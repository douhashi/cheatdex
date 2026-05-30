"use client";

import { useActionState, useState } from "react";
import type { CheatCode } from "@/app/lib/db/schema";
import {
	type ActionState,
	deleteCheatCodeAction,
	toggleCheatCodeAction,
	updateCheatCodeAction,
} from "./actions";
import styles from "./dashboard.module.css";

/**
 * CheatCode 1 件の表示・編集・ON/OFF・削除（クライアントコンポーネント）。
 * 編集は useActionState でエラー表示、トグル/削除は単純な form action。
 */
export function CheatCodeRow({ cheatCode }: { cheatCode: CheatCode }) {
	const [editing, setEditing] = useState(false);
	const [state, formAction] = useActionState<ActionState, FormData>(
		async (prev, form) => {
			const result = await updateCheatCodeAction(prev, form);
			if (!result?.error) setEditing(false);
			return result;
		},
		undefined,
	);

	if (editing) {
		return (
			<li className={styles.cheatRow}>
				<form action={formAction} className={styles.editForm}>
					<input type="hidden" name="id" value={cheatCode.id} />
					<label>
						名前
						<input name="name" defaultValue={cheatCode.name} required />
					</label>
					<label>
						コード
						<textarea name="code" defaultValue={cheatCode.code} required />
					</label>
					<label>
						説明
						<input
							name="description"
							defaultValue={cheatCode.description ?? ""}
						/>
					</label>
					{state?.error ? <p className={styles.error}>{state.error}</p> : null}
					<div className={styles.rowActions}>
						<button type="submit">保存</button>
						<button type="button" onClick={() => setEditing(false)}>
							キャンセル
						</button>
					</div>
				</form>
			</li>
		);
	}

	return (
		<li className={styles.cheatRow} data-enabled={cheatCode.enabled}>
			<div className={styles.cheatInfo}>
				<span className={styles.cheatName}>{cheatCode.name}</span>
				<code className={styles.cheatCode}>{cheatCode.code}</code>
				{cheatCode.description ? (
					<span className={styles.cheatDesc}>{cheatCode.description}</span>
				) : null}
				<span className={styles.badge}>
					{cheatCode.enabled ? "有効" : "無効"}
				</span>
			</div>
			<div className={styles.rowActions}>
				<form action={toggleCheatCodeAction}>
					<input type="hidden" name="id" value={cheatCode.id} />
					<input
						type="hidden"
						name="enabled"
						value={String(!cheatCode.enabled)}
					/>
					<button type="submit">
						{cheatCode.enabled ? "無効化" : "有効化"}
					</button>
				</form>
				<button type="button" onClick={() => setEditing(true)}>
					編集
				</button>
				<form action={deleteCheatCodeAction}>
					<input type="hidden" name="id" value={cheatCode.id} />
					<button type="submit">削除</button>
				</form>
			</div>
		</li>
	);
}
