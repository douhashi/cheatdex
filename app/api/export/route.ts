import { authenticate } from "@/app/lib/auth/authenticate";
import { getDb } from "@/app/lib/db/client";
import { getGamesForExport } from "@/app/lib/db/queries";
import { buildExport } from "@/app/lib/export/zip";
import { unauthorized } from "@/app/lib/http";

/**
 * GET /api/export — PCSX2 用 zip ダウンロード（所有者スコープ）。
 *
 * - 認証は API 共通の `authenticate()`（Bearer PAT またはセッション）。
 *   未認証は 401（ブラウザの <a download> でもセッション cookie が送られる）。
 * - 自分の Game / 自分の enabled な CheatCode のみ対象（user_id で絞る）。
 * - Game ごとに cheats/<CRC>.pnach に分割した zip を返す。
 *   CRC 未設定 / 不正 / 有効チート無しの Game はスキップ（件数を header で通知）。
 */
export async function GET(req: Request): Promise<Response> {
	const user = await authenticate(req);
	if (user === null) {
		return unauthorized();
	}

	const db = getDb();
	const games = await getGamesForExport(db, user.id);
	const { zip, skipped } = buildExport(games);

	return new Response(zip as BodyInit, {
		status: 200,
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="${exportFileName()}"`,
			"X-Cheatdex-Skipped": String(skipped.length),
		},
	});
}

/** ダウンロードファイル名（UTC 日付）: cheatdex-ps2-YYYYMMDD.zip */
function exportFileName(date = new Date()): string {
	const yyyy = date.getUTCFullYear();
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(date.getUTCDate()).padStart(2, "0");
	return `cheatdex-ps2-${yyyy}${mm}${dd}.zip`;
}
