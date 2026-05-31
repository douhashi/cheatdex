import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/app/lib/db/__tests__/testdb";
import { cheatCode, game, platform, users } from "@/app/lib/db/schema";
import { updateGameCrc } from "../mutations";

/**
 * V6: CRC 編集の検証・所有者スコープを実 SQLite で検証する。
 * - 8 桁 hex 以外を拒否（行は変更されない）。
 * - 大文字化して保存／空文字で null に戻す。
 * - 他ユーザーの Game / 共有 Game は編集不可。
 */

let testDb: TestDb;
let db: TestDb["db"];
let gameId: number;

beforeEach(async () => {
	testDb = createTestDb();
	db = testDb.db;
	await db.insert(users).values([
		{ id: "owner", email: "owner@example.com" },
		{ id: "other", email: "other@example.com" },
	]);
	const [ps2] = await db
		.insert(platform)
		.values({ slug: "ps2", name: "PlayStation 2" })
		.returning();
	const [g] = await db
		.insert(game)
		.values({ platformId: ps2.id, title: "Owner Game" })
		.returning();
	gameId = g.id;
	await db
		.insert(cheatCode)
		.values({ userId: "owner", gameId, name: "C", code: "c" });
});

afterEach(() => {
	testDb.dispose();
});

async function readCrc(): Promise<string | null> {
	const [row] = await db
		.select({ crc: game.crc })
		.from(game)
		.where(eq(game.id, gameId));
	return row?.crc ?? null;
}

describe("updateGameCrc", () => {
	it("有効な CRC を大文字化して保存する", async () => {
		const result = await updateGameCrc(db, "owner", gameId, " abcd1234 ");
		expect(result.ok).toBe(true);
		expect(await readCrc()).toBe("ABCD1234");
	});

	it("空文字で CRC を未設定（null）に戻す", async () => {
		await updateGameCrc(db, "owner", gameId, "ABCD1234");
		const result = await updateGameCrc(db, "owner", gameId, "   ");
		expect(result.ok).toBe(true);
		expect(await readCrc()).toBeNull();
	});

	it("8 桁 hex 以外を拒否し、行を変更しない", async () => {
		const result = await updateGameCrc(db, "owner", gameId, "nothex");
		expect(result).toEqual({
			ok: false,
			error: "CRC は 8 桁の16進数で入力してください",
		});
		expect(await readCrc()).toBeNull();
	});

	it("自分の CheatCode が無い Game は編集不可（not found）", async () => {
		const result = await updateGameCrc(db, "other", gameId, "ABCD1234");
		expect(result).toEqual({ ok: false, error: "game not found" });
		expect(await readCrc()).toBeNull();
	});

	it("他ユーザーと共有する Game は編集不可", async () => {
		await db
			.insert(cheatCode)
			.values({ userId: "other", gameId, name: "Theirs", code: "c" });
		const result = await updateGameCrc(db, "owner", gameId, "ABCD1234");
		expect(result.ok).toBe(false);
		expect(await readCrc()).toBeNull();
	});
});
