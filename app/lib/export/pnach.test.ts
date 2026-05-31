import { describe, expect, it } from "vitest";
import type { CheatCode, Game } from "@/app/lib/db/schema";
import { buildPnach } from "./pnach";

function makeGame(overrides?: Partial<Game>): Game {
	return {
		id: 1,
		platformId: 1,
		title: "Test Game",
		crc: "0123ABCD",
		createdAt: 0,
		...overrides,
	};
}

function makeCheat(overrides?: Partial<CheatCode>): CheatCode {
	return {
		id: 1,
		userId: "u-1",
		gameId: 1,
		name: "Cheat",
		code: "",
		description: null,
		enabled: true,
		createdAt: 0,
		updatedAt: 0,
		...overrides,
	};
}

describe("buildPnach", () => {
	it("先頭行が gametitle= になる", () => {
		const result = buildPnach(makeGame({ title: "Final Fantasy X" }), []);
		expect(result.split("\n")[0]).toBe("gametitle=Final Fantasy X");
	});

	it("チート名を comment= 行で出し、続けて patch 行を出す", () => {
		const result = buildPnach(makeGame(), [
			makeCheat({
				name: "Infinite HP",
				code: "patch=1,EE,001ABCDE,word,00000063",
			}),
		]);
		expect(result).toContain("comment=Infinite HP");
		expect(result).toContain("patch=1,EE,001ABCDE,word,00000063");
	});

	it("enabled=false のチートを除外する", () => {
		const result = buildPnach(makeGame(), [
			makeCheat({
				id: 1,
				name: "Enabled",
				code: "patch=1,EE,00000000,word,00000001",
				enabled: true,
			}),
			makeCheat({
				id: 2,
				name: "Disabled",
				code: "patch=1,EE,11111111,word,00000001",
				enabled: false,
			}),
		]);
		expect(result).toContain("comment=Enabled");
		expect(result).not.toContain("comment=Disabled");
		expect(result).not.toContain("11111111");
	});

	it("既存の patch= 行はそのまま通す", () => {
		const code = "patch=1,EE,002016E8,word,00000063";
		const result = buildPnach(makeGame(), [makeCheat({ name: "C", code })]);
		expect(result).toContain(code);
	});

	it("raw GameShark/PNACH hex ペアを patch= に変換する（ベストエフォート）", () => {
		const result = buildPnach(makeGame(), [
			makeCheat({ name: "Raw", code: "201ABCDE 00000063" }),
		]);
		// 2 始まり → word、アドレス先頭ニブルを 0 でマスク。
		expect(result).toContain("patch=1,EE,001ABCDE,word,00000063");
	});

	it("変換不能な行は破棄せず comment= で保全する（// は使わない）", () => {
		const result = buildPnach(makeGame(), [
			makeCheat({ name: "Weird", code: "this is not a code" }),
		]);
		expect(result).toContain("comment=[raw] this is not a code");
		expect(result).not.toContain("//");
	});

	it("複数行コードを各行変換する", () => {
		const result = buildPnach(makeGame(), [
			makeCheat({
				name: "Multi",
				code: "201ABCDE 00000063\n201ABCE2 00000063",
			}),
		]);
		expect(result).toContain("patch=1,EE,001ABCDE,word,00000063");
		expect(result).toContain("patch=1,EE,001ABCE2,word,00000063");
	});

	it("コード内の空行は無視する", () => {
		const result = buildPnach(makeGame(), [
			makeCheat({ name: "C", code: "patch=1,EE,00000000,word,00000001\n\n" }),
		]);
		const lines = result.split("\n").filter((l) => l.length > 0);
		// gametitle + comment + patch = 3 行
		expect(lines).toHaveLength(3);
	});
});
