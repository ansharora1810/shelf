export const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; ShelfBot/1.0)";

export async function fetchWithTimeout(
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

// Short links (tinyurl, t.co, youtu.be→watch, …) must be classified and parsed
// by their *destination*, not the shortener's host. HEAD follows redirects
// without downloading a body; falls back to the input on failure.
export async function resolveFinalUrl(url: string, timeoutMs: number): Promise<string> {
  const res = await fetchWithTimeout(url, timeoutMs, {
    method: "HEAD",
    headers: { "User-Agent": DEFAULT_USER_AGENT },
  });
  return res?.url ?? url;
}
