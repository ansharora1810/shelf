import normalizeUrlLib from "npm:normalize-url@8";

// Tracking params to drop beyond normalize-url's built-in `utm_*` handling.
const TRACKING_PARAMS = [
  /^utm_\w+/i,
  "fbclid",
  "gclid",
  "igshid",
  "igsh",
  "si",
  "mc_eid",
  "mc_cid",
  "_ga",
  "ref",
  "ref_src",
];

// Canonicalize a user-pasted link for dedup: add a scheme if missing, drop the
// fragment, strip `www`, remove tracking params, sort the query, and trim the
// trailing slash. Falls back to the raw input if it can't be parsed at all.
export function normalizeUrl(raw: string): string {
  try {
    return normalizeUrlLib(raw, {
      defaultProtocol: "https",
      removeQueryParameters: TRACKING_PARAMS,
    });
  } catch {
    return raw;
  }
}
