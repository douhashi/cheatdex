import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { detectCheats } from "../src/lib/detect";
import { extractText } from "../src/lib/extract-text";

const FIXTURES = join(__dirname, "fixtures");

function loadText(file: string): string {
	const html = readFileSync(join(FIXTURES, file), "utf-8");
	return extractText(new JSDOM(html).window.document);
}

describe("detectCheats - GameShark (V1/V2)", () => {
	const cheats = detectCheats(loadText("gameshark.html"));

	it("4 つのコードブロックを検出する", () => {
		expect(cheats.filter((c) => c.format === "gameshark")).toHaveLength(4);
	});

	it("複数行コードを 1 ブロックにまとめる", () => {
		const hp = cheats.find((c) => c.name === "Infinite HP");
		expect(hp?.code).toBe("1456E7A8 0000270F\n2456E7AC 000003E7");
	});

	it("近接見出しから候補名を付与する", () => {
		const names = cheats.map((c) => c.name);
		expect(names).toContain("Infinite HP");
		expect(names).toContain("Infinite MP");
		expect(names).toContain("Max Gil");
		expect(names).toContain("Quick Level Up");
	});

	it("周辺の散文をコードとして検出しない", () => {
		for (const c of cheats) {
			expect(c.code).not.toMatch(/Enjoy|prose|surrounding/i);
		}
	});
});

describe("detectCheats - PCSX2 .pnach (V1/V2)", () => {
	const cheats = detectCheats(loadText("pnach.html"));
	const pnach = cheats.filter((c) => c.format === "pnach");

	it("3 つの patch ブロックを検出する", () => {
		expect(pnach).toHaveLength(3);
	});

	it("patch 行のみをコードに含める", () => {
		for (const c of pnach) {
			for (const line of c.code.split("\n")) {
				expect(line).toMatch(/^patch=/);
			}
		}
	});

	it("コメント（// / comment=）から候補名を付与する", () => {
		const names = pnach.map((c) => c.name);
		expect(names).toContain("Infinite Health");
		expect(names).toContain("Infinite Grip");
		expect(names).toContain("Max Stamina");
	});

	it("gametitle 行をコードにしない", () => {
		for (const c of cheats) {
			expect(c.code).not.toMatch(/gametitle/);
		}
	});
});

describe("detectCheats - 非対応形式は無視 (V4)", () => {
	it("Action Replay / Game Genie / 雑多な文字列を検出しない", () => {
		expect(detectCheats(loadText("unsupported.html"))).toHaveLength(0);
	});
});

describe("detectCheats - 多件抽出 30+ (V1)", () => {
	const cheats = detectCheats(loadText("many.html"));

	it("35 件すべてを検出する", () => {
		expect(cheats).toHaveLength(35);
		expect(cheats.length).toBeGreaterThanOrEqual(30);
	});

	it("各件に候補名が付く", () => {
		const named = cheats.filter((c) => /^Cheat Number \d+$/.test(c.name));
		expect(named).toHaveLength(35);
	});
});

describe("detectCheats - エッジケース", () => {
	it("空文字は空配列", () => {
		expect(detectCheats("")).toEqual([]);
	});

	it("CRLF 改行を正規化する", () => {
		const cheats = detectCheats(
			"Speed Hack\r\nABCD1234 5678\r\nEEEE0000 1111\r\n",
		);
		expect(cheats).toHaveLength(1);
		expect(cheats[0].name).toBe("Speed Hack");
		expect(cheats[0].code).toBe("ABCD1234 5678\nEEEE0000 1111");
	});

	it("候補名が取れなくても空文字で検出は維持する", () => {
		const cheats = detectCheats("ABCD1234 5678\n");
		expect(cheats).toHaveLength(1);
		expect(cheats[0].name).toBe("");
	});
});
