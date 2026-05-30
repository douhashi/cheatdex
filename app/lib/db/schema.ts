import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * スキーマの真実源 (SSoT)。
 *
 * - Auth.js 標準テーブル: users / accounts / sessions / verification_tokens
 *   （@auth/d1-adapter が `up()` で生成する DDL に厳密に一致させる。
 *    adapter は raw SQL で読み書きするため、列名は camelCase、
 *    日時列（expires / emailVerified）は ISO8601 文字列を保存する DATETIME=TEXT とする）
 * - アプリ独自テーブル: platform / game / cheat_code / api_token
 *   （data-model.md に準拠。INTEGER 主キー AUTOINCREMENT、日時は epoch ミリ秒）
 *
 * すべて `drizzle-kit generate` でマイグレーション化し、
 * `wrangler d1 migrations apply cheatdex` で適用する（経路を 1 本に統一）。
 */

// --- Auth.js 標準テーブル（@auth/d1-adapter DDL 準拠） ---------------------

export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	name: text("name"),
	email: text("email"),
	emailVerified: text("emailVerified"),
	image: text("image"),
});

export const accounts = sqliteTable("accounts", {
	id: text("id").primaryKey(),
	userId: text("userId").notNull(),
	type: text("type").notNull(),
	provider: text("provider").notNull(),
	providerAccountId: text("providerAccountId").notNull(),
	refresh_token: text("refresh_token"),
	access_token: text("access_token"),
	expires_at: integer("expires_at"),
	token_type: text("token_type"),
	scope: text("scope"),
	id_token: text("id_token"),
	session_state: text("session_state"),
	oauth_token_secret: text("oauth_token_secret"),
	oauth_token: text("oauth_token"),
});

export const sessions = sqliteTable("sessions", {
	id: text("id").primaryKey(),
	sessionToken: text("sessionToken").notNull(),
	userId: text("userId").notNull(),
	expires: text("expires").notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
	identifier: text("identifier").notNull(),
	token: text("token").primaryKey(),
	expires: text("expires").notNull(),
});

// --- アプリ独自テーブル（data-model.md 準拠） -----------------------------

export const platform = sqliteTable("platform", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
	createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
});

export const game = sqliteTable("game", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	platformId: integer("platform_id")
		.notNull()
		.references(() => platform.id),
	title: text("title").notNull(),
	createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
});

export const cheatCode = sqliteTable("cheat_code", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id")
		.notNull()
		.references(() => users.id),
	gameId: integer("game_id")
		.notNull()
		.references(() => game.id),
	name: text("name").notNull(),
	code: text("code").notNull(),
	description: text("description"),
	createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
	updatedAt: integer("updated_at").notNull().default(sql`(unixepoch() * 1000)`),
});

export const apiToken = sqliteTable("api_token", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	userId: text("user_id")
		.notNull()
		.references(() => users.id),
	name: text("name").notNull(),
	tokenHash: text("token_hash").notNull().unique(),
	createdAt: integer("created_at").notNull().default(sql`(unixepoch() * 1000)`),
	lastUsedAt: integer("last_used_at"),
});

export type User = typeof users.$inferSelect;
export type Platform = typeof platform.$inferSelect;
export type Game = typeof game.$inferSelect;
export type CheatCode = typeof cheatCode.$inferSelect;
export type ApiToken = typeof apiToken.$inferSelect;
