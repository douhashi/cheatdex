/**
 * Cheatdex API クライアント層（payload 整形 + fetch ラッパ）。
 *
 * 選択されたチートを bulk payload に整形し、PAT 認証付きで
 * `POST /api/cheatcodes/bulk` に送信する。例外は投げず、401 を含むエラーを
 * 構造化結果として返し、UI 層はそれを表示するだけにする（V3/V5）。
 *
 * payload 形状は Phase 1 実スキーマに一致させる（V7）:
 * `{ game_id: number, items: [{ name, code, description? }] }`、本体カラムは `code`。
 */

export interface CheatInput {
	name: string;
	code: string;
	description?: string | null;
}

export interface BulkPayload {
	game_id: number;
	items: { name: string; code: string; description?: string }[];
}

export type BulkResult =
	| { ok: true; count: number }
	| {
			ok: false;
			/** UI 表示用の人間向けメッセージ。 */
			message: string;
			/** HTTP ステータス（ネットワークエラー時は undefined）。 */
			status?: number;
			/** 認証失敗（401）。UI は PAT 再設定を促す。 */
			unauthorized: boolean;
	  };

/**
 * 選択されたチートを bulk payload に整形する（純粋関数）。
 * description は空なら省略する。
 */
export function buildBulkPayload(
	gameId: number,
	cheats: CheatInput[],
): BulkPayload {
	return {
		game_id: gameId,
		items: cheats.map((c) => {
			const item: { name: string; code: string; description?: string } = {
				name: c.name,
				code: c.code,
			};
			const description = c.description?.trim();
			if (description) item.description = description;
			return item;
		}),
	};
}

/** baseURL の末尾スラッシュを除去して bulk エンドポイントの URL を作る。 */
function bulkUrl(baseUrl: string): string {
	return `${baseUrl.replace(/\/+$/, "")}/api/cheatcodes/bulk`;
}

export interface SubmitParams {
	baseUrl: string;
	pat: string;
	gameId: number;
	cheats: CheatInput[];
}

/**
 * bulk 登録を実行する。例外は投げず、常に BulkResult を返す。
 * fetch は注入可能（テストで差し替える）。
 */
export async function submitBulk(
	params: SubmitParams,
	fetchFn: typeof fetch = fetch,
): Promise<BulkResult> {
	const { baseUrl, pat, gameId, cheats } = params;

	if (!pat) {
		return {
			ok: false,
			message: "PAT が未設定です。オプション画面で設定してください。",
			unauthorized: true,
		};
	}
	if (cheats.length === 0) {
		return {
			ok: false,
			message: "送信するコードが選択されていません。",
			unauthorized: false,
		};
	}

	let res: Response;
	try {
		res = await fetchFn(bulkUrl(baseUrl), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${pat}`,
			},
			body: JSON.stringify(buildBulkPayload(gameId, cheats)),
		});
	} catch (err) {
		return {
			ok: false,
			message: `通信に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
			unauthorized: false,
		};
	}

	if (res.status === 401) {
		return {
			ok: false,
			message:
				"PAT が無効です。オプション画面で正しい PAT を設定してください。",
			status: 401,
			unauthorized: true,
		};
	}

	if (!res.ok) {
		return {
			ok: false,
			message: await readErrorMessage(res),
			status: res.status,
			unauthorized: false,
		};
	}

	const body = (await res.json().catch(() => null)) as {
		count?: number;
	} | null;
	const count = typeof body?.count === "number" ? body.count : cheats.length;
	return { ok: true, count };
}

/** エラーレスポンス（`{ error: string }`）から表示用メッセージを抽出する。 */
async function readErrorMessage(res: Response): Promise<string> {
	const body = (await res.json().catch(() => null)) as {
		error?: string;
	} | null;
	return body?.error
		? `登録に失敗しました (${res.status}): ${body.error}`
		: `登録に失敗しました (${res.status})`;
}
