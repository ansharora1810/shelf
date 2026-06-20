// A parser turns a link into shelf metadata. Enrichment runs entirely in the
// worker: `fetchContent` pulls the full payload — a deterministic title and
// thumbnail, plus the heavier body (transcript, caption, article text) and
// consume-time estimate used for AI tagging. The title is a best-effort
// fallback; the AI-generated name takes precedence when available.

import { Logger } from "../log.ts";

export interface FullContent {
  title: string | null;
  rawContent: string | null;
  consumeTime: number | null;
  thumbnailUrl: string | null;
}

export interface Parser {
  fetchContent(url: string, log?: Logger): Promise<FullContent>;
}
