import { DOMParser } from "jsr:@b-fuze/deno-dom";

export interface FastEnrichment {
  title: string | null;
  thumbnailUrl: string | null;
}

export interface FullContent {
  rawContent: string | null;
  consumeTime: number | null;
  thumbnailUrl: string | null;
}

// ---------------------------------------------------------------------------
// OG / Twitter meta helpers (used by website fast path and Instagram fallback)
// ---------------------------------------------------------------------------

function parseMeta(html: string): FastEnrichment {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { title: null, thumbnailUrl: null };

  function metaContent(property: string): string | null {
    const el =
      doc.querySelector(`meta[property="${property}"]`) ??
      doc.querySelector(`meta[name="${property}"]`);
    return el?.getAttribute("content") ?? null;
  }

  const title =
    metaContent("og:title") ??
    metaContent("twitter:title") ??
    doc.querySelector("title")?.textContent?.trim() ??
    null;

  const thumbnailUrl =
    metaContent("og:image") ?? metaContent("twitter:image") ?? null;

  return { title, thumbnailUrl };
}

// ---------------------------------------------------------------------------
// Text extraction for consume_time (websites)
// ---------------------------------------------------------------------------

function extractTextContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return "";

  // Remove script/style/nav/header/footer noise before extracting text.
  for (const tag of ["script", "style", "nav", "header", "footer", "aside"]) {
    for (const el of doc.querySelectorAll(tag)) {
      el.parentNode?.removeChild(el);
    }
  }

  return doc.querySelector("body")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export function computeWebsiteConsumeTime(text: string): number {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return Math.round((wordCount / 225) * 60);
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  options?: RequestInit
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Redirect resolution — short links (tinyurl, t.co, youtu.be→watch, …) must be
// classified and parsed by their *destination*, not the shortener's host.
// HEAD follows redirects without downloading a body; falls back to the input.
// ---------------------------------------------------------------------------

export async function resolveFinalUrl(url: string, timeoutMs: number): Promise<string> {
  const res = await fetchWithTimeout(url, timeoutMs, {
    method: "HEAD",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ShelfBot/1.0)" },
  });
  return res?.url ?? url;
}

// ---------------------------------------------------------------------------
// Website: fast enrichment
// ---------------------------------------------------------------------------

export async function fetchWebsiteFast(
  url: string,
  timeoutMs: number
): Promise<FastEnrichment> {
  const res = await fetchWithTimeout(url, timeoutMs, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ShelfBot/1.0)" },
  });
  if (!res || !res.ok) return { title: null, thumbnailUrl: null };
  const html = await res.text();
  return parseMeta(html);
}

// ---------------------------------------------------------------------------
// Website: full content (worker)
// ---------------------------------------------------------------------------

export async function fetchWebsiteContent(url: string): Promise<FullContent> {
  const res = await fetchWithTimeout(url, 10_000, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ShelfBot/1.0)" },
  });
  if (!res || !res.ok) return { rawContent: null, consumeTime: null, thumbnailUrl: null };
  const html = await res.text();
  const text = extractTextContent(html);
  const { thumbnailUrl } = parseMeta(html);
  return {
    rawContent: text || null,
    consumeTime: text ? computeWebsiteConsumeTime(text) : null,
    thumbnailUrl,
  };
}

// ---------------------------------------------------------------------------
// YouTube: fast enrichment via oEmbed
// ---------------------------------------------------------------------------

export async function fetchYoutubeFast(
  url: string,
  timeoutMs: number
): Promise<FastEnrichment> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetchWithTimeout(oembedUrl, timeoutMs);
  if (!res || !res.ok) return { title: null, thumbnailUrl: null };
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

// ---------------------------------------------------------------------------
// YouTube: transcript + video length (worker)
//
// The unofficial transcript endpoint is fetched from the watch page.
// We scrape `lengthSeconds` from the ytInitialPlayerResponse blob on the page
// and try the timedtext API for a transcript.
// ---------------------------------------------------------------------------

async function fetchYoutubeWatchPage(videoId: string): Promise<string | null> {
  const res = await fetchWithTimeout(
    `https://www.youtube.com/watch?v=${videoId}`,
    10_000,
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; ShelfBot/1.0)" } }
  );
  if (!res || !res.ok) return null;
  return res.text();
}

function extractLengthSeconds(pageHtml: string): number | null {
  const m = pageHtml.match(/"lengthSeconds":"(\d+)"/);
  return m ? parseInt(m[1], 10) : null;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

async function fetchYoutubeTranscript(pageHtml: string): Promise<string | null> {
  // Extract caption track URL from the player response JSON blob.
  const captionMatch = pageHtml.match(/"captionTracks":\s*(\[.*?\])/s);
  if (!captionMatch) return null;

  let tracks: Array<{ baseUrl: string; languageCode: string }>;
  try {
    tracks = JSON.parse(captionMatch[1]);
  } catch {
    return null;
  }

  // Prefer English, fall back to first available.
  const track =
    tracks.find((t) => t.languageCode === "en") ?? tracks[0] ?? null;
  if (!track?.baseUrl) return null;

  const res = await fetchWithTimeout(track.baseUrl, 8_000);
  if (!res || !res.ok) return null;

  const xml = await res.text();
  // Strip XML tags to get plain text.
  const text = xml
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

export async function fetchYoutubeContent(url: string): Promise<FullContent> {
  const videoId = extractVideoId(url);
  if (!videoId) return { rawContent: null, consumeTime: null, thumbnailUrl: null };

  const pageHtml = await fetchYoutubeWatchPage(videoId);
  const lengthSeconds = pageHtml ? extractLengthSeconds(pageHtml) : null;

  const transcript = pageHtml ? await fetchYoutubeTranscript(pageHtml) : null;

  // Fall back to description scraped from the page if no transcript.
  let rawContent = transcript;
  if (!rawContent && pageHtml) {
    const descMatch = pageHtml.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    if (descMatch) {
      rawContent = descMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  }

  return {
    rawContent: rawContent ?? null,
    consumeTime: lengthSeconds ?? null,
    // Deterministic from the video id — always available.
    thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  };
}

// ---------------------------------------------------------------------------
// Instagram: fast enrichment (OG meta from HTML, fragile by nature)
// ---------------------------------------------------------------------------

export async function fetchInstagramFast(
  url: string,
  timeoutMs: number
): Promise<FastEnrichment> {
  const res = await fetchWithTimeout(url, timeoutMs, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ShelfBot/1.0)",
    },
  });
  if (!res || !res.ok) return { title: null, thumbnailUrl: null };
  const html = await res.text();
  return parseMeta(html);
}

// ---------------------------------------------------------------------------
// Instagram: caption (worker) — same scrape, extract og:description as caption
// ---------------------------------------------------------------------------

export async function fetchInstagramContent(url: string): Promise<FullContent> {
  const res = await fetchWithTimeout(url, 10_000, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ShelfBot/1.0)",
    },
  });
  if (!res || !res.ok) return { rawContent: null, consumeTime: null, thumbnailUrl: null };
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { rawContent: null, consumeTime: null, thumbnailUrl: null };

  const caption =
    doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ??
    null;
  const thumbnailUrl =
    doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null;

  return { rawContent: caption, consumeTime: null, thumbnailUrl };
}
