import { describe, expect, it } from "vitest";
import { createTestDb } from "./testdb";

/**
 * V5: enabled migration の再現性。
 *
 * クリーンな SQLite に `drizzle/` の全 migration を適用した直後に、
 * `cheat_code.enabled` 列が NOT NULL / DEFAULT で存在することを PRAGMA で確認する。
 */
describe("migrations", () => {
	it("cheat_code に enabled 列が存在し NOT NULL かつ DEFAULT を持つ", () => {
		const { sqlite, dispose } = createTestDb();
		try {
			const cols = sqlite
				.prepare("PRAGMA table_info(cheat_code)")
				.all() as Array<{
				name: string;
				type: string;
				notnull: number;
				dflt_value: unknown;
			}>;
			const enabled = cols.find((c) => c.name === "enabled");
			expect(enabled).toBeDefined();
			expect(enabled?.notnull).toBe(1);
			expect(enabled?.dflt_value).not.toBeNull();
		} finally {
			dispose();
		}
	});

	it("DEFAULT により新規行は enabled=1（有効）で挿入される", () => {
		const { sqlite, dispose } = createTestDb();
		try {
			sqlite
				.prepare("INSERT INTO users (id, email) VALUES (?, ?)")
				.run("u1", "u1@example.com");
			sqlite
				.prepare("INSERT INTO platform (slug, name) VALUES (?, ?)")
				.run("ps2", "PlayStation 2");
			sqlite
				.prepare("INSERT INTO game (platform_id, title) VALUES (1, ?)")
				.run("G");
			sqlite
				.prepare(
					"INSERT INTO cheat_code (user_id, game_id, name, code) VALUES (?, 1, ?, ?)",
				)
				.run("u1", "n", "c");
			const row = sqlite
				.prepare("SELECT enabled FROM cheat_code LIMIT 1")
				.get() as { enabled: number };
			expect(row.enabled).toBe(1);
		} finally {
			dispose();
		}
	});
});
