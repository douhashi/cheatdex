"use client";

import { useActionState, useRef } from "react";
import { type IssueTokenState, issueTokenAction } from "./actions";
import styles from "./tokens.module.css";

/**
 * PAT 発行フォーム（クライアントコンポーネント）。
 * 発行に成功したら、その場で平文トークンを 1 度だけ表示する（再表示不可）。
 */
export function TokenIssueForm() {
	const formRef = useRef<HTMLFormElement>(null);
	const [state, formAction] = useActionState<IssueTokenState, FormData>(
		async (prev, form) => {
			const result = await issueTokenAction(prev, form);
			if (result && "token" in result) formRef.current?.reset();
			return result;
		},
		undefined,
	);

	return (
		<div>
			<form ref={formRef} action={formAction} className={styles.issueForm}>
				<label>
					用途名
					<input name="name" placeholder="例: Chrome 拡張" required />
				</label>
				<button type="submit">発行</button>
			</form>
			{state && "error" in state ? (
				<p className={styles.error}>{state.error}</p>
			) : null}
			{state && "token" in state ? (
				<div className={styles.issued}>
					<p>
						以下のトークンを Chrome
						拡張に設定してください。この画面を離れると再表示できません。
					</p>
					<code className={styles.tokenValue}>{state.token}</code>
				</div>
			) : null}
		</div>
	);
}
