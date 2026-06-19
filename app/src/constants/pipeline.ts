// Single source of truth for the FRONTEND (client WebView) fetch pipeline
// numbers. The backend keeps its own copy at
// supabase/functions/_shared/constants.ts — the two runtimes don't share a
// module graph, so values that must agree across the boundary are noted below.

// Hidden-WebView fetch (src/lib/fetch-fallback)
export const WEBVIEW_FETCH_TIMEOUT_MS = 20_000 // hard cap per attempt; resolves null if the page never posts
export const OG_POLL_INTERVAL_MS = 100 // how often the injected JS polls the DOM for og tags
export const OG_POLL_MAX_TRIES = 40 // × interval ≈ 4s before the recipe gives up
export const IG_NAME_MAX_LEN = 100 // "@owner: caption" title truncation

// Claim-then-work retry (src/lib/fetch-fallback/useClientFetchQueue)
export const MAX_APP_FETCH_ATTEMPTS = 3 // MUST equal the SQL watchdog's `app_fetch_attempts >= N`
export const RETRY_SCAN_INTERVAL_MS = 20_000 // foreground re-scan so fetch_failed rows retry without a new realtime/reconcile event

// Verbose website fetch/parse logging (raw HTML, parsed body, load errors).
// Surfaces in the Metro console. Set false for release.
export const DEBUG_PARSING = true
