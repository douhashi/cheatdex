import { describe, expect, it, vi } from "vitest";
import {
	buildBulkPayload,
	type CheatInput,
	submitBulk,
} from "../src/lib/api-client";

const cheats: CheatInput[] = [
	{ name: "Infinite HP", code: "1456E7A8 0000270F" },
	{ name: "Max Gil", code: "0456D120 05F5E0FF", description: "  money  " },
	{ name: "Empty Desc", code: "AAAA1111 2222", description: "   " },
];

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/** fetch シグネチャを持つ typed モックを作る（calls の引数を型付けするため）。 */
function mockFetch(
	impl: (...args: Parameters<typeof fetch>) => Promise<Response>,
) {
	return vi.fn(impl);
}

describe("buildBulkPayload (V3/V7)", () => {
	it("game_id と items を整形し、空 description は省略する", () => {
		const payload = buildBulkPayload(42, cheats);
		expect(payload.game_id).toBe(42);
		expect(payload.items).toEqual([
			{ name: "Infinite HP", code: "1456E7A8 0000270F" },
			{ name: "Max Gil", code: "0456D120 05F5E0FF", description: "money" },
			{ name: "Empty Desc", code: "AAAA1111 2222" },
		]);
	});
});

describe("submitBulk (V3/V5)", () => {
	const base = {
		baseUrl: "https://cheatdex.example.com",
		pat: "cdx_valid",
		gameId: 42,
		cheats,
	};

	it("201 で成功し count を返す。Bearer と payload を正しく送る", async () => {
		const fetchMock = mockFetch(async () =>
			jsonResponse(201, { created: [], count: 3 }),
		);
		const result = await submitBulk(base, fetchMock);

		expect(result).toEqual({ ok: true, count: 3 });
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://cheatdex.example.com/api/cheatcodes/bulk");
		expect(init?.method).toBe("POST");
		expect((init?.headers as Record<string, string>).Authorization).toBe(
			"Bearer cdx_valid",
		);
		const sent = JSON.parse(init?.body as string);
		expect(sent.game_id).toBe(42);
		expect(sent.items).toHaveLength(3);
	});

	it("30 件以上を 1 リクエストで送信できる（受け入れ基準2）", async () => {
		const many: CheatInput[] = Array.from({ length: 35 }, (_, i) => ({
			name: `Cheat ${i}`,
			code: `CODE${i}`,
		}));
		const fetchMock = mockFetch(async () => jsonResponse(201, { count: 35 }));
		const result = await submitBulk({ ...base, cheats: many }, fetchMock);

		expect(result).toEqual({ ok: true, count: 35 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const sent = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
		expect(sent.items).toHaveLength(35);
	});

	it("baseUrl 末尾スラッシュを正規化する", async () => {
		const fetchMock = mockFetch(async () => jsonResponse(201, { count: 3 }));
		await submitBulk(
			{ ...base, baseUrl: "https://cheatdex.example.com/" },
			fetchMock,
		);
		expect(fetchMock.mock.calls[0][0]).toBe(
			"https://cheatdex.example.com/api/cheatcodes/bulk",
		);
	});

	it("PAT 未設定なら送信せず unauthorized を返す", async () => {
		const fetchMock = mockFetch(async () => jsonResponse(201, { count: 3 }));
		const result = await submitBulk({ ...base, pat: "" }, fetchMock);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.unauthorized).toBe(true);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("401 を unauthorized として通知する（受け入れ基準3）", async () => {
		const fetchMock = mockFetch(async () =>
			jsonResponse(401, { error: "Unauthorized" }),
		);
		const result = await submitBulk(base, fetchMock);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.unauthorized).toBe(true);
			expect(result.status).toBe(401);
			expect(result.message).toMatch(/PAT/);
		}
	});

	it("400 エラーメッセージ（{ error }）を表示用に整形する", async () => {
		const fetchMock = mockFetch(async () =>
			jsonResponse(400, { error: "items[1]: code is required" }),
		);
		const result = await submitBulk(base, fetchMock);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.unauthorized).toBe(false);
			expect(result.status).toBe(400);
			expect(result.message).toContain("items[1]: code is required");
		}
	});

	it("ネットワークエラーを握りつぶさず返す", async () => {
		const fetchMock = mockFetch(async () => {
			throw new Error("network down");
		});
		const result = await submitBulk(base, fetchMock);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.unauthorized).toBe(false);
			expect(result.message).toContain("network down");
		}
	});

	it("空選択は送信せずエラー", async () => {
		const fetchMock = mockFetch(async () => jsonResponse(201, { count: 0 }));
		const result = await submitBulk({ ...base, cheats: [] }, fetchMock);
		expect(result.ok).toBe(false);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
