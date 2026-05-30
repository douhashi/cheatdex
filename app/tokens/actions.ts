"use server";

import { revalidatePath } from "next/cache";
import { issueToken, revokeToken } from "@/app/lib/auth/pat";
import { requireUser } from "@/app/lib/auth/session";

/**
 * PAT 管理の Server Actions（Web UI 専用 = 論点 3）。
 *
 * - 発行: 平文トークンは発行時のみ返す（再表示不可・pat.ts を踏襲）。
 * - 削除: 物理 DELETE（所有者スコープ・論点 2）。
 */

export type IssueTokenState = { token: string } | { error: string } | undefined;

export async function issueTokenAction(
	_prev: IssueTokenState,
	form: FormData,
): Promise<IssueTokenState> {
	const user = await requireUser();
	const nameValue = form.get("name");
	const name = typeof nameValue === "string" ? nameValue.trim() : "";
	if (name === "") return { error: "name is required" };
	const { token } = await issueToken(user.id, name);
	revalidatePath("/tokens");
	return { token };
}

export async function revokeTokenAction(form: FormData): Promise<void> {
	const user = await requireUser();
	const idValue = form.get("id");
	const id = Number(typeof idValue === "string" ? idValue : "");
	if (!Number.isInteger(id) || id <= 0) return;
	await revokeToken(user.id, id);
	revalidatePath("/tokens");
}
