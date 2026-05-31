import type { CheatCode, Game } from "@/app/lib/db/schema";

/**
 * PCSX2 .pnach フォーマットの 1 ファイル分テキストを生成する（純粋関数）。
 *
 * フォーマット（PCSX2 実規約）:
 *   gametitle=<title>
 *   comment=<cheat name>
 *   patch=1,EE,<addr>,<size>,<value>
 *   ...
 *
 * - enabled=true のチートのみ出力する。
 * - 各チートは `comment=` 行で名前を保持し、続けて patch 行を出力する。
 * - code の各行は raw hex → patch 変換をベストエフォートで試み、
 *   変換できない行も破棄せず `comment=[raw] <原文>` として保全する
 *   （不正な patch 行で PCSX2 の読み込み全体が壊れるのを防ぐ）。
 */
export function buildPnach(game: Game, cheatCodes: CheatCode[]): string {
	const lines: string[] = [`gametitle=${game.title}`];

	for (const cheat of cheatCodes) {
		if (!cheat.enabled) {
			continue;
		}
		lines.push(`comment=${cheat.name}`);
		for (const rawLine of cheat.code.split("\n")) {
			const line = rawLine.trim();
			if (line.length === 0) {
				continue;
			}
			lines.push(convertCodeLine(line));
		}
	}

	return lines.join("\n");
}

const PATCH_PREFIX = /^patch\s*=/i;
const RAW_PAIR = /^([0-9A-Fa-f]{8})\s+([0-9A-Fa-f]{8})$/;

/**
 * code の 1 行を PCSX2 patch 行へ変換する。
 * - 既に `patch=` 形式 → そのまま
 * - raw GameShark/PNACH hex ペア → `patch=1,EE,...` へ変換（ベストエフォート）
 * - 変換不能 → `comment=[raw] <原文>` として保全
 */
function convertCodeLine(line: string): string {
	if (PATCH_PREFIX.test(line)) {
		return line;
	}

	const pair = RAW_PAIR.exec(line);
	if (pair) {
		const converted = convertRawPair(pair[1], pair[2]);
		if (converted !== null) {
			return converted;
		}
	}

	return `comment=[raw] ${line}`;
}

/**
 * raw な 32bit アドレス + 32bit 値ペアを PCSX2 patch 行へ変換する。
 *
 * アドレス先頭ニブルが書き込みサイズを示す慣習に従う:
 *   0 → byte / 1 → short / 2 → word
 * 実アドレスは先頭ニブルを 0 でマスクした値とする。
 * 上記以外の先頭ニブルは曖昧なため変換不能扱い（null）。
 */
function convertRawPair(addrHex: string, valueHex: string): string | null {
	const addr = addrHex.toUpperCase();
	const value = valueHex.toUpperCase();
	const sizeByPrefix: Record<string, string> = {
		"0": "byte",
		"1": "short",
		"2": "word",
	};
	const size = sizeByPrefix[addr[0]];
	if (size === undefined) {
		return null;
	}
	const address = `0${addr.slice(1)}`;
	return `patch=1,EE,${address},${size},${value}`;
}
