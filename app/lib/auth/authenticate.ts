import { eq } from "drizzle-orm";
import { getDb } from "@/app/lib/db/client";
import { apiToken } from "@/app/lib/db/schema";
import { auth } from "./auth";
import { hashToken } from "./pat";

export interface AuthenticatedUser {
	id: string;
}

/**
 * セッション認証 (Auth.js) と PAT 認証を 1 箇所に集約した共通認証関数 (DRY)。
 *
 * 1. `Authorization: Bearer <token>` があれば PAT として検証する
 *    - 入力を SHA-256 でハッシュ化し api_token.token_hash と照合
 *    - 一致したら last_used_at を更新し、所有ユーザーを返す
 * 2. PAT が無ければ Auth.js セッション（database セッション）を確認する
 * 3. どちらも該当しなければ null（呼び出し側で 401 を返す）
 */
export async function authenticate(
	req: Request,
): Promise<AuthenticatedUser | null> {
	const bearer = extractBearer(req);
	if (bearer !== null) {
		return authenticatePat(bearer);
	}
	return authenticateSession();
}

function extractBearer(req: Request): string | null {
	const header = req.headers.get("authorization");
	if (header === null) {
		return null;
	}
	const match = header.match(/^Bearer\s+(.+)$/i);
	return match ? match[1] : null;
}

async function authenticatePat(
	plain: string,
): Promise<AuthenticatedUser | null> {
	const db = getDb();
	const hash = await hashToken(plain);
	const rows = await db
		.select({ id: apiToken.id, userId: apiToken.userId })
		.from(apiToken)
		.where(eq(apiToken.tokenHash, hash))
		.limit(1);
	const row = rows.at(0);
	if (row === undefined) {
		return null;
	}
	await db
		.update(apiToken)
		.set({ lastUsedAt: Date.now() })
		.where(eq(apiToken.id, row.id));
	return { id: row.userId };
}

async function authenticateSession(): Promise<AuthenticatedUser | null> {
	const session = await auth();
	const userId = session?.user?.id;
	return userId ? { id: userId } : null;
}
