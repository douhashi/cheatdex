import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Cloudflare D1 バインディング (`DB`) を Drizzle クライアントに包んで返す。
 * Route Handler など Workers ランタイム内から呼ぶ。
 */
export function getDb() {
	const { env } = getCloudflareContext();
	return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
