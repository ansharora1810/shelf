import { FullContent, Parser } from "./types.ts";
import { fetchWithTimeout } from "./http.ts";
import { YOUTUBE_OEMBED_TIMEOUT_MS } from "../constants.ts";

// YouTube parser. Title + thumbnail come from oEmbed — the only YouTube endpoint
// that returns real metadata from a datacenter IP. InnerTube and the watch page
// are IP-blocked there (they respond, but with title/duration stripped), so
// duration and transcript aren't obtainable from the worker; they're left null
// and the AI tags from the title. (A proxied transcript API would be needed to
// recover them — deferred.)
export class YoutubeParser implements Parser {
  async fetchContent(url: string): Promise<FullContent> {
    const videoId = this.extractVideoId(url);
    const oembed = await this.fetchOembed(url);
    return {
      title: oembed?.title ?? null,
      rawContent: null,
      consumeTime: null,
      thumbnailUrl:
        oembed?.thumbnailUrl ??
        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
    };
  }

  private extractVideoId(url: string): string | null {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") return u.pathname.slice(1);
      return u.searchParams.get("v");
    } catch {
      return null;
    }
  }

  private async fetchOembed(
    url: string,
  ): Promise<{ title: string | null; thumbnailUrl: string | null } | null> {
    const oembedUrl =
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetchWithTimeout(oembedUrl, YOUTUBE_OEMBED_TIMEOUT_MS);
    if (!res?.ok) return null;
    try {
      const json = await res.json();
      return { title: json.title ?? null, thumbnailUrl: json.thumbnail_url ?? null };
    } catch {
      return null;
    }
  }
}
