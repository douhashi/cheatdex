import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	getDashboardTree,
	getPlatformGameOptions,
	getTokensForUser,
} from "../queries";
import { apiToken, cheatCode, game, platform, users } from "../schema";
import { createTestDb, type TestDb } from "./testdb";

/**
 * V2 / V3: 所有者スコープのダッシュボード一覧・PAT 一覧クエリを実 SQLite で検証する。
 * - 一覧は「自分の CheatCode を持つ範囲」のみ（他人のデータは不可視）。
 * - sharedWithOthers が共有判定を正しく返す。
 * - PAT 一覧は token_hash を返さない。
 */

let testDb: TestDb;
let db: TestDb["db"];

beforeEach(() => {
	testDb = createTestDb();
	db = testDb.db;
});

afterEach(() => {
	testDb.dispose();
});

async function seed() {
	await db.insert(users).values([
		{ id: "alice", email: "alice@example.com" },
		{ id: "bob", email: "bob@example.com" },
	]);
	const [ps2] = await db
		.insert(platform)
		.values({ slug: "ps2", name: "PlayStation 2" })
		.returning();
	const [solo] = await db
		.insert(game)
		.values({ platformId: ps2.id, title: "Alice Solo" })
		.returning();
	const [shared] = await db
		.insert(game)
		.values({ platformId: ps2.id, title: "Shared" })
		.returning();
	const [bobOnly] = await db
		.insert(game)
		.values({ platformId: ps2.id, title: "Bob Only" })
		.returning();
	await db.insert(cheatCode).values([
		{ userId: "alice", gameId: solo.id, name: "a-solo", code: "c" },
		{ userId: "alice", gameId: shared.id, name: "a-shared", code: "c" },
		{ userId: "bob", gameId: shared.id, name: "b-shared", code: "c" },
		{ userId: "bob", gameId: bobOnly.id, name: "b-only", code: "c" },
	]);
	return { ps2, solo, shared, bobOnly };
}

describe("getDashboardTree", () => {
	it("自分の CheatCode を持つ Game のみを階層で返す（他人専用 Game は不可視）", async () => {
		const { solo, shared, bobOnly } = await seed();
		const tree = await getDashboardTree(db, "alice");

		expect(tree).toHaveLength(1); // ps2 のみ
		const gameIds = tree[0].games.map((g) => g.id).sort();
		expect(gameIds).toEqual([solo.id, shared.id].sort());
		expect(gameIds).not.toContain(bobOnly.id);

		// 全 CheatCode は自分のものだけ。
		const allNames = tree[0].games.flatMap((g) =>
			g.cheatCodes.map((c) => c.name),
		);
		expect(allNames.sort()).toEqual(["a-shared", "a-solo"]);
	});

	it("sharedWithOthers: 他ユーザーの CheatCode の有無を正しく返す", async () => {
		const { solo, shared } = await seed();
		const tree = await getDashboardTree(db, "alice");
		const games = tree[0].games;
		expect(games.find((g) => g.id === solo.id)?.sharedWithOthers).toBe(false);
		expect(games.find((g) => g.id === shared.id)?.sharedWithOthers).toBe(true);
	});

	it("CheatCode が無いユーザーには空配列を返す", async () => {
		await db.insert(users).values({ id: "carol", email: "carol@example.com" });
		const tree = await getDashboardTree(db, "carol");
		expect(tree).toEqual([]);
	});
});

describe("getTokensForUser", () => {
	it("自分の PAT のみを返し、token_hash は含めない", async () => {
		await db.insert(users).values([
			{ id: "alice", email: "alice@example.com" },
			{ id: "bob", email: "bob@example.com" },
		]);
		await db.insert(apiToken).values([
			{ userId: "alice", name: "alice token", tokenHash: "hash-a" },
			{ userId: "bob", name: "bob token", tokenHash: "hash-b" },
		]);

		const tokens = await getTokensForUser(db, "alice");
		expect(tokens).toHaveLength(1);
		expect(tokens[0].name).toBe("alice token");
		expect(tokens[0]).not.toHaveProperty("tokenHash");
	});
});

describe("getPlatformGameOptions", () => {
	it("Platform / Game の全件を返す（手動登録の選択肢）", async () => {
		const { ps2 } = await seed();
		const options = await getPlatformGameOptions(db);
		expect(options.platforms.map((p) => p.id)).toContain(ps2.id);
		expect(options.games.length).toBe(3);
	});
});
