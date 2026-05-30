"use client";

import { type ReactNode, useActionState, useState } from "react";
import type { DashboardGame } from "@/app/lib/db/queries";
import {
	type ActionState,
	deleteGameAction,
	updateGameAction,
} from "./actions";
import styles from "./dashboard.module.css";

/**
 * Game 1 件のセクション（クライアントコンポーネント）。
 * - title 編集は「他ユーザーの CheatCode が無い場合のみ」許可（補足設計判断）。
 * - 削除は自分の配下 CheatCode を全削除。
 */
export function GameSection({
	game,
	children,
}: {
	game: DashboardGame;
	children: ReactNode;
}) {
	const [editing, setEditing] = useState(false);
	const [state, formAction] = useActionState<ActionState, FormData>(
		async (prev, form) => {
			const result = await updateGameAction(prev, form);
			if (!result?.error) setEditing(false);
			return result;
		},
		undefined,
	);

	return (
		<div className={styles.game}>
			<div className={styles.gameHeader}>
				{editing ? (
					<form action={formAction} className={styles.inlineForm}>
						<input type="hidden" name="gameId" value={game.id} />
						<input name="title" defaultValue={game.title} required />
						<button type="submit">保存</button>
						<button type="button" onClick={() => setEditing(false)}>
							キャンセル
						</button>
						{state?.error ? (
							<span className={styles.error}>{state.error}</span>
						) : null}
					</form>
				) : (
					<>
						<h4 className={styles.gameTitle}>{game.title}</h4>
						<div className={styles.rowActions}>
							{game.sharedWithOthers ? (
								<span
									className={styles.note}
									title="他のユーザーも利用している Game のため編集できません"
								>
									共有中（編集不可）
								</span>
							) : (
								<button type="button" onClick={() => setEditing(true)}>
									名称を編集
								</button>
							)}
							<form action={deleteGameAction}>
								<input type="hidden" name="gameId" value={game.id} />
								<button type="submit">この Game のチートを削除</button>
							</form>
						</div>
					</>
				)}
			</div>
			<ul className={styles.cheatList}>{children}</ul>
		</div>
	);
}
