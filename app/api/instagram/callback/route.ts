import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, exchangeCodeForSession, saveSession } from "@/lib/instagram/auth";

function sameState(a: string | undefined, b: string | null) {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Instagram redirects here after the user approves (or denies) access.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  let result = "error";

  try {
    if (params.get("error")) {
      console.error("[instagram/callback] OAuth denied:", params.get("error_reason"));
    } else if (!sameState(request.cookies.get(STATE_COOKIE)?.value, params.get("state"))) {
      console.error("[instagram/callback] OAuth state mismatch");
    } else if (code) {
      await saveSession(await exchangeCodeForSession(code));
      result = "connected";
    }
  } catch (err) {
    console.error("[instagram/callback]", err);
  }

  const response = NextResponse.redirect(new URL(`/?instagram=${result}`, request.url));
  response.cookies.delete({ name: STATE_COOKIE, path: "/api/instagram/callback" });
  return response;
}
