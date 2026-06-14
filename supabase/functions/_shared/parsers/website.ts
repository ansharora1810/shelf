import { FastEnrichment, FullContent, Parser } from "./types.ts";
import { DEFAULT_USER_AGENT, fetchWithTimeout } from "./http.ts";
import { extractTextContent, parseMeta } from "./html.ts";

const CONTENT_TIMEOUT_MS = 10_000;
const WORDS_PER_MINUTE = 225;

// Default parser for any host without a platform-specific handler. Reads OG
// metadata for the fast path and the full article text for consume-time.
export class WebsiteParser implements Parser {
  async fetchFast(url: string, timeoutMs: number): Promise<FastEnrichment> {
    const html = await this.fetchHtml(url, timeoutMs);
    return html ? parseMeta(html) : { title: null, thumbnailUrl: null };
  }

  async fetchContent(url: string): Promise<FullContent> {
    const html = await this.fetchHtml(url, CONTENT_TIMEOUT_MS);
    if (!html) return { rawContent: null, consumeTime: null, thumbnailUrl: null };

    const text = extractTextContent(html);
    const { thumbnailUrl } = parseMeta(html);
    return {
      rawContent: text || null,
      consumeTime: text ? this.estimateReadSeconds(text) : null,
      thumbnailUrl,
    };
  }

  private async fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
    const res = await fetchWithTimeout(url, timeoutMs, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    });
    return res?.ok ? res.text() : null;
  }

  private estimateReadSeconds(text: string): number {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return Math.round((wordCount / WORDS_PER_MINUTE) * 60);
  }
}
