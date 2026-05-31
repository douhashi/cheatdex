import { describe, expect, it } from "vitest";
import { isValidCrc, normalizeCrc } from "./crc";

describe("isValidCrc", () => {
	it("8 桁 hex（大小文字混在・前後空白）を受け付ける", () => {
		expect(isValidCrc("0123abcd")).toBe(true);
		expect(isValidCrc("0123ABCD")).toBe(true);
		expect(isValidCrc("0123AbCd")).toBe(true);
		expect(isValidCrc("  0123ABCD  ")).toBe(true);
	});

	it("8 桁 hex でない値を拒否する", () => {
		expect(isValidCrc("0123ABC")).toBe(false); // 7 桁
		expect(isValidCrc("0123ABCDE")).toBe(false); // 9 桁
		expect(isValidCrc("0123ABCG")).toBe(false); // 非 hex
		expect(isValidCrc("")).toBe(false);
		expect(isValidCrc("        ")).toBe(false);
	});
});

describe("normalizeCrc", () => {
	it("有効な CRC を大文字化・トリムする", () => {
		expect(normalizeCrc("  0123abcd ")).toBe("0123ABCD");
	});

	it("不正な CRC は null を返す", () => {
		expect(normalizeCrc("xyz")).toBeNull();
		expect(normalizeCrc("0123ABC")).toBeNull();
		expect(normalizeCrc("")).toBeNull();
	});
});
