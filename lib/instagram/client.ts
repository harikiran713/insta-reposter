// Minimal wrapper around the official Instagram Graph API (Instagram API with Instagram Login).

export const GRAPH_URL = "https://graph.instagram.com/v23.0";

/** An error whose `userMessage` is safe to show in the browser. */
export class AppError extends Error {
  constructor(
    public userMessage: string,
    public status = 400,
    detail?: string,
  ) {
    super(detail ?? userMessage);
  }
}

export const ERRORS = {
  invalidUrl: "Please enter a valid Instagram Reel URL.",
  notConnected: "Please connect your Instagram account first.",
  reelUnavailable: "This Reel cannot be retrieved using the supported Instagram API.",
  publishFailed: "Instagram could not publish this Reel.",
} as const;

type Params = Record<string, string | number | undefined>;

function toSearch(params: Params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search;
}

/**
 * Calls the Graph API. `path` may be a relative path ("/me/media") or a full
 * pagination URL returned by the API. Throws a plain Error (server-side detail only).
 */
export async function graphRequest<T>(
  path: string,
  accessToken: string,
  { method = "GET", params = {} }: { method?: "GET" | "POST"; params?: Params } = {},
): Promise<T> {
  const url = new URL(path.startsWith("https://") ? path : `${GRAPH_URL}${path}`);
  if (url.hostname !== "graph.instagram.com") throw new Error(`Refusing to call ${url.hostname}`);

  const init: RequestInit = { method, cache: "no-store" };
  if (method === "GET") {
    toSearch(params).forEach((value, key) => url.searchParams.set(key, value));
    url.searchParams.set("access_token", accessToken);
  } else {
    init.headers = { "Content-Type": "application/x-www-form-urlencoded" };
    init.body = toSearch({ ...params, access_token: accessToken });
  }

  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.error) {
    const err = data?.error;
    throw new Error(
      `Graph API ${method} ${url.pathname} failed (${res.status}): ${err?.message ?? "unknown error"}` +
        (err?.code ? ` [code ${err.code}${err.error_subcode ? `/${err.error_subcode}` : ""}]` : ""),
    );
  }
  return data as T;
}
