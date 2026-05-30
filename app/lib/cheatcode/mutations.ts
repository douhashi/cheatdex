import { and, eq, ne } from "drizzle-orm";
import type { Db } from "../db/client";
import { cheatCode, game } from "../db/schema";
import type { ValidCheatCodeItem } from "./validate";

/**
 * 所有者スコープの CheatCode / Game ミューテーション（SSoT）。
 *
 * すべて「ログインユーザーが所有する CheatCode のみ」を対象とし、
 * 他者データには触れない。Server Actions から再利用する。
 * 入力検証は `validateCheatCodeItem`（DRY）を呼び出し側で済ませた
 * `ValidCheatCodeItem` を受け取る。
 *
 * Game は全ユーザー共有マスタ（game.userId なし）。ダッシュボード上の
 * Game 操作セマンティクスは docs/development/data-model.md を参照。
 * 他人の id を指定したら not found（存在秘匿。403 と区別しない = 論点 5）。
 */

export type MutationResult = { ok: true } | { ok: false; error: string };

/**
 * CheatCode を編集する（name / code / description）。自分が所有する行のみ。
 */
export async function updateCheatCode(
	db: Db,
	userId: string,
	id: number,
	input: ValidCheatCodeItem,
): Promise<MutationResult> {
	const updated = await db
		.update(cheatCode)
		.set({
			name: input.name,
			code: input.code,
			description: input.description,
			updatedAt: Date.now(),
		})
		.where(and(eq(cheatCode.id, id), eq(cheatCode.userId, userId)))
		.returning({ id: cheatCode.id });
	if (updated.length === 0) return { ok: false, error: "cheat code not found" };
	return { ok: true };
}

/**
 * CheatCode の有効/無効を設定する。自分が所有する行のみ。
 */
export async function setCheatCodeEnabled(
	db: Db,
	userId: string,
	id: number,
	enabled: boolean,
): Promise<MutationResult> {
	const updated = await db
		.update(cheatCode)
		.set({ enabled, updatedAt: Date.now() })
		.where(and(eq(cheatCode.id, id), eq(cheatCode.userId, userId)))
		.returning({ id: cheatCode.id });
	if (updated.length === 0) return { ok: false, error: "cheat code not found" };
	return { ok: true };
}

/**
 * CheatCode を削除する。自分が所有する行のみ。
 */
export async function deleteCheatCode(
	db: Db,
	userId: string,
	id: number,
): Promise<MutationResult> {
	const deleted = await db
		.delete(cheatCode)
		.where(and(eq(cheatCode.id, id), eq(cheatCode.userId, userId)))
		.returning({ id: cheatCode.id });
	if (deleted.length === 0) return { ok: false, error: "cheat code not found" };
	return { ok: true };
}

/**
 * CheatCode を手動登録する。既存 Game への紐付け（Game は共有マスタ）。
 * 所有者は userId。Game が存在しない場合は not found。
 */
export async function createCheatCode(
	db: Db,
	userId: string,
	gameId: number,
	input: ValidCheatCodeItem,
): Promise<MutationResult> {
	const games = await db
		.select({ id: game.id })
		.from(game)
		.where(eq(game.id, gameId))
		.limit(1);
	if (games.at(0) === undefined) return { ok: false, error: "game not found" };

	await db.insert(cheatCode).values({
		userId,
		gameId,
		name: input.name,
		code: input.code,
		description: input.description,
	});
	return { ok: true };
}

/**
 * 指定 Game に他ユーザーの CheatCode が存在するか。
 */
async function hasOtherOwnerCheatCodes(
	db: Db,
	userId: string,
	gameId: number,
): Promise<boolean> {
	const others = await db
		.select({ id: cheatCode.id })
		.from(cheatCode)
		.where(and(eq(cheatCode.gameId, gameId), ne(cheatCode.userId, userId)))
		.limit(1);
	return others.length > 0;
}

/**
 * Game の title を編集する。
 * 他ユーザーの CheatCode が 1 件でもある場合は不可（共有マスタ保護）。
 * かつ自分の CheatCode を 1 件以上持つ Game のみ対象（所有者スコープ）。
 */
export async function updateGameTitle(
	db: Db,
	userId: string,
	gameId: number,
	title: string,
): Promise<MutationResult> {
	const trimmed = title.trim();
	if (trimmed === "") return { ok: false, error: "title is required" };

	const mine = await db
		.select({ id: cheatCode.id })
		.from(cheatCode)
		.where(and(eq(cheatCode.gameId, gameId), eq(cheatCode.userId, userId)))
		.limit(1);
	if (mine.at(0) === undefined) return { ok: false, error: "game not found" };

	if (await hasOtherOwnerCheatCodes(db, userId, gameId)) {
		return {
			ok: false,
			error: "他のユーザーも利用している Game のため編集できません",
		};
	}

	await db.update(game).set({ title: trimmed }).where(eq(game.id, gameId));
	return { ok: true };
}

/**
 * Game 配下の「自分の CheatCode」を全削除する（= 自分の視点からの Game 削除）。
 * 共有 game 行は、削除後に誰も参照しなくなった場合のみ削除する（最小）。
 * 他ユーザーの CheatCode には触れない。
 */
export async function deleteGameCheatCodes(
	db: Db,
	userId: string,
	gameId: number,
): Promise<MutationResult> {
	const deleted = await db
		.delete(cheatCode)
		.where(and(eq(cheatCode.gameId, gameId), eq(cheatCode.userId, userId)))
		.returning({ id: cheatCode.id });
	if (deleted.length === 0) return { ok: false, error: "game not found" };

	// 誰も参照しなくなったら共有 game 行を削除（任意・最小）。
	const remaining = await db
		.select({ id: cheatCode.id })
		.from(cheatCode)
		.where(eq(cheatCode.gameId, gameId))
		.limit(1);
	if (remaining.at(0) === undefined) {
		await db.delete(game).where(eq(game.id, gameId));
	}
	return { ok: true };
}
