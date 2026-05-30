"use client";

import { useActionState, useRef } from "react";
import type { Game, Platform } from "@/app/lib/db/schema";
import { type ActionState, createCheatCodeAction } from "./actions";
import styles from "./dashboard.module.css";

/**
 * CheatCode 手動登録フォーム（クライアントコンポーネント）。
 * 既存 Game を選択して登録する（Game は共有マスタ）。
 */
export function CreateCheatCodeForm({
	platforms,
	games,
}: {
	platforms: Platform[];
	games: Game[];
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [state, formAction] = useActionState<ActionState, FormData>(
		async (prev, form) => {
			const result = await createCheatCodeAction(prev, form);
			if (!result?.error) formRef.current?.reset();
			return result;
		},
		undefined,
	);

	const platformName = new Map(platforms.map((p) => [p.id, p.name]));

	if (games.length === 0) {
		return (
			<p className={styles.note}>
				登録可能な Game がありません。先に Chrome 拡張などから登録してください。
			</p>
		);
	}

	return (
		<form ref={formRef} action={formAction} className={styles.createForm}>
			<label>
				Game
				<select name="gameId" required defaultValue="">
					<option value="" disabled>
						選択してください
					</option>
					{games.map((g) => (
						<option key={g.id} value={g.id}>
							{platformName.get(g.platformId) ?? "?"} / {g.title}
						</option>
					))}
				</select>
			</label>
			<label>
				名前
				<input name="name" required />
			</label>
			<label>
				コード
				<textarea name="code" required />
			</label>
			<label>
				説明（任意）
				<input name="description" />
			</label>
			{state?.error ? <p className={styles.error}>{state.error}</p> : null}
			<button type="submit">登録</button>
		</form>
	);
}
