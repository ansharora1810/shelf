import { FullContent, Parser } from "./types.ts";
import { Logger } from "../log.ts";
import { DEFAULT_USER_AGENT, fetchWithTimeout } from "./http.ts";
import { extractTextContent, parseMeta } from "./html.ts";
import { CONTENT_FETCH_TIMEOUT_MS, WORDS_PER_MINUTE } from "../constants.ts";

// Default parser for any host without a platform-specific handler. Reads OG
// metadata (title + thumbnail) and the full article text for consume-time.
// With DEBUG_PARSING on, logs the HTTP status, raw body, and parsed body text
// (visible in the edge-function logs) to diagnose new sites.
export class WebsiteParser implements Parser {
  async fetchContent(url: string, log?: Logger): Promise<FullContent> {
    const res = await fetchWithTimeout(url, CONTENT_FETCH_TIMEOUT_MS, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    });
    const html = res?.ok ? await res.text() : null;

    log?.debug("website-get", `status=${res?.status ?? "no-response"} bodyChars=${html?.length ?? 0}`);
    if (html) log?.debug("website-raw", html.slice(0, 4_000));

    if (!html) return { title: null, rawContent: null, consumeTime: null, thumbnailUrl: null };

    const text = extractTextContent(html);
    const { title, thumbnailUrl } = parseMeta(html);

    log?.debug("website-parsed", `title=${JSON.stringify(title)} textChars=${text.length} thumb=${JSON.stringify(thumbnailUrl)}`);
    log?.debug("website-text", text.slice(0, 2_000));

    return {
      title,
      rawContent: text || null,
      consumeTime: text ? this.estimateReadSeconds(text) : null,
      thumbnailUrl,
    };
  }

  private estimateReadSeconds(text: string): number {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return Math.round((wordCount / WORDS_PER_MINUTE) * 60);
  }
}
