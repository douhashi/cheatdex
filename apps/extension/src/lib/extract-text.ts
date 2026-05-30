/**
 * DOM からチート検出用のプレーンテキストを抽出する。
 *
 * `<pre>` 内の改行・空白を保つことが GameShark / .pnach の行検出に重要なため、
 * `innerText`（レイアウト由来の改行を反映）を優先し、無ければ `textContent` を使う。
 * テストでは jsdom 等の Document を渡し、本番と同じロジックを検証できる。
 */
export function extractText(doc: Document): string {
	const body = doc.body;
	if (!body) return "";
	const innerText = (body as HTMLElement).innerText;
	return innerText?.trim() ? innerText : (body.textContent ?? "");
}
