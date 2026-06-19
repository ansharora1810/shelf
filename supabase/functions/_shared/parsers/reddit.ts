import { FullContent, Parser } from "./types.ts";
import { fetchWithTimeout } from "./http.ts";
import { parseMeta } from "./html.ts";

const CONTENT_TIMEOUT_MS = 10_000;
const WORDS_PER_MINUTE = 225;

// Reddit serves a bot-verification wall to the generic crawler UA, so the
// default WebsiteParser yields nothing. The public `.json` view of a post
// returns the same data the web client uses — title, selftext, media, and a
// clean preview image — and answers to a browser UA. `raw_json=1` keeps text
// and image URLs unescaped; `limit=1` trims the comment tree we don't read.
// Non-post surfaces (subreddits, users) have no JSON post payload, so they
// fall back to the OG-meta scrape for a best-effort title + thumbnail.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const PLACEHOLDER_THUMBNAILS = new Set([
  "self", "default", "nsfw", "spoiler", "image", "",
]);

interface RedditPost {
  title: string | null;
  selftext: string | null;
  thumbnailUrl: string | null;
  videoDuration: number | null;
}

export class RedditParser implements Parser {
  async fetchContent(url: string): Promise<FullContent> {
    const post = await this.fetchPost(url, CONTENT_TIMEOUT_MS);
    if (post) {
      const body = post.selftext?.trim() || null;
      return {
        title: post.title,
        rawContent: body,
        consumeTime: post.videoDuration ?? (body ? this.estimateReadSeconds(body) : null),
        thumbnailUrl: post.thumbnailUrl,
      };
    }

    const html = await this.fetchHtml(url, CONTENT_TIMEOUT_MS);
    if (!html) return { title: null, rawContent: null, consumeTime: null, thumbnailUrl: null };
    const { title, thumbnailUrl } = parseMeta(html);
    return { title, rawContent: null, consumeTime: null, thumbnailUrl };
  }

  private async fetchPost(url: string, timeoutMs: number): Promise<RedditPost | null> {
    const jsonUrl = this.toJsonUrl(url);
    if (!jsonUrl) return null;

    const res = await fetchWithTimeout(jsonUrl, timeoutMs, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res?.ok) return null;

    try {
      const json = await res.json();
      const data = json?.[0]?.data?.children?.[0]?.data;
      if (!data) return null;
      return {
        title: data.title ?? null,
        selftext: data.selftext ?? null,
        thumbnailUrl: this.pickThumbnail(data),
        videoDuration: data.is_video
          ? (data.media?.reddit_video?.duration ?? null)
          : null,
      };
    } catch {
      return null;
    }
  }

  private toJsonUrl(url: string): string | null {
    try {
      const u = new URL(url);
      if (!u.pathname.includes("/comments/")) return null;
      u.pathname = `${u.pathname.replace(/\/$/, "")}.json`;
      u.search = "";
      u.searchParams.set("raw_json", "1");
      u.searchParams.set("limit", "1");
      return u.toString();
    } catch {
      return null;
    }
  }

  private pickThumbnail(data: Record<string, unknown>): string | null {
    const preview = data.preview as
      | { images?: Array<{ source?: { url?: string } }> }
      | undefined;
    const previewUrl = preview?.images?.[0]?.source?.url;
    if (previewUrl) return previewUrl;

    const thumbnail = typeof data.thumbnail === "string" ? data.thumbnail : "";
    return PLACEHOLDER_THUMBNAILS.has(thumbnail) ? null : thumbnail;
  }

  private async fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
    const res = await fetchWithTimeout(url, timeoutMs, {
      headers: { "User-Agent": USER_AGENT },
    });
    return res?.ok ? res.text() : null;
  }

  private estimateReadSeconds(text: string): number {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return Math.round((wordCount / WORDS_PER_MINUTE) * 60);
  }
}
