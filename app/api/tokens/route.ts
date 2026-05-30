import { desc, eq } from "drizzle-orm";
import { authenticate } from "@/app/lib/auth/authenticate";
import { generateToken, hashToken } from "@/app/lib/auth/pat";
import { getDb } from "@/app/lib/db/client";
import { apiToken } from "@/app/lib/db/schema";
import { badRequest, json, unauthorized } from "@/app/lib/http";

/**
 * GET /api/tokens — 自分の PAT 一覧（token_hash は返さない）
 */
export async function GET(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}
	const db = getDb();
	const tokens = await db
		.select({
			id: apiToken.id,
			name: apiToken.name,
			createdAt: apiToken.createdAt,
			lastUsedAt: apiToken.lastUsedAt,
		})
		.from(apiToken)
		.where(eq(apiToken.userId, user.id))
		.orderBy(desc(apiToken.createdAt));
	return json({ tokens });
}

/**
 * POST /api/tokens — PAT 発行。平文トークンはこのレスポンスで 1 度だけ返す。
 * body: { name: string }
 */
export async function POST(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}
	const body = (await req.json().catch(() => null)) as {
		name?: unknown;
	} | null;
	const name = body?.name;
	if (typeof name !== "string" || name.trim() === "") {
		return badRequest("name is required");
	}

	const plain = generateToken();
	const tokenHash = await hashToken(plain);
	const db = getDb();
	const [created] = await db
		.insert(apiToken)
		.values({ userId: user.id, name: name.trim(), tokenHash })
		.returning({ id: apiToken.id, name: apiToken.name });

	// 平文 (token) はここでのみ返す。以降は再取得不可。
	return json({ id: created.id, name: created.name, token: plain }, 201);
}
