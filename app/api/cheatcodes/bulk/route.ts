import { eq } from "drizzle-orm";
import { authenticate } from "@/app/lib/auth/authenticate";
import { validateCheatCodeItems } from "@/app/lib/cheatcode/validate";
import { getDb } from "@/app/lib/db/client";
import { cheatCode, game } from "@/app/lib/db/schema";
import { badRequest, json, unauthorized } from "@/app/lib/http";

/**
 * POST /api/cheatcodes/bulk — チートコードの一括登録。
 *
 * Game / Platform はトップレベルで 1 度だけ指定し、複数 item を 1 回の
 * バッチ挿入で登録する（architecture.md「Game と Platform を 1 度だけ指定して bulk 送信」）。
 *
 * body: { game_id: number, items: [{ name, code, description? }] }（items 最大 200 件）
 *
 * 部分失敗ポリシーは all-or-nothing:
 * 全 items を先に検証し、1 件でも不正なら何も挿入せず 400（不正 index と理由）を返す。
 */
export async function POST(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}

	const body = (await req.json().catch(() => null)) as {
		game_id?: unknown;
		items?: unknown;
	} | null;

	const gameId = body?.game_id;
	if (typeof gameId !== "number" || !Number.isInteger(gameId)) {
		return badRequest("game_id is required");
	}

	const validated = validateCheatCodeItems(body?.items);
	if (!validated.ok) {
		return badRequest(
			validated.index >= 0
				? `items[${validated.index}]: ${validated.reason}`
				: validated.reason,
		);
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

	const created = await db
		.insert(cheatCode)
		.values(
			validated.values.map((item) => ({
				userId: user.id,
				gameId,
				...item,
			})),
		)
		.returning();

	return json({ created, count: created.length }, 201);
}
