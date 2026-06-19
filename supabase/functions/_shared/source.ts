// `source` is the link's real, normalized host (e.g. "youtube.com",
// "tiktok.com", "nytimes.com") — the destination's identity, not a capability
// bucket. Parsers and logos are chosen downstream by host with a fallback, so
// an unrecognised host keeps its true identity instead of becoming "website".

import { parse } from "npm:tldts@6";

const SUBDOMAIN_PREFIX = /^(www\.|m\.|mobile\.)/;
const HOST_ALIASES: Record<string, string> = {
  "youtu.be": "youtube.com",
};

export function classifySource(url: string): string {
  // tldts pulls the host out of any-shape input — scheme-less, host:port,
  // messy paste — using the Public Suffix List, where `new URL()` would throw.
  const host = parse(url).hostname?.toLowerCase();
  if (!host) return "website"; // unparseable — last-resort label
  const stripped = host.replace(SUBDOMAIN_PREFIX, "");
  return HOST_ALIASES[stripped] ?? stripped;
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

export function isReddit(host: string): boolean {
  return matchesPlatform(host, "reddit.com");
}
