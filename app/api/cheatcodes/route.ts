import { desc, eq } from "drizzle-orm";
import { authenticate } from "@/app/lib/auth/authenticate";
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
 */
export async function POST(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}
	const body = (await req.json().catch(() => null)) as {
		game_id?: unknown;
		name?: unknown;
		code?: unknown;
		description?: unknown;
	} | null;
	const gameId = body?.game_id;
	const name = body?.name;
	const code = body?.code;
	const description = body?.description;
	if (typeof gameId !== "number" || !Number.isInteger(gameId)) {
		return badRequest("game_id is required");
	}
	if (typeof name !== "string" || name.trim() === "") {
		return badRequest("name is required");
	}
	if (typeof code !== "string" || code.trim() === "") {
		return badRequest("code is required");
	}
	if (description !== undefined && typeof description !== "string") {
		return badRequest("description must be a string");
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
		.values({
			userId: user.id,
			gameId,
			name: name.trim(),
			code,
			description: description ?? null,
		})
		.returning();
	return json(created, 201);
}
