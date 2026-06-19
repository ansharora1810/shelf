import { isInstagram, isReddit, isYouTube } from "../source.ts";
import { Parser } from "./types.ts";
import { WebsiteParser } from "./website.ts";
import { YoutubeParser } from "./youtube.ts";
import { InstagramParser } from "./instagram.ts";
import { RedditParser } from "./reddit.ts";

export type { FullContent, Parser } from "./types.ts";
export { resolveFinalUrl } from "./http.ts";
export { classifyInstagramUrl } from "./instagram.ts";
export type { InstagramUrlKind } from "./instagram.ts";

// Parsers are stateless, so a single instance each is reused across requests.
const website = new WebsiteParser();
const youtube = new YoutubeParser();
const instagram = new InstagramParser();
const reddit = new RedditParser();

// Selects the parser for a link's source host, falling back to the generic
// website parser for any host without a platform-specific handler.
export function getParser(source: string): Parser {
  if (isYouTube(source)) return youtube;
  if (isInstagram(source)) return instagram;
  if (isReddit(source)) return reddit;
  return website;
}
