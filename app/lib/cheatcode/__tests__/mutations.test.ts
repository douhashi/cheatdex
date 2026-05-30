import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "@/app/lib/db/__tests__/testdb";
import { cheatCode, game, platform, users } from "@/app/lib/db/schema";
import {
	createCheatCode,
	deleteCheatCode,
	deleteGameCheatCodes,
	setCheatCodeEnabled,
	updateCheatCode,
	updateGameTitle,
} from "../mutations";

/**
 * V3 / V4 / V6: CheatCode・Game ミューテーションの所有者スコープ・enabled・
 * Game 操作セマンティクスを実 SQLite（node:sqlite）で検証する。
 */

let testDb: TestDb;
let db: TestDb["db"];

async function seed() {
	await db.insert(users).values([
		{ id: "alice", email: "alice@example.com" },
		{ id: "bob", email: "bob@example.com" },
	]);
	const [ps2] = await db
		.insert(platform)
		.values({ slug: "ps2", name: "PlayStation 2" })
		.returning();
	const [soloGame] = await db
		.insert(game)
		.values({ platformId: ps2.id, title: "Solo Game" })
		.returning();
	const [sharedGame] = await db
		.insert(game)
		.values({ platformId: ps2.id, title: "Shared Game" })
		.returning();
	return { ps2, soloGame, sharedGame };
}

beforeEach(() => {
	testDb = createTestDb();
	db = testDb.db;
});

afterEach(() => {
	testDb.dispose();
});

describe("createCheatCode", () => {
	it("既存 Game に自分の CheatCode を登録できる（enabled は既定 true）", async () => {
		const { soloGame } = await seed();
		const result = await createCheatCode(db, "alice", soloGame.id, {
			name: "Infinite HP",
			code: "ABCD-1234",
			description: null,
		});
		expect(result).toEqual({ ok: true });

		const rows = await db
			.select()
			.from(cheatCode)
			.where(eq(cheatCode.userId, "alice"));
		expect(rows).toHaveLength(1);
		expect(rows[0].name).toBe("Infinite HP");
		expect(rows[0].enabled).toBe(true);
	});

	it("存在しない Game には登録できない", async () => {
		await seed();
		const result = await createCheatCode(db, "alice", 99999, {
			name: "x",
			code: "y",
			description: null,
		});
		expect(result).toEqual({ ok: false, error: "game not found" });
	});
});

describe("updateCheatCode / setCheatCodeEnabled / deleteCheatCode", () => {
	it("自分の CheatCode を編集・トグル・削除できる", async () => {
		const { soloGame } = await seed();
		const [cc] = await db
			.insert(cheatCode)
			.values({ userId: "alice", gameId: soloGame.id, name: "old", code: "c" })
			.returning();

		expect(
			await updateCheatCode(db, "alice", cc.id, {
				name: "new",
				code: "c2",
				description: "memo",
			}),
		).toEqual({ ok: true });
		expect(await setCheatCodeEnabled(db, "alice", cc.id, false)).toEqual({
			ok: true,
		});

		const [after] = await db
			.select()
			.from(cheatCode)
			.where(eq(cheatCode.id, cc.id));
		expect(after.name).toBe("new");
		expect(after.code).toBe("c2");
		expect(after.enabled).toBe(false);

		expect(await deleteCheatCode(db, "alice", cc.id)).toEqual({ ok: true });
		const remaining = await db
			.select()
			.from(cheatCode)
			.where(eq(cheatCode.id, cc.id));
		expect(remaining).toHaveLength(0);
	});

	it("他人の CheatCode は編集・トグル・削除できない（not found）", async () => {
		const { soloGame } = await seed();
		const [cc] = await db
			.insert(cheatCode)
			.values({
				userId: "alice",
				gameId: soloGame.id,
				name: "alice secret",
				code: "c",
			})
			.returning();

		expect(
			await updateCheatCode(db, "bob", cc.id, {
				name: "hacked",
				code: "x",
				description: null,
			}),
		).toEqual({ ok: false, error: "cheat code not found" });
		expect(await setCheatCodeEnabled(db, "bob", cc.id, false)).toEqual({
			ok: false,
			error: "cheat code not found",
		});
		expect(await deleteCheatCode(db, "bob", cc.id)).toEqual({
			ok: false,
			error: "cheat code not found",
		});

		const [after] = await db
			.select()
			.from(cheatCode)
			.where(eq(cheatCode.id, cc.id));
		expect(after.name).toBe("alice secret");
		expect(after.enabled).toBe(true);
	});
});

describe("updateGameTitle (単独所有時のみ可)", () => {
	it("自分のみが CheatCode を持つ Game は title 編集できる", async () => {
		const { soloGame } = await seed();
		await db
			.insert(cheatCode)
			.values({ userId: "alice", gameId: soloGame.id, name: "a", code: "c" });
		expect(await updateGameTitle(db, "alice", soloGame.id, "Renamed")).toEqual({
			ok: true,
		});
		const [g] = await db.select().from(game).where(eq(game.id, soloGame.id));
		expect(g.title).toBe("Renamed");
	});

	it("他ユーザーの CheatCode がある共有 Game は編集できない", async () => {
		const { sharedGame } = await seed();
		await db.insert(cheatCode).values([
			{ userId: "alice", gameId: sharedGame.id, name: "a", code: "c" },
			{ userId: "bob", gameId: sharedGame.id, name: "b", code: "c" },
		]);
		const result = await updateGameTitle(db, "alice", sharedGame.id, "Renamed");
		expect(result.ok).toBe(false);

		const [g] = await db.select().from(game).where(eq(game.id, sharedGame.id));
		expect(g.title).toBe("Shared Game");
	});

	it("自分の CheatCode を持たない Game は編集できない（not found）", async () => {
		const { soloGame } = await seed();
		expect(await updateGameTitle(db, "alice", soloGame.id, "x")).toEqual({
			ok: false,
			error: "game not found",
		});
	});
});

describe("deleteGameCheatCodes (自分の視点からの Game 削除)", () => {
	it("共有 Game では自分の CheatCode のみ消え、他者のと game 行は残る", async () => {
		const { sharedGame } = await seed();
		await db.insert(cheatCode).values([
			{ userId: "alice", gameId: sharedGame.id, name: "a1", code: "c" },
			{ userId: "alice", gameId: sharedGame.id, name: "a2", code: "c" },
			{ userId: "bob", gameId: sharedGame.id, name: "b1", code: "c" },
		]);

		expect(await deleteGameCheatCodes(db, "alice", sharedGame.id)).toEqual({
			ok: true,
		});

		const aliceLeft = await db
			.select()
			.from(cheatCode)
			.where(eq(cheatCode.userId, "alice"));
		expect(aliceLeft).toHaveLength(0);
		const bobLeft = await db
			.select()
			.from(cheatCode)
			.where(eq(cheatCode.userId, "bob"));
		expect(bobLeft).toHaveLength(1);
		const games = await db
			.select()
			.from(game)
			.where(eq(game.id, sharedGame.id));
		expect(games).toHaveLength(1);
	});

	it("単独所有 Game では誰も参照しなくなり game 行も掃除される", async () => {
		const { soloGame } = await seed();
		await db
			.insert(cheatCode)
			.values({ userId: "alice", gameId: soloGame.id, name: "a", code: "c" });
		expect(await deleteGameCheatCodes(db, "alice", soloGame.id)).toEqual({
			ok: true,
		});
		const games = await db.select().from(game).where(eq(game.id, soloGame.id));
		expect(games).toHaveLength(0);
	});

	it("自分の CheatCode を持たない Game は削除できない（not found）", async () => {
		const { soloGame } = await seed();
		await db
			.insert(cheatCode)
			.values({ userId: "bob", gameId: soloGame.id, name: "b", code: "c" });
		expect(await deleteGameCheatCodes(db, "alice", soloGame.id)).toEqual({
			ok: false,
			error: "game not found",
		});
		const bobLeft = await db
			.select()
			.from(cheatCode)
			.where(eq(cheatCode.userId, "bob"));
		expect(bobLeft).toHaveLength(1);
	});
});
