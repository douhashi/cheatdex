/**
 * PAT (Personal Access Token) ユーティリティ。
 *
 * - 平文トークンは 32byte 乱数（crypto.getRandomValues）を base64url 化した
 *   高エントロピー文字列。`cdx_` プレフィックスを付与（漏洩スキャン・誤検知対策）。
 * - DB には SHA-256（crypto.subtle.digest, ソルト無し）ハッシュ (hex) のみ保存し、
 *   平文は発行時のレスポンスで 1 度だけ返す。
 * - 検証は入力を同じ方式でハッシュ化し、DB の hash と照合する
 *   （平文比較はせず、ハッシュ同士の比較で定数時間性を意識）。
 */

import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { apiToken } from "../db/schema";

const TOKEN_BYTES = 32;
const TOKEN_PREFIX = "cdx_";

/** 32byte 乱数を base64url 化した平文トークンを生成する。 */
export function generateToken(): string {
	const bytes = new Uint8Array(TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	return TOKEN_PREFIX + base64url(bytes);
}

/** 平文トークンを SHA-256 でハッシュ化し hex 文字列で返す。 */
export async function hashToken(plain: string): Promise<string> {
	const data = new TextEncoder().encode(plain);
	const digest = await crypto.subtle.digest("SHA-256", data);
	return toHex(new Uint8Array(digest));
}

function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const b of bytes) {
		binary += String.fromCharCode(b);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * PAT を発行する。平文トークンは戻り値で 1 度だけ返し、DB にはハッシュのみ保存する
 * （Web UI からも `POST /api/tokens` と同じロジックを使うため集約 = DRY）。
 */
export async function issueToken(
	userId: string,
	name: string,
): Promise<{ id: number; name: string; token: string }> {
	const plain = generateToken();
	const tokenHash = await hashToken(plain);
	const db = getDb();
	const [created] = await db
		.insert(apiToken)
		.values({ userId, name: name.trim(), tokenHash })
		.returning({ id: apiToken.id, name: apiToken.name });
	return { id: created.id, name: created.name, token: plain };
}

/**
 * PAT を物理削除する（revoked_at は持たない = 論点 2）。
 * 自分が所有する行のみ削除可能。削除後は tokenHash 一致行が無くなり、
 * authenticate() が当該 Bearer を自然に 401 とする（追加分岐は不要）。
 */
export async function revokeToken(
	userId: string,
	id: number,
): Promise<{ ok: boolean }> {
	const db = getDb();
	const deleted = await db
		.delete(apiToken)
		.where(and(eq(apiToken.id, id), eq(apiToken.userId, userId)))
		.returning({ id: apiToken.id });
	return { ok: deleted.length > 0 };
}
