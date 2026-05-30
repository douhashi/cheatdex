/** API Route Handler 用の共通 JSON レスポンスヘルパ。 */

export function json(data: unknown, status = 200): Response {
	return Response.json(data, { status });
}

export function unauthorized(): Response {
	return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string): Response {
	return Response.json({ error: message }, { status: 400 });
}
