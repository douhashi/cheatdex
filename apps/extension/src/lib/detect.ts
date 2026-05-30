/**
 * チートコード検出ロジック（純粋関数 / DOM 非依存）。
 *
 * ページから抽出したプレーンテキストを入力に取り、GameShark 系 hex と
 * PCSX2 `.pnach` 形式のコードを検出する。近接テキストから候補名（チート名）を
 * ヒューリスティックに付与する（論点 6: 広めに拾い人間確認で吸収）。
 *
 * 完璧さは求めない。対応する 2 系統内で寛容に拾い、非対応形式は無視する。
 */

export type CheatFormat = "gameshark" | "pnach";

export interface DetectedCheat {
	/** 候補名（チート名）。見つからなければ空文字。 */
	name: string;
	/** チートコード本体。複数行コードは改行で連結。 */
	code: string;
	/** 検出した形式。 */
	format: CheatFormat;
}

/** GameShark 系の 1 行: `XXXXXXXX YYYY` または `XXXXXXXX YYYYYYYY`。 */
const GAMESHARK_LINE =
	/^[0-9A-Fa-f]{8}[ \t]+[0-9A-Fa-f]{4}(?:[0-9A-Fa-f]{4})?$/;

/** PCSX2 .pnach の patch 行: `patch=1,EE,XXXXXXXX,extended,YYYYYYYY`。 */
const PNACH_LINE =
	/^patch\s*=\s*\d,[A-Za-z]+,[0-9A-Fa-f]+,[A-Za-z]+,[0-9A-Fa-f]+\s*$/;

/** .pnach のコメント行（候補名のヒント）: `//` または `comment=`。 */
const PNACH_COMMENT = /^(?:\/\/\s*|comment\s*=\s*)(.+?)\s*$/;

/** GameShark 候補名行の判定: コードでも空でもない、ほどほどの長さのテキスト行。 */
function isNameCandidate(line: string): boolean {
	const trimmed = line.trim();
	if (!trimmed) return false;
	if (GAMESHARK_LINE.test(trimmed)) return false;
	if (PNACH_LINE.test(trimmed)) return false;
	// 区切り無しの 16 進塊（コード断片）は名前にしない。
	if (/^[0-9A-Fa-f]{8,}$/.test(trimmed)) return false;
	// 極端に長い行は本文とみなす。
	if (trimmed.length > 80) return false;
	return true;
}

/** HTML 由来の改行・空白を正規化して行に分割する。 */
function toLines(text: string): string[] {
	return text.replace(/\r\n?/g, "\n").replace(/ /g, " ").split("\n");
}

/** 候補名の前後の装飾（記号・括弧）を軽く除去する。 */
function cleanName(raw: string): string {
	return raw
		.trim()
		.replace(/^[#*\-=:[\]()<>"']+/, "")
		.replace(/[#*\-=:[\]()<>"']+$/, "")
		.trim();
}

/** ブロック直前の、候補名らしいテキスト行を最大 3 行遡って探す。 */
function findPrecedingName(lines: string[], blockStart: number): string {
	for (let i = blockStart - 1; i >= 0 && i >= blockStart - 3; i--) {
		const line = lines[i];
		if (isNameCandidate(line)) {
			return cleanName(line);
		}
		if (line.trim() === "") continue;
		break;
	}
	return "";
}

/** .pnach ブロック直前の近接コメント（最大 3 行）を候補名にする。 */
function findPnachName(lines: string[], blockStart: number): string {
	for (let i = blockStart - 1; i >= 0 && i >= blockStart - 3; i--) {
		const match = lines[i].trim().match(PNACH_COMMENT);
		if (match) return cleanName(match[1]);
		if (lines[i].trim() === "") continue;
		break;
	}
	return "";
}

/**
 * 連続するコード行を 1 ブロックにまとめる汎用ロジック。
 * `isCode` がコード行か判定し、`nameOf` がブロック直前から候補名を求める。
 */
function collectBlocks(
	lines: string[],
	format: CheatFormat,
	isCode: (line: string) => boolean,
	nameOf: (lines: string[], blockStart: number) => string,
	isInBlockNoise: (line: string) => boolean = () => false,
): DetectedCheat[] {
	const results: DetectedCheat[] = [];
	let block: string[] = [];
	let blockStart = -1;

	const flush = () => {
		if (block.length === 0) return;
		results.push({
			name: nameOf(lines, blockStart),
			code: block.join("\n"),
			format,
		});
		block = [];
		blockStart = -1;
	};

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim();
		if (isCode(trimmed)) {
			if (block.length === 0) blockStart = i;
			block.push(trimmed);
		} else if (block.length > 0 && isInBlockNoise(trimmed)) {
			// ブロック途中に挟まる許容行（.pnach のコメント等）はブロックを切らない。
		} else {
			flush();
		}
	}
	flush();

	return results;
}

/**
 * テキストから対応形式のチートコードをすべて検出する。非対応形式は無視する。
 */
export function detectCheats(text: string): DetectedCheat[] {
	if (!text) return [];
	const lines = toLines(text);
	return [
		...collectBlocks(
			lines,
			"gameshark",
			(line) => GAMESHARK_LINE.test(line),
			findPrecedingName,
		),
		...collectBlocks(
			lines,
			"pnach",
			(line) => PNACH_LINE.test(line),
			findPnachName,
			(line) => PNACH_COMMENT.test(line),
		),
	];
}
