import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { CheatCode, Game } from "@/app/lib/db/schema";
import { buildExport, type GameExport } from "./zip";

function makeGame(overrides: Partial<Game> & Pick<Game, "id">): Game {
	return {
		platformId: 1,
		title: "G",
		crc: "0123ABCD",
		createdAt: 0,
		...overrides,
	};
}

function cheat(
	id: number,
	name: string,
	code: string,
	enabled = true,
): CheatCode {
	return {
		id,
		userId: "u-1",
		gameId: 1,
		name,
		code,
		description: null,
		enabled,
		createdAt: 0,
		updatedAt: 0,
	};
}

describe("buildExport", () => {
	it("Game ごとに cheats/<CRC>.pnach エントリを 1 つ作る", () => {
		const games: GameExport[] = [
			{
				game: makeGame({ id: 1, title: "Game One", crc: "AAAAAAAA" }),
				cheatCodes: [cheat(1, "HP", "patch=1,EE,00000000,word,00000001")],
			},
			{
				game: makeGame({ id: 2, title: "Game Two", crc: "BBBBBBBB" }),
				cheatCodes: [cheat(2, "MP", "patch=1,EE,11111111,word,00000002")],
			},
		];

		const { zip, included, skipped } = buildExport(games);
		const entries = unzipSync(zip);

		expect(Object.keys(entries).sort()).toEqual([
			"cheats/AAAAAAAA.pnach",
			"cheats/BBBBBBBB.pnach",
		]);
		expect(strFromU8(entries["cheats/AAAAAAAA.pnach"])).toContain(
			"gametitle=Game One",
		);
		expect(strFromU8(entries["cheats/BBBBBBBB.pnach"])).toContain(
			"gametitle=Game Two",
		);
		expect(included.map((g) => g.id).sort()).toEqual([1, 2]);
		expect(skipped).toHaveLength(0);
	});

	it("ファイル名の CRC を大文字へ正規化する", () => {
		const { zip } = buildExport([
			{
				game: makeGame({ id: 1, crc: "abcd1234" }),
				cheatCodes: [cheat(1, "C", "patch=1,EE,00000000,word,00000001")],
			},
		]);
		expect(Object.keys(unzipSync(zip))).toEqual(["cheats/ABCD1234.pnach"]);
	});

	it("CRC 未設定の Game をスキップする", () => {
		const { zip, included, skipped } = buildExport([
			{
				game: makeGame({ id: 1, crc: null }),
				cheatCodes: [cheat(1, "C", "patch=1,EE,00000000,word,00000001")],
			},
		]);
		expect(Object.keys(unzipSync(zip))).toHaveLength(0);
		expect(included).toHaveLength(0);
		expect(skipped[0].reason).toBe("no-crc");
	});

	it("不正な CRC の Game をスキップする", () => {
		const { included, skipped } = buildExport([
			{
				game: makeGame({ id: 1, crc: "zzz" }),
				cheatCodes: [cheat(1, "C", "patch=1,EE,00000000,word,00000001")],
			},
		]);
		expect(included).toHaveLength(0);
		expect(skipped[0].reason).toBe("invalid-crc");
	});

	it("有効なチートが無い Game をスキップする", () => {
		const { zip, included, skipped } = buildExport([
			{
				game: makeGame({ id: 1, crc: "AAAAAAAA" }),
				cheatCodes: [cheat(1, "C", "patch=1,EE,0,word,1", false)],
			},
		]);
		expect(Object.keys(unzipSync(zip))).toHaveLength(0);
		expect(included).toHaveLength(0);
		expect(skipped[0].reason).toBe("no-enabled-cheats");
	});

	it("出力対象が無いとき空の有効な zip を返す", () => {
		const { zip } = buildExport([]);
		expect(Object.keys(unzipSync(zip))).toHaveLength(0);
	});
});
