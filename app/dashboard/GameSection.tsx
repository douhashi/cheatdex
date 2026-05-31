"use client";

import { type ReactNode, useActionState, useState } from "react";
import type { DashboardGame } from "@/app/lib/db/queries";
import {
	type ActionState,
	deleteGameAction,
	updateGameAction,
	updateGameCrcAction,
} from "./actions";
import styles from "./dashboard.module.css";

/**
 * Game 1 件のセクション（クライアントコンポーネント）。
 * - title / CRC 編集は「他ユーザーの CheatCode が無い場合のみ」許可（補足設計判断）。
 * - CRC 未設定の Game は zip 出力からスキップされるため注記を出す。
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
	const [editingCrc, setEditingCrc] = useState(false);
	const [state, formAction] = useActionState<ActionState, FormData>(
		async (prev, form) => {
			const result = await updateGameAction(prev, form);
			if (!result?.error) setEditing(false);
			return result;
		},
		undefined,
	);
	const [crcState, crcFormAction] = useActionState<ActionState, FormData>(
		async (prev, form) => {
			const result = await updateGameCrcAction(prev, form);
			if (!result?.error) setEditingCrc(false);
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

			<div className={styles.crcRow}>
				{editingCrc ? (
					<form action={crcFormAction} className={styles.inlineForm}>
						<input type="hidden" name="gameId" value={game.id} />
						<input
							name="crc"
							defaultValue={game.crc ?? ""}
							placeholder="CRC（8桁hex）"
							maxLength={8}
						/>
						<button type="submit">保存</button>
						<button type="button" onClick={() => setEditingCrc(false)}>
							キャンセル
						</button>
						{crcState?.error ? (
							<span className={styles.error}>{crcState.error}</span>
						) : null}
					</form>
				) : (
					<>
						<span className={styles.crcLabel}>
							CRC: {game.crc ?? <span className={styles.muted}>未設定</span>}
						</span>
						{game.sharedWithOthers ? null : (
							<button type="button" onClick={() => setEditingCrc(true)}>
								CRC を編集
							</button>
						)}
						{game.crc ? null : (
							<span className={styles.note}>
								CRC 未設定のため zip 出力からは除外されます
							</span>
						)}
					</>
				)}
			</div>

			<ul className={styles.cheatList}>{children}</ul>
		</div>
	);
}
