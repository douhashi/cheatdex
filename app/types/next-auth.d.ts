import type { DefaultSession } from "next-auth";

/**
 * next-auth の型拡張。
 *
 * database session 戦略では session callback で `session.user.id = user.id` を
 * 付与する（app/lib/auth/auth.ts）。その値を型安全に参照できるよう、
 * Session["user"] に id を追加する（`as any` を使わないため）。
 */
declare module "next-auth" {
	interface Session {
		user: {
			id: string;
		} & DefaultSession["user"];
	}
}
