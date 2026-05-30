import { defineConfig } from "vitest/config";

/**
 * ルート（Next.js / API）の vitest 設定。
 *
 * `app/**` のユニットテストのみを対象にする。`apps/extension` は独自の
 * vitest 設定（jsdom 環境 / build-define 注入）を持ち、
 * `pnpm --filter cheatdex-extension test` で個別に実行するため、ここでは除外する。
 */
export default defineConfig({
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
