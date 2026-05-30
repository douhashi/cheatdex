import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * ルート（Next.js / API）の vitest 設定。
 *
 * `app/**` のユニット/統合テストを対象にする。`apps/extension` は独自の
 * vitest 設定（jsdom 環境 / build-define 注入）を持ち、
 * `pnpm --filter cheatdex-extension test` で個別に実行するため、ここでは除外する。
 *
 * `@/` パスエイリアスは tsconfig.json と同じく "リポジトリルート起点" に解決する
 * （プロダクションコード・テストの import を揃える）。
 */
export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL(".", import.meta.url)),
		},
	},
	test: {
		include: ["app/**/*.test.ts"],
		exclude: [
			"**/node_modules/**",
			"apps/**",
			"**/.next/**",
			"**/.open-next/**",
		],
	},
});
