import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { classifySource } from "../_shared/source.ts";
import { getParser, resolveFinalUrl } from "../_shared/parsers/index.ts";

const WORKER_SECRET = Deno.env.get("WORKER_SECRET")!;

// Read-only probe of the worker's fetch stage on Supabase's datacenter IP, so
// the bot-walls fetch-item hits in production are visible directly. Same
// resolve → classify → parser path as fetch-item/index.ts — no DB, no
// Gemini. Guarded by the shared worker secret so it isn't an open fetch proxy:
// pass it as the x-worker-secret header or a ?secret= query param.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();

  const reqUrl = new URL(req.url);
  const secret = req.headers.get("x-worker-secret") ?? reqUrl.searchParams.get("secret");
  if (secret !== WORKER_SECRET) return json({ error: "Unauthorized" }, 401);

  let target = reqUrl.searchParams.get("url") ?? undefined;
  if (!target && req.method === "POST") {
    try {
      target = (await req.json())?.url;
    } catch {
      // fall through to the missing-url error
    }
  }
  target = target?.trim();
  if (!target) return json({ error: "url is required — pass ?url= or POST { url }" }, 400);

  const finalUrl = await resolveFinalUrl(target, 8_000);
  const source = classifySource(finalUrl);
  const parser = getParser(source);

  try {
    const fetched = await parser.fetchContent(finalUrl);
    return json({
      input: target,
      finalUrl,
      source,
      parser: parser.constructor.name,
      title: fetched.title,
      thumbnailUrl: fetched.thumbnailUrl,
      consumeTime: fetched.consumeTime,
      rawContentLength: fetched.rawContent?.length ?? 0,
      rawContent: fetched.rawContent,
    });
  } catch (err) {
    return json(
      { input: target, finalUrl, source, parser: parser.constructor.name, error: String(err) },
      500,
    );
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
