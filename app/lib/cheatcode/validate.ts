/**
 * チートコード登録の共通バリデーション（純粋関数 / DB・HTTP 非依存）。
 *
 * 単件 `POST /api/cheatcodes` と bulk `POST /api/cheatcodes/bulk` の双方から利用し、
 * 入力検証ロジックの二重化を防ぐ（DRY）。真実源は `app/lib/db/schema.ts`：
 * cheat_code の本体カラムは `code`、補足は `description`（nullable）、`enabled` は無い。
 */

/** bulk 1 リクエストで受け付ける items の最大件数。 */
export const MAX_BULK_ITEMS = 200;

/** 永続化に渡せる正規化済みの 1 件分（name は trim 済み、code は原文保持）。 */
export interface ValidCheatCodeItem {
	name: string;
	code: string;
	description: string | null;
}

/** 単件 item 検証の結果。 */
export type ItemValidationResult =
	| { ok: true; value: ValidCheatCodeItem }
	| { ok: false; reason: string };

/** bulk items 検証の結果（不正時は最初の不正 index と理由を返す）。 */
export type ItemsValidationResult =
	| { ok: true; values: ValidCheatCodeItem[] }
	| { ok: false; index: number; reason: string };

/**
 * 1 件分のチートコード入力を検証・正規化する。
 *
 * 単件 route の既存仕様に合わせる：
 * - `name` 必須（trim 後に非空。値は trim して保持）
 * - `code` 必須（trim 後に非空。値は原文のまま保持＝改行・空白を壊さない）
 * - `description` 任意（string か未指定。未指定は null）
 */
export function validateCheatCodeItem(input: unknown): ItemValidationResult {
	const item = (input ?? {}) as {
		name?: unknown;
		code?: unknown;
		description?: unknown;
	};
	const { name, code, description } = item;

	if (typeof name !== "string" || name.trim() === "") {
		return { ok: false, reason: "name is required" };
	}
	if (typeof code !== "string" || code.trim() === "") {
		return { ok: false, reason: "code is required" };
	}
	if (description !== undefined && typeof description !== "string") {
		return { ok: false, reason: "description must be a string" };
	}

	return {
		ok: true,
		value: { name: name.trim(), code, description: description ?? null },
	};
}

/**
 * bulk 登録用の items 配列を検証する。
 * - 配列であること / 1 件以上 / `MAX_BULK_ITEMS` 件以下
 * - 全件を先に検証し、1 件でも不正なら最初の不正 index と理由を返す（all-or-nothing）
 */
export function validateCheatCodeItems(input: unknown): ItemsValidationResult {
	if (!Array.isArray(input)) {
		return { ok: false, index: -1, reason: "items must be an array" };
	}
	if (input.length === 0) {
		return { ok: false, index: -1, reason: "items must not be empty" };
	}
	if (input.length > MAX_BULK_ITEMS) {
		return {
			ok: false,
			index: -1,
			reason: `items must be at most ${MAX_BULK_ITEMS}`,
		};
	}

	const values: ValidCheatCodeItem[] = [];
	for (let index = 0; index < input.length; index++) {
		const result = validateCheatCodeItem(input[index]);
		if (!result.ok) {
			return { ok: false, index, reason: result.reason };
		}
		values.push(result.value);
	}

	return { ok: true, values };
}
