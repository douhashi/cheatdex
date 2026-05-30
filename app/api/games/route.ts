import { asc, eq } from "drizzle-orm";
import { authenticate } from "@/app/lib/auth/authenticate";
import { getDb } from "@/app/lib/db/client";
import { game, platform } from "@/app/lib/db/schema";
import { badRequest, json, unauthorized } from "@/app/lib/http";

/**
 * GET /api/games — ゲーム一覧（マスタ）
 */
export async function GET(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}
	const db = getDb();
	const games = await db.select().from(game).orderBy(asc(game.title));
	return json({ games });
}

/**
 * POST /api/games — ゲーム登録（既存 platform_id 必須、find-or-create はしない）
 * body: { platform_id: number, title: string }
 */
export async function POST(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}
	const body = (await req.json().catch(() => null)) as {
		platform_id?: unknown;
		title?: unknown;
	} | null;
	const platformId = body?.platform_id;
	const title = body?.title;
	if (typeof platformId !== "number" || !Number.isInteger(platformId)) {
		return badRequest("platform_id is required");
	}
	if (typeof title !== "string" || title.trim() === "") {
		return badRequest("title is required");
	}

	const db = getDb();
	const exists = await db
		.select({ id: platform.id })
		.from(platform)
		.where(eq(platform.id, platformId))
		.limit(1);
	if (exists.at(0) === undefined) {
		return badRequest("platform_id does not exist");
	}

	const [created] = await db
		.insert(game)
		.values({ platformId, title: title.trim() })
		.returning();
	return json(created, 201);
}
