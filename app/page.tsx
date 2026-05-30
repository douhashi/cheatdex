import Link from "next/link";
import { signInAction, signOutAction } from "@/app/lib/auth/actions";
import { auth } from "@/app/lib/auth/auth";
import styles from "./page.module.css";

/**
 * トップページ。
 * 未ログインなら Google ログイン、ログイン済みならダッシュボード導線を表示する。
 */
export default async function Home() {
	const session = await auth();
	const user = session?.user;

	return (
		<main className={styles.main}>
			<h1>Cheatdex</h1>
			<p>API-first cheat code manager.</p>
			{user ? (
				<div className={styles.actions}>
					<p>
						ログイン中: <strong>{user.email}</strong>
					</p>
					<nav className={styles.nav}>
						<Link href="/dashboard">ダッシュボード</Link>
						<Link href="/tokens">アクセストークン管理</Link>
					</nav>
					<form action={signOutAction}>
						<button type="submit">ログアウト</button>
					</form>
				</div>
			) : (
				<form action={signInAction}>
					<button type="submit">Google でログイン</button>
				</form>
			)}
		</main>
	);
}
