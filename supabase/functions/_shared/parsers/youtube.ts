import { FastEnrichment, FullContent, Parser } from "./types.ts";
import { DEFAULT_USER_AGENT, fetchWithTimeout } from "./http.ts";

const CONTENT_TIMEOUT_MS = 10_000;
const TRANSCRIPT_TIMEOUT_MS = 8_000;

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
}

// YouTube parser. The fast path uses oEmbed (reliable from a datacenter IP);
// the content path scrapes the watch page for video length and a transcript,
// falling back to the description when no captions exist.
export class YoutubeParser implements Parser {
  async fetchFast(url: string, timeoutMs: number): Promise<FastEnrichment> {
    const oembedUrl =
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetchWithTimeout(oembedUrl, timeoutMs);
    if (!res?.ok) return { title: null, thumbnailUrl: null };
    try {
      const json = await res.json();
      return {
        title: json.title ?? null,
        thumbnailUrl: json.thumbnail_url ?? null,
      };
    } catch {
      return { title: null, thumbnailUrl: null };
    }
  }

  async fetchContent(url: string): Promise<FullContent> {
    const videoId = this.extractVideoId(url);
    if (!videoId) return { rawContent: null, consumeTime: null, thumbnailUrl: null };

    const pageHtml = await this.fetchWatchPage(videoId);
    const lengthSeconds = pageHtml ? this.extractLengthSeconds(pageHtml) : null;
    const transcript = pageHtml ? await this.fetchTranscript(pageHtml) : null;

    const rawContent =
      transcript ?? (pageHtml ? this.extractDescription(pageHtml) : null);

    return {
      rawContent,
      consumeTime: lengthSeconds,
      // Deterministic from the video id — always available.
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
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

  private async fetchWatchPage(videoId: string): Promise<string | null> {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/watch?v=${videoId}`,
      CONTENT_TIMEOUT_MS,
      { headers: { "User-Agent": DEFAULT_USER_AGENT } }
    );
    return res?.ok ? res.text() : null;
  }

  private extractLengthSeconds(pageHtml: string): number | null {
    const m = pageHtml.match(/"lengthSeconds":"(\d+)"/);
    return m ? parseInt(m[1], 10) : null;
  }

  private extractDescription(pageHtml: string): string | null {
    const m = pageHtml.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    return m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : null;
  }

  private async fetchTranscript(pageHtml: string): Promise<string | null> {
    const captionMatch = pageHtml.match(/"captionTracks":\s*(\[.*?\])/s);
    if (!captionMatch) return null;

    let tracks: CaptionTrack[];
    try {
      tracks = JSON.parse(captionMatch[1]);
    } catch {
      return null;
    }

    const track = tracks.find((t) => t.languageCode === "en") ?? tracks[0] ?? null;
    if (!track?.baseUrl) return null;

    const res = await fetchWithTimeout(track.baseUrl, TRANSCRIPT_TIMEOUT_MS);
    if (!res?.ok) return null;

    const text = (await res.text())
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    return text || null;
  }
}
