import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import type { Db } from "../client";
import * as schema from "../schema";

/**
 * テスト用の実 SQLite 環境を作り、`drizzle/` の全 migration を journal 順に適用する。
 *
 * philosophy「DB アクセスを伴うテストは可能な限り実 DB 環境を使う」に従い、
 * 自プロジェクト内のロジック（mutations / queries / pat / authenticate）はモック
 * せず、実 SQLite（Node 組み込みの `node:sqlite` = SQLite 本体）に対して検証する。
 *
 * 本番の Cloudflare D1 も SQLite 実装であり、Drizzle の SQL は同一。D1 ドライバは
 * Workers バインディング依存で Node から直接起動できないため、Drizzle の
 * sqlite-proxy ドライバ経由で `node:sqlite` を実 DB として使う（新規依存を足さない）。
 */

const DRIZZLE_DIR = join(process.cwd(), "drizzle");

type Journal = { entries: { tag: string }[] };

function migrationStatements(): string[] {
	const journal = JSON.parse(
		readFileSync(join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8"),
	) as Journal;
	const statements: string[] = [];
	for (const entry of journal.entries) {
		const sql = readFileSync(join(DRIZZLE_DIR, `${entry.tag}.sql`), "utf8");
		for (const part of sql.split("--> statement-breakpoint")) {
			const trimmed = part.trim().replace(/;\s*$/, "");
			if (trimmed !== "") statements.push(trimmed);
		}
	}
	return statements;
}

export type TestDb = { db: Db; sqlite: DatabaseSync; dispose: () => void };

/**
 * 新しい in-memory SQLite を作り、migration 適用済みの drizzle クライアントを返す。
 * 利用後は `dispose()` を呼ぶこと。
 */
export function createTestDb(): TestDb {
	const sqlite = new DatabaseSync(":memory:");
	for (const statement of migrationStatements()) {
		sqlite.exec(statement);
	}

	const db = drizzle(
		async (sql, params, method) => {
			if (method === "run") {
				sqlite.prepare(sql).run(...(params as never[]));
				return { rows: [] };
			}
			const stmt = sqlite.prepare(sql);
			const rowObjects = stmt.all(...(params as never[])) as Record<
				string,
				unknown
			>[];
			// sqlite-proxy は配列形式の行（カラム順）を要求する。
			const rows = rowObjects.map((row) => Object.values(row));
			return { rows: method === "get" ? (rows[0] ?? []) : rows };
		},
		{ schema },
	) as unknown as Db;

	return { db, sqlite, dispose: () => sqlite.close() };
}
