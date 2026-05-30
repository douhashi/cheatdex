/**
 * 拡張の設定（PAT / API baseURL）を chrome.storage.local で永続化する（論点 5）。
 * PAT は秘密情報のため chrome.storage.sync（端末間同期）には載せない（V8）。
 */

export interface Settings {
	pat: string;
	baseUrl: string;
}

const KEY_PAT = "pat";
const KEY_BASE_URL = "baseUrl";

/**
 * API baseURL のデフォルト値。ビルド時に Vite の define で差し替えられる。
 */
export const DEFAULT_BASE_URL = __CHEATDEX_DEFAULT_BASE_URL__;

export async function loadSettings(): Promise<Settings> {
	const stored = await chrome.storage.local.get([KEY_PAT, KEY_BASE_URL]);
	return {
		pat: typeof stored[KEY_PAT] === "string" ? stored[KEY_PAT] : "",
		baseUrl:
			typeof stored[KEY_BASE_URL] === "string" && stored[KEY_BASE_URL]
				? stored[KEY_BASE_URL]
				: DEFAULT_BASE_URL,
	};
}

export async function saveSettings(settings: Settings): Promise<void> {
	await chrome.storage.local.set({
		[KEY_PAT]: settings.pat.trim(),
		[KEY_BASE_URL]: settings.baseUrl.trim() || DEFAULT_BASE_URL,
	});
}
