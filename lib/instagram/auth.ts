import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { GRAPH_URL } from "./client";

const SESSION_COOKIE = "ig_session";
export const STATE_COOKIE = "ig_oauth_state";

const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

export type Session = {
  accessToken: string;
  userId: string;
  username: string;
  expiresAt: number; // epoch ms
};

function env() {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new Error("Missing INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET or INSTAGRAM_REDIRECT_URI");
  }
  return { appId, appSecret, redirectUri };
}

export const secureCookies = process.env.NODE_ENV === "production";

// ---------- OAuth ----------

export function buildAuthorizeUrl(state: string) {
  const { appId, redirectUri } = env();
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

async function fetchJson(input: string | URL, init?: RequestInit) {
  const res = await fetch(input, { ...init, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Exchanges the OAuth code for a long-lived (~60 day) token and loads the account username. */
export async function exchangeCodeForSession(code: string): Promise<Session> {
  const { appId, appSecret, redirectUri } = env();

  // 1. Code -> short-lived token
  const short = await fetchJson("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  if (!short.ok || !short.data.access_token) {
    throw new Error(`Short-lived token exchange failed: ${JSON.stringify(short.data)}`);
  }

  // 2. Short-lived -> long-lived token
  const longUrl = new URL("https://graph.instagram.com/access_token");
  longUrl.searchParams.set("grant_type", "ig_exchange_token");
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("access_token", short.data.access_token);
  const long = await fetchJson(longUrl);
  if (!long.ok || !long.data.access_token) {
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(long.data)}`);
  }

  // 3. Account info
  const meUrl = new URL(`${GRAPH_URL}/me`);
  meUrl.searchParams.set("fields", "user_id,username");
  meUrl.searchParams.set("access_token", long.data.access_token);
  const me = await fetchJson(meUrl);
  if (!me.ok || !me.data.username) {
    throw new Error(`Fetching account info failed: ${JSON.stringify(me.data)}`);
  }

  return {
    accessToken: long.data.access_token,
    userId: String(me.data.user_id ?? short.data.user_id),
    username: me.data.username,
    expiresAt: Date.now() + (Number(long.data.expires_in) || 60 * 24 * 3600) * 1000,
  };
}

// ---------- Encrypted session cookie (no database) ----------

function key() {
  // Derive a 256-bit key from the app secret so no extra env var is needed.
  return createHash("sha256").update(`reel-reposter-session:${env().appSecret}`).digest();
}

function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

function decrypt(value: string) {
  const raw = Buffer.from(value, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

export async function saveSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, encrypt(JSON.stringify(session)), {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor((session.expiresAt - Date.now()) / 1000),
  });
}

/** Returns the connected account, or null if not connected / expired / tampered with. */
export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    const session = JSON.parse(decrypt(value)) as Session;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}
