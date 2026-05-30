import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/.output/**", "**/.wxt/**"],
	},
	// settings.ts が参照する baseURL 定数を、テスト時にも解決できるよう埋め込む。
	define: {
		__CHEATDEX_DEFAULT_BASE_URL__: JSON.stringify("http://localhost:3000"),
	},
});
