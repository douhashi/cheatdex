import { describe, expect, it } from "vitest";
import {
	MAX_BULK_ITEMS,
	validateCheatCodeItem,
	validateCheatCodeItems,
} from "./validate";

describe("validateCheatCodeItem", () => {
	it("正常入力を正規化（name は trim、code は原文保持）", () => {
		const result = validateCheatCodeItem({
			name: "  Infinite HP  ",
			code: "1456E7A8 0000270F\n2456E7AC 000003E7",
			description: "max hp",
		});
		expect(result).toEqual({
			ok: true,
			value: {
				name: "Infinite HP",
				code: "1456E7A8 0000270F\n2456E7AC 000003E7",
				description: "max hp",
			},
		});
	});

	it("description 省略時は null", () => {
		const result = validateCheatCodeItem({ name: "n", code: "c" });
		expect(result).toEqual({
			ok: true,
			value: { name: "n", code: "c", description: null },
		});
	});

	it("name 欠落で不正", () => {
		expect(validateCheatCodeItem({ code: "c" })).toEqual({
			ok: false,
			reason: "name is required",
		});
	});

	it("name 空白のみで不正", () => {
		expect(validateCheatCodeItem({ name: "   ", code: "c" })).toEqual({
			ok: false,
			reason: "name is required",
		});
	});

	it("code 欠落で不正", () => {
		expect(validateCheatCodeItem({ name: "n" })).toEqual({
			ok: false,
			reason: "code is required",
		});
	});

	it("description が文字列以外で不正", () => {
		expect(
			validateCheatCodeItem({ name: "n", code: "c", description: 1 }),
		).toEqual({ ok: false, reason: "description must be a string" });
	});

	it("非オブジェクト入力でも安全に不正判定", () => {
		expect(validateCheatCodeItem(null)).toEqual({
			ok: false,
			reason: "name is required",
		});
		expect(validateCheatCodeItem("nope")).toEqual({
			ok: false,
			reason: "name is required",
		});
	});
});

describe("validateCheatCodeItems", () => {
	it("正常配列を全件正規化", () => {
		expect(
			validateCheatCodeItems([
				{ name: "a", code: "1" },
				{ name: "b", code: "2", description: "d" },
			]),
		).toEqual({
			ok: true,
			values: [
				{ name: "a", code: "1", description: null },
				{ name: "b", code: "2", description: "d" },
			],
		});
	});

	it("配列でないと不正", () => {
		expect(validateCheatCodeItems({})).toEqual({
			ok: false,
			index: -1,
			reason: "items must be an array",
		});
	});

	it("空配列は不正", () => {
		expect(validateCheatCodeItems([])).toEqual({
			ok: false,
			index: -1,
			reason: "items must not be empty",
		});
	});

	it("上限超過は不正", () => {
		const tooMany = Array.from({ length: MAX_BULK_ITEMS + 1 }, () => ({
			name: "n",
			code: "c",
		}));
		expect(validateCheatCodeItems(tooMany)).toEqual({
			ok: false,
			index: -1,
			reason: `items must be at most ${MAX_BULK_ITEMS}`,
		});
	});

	it("1 件でも不正なら最初の不正 index と理由を返す（all-or-nothing）", () => {
		expect(
			validateCheatCodeItems([
				{ name: "ok", code: "1" },
				{ name: "", code: "2" },
				{ name: "ok2", code: "3" },
			]),
		).toEqual({ ok: false, index: 1, reason: "name is required" });
	});

	it("上限ちょうど（30 件超含む）は許容", () => {
		const exactly = Array.from({ length: MAX_BULK_ITEMS }, (_, i) => ({
			name: `n${i}`,
			code: `c${i}`,
		}));
		const result = validateCheatCodeItems(exactly);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.values).toHaveLength(MAX_BULK_ITEMS);
	});
});
