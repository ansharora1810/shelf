import { DOMParser } from "jsr:@b-fuze/deno-dom";
import { FastEnrichment } from "./types.ts";

// OG / Twitter card metadata — the title + thumbnail a page advertises to bots.
export function parseMeta(html: string): FastEnrichment {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { title: null, thumbnailUrl: null };

  const metaContent = (property: string): string | null => {
    const el =
      doc.querySelector(`meta[property="${property}"]`) ??
      doc.querySelector(`meta[name="${property}"]`);
    return el?.getAttribute("content") ?? null;
  };

  const title =
    metaContent("og:title") ??
    metaContent("twitter:title") ??
    doc.querySelector("title")?.textContent?.trim() ??
    null;

  const thumbnailUrl =
    metaContent("og:image") ?? metaContent("twitter:image") ?? null;

  return { title, thumbnailUrl };
}

// A single named meta property, used when a parser needs one tag rather than
// the full title/thumbnail pair (e.g. Instagram's og:description fallback).
export function metaProperty(html: string, property: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc?.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ?? null;
}

// Visible body text with the obvious chrome stripped, for word-count estimates.
export function extractTextContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return "";

  for (const tag of ["script", "style", "nav", "header", "footer", "aside"]) {
    for (const el of doc.querySelectorAll(tag)) {
      el.parentNode?.removeChild(el);
    }
  }

  return doc.querySelector("body")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
