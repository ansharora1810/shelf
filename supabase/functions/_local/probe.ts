// Exercises the worker's content-fetch stage (process-item/index.ts:88-102)
// from this machine's residential IP — a stand-in for what a client-side fetch
// would see. Reuses the worker's own modules so the output matches it exactly.
//
//   deno run --allow-net supabase/functions/_local/probe.ts <url> [url...]

import { classifySource } from "../_shared/source.ts";
import { getParser, resolveFinalUrl } from "../_shared/parsers/index.ts";

const PREVIEW_CHARS = 800;

if (Deno.args.length === 0) {
  console.error("usage: deno run --allow-net probe.ts <url> [url...]");
  Deno.exit(1);
}

// Fetch errors are swallowed to null downstream (the worker degrades gracefully),
// so a missing net flag would look like every site returned nothing. Fail loud.
if ((await Deno.permissions.query({ name: "net" })).state !== "granted") {
  console.error(
    "network access is required — re-run with --allow-net:\n" +
      "  deno run --allow-net supabase/functions/_local/probe.ts <url>...",
  );
  Deno.exit(1);
}

for (const input of Deno.args) {
  if (input.includes("\\")) {
    console.error(`warning: '${input}' contains a backslash — inside quotes you don't escape ? or =, so the URL is likely corrupted.`);
  }
  const finalUrl = await resolveFinalUrl(input, 8_000);
  const source = classifySource(finalUrl);
  const parser = getParser(source);

  try {
    const fetched = await parser.fetchContent(finalUrl);
    console.log(JSON.stringify({
      input,
      finalUrl,
      source,
      parser: parser.constructor.name,
      title: fetched.title,
      thumbnailUrl: fetched.thumbnailUrl,
      consumeTime: fetched.consumeTime,
      rawContentLength: fetched.rawContent?.length ?? 0,
      rawContentPreview: fetched.rawContent?.slice(0, PREVIEW_CHARS) ?? null,
    }, null, 2));
  } catch (err) {
    console.log(JSON.stringify(
      { input, finalUrl, source, parser: parser.constructor.name, error: String(err) },
      null,
      2,
    ));
  }
}
