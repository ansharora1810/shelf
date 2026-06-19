import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/cors.ts";
import { classifySource } from "../_shared/source.ts";
import { getParser, resolveFinalUrl } from "../_shared/parsers/index.ts";
import { RESOLVE_URL_TIMEOUT_MS } from "../_shared/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_SECRET = Deno.env.get("WORKER_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Verify the shared secret — this fn runs with verify_jwt=false.
  if (req.headers.get("x-worker-secret") !== WORKER_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { item_id?: string; mode?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { item_id, mode } = body;
  if (!item_id || mode !== "fetch") {
    return json({ error: "item_id and mode='fetch' are required" }, 400);
  }

  // Service-role client bypasses RLS — every write is scoped by item_id.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Wrap everything so the worker never throws unhandled.
  try {
    await fetchItem(supabase, item_id);
  } catch (err) {
    console.error(`fetch-item unhandled error for ${item_id}:`, err);
  }

  // Always 200 to pg_net — caller doesn't act on the response body.
  return json({ ok: true });
});

// ---------------------------------------------------------------------------
// Fetch stage — pull raw content only; no Gemini. enrich-item runs the AI.
// ---------------------------------------------------------------------------

async function fetchItem(
  supabase: ReturnType<typeof createClient>,
  itemId: string,
): Promise<void> {
  // 1. Load the row.
  const { data: item, error: loadError } = await supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (loadError || !item) {
    console.error(`fetch-item: row not found for ${itemId}`, loadError);
    return;
  }

  // 2. Guard: only fetch from the `started` state (zombie / late retry → no-op).
  if (item.status !== "started") {
    return;
  }

  // Resolve the redirect and classify on the destination — a shortened link to
  // YouTube/Instagram must be parsed as such, not as a generic website.
  // Prefer the canonical (scheme-bearing) URL so redirect resolution and the
  // parsers' own fetches operate on an absolute URL.
  const url: string = item.normalized_url ?? item.url ?? "";
  const finalUrl = await resolveFinalUrl(url, RESOLVE_URL_TIMEOUT_MS);
  const source = classifySource(finalUrl);

  // 3. Fetch full content: deterministic title + thumbnail + body.
  let title: string | null = null;
  let rawContent: string | null = null;
  let consumeTime: number | null = null;
  let thumbnailUrl: string | null = null;

  try {
    const fetched = await getParser(source).fetchContent(finalUrl);
    title = fetched.title;
    rawContent = fetched.rawContent;
    consumeTime = fetched.consumeTime;
    thumbnailUrl = fetched.thumbnailUrl;
  } catch (err) {
    console.error(`fetch-item: content fetch failed for ${itemId}:`, err);
    // Proceed with nulls — the body decides the status below.
  }

  // 4. Status decision (PRD §11.1): `fetched` only if a usable BODY was obtained.
  //    A title/thumbnail without a body (e.g. YouTube oEmbed) is NOT enough —
  //    that row goes to `fetch_failed` for the app to fetch on a residential IP.
  //    Whatever title/thumbnail/source the backend did get is persisted either
  //    way, so the app augments rather than starts blank.
  const hasBody = !!rawContent && rawContent.trim().length > 0;
  const nextStatus = hasBody ? "fetched" : "fetch_failed";

  // 5. Guarded terminal write — WHERE id = :itemId AND status = 'started' so a
  //    watchdog that already advanced the row wins and we no-op. status and
  //    content are written in a single UPDATE (PRD §11.1 atomicity).
  const { error: updateError } = await supabase
    .from("items")
    .update({
      status: nextStatus,
      // Correct the source from the resolved destination (create may have
      // classified a shortened link as 'website' before resolving it).
      source,
      raw_content: rawContent,
      // name: keep a user-set name; else the deterministic title so the card
      // is never blank while the app fetches the body / enrich-item runs.
      name: item.name?.trim() ? item.name : title,
      consume_time: item.consume_time ?? consumeTime,
      thumbnail_url: item.thumbnail_url ?? thumbnailUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("status", "started"); // the guard

  if (updateError) {
    console.error(
      `fetch-item: terminal write failed for ${itemId}:`,
      updateError,
    );
  }
}
