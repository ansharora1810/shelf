import { FullContent, Parser } from "./types.ts";
import { fetchWithTimeout } from "./http.ts";

// YouTube parser.
// - Title + thumbnail come from oEmbed: keyless and reliable from any IP.
// - Duration + transcript come from the InnerTube client (youtubei.js), which
//   is best-effort: YouTube rate-limits datacenter IPs and the unofficial
//   transcript endpoint breaks periodically. On failure we degrade to title +
//   thumbnail and let the AI tag from the title alone. youtubei.js is imported
//   lazily so non-YouTube links don't pay its load cost.
export class YoutubeParser implements Parser {
  async fetchContent(url: string): Promise<FullContent> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      return { title: null, rawContent: null, consumeTime: null, thumbnailUrl: null };
    }

    const [oembed, inner] = await Promise.all([
      this.fetchOembed(url),
      this.fetchInnertube(videoId),
    ]);

    return {
      title: oembed?.title ?? inner?.title ?? null,
      rawContent: inner?.transcript ?? null,
      consumeTime: inner?.duration ?? null,
      thumbnailUrl: oembed?.thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  private extractVideoId(url: string): string | null {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") return u.pathname.slice(1);
      return u.searchParams.get("v");
    } catch {
      return null;
    }
  }

  private async fetchOembed(
    url: string,
  ): Promise<{ title: string | null; thumbnailUrl: string | null } | null> {
    const oembedUrl =
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetchWithTimeout(oembedUrl, 8_000);
    if (!res?.ok) return null;
    try {
      const json = await res.json();
      return { title: json.title ?? null, thumbnailUrl: json.thumbnail_url ?? null };
    } catch {
      return null;
    }
  }

  private async fetchInnertube(
    videoId: string,
  ): Promise<{ title: string | null; duration: number | null; transcript: string | null } | null> {
    try {
      const { Innertube, Log } = await import("npm:youtubei.js@17");
      Log.setLevel(0); // silence the library's parser warnings
      const yt = await Innertube.create({ retrieve_player: false });
      const info = await yt.getInfo(videoId);
      return {
        title: info.basic_info.title ?? null,
        duration: info.basic_info.duration ?? null,
        transcript: await this.extractTranscript(info),
      };
    } catch {
      return null;
    }
  }

  // deno-lint-ignore no-explicit-any -- youtubei.js transcript types are loose
  private async extractTranscript(info: any): Promise<string | null> {
    try {
      const t = await info.getTranscript();
      const segments = t?.transcript?.content?.body?.initial_segments ?? [];
      const text = segments
        .map((s: { snippet?: { text?: string } }) => s.snippet?.text ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      return text || null;
    } catch {
      return null;
    }
  }
}
