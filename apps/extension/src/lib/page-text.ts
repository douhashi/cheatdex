/**
 * アクティブなタブに都度スクリプトを注入し、ページの可視テキストを取得する（論点 4）。
 *
 * activeTab + chrome.scripting.executeScript により、ユーザーがポップアップを
 * 開いた瞬間のタブにのみ一時的にアクセスする（常時 content_scripts は使わない）。
 */
export async function getActiveTabText(): Promise<string> {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	if (!tab?.id) {
		throw new Error("アクティブなタブが見つかりません");
	}

	const results = await chrome.scripting.executeScript({
		target: { tabId: tab.id },
		// 注入先で実行され、ページの可視テキストを返すだけの関数。
		func: () => document.body?.innerText ?? document.body?.textContent ?? "",
	});

	return results[0]?.result ?? "";
}
