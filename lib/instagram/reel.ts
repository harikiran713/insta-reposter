import "server-only";
import { z } from "zod";
import { AppError, ERRORS, graphRequest } from "./client";
import type { Session } from "./auth";

/*
 * All Reel retrieval lives in this file. If Meta's API capabilities change,
 * only `fetchReel` needs updating; the rest of the app stays the same.
 */

export type Reel = {
  videoUrl: string;
  caption: string;
  creatorUsername: string;
};

// Matches /reel/{code}/, /reels/{code}/ and /{username}/reel/{code}/
const REEL_PATH = /^\/(?:[A-Za-z0-9._]+\/)?reels?\/([A-Za-z0-9_-]{5,})\/?$/;

/** Validates an Instagram Reel URL and returns its shortcode. */
export const reelUrlSchema = z
  .string()
  .trim()
  .max(500)
  .url()
  .transform((value, ctx) => {
    const url = new URL(value);
    const match = url.pathname.match(REEL_PATH);
    if (
      url.protocol !== "https:" ||
      !["instagram.com", "www.instagram.com"].includes(url.hostname) ||
      !match
    ) {
      ctx.addIssue({ code: "custom", message: ERRORS.invalidUrl });
      return z.NEVER;
    }
    return match[1];
  });

type MediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  shortcode?: string;
  username?: string;
};

type MediaPage = { data: MediaItem[]; paging?: { next?: string } };

const MAX_PAGES = 10;

/**
 * Retrieves a Reel through the official Instagram API.
 *
 * The Instagram API with Instagram Login only exposes media owned by the
 * connected account, so the Reel is looked up in that account's media by its
 * shortcode. Reels from other accounts are not retrievable through the
 * official API and are reported as unavailable; no scraping fallback is used.
 */
export async function fetchReel(shortcode: string, session: Session): Promise<Reel> {
  let next: string | undefined = `/${session.userId}/media`;

  for (let page = 0; next && page < MAX_PAGES; page++) {
    const result: MediaPage = await graphRequest<MediaPage>(next, session.accessToken, {
      // Pagination URLs from the API already include fields/limit/cursor.
      params:
        page === 0
          ? { fields: "id,caption,media_type,media_url,permalink,shortcode,username", limit: 50 }
          : {},
    });

    const item = result.data.find(
      (m) => m.shortcode === shortcode || m.permalink?.includes(`/${shortcode}/`),
    );
    if (item) {
      if (item.media_type !== "VIDEO" || !item.media_url) {
        throw new AppError(ERRORS.reelUnavailable, 422, `Media ${item.id} is not an accessible video`);
      }
      return {
        videoUrl: item.media_url,
        caption: item.caption ?? "",
        creatorUsername: item.username ?? session.username,
      };
    }
    next = result.paging?.next;
  }

  throw new AppError(ERRORS.reelUnavailable, 422, `Shortcode ${shortcode} not found via official API`);
}
