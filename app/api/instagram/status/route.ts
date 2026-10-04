import { getSession } from "@/lib/instagram/auth";

// Tells the browser whether an account is connected. Never returns the token.
export async function GET() {
  const session = await getSession();
  return Response.json(
    session ? { connected: true, username: session.username } : { connected: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
