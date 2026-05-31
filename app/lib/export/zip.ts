import { strToU8, zipSync } from "fflate";
import type { CheatCode, Game } from "@/app/lib/db/schema";
import { normalizeCrc } from "./crc";
import { buildPnach } from "./pnach";

/** export 1 件分（Game とそのチート）。所有者スコープは取得側で担保する。 */
export type GameExport = {
	game: Game;
	cheatCodes: CheatCode[];
};

export type SkipReason = "no-crc" | "invalid-crc" | "no-enabled-cheats";

export type SkippedGame = {
	game: Game;
	reason: SkipReason;
};

export type ExportResult = {
	zip: Uint8Array;
	included: Game[];
	skipped: SkippedGame[];
};

/**
 * 全 Game を 1 つの zip にまとめる（純粋関数 / fflate）。
 * Game ごとに `cheats/<CRC>.pnach` として分割し、enabled なチートのみ出力する。
 *
 * 次の Game は出力からスキップし、理由を skipped に記録する:
 * - CRC 未設定（no-crc）
 * - CRC が 8 桁 hex でない（invalid-crc）
 * - enabled なチートが 1 件も無い（no-enabled-cheats）
 */
export function buildExport(games: GameExport[]): ExportResult {
	const files: Record<string, Uint8Array> = {};
	const included: Game[] = [];
	const skipped: SkippedGame[] = [];

	for (const { game, cheatCodes } of games) {
		if (game.crc === null || game.crc.trim().length === 0) {
			skipped.push({ game, reason: "no-crc" });
			continue;
		}

		const crc = normalizeCrc(game.crc);
		if (crc === null) {
			skipped.push({ game, reason: "invalid-crc" });
			continue;
		}

		const enabledCheats = cheatCodes.filter((c) => c.enabled);
		if (enabledCheats.length === 0) {
			skipped.push({ game, reason: "no-enabled-cheats" });
			continue;
		}

		files[`cheats/${crc}.pnach`] = strToU8(buildPnach(game, enabledCheats));
		included.push(game);
	}

	return { zip: zipSync(files), included, skipped };
}
