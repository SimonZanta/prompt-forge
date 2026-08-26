/** Error thrown by `apiRequest` for non-2xx responses; carries the HTTP status. */
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

/** Calls `/api<path>` and returns the parsed JSON body; throws `ApiError` when the server answers with an error. */
export async function apiRequest<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch("/api" + path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error || response.statusText, response.status);
  return data as T;
}

/** Fetch options for sending `body` as JSON with the given HTTP method. */
export function jsonRequestOptions(method: "POST" | "PUT", body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
