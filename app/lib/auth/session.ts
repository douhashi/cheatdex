import { redirect } from "next/navigation";
import { auth } from "./auth";

/**
 * Web UI（Server Component / Server Action）用の認証ガード。
 *
 * 認証ガードは middleware を導入せず、page / Server Action で本関数を呼ぶ方針
 * （論点 4）。未ログインなら Auth.js のサインインへリダイレクトする。
 * クライアントから渡る id を信用せず、常にセッションの user.id でスコープする。
 */
export async function requireUser(): Promise<{ id: string; email: string }> {
	const session = await auth();
	const user = session?.user;
	if (!user?.id) {
		redirect("/api/auth/signin");
	}
	return { id: user.id, email: user.email ?? "" };
}
