import Link from "next/link";
import { requireUser } from "@/app/lib/auth/session";
import { getDb } from "@/app/lib/db/client";
import { getDashboardTree, getPlatformGameOptions } from "@/app/lib/db/queries";
import { CheatCodeRow } from "./CheatCodeRow";
import { CreateCheatCodeForm } from "./CreateCheatCodeForm";
import styles from "./dashboard.module.css";
import { GameSection } from "./GameSection";

/**
 * ダッシュボード（チート一覧・編集）。
 *
 * - 認証ガード: requireUser（未ログインはサインインへ・論点 4）。
 * - データ取得: Server Component から getDb() 直取得（所有者スコープ・論点 7）。
 */
export default async function DashboardPage() {
	const user = await requireUser();
	const db = getDb();
	const [tree, options] = await Promise.all([
		getDashboardTree(db, user.id),
		getPlatformGameOptions(db),
	]);

	return (
		<main className={styles.main}>
			<header className={styles.header}>
				<h1>ダッシュボード</h1>
				<nav className={styles.nav}>
					<Link href="/">トップ</Link>
					<Link href="/tokens">アクセストークン管理</Link>
				</nav>
			</header>

			<section className={styles.section}>
				<h2>チートコードを登録</h2>
				<CreateCheatCodeForm
					platforms={options.platforms}
					games={options.games}
				/>
			</section>

			<section className={styles.section}>
				<h2>登録済みチートコード</h2>
				{tree.length === 0 ? (
					<p>まだチートコードがありません。</p>
				) : (
					tree.map((p) => (
						<div key={p.id} className={styles.platform}>
							<h3>{p.name}</h3>
							{p.games.map((g) => (
								<GameSection key={g.id} game={g}>
									{g.cheatCodes.map((cc) => (
										<CheatCodeRow key={cc.id} cheatCode={cc} />
									))}
								</GameSection>
							))}
						</div>
					))
				)}
			</section>
		</main>
	);
}
