const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_source_platform",
  "fbclid",
  "gclid",
  "igshid",
  "si",
  "mc_eid",
  "mc_cid",
  "_ga",
  "ref",
  "ref_src",
]);

// Strips tracking params whose key starts with utm_ (catches any variant).
function isTracking(key: string): boolean {
  return key.startsWith("utm_") || TRACKING_PARAMS.has(key);
}

export function normalizeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    // Not a valid URL — return as-is so callers can decide.
    return raw;
  }

  // 1. Lowercase scheme + host (URL constructor already lowercases these,
  //    but be explicit about path case — we do NOT lowercase path).
  const scheme = u.protocol; // already lowercase
  const host = u.hostname.toLowerCase();

  // 2. Strip default ports.
  const port =
    (scheme === "http:" && u.port === "80") ||
    (scheme === "https:" && u.port === "443")
      ? ""
      : u.port
      ? `:${u.port}`
      : "";

  // 3. Drop fragment (don't include hash).
  // 4. Remove trailing slash from path.
  let path = u.pathname;
  if (path.endsWith("/") && path.length > 1) {
    path = path.slice(0, -1);
  }

  // 5 & 6. Strip tracking params, keep meaningful ones, sort alphabetically.
  const kept: [string, string][] = [];
  for (const [k, v] of u.searchParams.entries()) {
    if (!isTracking(k)) {
      kept.push([k, v]);
    }
  }
  kept.sort(([a], [b]) => a.localeCompare(b));

  const query =
    kept.length > 0
      ? "?" + kept.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
      : "";

  return `${scheme}//${host}${port}${path}${query}`;
}
