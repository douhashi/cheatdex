import { D1Adapter } from "@auth/d1-adapter";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js (NextAuth v5) 設定。
 *
 * - Google OAuth プロバイダ
 * - @auth/d1-adapter による database セッション戦略（session を D1 に永続化）
 * - D1 バインディングは OpenNext の getCloudflareContext() からリクエスト時に取得する
 *   （設定をファクトリ関数で渡すことで Workers ランタイム内のバインディングにアクセス）
 *
 * シークレット (AUTH_SECRET / AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET) は
 * Cloudflare 環境変数 (wrangler secret / .dev.vars) から供給される。
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
	const { env } = getCloudflareContext();
	return {
		adapter: D1Adapter(env.DB),
		session: { strategy: "database" },
		providers: [Google],
		callbacks: {
			// database セッション戦略では callback の user に DB レコードが渡る。
			// session.user.id を露出し、所有者スコープ判定で利用する
			// （authenticateSession() / Server Component / Server Action が前提とする）。
			session({ session, user }) {
				session.user.id = user.id;
				return session;
			},
		},
	};
});
