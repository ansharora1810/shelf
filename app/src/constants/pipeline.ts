// Single source of truth for the FRONTEND (client WebView) fetch pipeline
// numbers. The backend keeps its own copy at
// supabase/functions/_shared/constants.ts — the two runtimes don't share a
// module graph, so values that must agree across the boundary are noted below.

// Hidden-WebView fetch (src/lib/fetch-fallback)
// MUST stay below the watchdog's client-claim lease (45s, shelf_watchdog) so a
// release never fires while a fetch is still in flight (§8.2).
export const WEBVIEW_FETCH_TIMEOUT_MS = 20_000 // hard cap per attempt; resolves null if the page never posts
export const OG_POLL_INTERVAL_MS = 100 // how often the injected JS polls the DOM for og tags
export const OG_POLL_MAX_TRIES = 40 // × interval ≈ 4s before the recipe gives up
export const IG_NAME_MAX_LEN = 100 // "@owner: caption" title truncation

// Claim-then-work (src/lib/fetch-fallback/useClientFetchQueue). The claim stamps
// dispatched_at; retries are driven by the watchdog releasing a stale claim
// (realtime), with the reconcile GET as the backstop — no client-side interval.
export const MAX_APP_FETCH_ATTEMPTS = 3 // MUST equal the SQL watchdog's `app_fetch_attempts >= N`

// Verbose client-fetch logging (claim/fetch lifecycle, raw HTML, parsed body,
// load errors), one line per item keyed by `item=<id>` (see fetch-fallback/log).
// Surfaces in the device log (Console.app / idevicesyslog) or Metro console.
// Set false for release.
export const DEBUG_PARSING = true
