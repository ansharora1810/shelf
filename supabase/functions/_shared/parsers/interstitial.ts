import { INTERSTITIAL_MAX_BODY_CHARS } from "../constants.ts";

// Bot-detection / "please wait" walls (Cloudflare, DataDome, Incapsula, Google,
// plain redirect shims) answer a datacenter IP with HTTP 200 and placeholder
// text instead of the real page. The body is unusable and the <title> is the
// wall's, not the page's — so a row that hits one must go fetch_failed (the app
// re-fetches on its residential IP, §8.2) and the wall's title must never be
// persisted as the item name.
const WALL_PATTERNS: RegExp[] = [
  /just a moment/i,
  /attention required/i,
  /checking your browser before/i,
  /please (wait|stand by) while .{0,40}redirect/i,
  /redirecting you to/i,
  /one moment,? please/i,
  /please (enable|turn on) javascript/i,
  /enable javascript and cookies to continue/i,
  /verify(ing)? (you are|that you are) (a )?human/i,
  /are you a (human|robot)/i,
  /unusual traffic from your/i,
  /ddos protection by/i,
  /pardon our interruption/i,
  /access (to this page has been |is )?denied/i,
  /you don'?t have permission to access/i,
  /request unsuccessful\.?\s*incapsula/i,
  /complete the security check/i,
  /needs to review the security of your connection/i,
  /click here if you are not redirected/i,
];

const matchesWall = (text: string | null): boolean =>
  !!text && WALL_PATTERNS.some((re) => re.test(text));

// A wall gates the real content, so its visible body is tiny or empty — the
// length cap keeps a genuine article that merely quotes one of these phrases
// from being misclassified.
export function looksLikeInterstitial(
  title: string | null,
  body: string | null,
): boolean {
  if ((body?.trim().length ?? 0) > INTERSTITIAL_MAX_BODY_CHARS) return false;
  return matchesWall(title) || matchesWall(body);
}
