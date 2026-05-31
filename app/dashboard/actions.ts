"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/lib/auth/session";
import {
	createCheatCode,
	deleteCheatCode,
	deleteGameCheatCodes,
	setCheatCodeEnabled,
	updateCheatCode,
	updateGameCrc,
	updateGameTitle,
} from "@/app/lib/cheatcode/mutations";
import { validateCheatCodeItem } from "@/app/lib/cheatcode/validate";
import { getDb } from "@/app/lib/db/client";

/**
 * ダッシュボードの編集系 Server Actions（Web UI 専用 = 論点 3）。
 *
 * - 認証ガードは requireUser（未ログインはサインインへ・論点 4）。
 * - 所有者スコープは mutations 側で `and(eq(id), eq(userId))` により担保。
 * - 入力検証は単件/ bulk と共通の `validateCheatCodeItem`（DRY）。
 * - 変更後は revalidatePath で即時反映。
 *
 * フォームからの呼び出しに合わせ FormData を受け取り、エラーは返り値で返す。
 */

export type ActionState = { error?: string } | undefined;

function fieldString(form: FormData, key: string): string {
	const value = form.get(key);
	return typeof value === "string" ? value : "";
}

function parseId(form: FormData, key: string): number | null {
	const raw = fieldString(form, key);
	const id = Number(raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}

export async function updateCheatCodeAction(
	_prev: ActionState,
	form: FormData,
): Promise<ActionState> {
	const user = await requireUser();
	const id = parseId(form, "id");
	if (id === null) return { error: "id is required" };
	const validated = validateCheatCodeItem({
		name: fieldString(form, "name"),
		code: fieldString(form, "code"),
		description: fieldString(form, "description"),
	});
	if (!validated.ok) return { error: validated.reason };
	const result = await updateCheatCode(getDb(), user.id, id, validated.value);
	if (!result.ok) return { error: result.error };
	revalidatePath("/dashboard");
	return undefined;
}

export async function toggleCheatCodeAction(form: FormData): Promise<void> {
	const user = await requireUser();
	const id = parseId(form, "id");
	if (id === null) return;
	const enabled = fieldString(form, "enabled") === "true";
	await setCheatCodeEnabled(getDb(), user.id, id, enabled);
	revalidatePath("/dashboard");
}

export async function deleteCheatCodeAction(form: FormData): Promise<void> {
	const user = await requireUser();
	const id = parseId(form, "id");
	if (id === null) return;
	await deleteCheatCode(getDb(), user.id, id);
	revalidatePath("/dashboard");
}

export async function updateGameAction(
	_prev: ActionState,
	form: FormData,
): Promise<ActionState> {
	const user = await requireUser();
	const gameId = parseId(form, "gameId");
	if (gameId === null) return { error: "gameId is required" };
	const result = await updateGameTitle(
		getDb(),
		user.id,
		gameId,
		fieldString(form, "title"),
	);
	if (!result.ok) return { error: result.error };
	revalidatePath("/dashboard");
	return undefined;
}

export async function updateGameCrcAction(
	_prev: ActionState,
	form: FormData,
): Promise<ActionState> {
	const user = await requireUser();
	const gameId = parseId(form, "gameId");
	if (gameId === null) return { error: "gameId is required" };
	const result = await updateGameCrc(
		getDb(),
		user.id,
		gameId,
		fieldString(form, "crc"),
	);
	if (!result.ok) return { error: result.error };
	revalidatePath("/dashboard");
	return undefined;
}

export async function deleteGameAction(form: FormData): Promise<void> {
	const user = await requireUser();
	const gameId = parseId(form, "gameId");
	if (gameId === null) return;
	await deleteGameCheatCodes(getDb(), user.id, gameId);
	revalidatePath("/dashboard");
}

export async function createCheatCodeAction(
	_prev: ActionState,
	form: FormData,
): Promise<ActionState> {
	const user = await requireUser();
	const gameId = parseId(form, "gameId");
	if (gameId === null) return { error: "gameId is required" };
	const validated = validateCheatCodeItem({
		name: fieldString(form, "name"),
		code: fieldString(form, "code"),
		description: fieldString(form, "description"),
	});
	if (!validated.ok) return { error: validated.reason };
	const result = await createCheatCode(
		getDb(),
		user.id,
		gameId,
		validated.value,
	);
	if (!result.ok) return { error: result.error };
	revalidatePath("/dashboard");
	return undefined;
}
