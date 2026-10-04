import "server-only";
import { AppError, ERRORS, graphRequest } from "./client";
import type { Session } from "./auth";

/** Adds the credit line at the top; the original caption is kept exactly as-is. */
export function buildCaption(creatorUsername: string, originalCaption: string) {
  const credit = `🎥 Credit: @${creatorUsername.replace(/^@/, "")}`;
  return originalCaption.trim() ? `${credit}\n\n${originalCaption}` : credit;
}

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 60; // ~5 minutes

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Publishes a Reel via the official content publishing API and returns its permalink. */
export async function publishReel(session: Session, videoUrl: string, caption: string) {
  try {
    // 1. Create the media container
    const container = await graphRequest<{ id: string }>(`/${session.userId}/media`, session.accessToken, {
      method: "POST",
      params: { media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true" },
    });

    // 2. Wait until Instagram has finished processing the video
    for (let i = 0; ; i++) {
      const { status_code } = await graphRequest<{ status_code: string }>(
        `/${container.id}`,
        session.accessToken,
        { params: { fields: "status_code" } },
      );
      if (status_code === "FINISHED") break;
      if (status_code === "ERROR" || status_code === "EXPIRED" || i >= MAX_POLLS) {
        throw new Error(`Container ${container.id} ended with status ${status_code}`);
      }
      await sleep(POLL_INTERVAL_MS);
    }

    // 3. Publish
    const published = await graphRequest<{ id: string }>(
      `/${session.userId}/media_publish`,
      session.accessToken,
      { method: "POST", params: { creation_id: container.id } },
    );

    // 4. Fetch the public link (non-critical)
    const { permalink } = await graphRequest<{ permalink?: string }>(`/${published.id}`, session.accessToken, {
      params: { fields: "permalink" },
    }).catch(() => ({ permalink: undefined }));

    return permalink ?? `https://www.instagram.com/${session.username}/`;
  } catch (err) {
    throw new AppError(ERRORS.publishFailed, 502, (err as Error).message);
  }
}
