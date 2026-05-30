import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit 設定。
 *
 * - schema からマイグレーション SQL を生成する用途のみで使う (`drizzle-kit generate`)。
 * - 生成された SQL の適用は `wrangler d1 migrations apply cheatdex` に一本化する
 *   （drizzle-kit migrate / push は使わない）。そのため d1-http の
 *   dbCredentials（accountId/token）は不要。dialect=sqlite のみ指定する。
 */
export default defineConfig({
	schema: "./app/lib/db/schema.ts",
	out: "./drizzle",
	dialect: "sqlite",
});
