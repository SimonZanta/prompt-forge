/** Builds a JSON `Response` with the given HTTP status (200 by default). */
export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/** Shorthand for `{ error: message }` responses with a non-2xx status. */
export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}

/** Parses the request body as a JSON object; malformed or missing bodies become `{}`. */
export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}
