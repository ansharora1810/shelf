export type ItemSource = "youtube" | "instagram" | "website";

export function classifySource(url: string): ItemSource {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "website";
  }

  if (hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be") {
    return "youtube";
  }
  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) {
    return "instagram";
  }
  return "website";
}
