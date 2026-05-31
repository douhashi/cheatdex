/**
 * CRC（PCSX2 が要求するゲーム識別子）の検証・正規化（純粋関数 / DB・HTTP 非依存）。
 *
 * 形式は大文字 8 桁 hex。入力は大文字小文字を問わず受け付け、
 * 保存・ファイル名生成時は大文字へ正規化する（真実源は本ファイル）。
 */

const CRC_PATTERN = /^[0-9A-Fa-f]{8}$/;

/** 値が 8 桁 hex（前後空白は許容）かを判定する。 */
export function isValidCrc(value: string): boolean {
	return CRC_PATTERN.test(value.trim());
}

/**
 * CRC をトリム + 大文字化して正規化する。
 * 形式が不正な場合は null を返す。
 */
export function normalizeCrc(value: string): string | null {
	const trimmed = value.trim();
	if (!CRC_PATTERN.test(trimmed)) {
		return null;
	}
	return trimmed.toUpperCase();
}
