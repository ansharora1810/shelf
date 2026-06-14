// A parser turns a link into shelf metadata. The two methods map to the two
// stages of the pipeline: `fetchFast` runs inline on item creation under a
// tight timeout (title + thumbnail only), `fetchContent` runs in the worker
// to pull the heavier payload (transcript, caption, article text) used for AI
// tagging and the consume-time estimate.

export interface FastEnrichment {
  title: string | null;
  thumbnailUrl: string | null;
}

export interface FullContent {
  rawContent: string | null;
  consumeTime: number | null;
  thumbnailUrl: string | null;
}

export interface Parser {
  fetchFast(url: string, timeoutMs: number): Promise<FastEnrichment>;
  fetchContent(url: string): Promise<FullContent>;
}
