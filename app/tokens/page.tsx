import Link from "next/link";
import { requireUser } from "@/app/lib/auth/session";
import { getDb } from "@/app/lib/db/client";
import { getTokensForUser } from "@/app/lib/db/queries";
import { revokeTokenAction } from "./actions";
import { TokenIssueForm } from "./TokenIssueForm";
import styles from "./tokens.module.css";

/**
 * PAT 管理画面（一覧・発行・削除）。
 *
 * - 認証ガード: requireUser（未ログインはサインインへ・論点 4）。
 * - 一覧は token_hash を返さない（getTokensForUser）。
 * - 発行直後の平文は TokenIssueForm が 1 度だけ表示する（再表示不可）。
 */
export default async function TokensPage() {
	const user = await requireUser();
	const tokens = await getTokensForUser(getDb(), user.id);

	return (
		<main className={styles.main}>
			<header className={styles.header}>
				<h1>アクセストークン管理</h1>
				<nav className={styles.nav}>
					<Link href="/">トップ</Link>
					<Link href="/dashboard">ダッシュボード</Link>
				</nav>
			</header>

			<section className={styles.section}>
				<h2>新しいトークンを発行</h2>
				<p className={styles.note}>
					Chrome 拡張に設定するアクセストークンを発行します。平文は発行直後に 1
					度だけ表示され、再表示はできません。
				</p>
				<TokenIssueForm />
			</section>

			<section className={styles.section}>
				<h2>発行済みトークン</h2>
				{tokens.length === 0 ? (
					<p>発行済みのトークンはありません。</p>
				) : (
					<ul className={styles.list}>
						{tokens.map((t) => (
							<li key={t.id} className={styles.row}>
								<span className={styles.tokenName}>{t.name}</span>
								<form action={revokeTokenAction}>
									<input type="hidden" name="id" value={t.id} />
									<button type="submit">削除</button>
								</form>
							</li>
						))}
					</ul>
				)}
			</section>
		</main>
	);
}
