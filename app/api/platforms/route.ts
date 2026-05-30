import { asc } from "drizzle-orm";
import { authenticate } from "@/app/lib/auth/authenticate";
import { getDb } from "@/app/lib/db/client";
import { platform } from "@/app/lib/db/schema";
import { json, unauthorized } from "@/app/lib/http";

/**
 * GET /api/platforms — プラットフォーム一覧（全ユーザー共有のマスタ）
 */
export async function GET(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}
	const db = getDb();
	const platforms = await db
		.select()
		.from(platform)
		.orderBy(asc(platform.name));
	return json({ platforms });
}
