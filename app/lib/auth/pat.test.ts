import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./pat";

describe("generateToken", () => {
	it("returns a high-entropy token with the cdx_ prefix", () => {
		const token = generateToken();
		expect(token.startsWith("cdx_")).toBe(true);
		// 32 byte -> base64url は約 43 文字。prefix を含め十分な長さ
		expect(token.length).toBeGreaterThanOrEqual(40);
	});

	it("produces unique tokens across calls", () => {
		const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
		expect(tokens.size).toBe(100);
	});

	it("contains only base64url-safe characters after the prefix", () => {
		const body = generateToken().slice("cdx_".length);
		expect(body).toMatch(/^[A-Za-z0-9_-]+$/);
	});
});

describe("hashToken", () => {
	it("returns a 64-char hex SHA-256 digest", async () => {
		const hash = await hashToken("cdx_example");
		expect(hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it("is deterministic for the same input", async () => {
		const a = await hashToken("cdx_same");
		const b = await hashToken("cdx_same");
		expect(a).toBe(b);
	});

	it("produces different hashes for different inputs (invalid token mismatch)", async () => {
		const a = await hashToken("cdx_one");
		const b = await hashToken("cdx_two");
		expect(a).not.toBe(b);
	});

	it("never equals the plaintext (plaintext is not stored)", async () => {
		const plain = generateToken();
		const hash = await hashToken(plain);
		expect(hash).not.toBe(plain);
	});

	it("matches the known SHA-256 of a fixed string", async () => {
		// echo -n "abc" | sha256sum
		const hash = await hashToken("abc");
		expect(hash).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});
});
