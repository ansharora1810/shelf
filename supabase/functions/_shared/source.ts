// `source` is the link's real, normalized host (e.g. "youtube.com",
// "tiktok.com", "nytimes.com") — the destination's identity, not a capability
// bucket. Parsers and logos are chosen downstream by host with a fallback, so
// an unrecognised host keeps its true identity instead of becoming "website".

const SUBDOMAIN_PREFIX = /^(www\.|m\.|mobile\.)/;
const HOST_ALIASES: Record<string, string> = {
  "youtu.be": "youtube.com",
};

export function classifySource(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "website"; // unparseable — last-resort label
  }
  host = host.replace(SUBDOMAIN_PREFIX, "");
  return HOST_ALIASES[host] ?? host;
}

function matchesPlatform(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`);
}

export function isYouTube(host: string): boolean {
  return matchesPlatform(host, "youtube.com");
}

export function isInstagram(host: string): boolean {
  return matchesPlatform(host, "instagram.com");
}
