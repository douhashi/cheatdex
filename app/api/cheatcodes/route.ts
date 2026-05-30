import { desc, eq } from "drizzle-orm";
import { authenticate } from "@/app/lib/auth/authenticate";
import { validateCheatCodeItem } from "@/app/lib/cheatcode/validate";
import { getDb } from "@/app/lib/db/client";
import { cheatCode, game } from "@/app/lib/db/schema";
import { badRequest, json, unauthorized } from "@/app/lib/http";

/**
 * GET /api/cheatcodes — 自分のチートコード一覧（所有者のみ）
 */
export async function GET(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}
	const db = getDb();
	const cheatcodes = await db
		.select()
		.from(cheatCode)
		.where(eq(cheatCode.userId, user.id))
		.orderBy(desc(cheatCode.createdAt));
	return json({ cheatcodes });
}

/**
 * POST /api/cheatcodes — チートコード登録（既存 game_id 必須）
 * body: { game_id: number, name: string, code: string, description?: string }
 *
 * 入力検証は bulk と共通の `validateCheatCodeItem` を用いる（DRY）。
 */
export async function POST(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}
	const body = (await req.json().catch(() => null)) as {
		game_id?: unknown;
	} | null;
	const gameId = body?.game_id;
	if (typeof gameId !== "number" || !Number.isInteger(gameId)) {
		return badRequest("game_id is required");
	}

	const validated = validateCheatCodeItem(body);
	if (!validated.ok) {
		return badRequest(validated.reason);
	}

	const db = getDb();
	const exists = await db
		.select({ id: game.id })
		.from(game)
		.where(eq(game.id, gameId))
		.limit(1);
	if (exists.at(0) === undefined) {
		return badRequest("game_id does not exist");
	}

	const [created] = await db
		.insert(cheatCode)
		.values({ userId: user.id, gameId, ...validated.value })
		.returning();
	return json(created, 201);
}
