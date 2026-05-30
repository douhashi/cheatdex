import { asc, eq } from "drizzle-orm";
import type { Db } from "./client";
import type { CheatCode, Game, Platform } from "./schema";
import { apiToken, cheatCode, game, platform } from "./schema";

/**
 * 所有者スコープの DB クエリ集約（SSoT / 論点 5・7）。
 *
 * Server Component（ダッシュボード）と Server Actions から再利用する。
 * Game / Platform は全ユーザー共有マスタだが、ダッシュボード表示は
 * 「ログインユーザーが CheatCode を持つ範囲」に限定する（補足設計判断）。
 */

export type DashboardGame = {
	id: number;
	title: string;
	/** この Game に他ユーザーの CheatCode が存在するか（編集可否判定に使う）。 */
	sharedWithOthers: boolean;
	cheatCodes: CheatCode[];
};

export type DashboardPlatform = {
	id: number;
	name: string;
	games: DashboardGame[];
};

/**
 * ログインユーザーの CheatCode を Platform > Game > CheatCode の階層で返す。
 * 自分の CheatCode が 1 件も無い Platform / Game は含めない。
 */
export async function getDashboardTree(
	db: Db,
	userId: string,
): Promise<DashboardPlatform[]> {
	const myCodes = await db
		.select()
		.from(cheatCode)
		.where(eq(cheatCode.userId, userId))
		.orderBy(asc(cheatCode.createdAt));
	if (myCodes.length === 0) return [];

	const games = await db.select().from(game).orderBy(asc(game.title));
	const platforms = await db
		.select()
		.from(platform)
		.orderBy(asc(platform.name));

	// 各 Game に他ユーザーの CheatCode が存在するかを判定する。
	const myGameIds = new Set(myCodes.map((c) => c.gameId));
	const allCodes = await db
		.select({ gameId: cheatCode.gameId, userId: cheatCode.userId })
		.from(cheatCode);
	const otherOwnerGameIds = new Set<number>();
	for (const row of allCodes) {
		if (myGameIds.has(row.gameId) && row.userId !== userId) {
			otherOwnerGameIds.add(row.gameId);
		}
	}

	const gameById = new Map(games.map((g) => [g.id, g]));

	// platformId -> gameId -> codes
	const tree = new Map<number, Map<number, CheatCode[]>>();
	for (const code of myCodes) {
		const g = gameById.get(code.gameId);
		if (!g) continue;
		if (!tree.has(g.platformId)) tree.set(g.platformId, new Map());
		const gameMap = tree.get(g.platformId);
		if (!gameMap) continue;
		if (!gameMap.has(g.id)) gameMap.set(g.id, []);
		gameMap.get(g.id)?.push(code);
	}

	const result: DashboardPlatform[] = [];
	for (const p of platforms) {
		const gameMap = tree.get(p.id);
		if (!gameMap) continue;
		const dashGames: DashboardGame[] = [];
		for (const g of games) {
			if (g.platformId !== p.id) continue;
			const codes = gameMap.get(g.id);
			if (!codes) continue;
			dashGames.push({
				id: g.id,
				title: g.title,
				sharedWithOthers: otherOwnerGameIds.has(g.id),
				cheatCodes: codes,
			});
		}
		if (dashGames.length === 0) continue;
		result.push({ id: p.id, name: p.name, games: dashGames });
	}
	return result;
}

/**
 * ログインユーザーの PAT 一覧を返す（token_hash は返さない）。
 */
export function getTokensForUser(db: Db, userId: string) {
	return db
		.select({
			id: apiToken.id,
			name: apiToken.name,
			createdAt: apiToken.createdAt,
			lastUsedAt: apiToken.lastUsedAt,
		})
		.from(apiToken)
		.where(eq(apiToken.userId, userId))
		.orderBy(asc(apiToken.createdAt));
}

/**
 * 手動登録フォーム用: 選択肢となる Platform / Game の一覧を返す。
 * Game は共有マスタなので全件返す（手動登録は既存 Game への紐付け）。
 */
export async function getPlatformGameOptions(
	db: Db,
): Promise<{ platforms: Platform[]; games: Game[] }> {
	const platforms = await db
		.select()
		.from(platform)
		.orderBy(asc(platform.name));
	const games = await db.select().from(game).orderBy(asc(game.title));
	return { platforms, games };
}
