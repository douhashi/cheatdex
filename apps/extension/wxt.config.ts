import { defineConfig } from "wxt";

// API baseURL のデフォルト値。env (CHEATDEX_DEFAULT_BASE_URL) で上書き可能。
// 未指定ならローカル開発の既定値を使う。options 画面でユーザーが更に上書きできる。
const DEFAULT_BASE_URL =
	process.env.CHEATDEX_DEFAULT_BASE_URL ?? "http://localhost:3000";

// MV3 manifest 設定（論点 4 / 論点 5）。権限は最小限に絞る:
// - activeTab + scripting: ユーザーがポップアップを操作したときだけ「現在のタブ」へ
//   executeScript で注入してページテキストを取得する。<all_urls> の常時 content_scripts は使わない。
// - storage: PAT と API baseURL を chrome.storage.local に保存する。
// host_permissions は宣言しない（送信先 API は popup から fetch するだけで、
// ページアクセスは activeTab により「ユーザー操作したタブ」へ一時的に限定される）。
export default defineConfig({
	srcDir: ".",
	manifest: {
		name: "Cheatdex Collector",
		description:
			"チート掲載ページから GameShark / PCSX2 コードを抽出し Cheatdex に一括登録する",
		permissions: ["activeTab", "scripting", "storage"],
	},
	vite: () => ({
		define: {
			__CHEATDEX_DEFAULT_BASE_URL__: JSON.stringify(DEFAULT_BASE_URL),
		},
	}),
});
