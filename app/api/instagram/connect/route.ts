import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, buildAuthorizeUrl, secureCookies } from "@/lib/instagram/auth";

// Starts the official Instagram OAuth flow.
export async function GET(request: NextRequest) {
  if (!process.env.INSTAGRAM_APP_ID || !process.env.INSTAGRAM_APP_SECRET || !process.env.INSTAGRAM_REDIRECT_URI) {
    console.error("[instagram/connect] INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET or INSTAGRAM_REDIRECT_URI is empty");
    return NextResponse.redirect(new URL("/?instagram=not_configured", request.url));
  }

  try {
    const state = randomBytes(24).toString("base64url");
    const response = NextResponse.redirect(buildAuthorizeUrl(state));
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: "lax",
      path: "/api/instagram/callback",
      maxAge: 600,
    });
    return response;
  } catch (err) {
    console.error("[instagram/connect]", err);
    return NextResponse.redirect(new URL("/?instagram=error", request.url));
  }
}
