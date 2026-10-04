import { z } from "zod";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/instagram/auth";
import { AppError, ERRORS } from "@/lib/instagram/client";
import { fetchReel, reelUrlSchema } from "@/lib/instagram/reel";
import { buildCaption, publishReel } from "@/lib/instagram/publish";

export const maxDuration = 300; // video processing can take a few minutes

const bodySchema = z.object({ url: reelUrlSchema });

// ---------- Simple in-memory rate limit (per IP) ----------
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

function fail(message: string, status: number) {
  return Response.json({ success: false, message }, { status });
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  if (rateLimited(ip)) {
    return fail("Too many requests. Please wait a few minutes and try again.", 429);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(ERRORS.invalidUrl, 400);

  const session = await getSession();
  if (!session) return fail(ERRORS.notConnected, 401);

  try {
    const reel = await fetchReel(parsed.data.url, session);
    const caption = buildCaption(reel.creatorUsername, reel.caption);
    const instagramUrl = await publishReel(session, reel.videoUrl, caption);

    return Response.json({ success: true, message: "Reel published successfully", instagramUrl });
  } catch (err) {
    console.error("[reel/post]", err);
    if (err instanceof AppError) return fail(err.userMessage, err.status);
    return fail("Unable to publish Reel", 500);
  }
}
