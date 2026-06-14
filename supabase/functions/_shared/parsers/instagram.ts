import { FastEnrichment, FullContent, Parser } from "./types.ts";
import { fetchWithTimeout } from "./http.ts";
import { metaProperty, parseMeta } from "./html.ts";

const CONTENT_TIMEOUT_MS = 10_000;

// Instagram's own web client reads posts through `/api/graphql` with a
// persisted query (`doc_id`) and the public web app id — no cookie required.
// This returns the full caption plus structured media fields, where the OG
// meta tags Instagram serves to bots are truncated and login-gated. The
// OG-meta scrape is kept as a fallback if the endpoint changes shape.
const GRAPHQL_ENDPOINT = "https://www.instagram.com/api/graphql";
const APP_ID = "936619743392459";
const LSD = "AVqbxe3J_YA";
const DOC_ID = "10015901848480474";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// An Instagram link can be a post, reel, story, profile, the feed, or some
// other surface (explore, audio pages, account settings). Only posts and reels
// (incl. legacy IGTV `/tv/`) carry a shortcode and a caption.
export type InstagramUrlKind = "post" | "reel" | "story" | "profile" | "feed" | "other";

const RESERVED_SEGMENTS = new Set([
  "p", "reel", "reels", "tv", "stories",
  "explore", "accounts", "direct", "about", "developer", "legal",
  "press", "api", "web", "channel", "igtv", "ar",
]);

interface InstagramRef {
  kind: InstagramUrlKind;
  shortcode: string | null;
}

interface InstagramMedia {
  caption: string | null;
  thumbnailUrl: string | null;
  isVideo: boolean;
  videoDuration: number | null;
  ownerUsername: string | null;
}

function parseUrl(url: string): InstagramRef {
  let segments: string[];
  try {
    segments = new URL(url).pathname.split("/").filter(Boolean);
  } catch {
    return { kind: "other", shortcode: null };
  }
  if (segments.length === 0) return { kind: "feed", shortcode: null };

  const [first, second] = segments;
  if ((first === "p" || first === "tv") && second) return { kind: "post", shortcode: second };
  if (first === "reel" && second) return { kind: "reel", shortcode: second };
  if (first === "reels" && second && second !== "audio") return { kind: "reel", shortcode: second };
  if (first === "stories" && second) return { kind: "story", shortcode: null };
  if (segments.length === 1 && !RESERVED_SEGMENTS.has(first)) {
    return { kind: "profile", shortcode: null };
  }
  return { kind: "other", shortcode: null };
}

export function classifyInstagramUrl(url: string): InstagramUrlKind {
  return parseUrl(url).kind;
}

export class InstagramParser implements Parser {
  async fetchFast(url: string, timeoutMs: number): Promise<FastEnrichment> {
    const media = await this.fetchGraphql(url, timeoutMs);
    if (media) {
      return {
        title: this.captionToTitle(media.caption, media.ownerUsername),
        thumbnailUrl: media.thumbnailUrl,
      };
    }
    const html = await this.fetchHtml(url, timeoutMs);
    return html ? parseMeta(html) : { title: null, thumbnailUrl: null };
  }

  async fetchContent(url: string): Promise<FullContent> {
    const media = await this.fetchGraphql(url, CONTENT_TIMEOUT_MS);
    if (media) {
      return {
        rawContent: media.caption,
        consumeTime: media.isVideo ? media.videoDuration : null,
        thumbnailUrl: media.thumbnailUrl,
      };
    }

    // No caption via GraphQL. For posts/reels this is an endpoint failure —
    // fall back to the OG description as a best-effort caption. Profiles,
    // stories, and the feed have no caption: keep only the thumbnail.
    const html = await this.fetchHtml(url, CONTENT_TIMEOUT_MS);
    if (!html) return { rawContent: null, consumeTime: null, thumbnailUrl: null };

    const { thumbnailUrl } = parseMeta(html);
    const { kind } = parseUrl(url);
    const captioned = kind === "post" || kind === "reel";
    return {
      rawContent: captioned ? metaProperty(html, "og:description") : null,
      consumeTime: null,
      thumbnailUrl,
    };
  }

  private async fetchGraphql(url: string, timeoutMs: number): Promise<InstagramMedia | null> {
    const { shortcode } = parseUrl(url);
    if (!shortcode) return null;

    const endpoint = new URL(GRAPHQL_ENDPOINT);
    endpoint.searchParams.set("variables", JSON.stringify({ shortcode }));
    endpoint.searchParams.set("doc_id", DOC_ID);
    endpoint.searchParams.set("lsd", LSD);

    const res = await fetchWithTimeout(endpoint.toString(), timeoutMs, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        "X-IG-App-ID": APP_ID,
        "X-FB-LSD": LSD,
        "X-ASBD-ID": "129477",
        "Sec-Fetch-Site": "same-origin",
      },
    });
    if (!res?.ok) return null;

    try {
      const json = await res.json();
      const media = json?.data?.xdt_shortcode_media;
      if (!media) return null;
      return {
        caption: media.edge_media_to_caption?.edges?.[0]?.node?.text ?? null,
        thumbnailUrl: media.display_url ?? media.thumbnail_src ?? null,
        isVideo: media.is_video ?? false,
        videoDuration:
          typeof media.video_duration === "number" ? Math.round(media.video_duration) : null,
        ownerUsername: media.owner?.username ?? null,
      };
    } catch {
      return null;
    }
  }

  private async fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
    const res = await fetchWithTimeout(url, timeoutMs, {
      headers: { "User-Agent": USER_AGENT },
    });
    return res?.ok ? res.text() : null;
  }

  private captionToTitle(caption: string | null, owner: string | null): string | null {
    const firstLine = caption?.split("\n").map((s) => s.trim()).find(Boolean);
    if (firstLine) {
      return firstLine.length > 100 ? `${firstLine.slice(0, 100).trimEnd()}…` : firstLine;
    }
    return owner ? `Instagram post by @${owner}` : null;
  }
}
