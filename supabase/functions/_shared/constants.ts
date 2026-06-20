// Single source of truth for the BACKEND (Edge/Deno) fetch + parse pipeline
// numbers. The frontend keeps its own copy at app/src/constants/pipeline.ts —
// the two runtimes (Metro vs Deno-on-Edge) don't share a module graph, so a
// single shared file isn't practical; values that must agree across the
// boundary are noted below.

// Network timeouts (ms)
export const RESOLVE_URL_TIMEOUT_MS = 3_000; // fetch-item HEAD redirect resolution
export const YOUTUBE_OEMBED_TIMEOUT_MS = 3_000; // youtube oEmbed metadata fetch
export const CONTENT_FETCH_TIMEOUT_MS = 3_000; // parser page/content fetches

// Content heuristics
export const WORDS_PER_MINUTE = 225; // consume-time estimate (reddit, website)
export const IG_NAME_MAX_LEN = 100; // "@owner: caption" title truncation
export const INTERSTITIAL_MAX_BODY_CHARS = 1_500; // bot-wall bodies are tiny; longer ⇒ real content

// Gemini (enrich-item)
export const GEMINI_MAX_ATTEMPTS = 4;
export const GEMINI_BACKOFF_MS = 4_000; // multiplied by attempt index
export const GEMINI_CONTENT_LIMIT = 12_000; // chars of raw_content sent to the model
export const GEMINI_TAGS_MIN = 3;
export const GEMINI_TAGS_MAX = 6;

// Gemini embeddings (search — §11.1). gemini-embedding-001 truncated to 768 dims
// (Matryoshka) and L2-normalized; the column type is vector(768).
export const GEMINI_EMBED_MODEL = "gemini-embedding-001";
export const GEMINI_EMBED_DIM = 768;
// When an item has no summary, fall back to the head of raw_content as the
// Summary field of the embedding input (§11.1 open-item #4).
export const EMBED_SUMMARY_FALLBACK_CHARS = 2_000;

// Verbose website fetch/parse logging (response code, raw body, parsed body).
// Surfaces in the edge-function logs. Set false for release.
export const DEBUG_PARSING = true;

// ---------------------------------------------------------------------------
// Cross-runtime / SQL values — NOT importable from here; kept in sync by hand:
//   • App attempt cap = 3 — app/src/constants/pipeline.ts MAX_APP_FETCH_ATTEMPTS
//     AND shelf_watchdog `app_fetch_attempts >= 3`.
//   • Watchdog deadlines: started / fetched → 90s; awaiting_upload → 3 min.
//     pg_cron runs shelf_watchdog every 1 min.
//   (all in supabase/migrations/ — latest watchdog revision wins)
// ---------------------------------------------------------------------------
