"use server";

import { signIn, signOut } from "./auth";

/**
 * ログイン / ログアウトの Server Actions。
 *
 * Auth.js v5 の signIn / signOut をフォームから呼べるようラップする。
 */
export async function signInAction(): Promise<void> {
	await signIn("google", { redirectTo: "/dashboard" });
}

export async function signOutAction(): Promise<void> {
	await signOut({ redirectTo: "/" });
}
