import { unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildExport } from "@/app/lib/export/zip";
import { getGamesForExport } from "../queries";
import { cheatCode, game, platform, users } from "../schema";
import { createTestDb, type TestDb } from "./testdb";

/**
 * 実 SQLite（node:sqlite + 全 migration 適用）での export 統合テスト。
 * - V3: 全 migration 適用後に game.crc 列が存在する（CRC migration 再現性）。
 * - V4: getGamesForExport が他ユーザーの Game / CheatCode を含めない（所有者スコープ）。
 * - V6: CRC 未設定の Game は buildExport でスキップされる。
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

describe("CRC migration の再現性（V3）", () => {
	it("全 migration 適用後に game.crc 列が存在する", () => {
		const cols = testDb.sqlite
			.prepare("PRAGMA table_info(game)")
			.all() as Array<{ name: string }>;
		expect(cols.map((c) => c.name)).toContain("crc");
	});
});

async function seedTwoUsers() {
	await db.insert(users).values([
		{ id: "owner", email: "owner@example.com" },
		{ id: "other", email: "other@example.com" },
	]);
	const [ps2] = await db
		.insert(platform)
		.values({ slug: "ps2", name: "PlayStation 2" })
		.returning();
	const [ownerGame] = await db
		.insert(game)
		.values({ platformId: ps2.id, title: "Owner Game", crc: "AAAAAAAA" })
		.returning();
	const [otherGame] = await db
		.insert(game)
		.values({ platformId: ps2.id, title: "Other Game", crc: "BBBBBBBB" })
		.returning();
	await db.insert(cheatCode).values([
		{
			userId: "owner",
			gameId: ownerGame.id,
			name: "Owner Cheat",
			code: "patch=1,EE,00000000,word,00000001",
		},
		{
			userId: "other",
			gameId: otherGame.id,
			name: "Other Cheat",
			code: "patch=1,EE,11111111,word,00000002",
		},
	]);
	return { ownerGame, otherGame };
}

describe("getGamesForExport の所有者スコープ（V4）", () => {
	it("他ユーザーの Game / CheatCode を export に含めない", async () => {
		await seedTwoUsers();

		const rows = await getGamesForExport(db, "owner");
		const { zip, included } = buildExport(rows);
		const entries = unzipSync(zip);

		expect(Object.keys(entries)).toEqual(["cheats/AAAAAAAA.pnach"]);
		expect(Object.keys(entries)).not.toContain("cheats/BBBBBBBB.pnach");
		expect(included.map((g) => g.title)).toEqual(["Owner Game"]);
	});

	it("同一 Game に両者のチートがあっても自分のチートのみ出力する", async () => {
		await db.insert(users).values([
			{ id: "owner", email: "owner@example.com" },
			{ id: "other", email: "other@example.com" },
		]);
		const [ps2] = await db
			.insert(platform)
			.values({ slug: "ps2", name: "PlayStation 2" })
			.returning();
		const [shared] = await db
			.insert(game)
			.values({ platformId: ps2.id, title: "Shared", crc: "CCCCCCCC" })
			.returning();
		await db.insert(cheatCode).values([
			{
				userId: "owner",
				gameId: shared.id,
				name: "Mine",
				code: "patch=1,EE,00000000,word,00000001",
			},
			{
				userId: "other",
				gameId: shared.id,
				name: "Theirs",
				code: "patch=1,EE,11111111,word,00000002",
			},
		]);

		const rows = await getGamesForExport(db, "owner");
		const names = rows.flatMap((r) => r.cheatCodes.map((c) => c.name));
		expect(names).toEqual(["Mine"]);
		expect(names).not.toContain("Theirs");
	});
});

describe("CRC 未設定 Game のスキップ（V6）", () => {
	it("自分の Game でも CRC 未設定なら zip に含めない", async () => {
		await db.insert(users).values({ id: "owner", email: "owner@example.com" });
		const [ps2] = await db
			.insert(platform)
			.values({ slug: "ps2", name: "PlayStation 2" })
			.returning();
		const [g] = await db
			.insert(game)
			.values({ platformId: ps2.id, title: "No CRC" })
			.returning();
		await db.insert(cheatCode).values({
			userId: "owner",
			gameId: g.id,
			name: "C",
			code: "patch=1,EE,0,word,1",
		});

		const rows = await getGamesForExport(db, "owner");
		const { zip, skipped } = buildExport(rows);

		expect(Object.keys(unzipSync(zip))).toHaveLength(0);
		expect(skipped[0].reason).toBe("no-crc");
	});
});
