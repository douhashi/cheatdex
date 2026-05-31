import { strFromU8, unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameExport } from "@/app/lib/export/zip";

/**
 * V5: GET /api/export のレスポンスヘッダと未認証 401 を検証する。
 *
 * 外部境界（認証 = セッション/PAT、D1 クライアント）のみモックする。
 * zip 生成・所有者フィルタ等の自プロジェクトのロジックは実体を通す。
 */
const authenticate = vi.fn();
const getGamesForExport = vi.fn();

vi.mock("@/app/lib/auth/authenticate", () => ({
	authenticate: (...args: unknown[]) => authenticate(...args),
}));
vi.mock("@/app/lib/db/client", () => ({
	getDb: () => ({}) as never,
}));
vi.mock("@/app/lib/db/queries", () => ({
	getGamesForExport: (...args: unknown[]) => getGamesForExport(...args),
}));

import { GET } from "./route";

afterEach(() => {
	vi.clearAllMocks();
});

function req(): Request {
	return new Request("https://example.com/api/export");
}

function gameExport(overrides?: Partial<GameExport>): GameExport {
	return {
		game: {
			id: 1,
			platformId: 1,
			title: "G",
			crc: "AAAAAAAA",
			createdAt: 0,
		},
		cheatCodes: [
			{
				id: 1,
				userId: "u",
				gameId: 1,
				name: "C",
				code: "patch=1,EE,00000000,word,00000001",
				description: null,
				enabled: true,
				createdAt: 0,
				updatedAt: 0,
			},
		],
		...overrides,
	};
}

describe("GET /api/export", () => {
	it("未認証は 401 を返し、DB を引かない", async () => {
		authenticate.mockResolvedValue(null);

		const res = await GET(req());

		expect(res.status).toBe(401);
		expect(getGamesForExport).not.toHaveBeenCalled();
	});

	it("認証済みなら zip と attachment ヘッダを返す", async () => {
		authenticate.mockResolvedValue({ id: "u" });
		getGamesForExport.mockResolvedValue([gameExport()]);

		const res = await GET(req());

		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/zip");
		expect(res.headers.get("Content-Disposition")).toMatch(
			/^attachment; filename="cheatdex-ps2-\d{8}\.zip"$/,
		);

		const buf = new Uint8Array(await res.arrayBuffer());
		const entries = unzipSync(buf);
		expect(Object.keys(entries)).toEqual(["cheats/AAAAAAAA.pnach"]);
		expect(strFromU8(entries["cheats/AAAAAAAA.pnach"])).toContain(
			"gametitle=G",
		);
	});

	it("クエリを認証ユーザー id でスコープする", async () => {
		authenticate.mockResolvedValue({ id: "user-42" });
		getGamesForExport.mockResolvedValue([]);

		await GET(req());

		expect(getGamesForExport).toHaveBeenCalledWith(
			expect.anything(),
			"user-42",
		);
	});

	it("スキップ件数を header で通知する", async () => {
		authenticate.mockResolvedValue({ id: "u" });
		getGamesForExport.mockResolvedValue([
			gameExport(),
			gameExport({
				game: {
					id: 2,
					platformId: 1,
					title: "No CRC",
					crc: null,
					createdAt: 0,
				},
			}),
		]);

		const res = await GET(req());

		expect(res.headers.get("X-Cheatdex-Skipped")).toBe("1");
	});
});
