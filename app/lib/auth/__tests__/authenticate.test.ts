import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/app/lib/db/__tests__/testdb";
import { users } from "@/app/lib/db/schema";

/**
 * V1: PAT 削除 → 401 の統合テスト（受け入れ基準の核）。
 *
 * 外部境界（Cloudflare D1 / Auth.js セッション）のみモックし、`authenticate`・
 * `revokeToken`・実 D1 を本物のまま通す（philosophy「外部境界に限定したモック」）。
 * 実 D1 は Miniflare（= 本番と同一の Cloudflare D1 実装）を使う。
 */

let testDb: TestDb;

// getDb は Cloudflare バインディング依存（外部境界）なのでテスト D1 に差し替える。
vi.mock("@/app/lib/db/client", () => ({
	getDb: () => testDb.db,
}));
// auth は Auth.js（外部境界）。セッション経路のテストでのみ戻り値を差し替える。
const authMock = vi.fn();
vi.mock("@/app/lib/auth/auth", () => ({
	auth: () => authMock(),
}));

async function seedUser(id: string): Promise<void> {
	await testDb.db.insert(users).values({ id, email: `${id}@example.com` });
}

beforeEach(() => {
	testDb = createTestDb();
	authMock.mockReset();
	authMock.mockResolvedValue(null);
});

afterEach(() => {
	testDb.dispose();
});

function bearerRequest(token: string): Request {
	return new Request("https://example.com/api/cheatcodes", {
		headers: { authorization: `Bearer ${token}` },
	});
}

describe("authenticate (PAT)", () => {
	it("削除前は有効な PAT で所有ユーザーを返し、物理削除後は 401(null) になる", async () => {
		const { issueToken, revokeToken } = await import("@/app/lib/auth/pat");
		const { authenticate } = await import("@/app/lib/auth/authenticate");
		await seedUser("user-1");

		const issued = await issueToken("user-1", "Chrome 拡張");

		// 削除前: 認証成功。
		const before = await authenticate(bearerRequest(issued.token));
		expect(before).toEqual({ id: "user-1" });

		// 物理削除（所有者スコープ）。
		const revoked = await revokeToken("user-1", issued.id);
		expect(revoked.ok).toBe(true);

		// 削除後: tokenHash 一致行が無く 401（null）。
		const after = await authenticate(bearerRequest(issued.token));
		expect(after).toBeNull();
	});

	it("存在しない PAT は 401(null)", async () => {
		const { authenticate } = await import("@/app/lib/auth/authenticate");
		const result = await authenticate(bearerRequest("cdx_not_a_real_token"));
		expect(result).toBeNull();
	});

	it("他人の PAT は削除できない（所有者スコープ）", async () => {
		const { issueToken, revokeToken } = await import("@/app/lib/auth/pat");
		const { authenticate } = await import("@/app/lib/auth/authenticate");
		await seedUser("owner");
		await seedUser("attacker");
		const issued = await issueToken("owner", "owner token");

		// 攻撃者として削除を試みる → 失敗。
		const revoked = await revokeToken("attacker", issued.id);
		expect(revoked.ok).toBe(false);

		// owner の PAT は依然有効。
		const result = await authenticate(bearerRequest(issued.token));
		expect(result).toEqual({ id: "owner" });
	});
});

describe("authenticate (session)", () => {
	it("Bearer が無ければセッションの user.id を返す", async () => {
		authMock.mockResolvedValue({ user: { id: "session-user" } });
		const { authenticate } = await import("@/app/lib/auth/authenticate");
		const result = await authenticate(
			new Request("https://example.com/api/cheatcodes"),
		);
		expect(result).toEqual({ id: "session-user" });
	});

	it("セッションが無ければ 401(null)", async () => {
		authMock.mockResolvedValue(null);
		const { authenticate } = await import("@/app/lib/auth/authenticate");
		const result = await authenticate(
			new Request("https://example.com/api/cheatcodes"),
		);
		expect(result).toBeNull();
	});
});
