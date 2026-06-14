import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { normalizeUrl } from "../_shared/url.ts";
import { classifySource, ItemSource } from "../_shared/source.ts";
import {
  resolveFinalUrl,
  fetchWebsiteFast,
  fetchYoutubeFast,
  fetchInstagramFast,
} from "../_shared/parse.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Title/thumbnail fetch budget. Follows redirects (e.g. tinyurl → destination),
// so it needs headroom for two hops; the popup shows a name skeleton meanwhile.
const ENRICH_TIMEOUT_MS = 8_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Build a client scoped to the caller's JWT so RLS sets user_id automatically.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  // Validate the JWT and retrieve the user.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  let body: { url?: string; project_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const rawUrl = body.url?.trim();
  if (!rawUrl) return json({ error: "url is required" }, 400);

  const normalizedUrl = normalizeUrl(rawUrl);

  // -------------------------------------------------------------------------
  // Dedup: check for an existing item with this normalized_url.
  // -------------------------------------------------------------------------
  const { data: existing } = await supabase
    .from("items")
    .select("*")
    .eq("normalized_url", normalizedUrl)
    .eq("type", "link")
    .maybeSingle();

  if (existing) {
    // If the existing item has no project and a project_id was supplied, file it.
    if (!existing.project_id && body.project_id) {
      await supabase
        .from("items")
        .update({ project_id: body.project_id })
        .eq("id", existing.id);
      existing.project_id = body.project_id;
    }
    return json({ item: existing, deduped: true });
  }

  // -------------------------------------------------------------------------
  // Fast enrichment (non-AI, under tight timeout).
  // We race the enrichment against the timeout; on timeout we proceed with
  // whatever resolved — a slow origin is not an error.
  // -------------------------------------------------------------------------
  let source: ItemSource = classifySource(rawUrl); // fallback if resolution fails
  let title: string | null = null;
  let thumbnailUrl: string | null = null;

  try {
    const enriched = await withTimeout(enrich(rawUrl), ENRICH_TIMEOUT_MS);
    source = enriched.source;
    title = enriched.title;
    thumbnailUrl = enriched.thumbnailUrl;
  } catch {
    // Timeout or fetch error — proceed with the fallback source and null fields.
  }

  // -------------------------------------------------------------------------
  // Insert the row. Uses caller JWT → RLS sets user_id = auth.uid().
  // -------------------------------------------------------------------------
  const { data: item, error: insertError } = await supabase
    .from("items")
    .insert({
      type: "link",
      url: rawUrl,
      normalized_url: normalizedUrl,
      source,
      name: title,
      thumbnail_url: thumbnailUrl,
      project_id: body.project_id ?? null,
      status: "processing",
      processing_started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError || !item) {
    console.error("create-item insert error:", insertError);
    return json({ error: "Failed to create item" }, 500);
  }

  return json({ item, deduped: false });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Resolve the redirect, classify on the *final* URL, then parse it. YouTube
// (incl. shortened/redirected links) uses oEmbed — reliable from a datacenter
// IP, unlike scraping the watch page (which hits a consent wall).
async function enrich(
  rawUrl: string
): Promise<{ source: ItemSource; title: string | null; thumbnailUrl: string | null }> {
  const finalUrl = await resolveFinalUrl(rawUrl, ENRICH_TIMEOUT_MS);
  const source = classifySource(finalUrl);
  const parsed =
    source === "youtube"
      ? await fetchYoutubeFast(finalUrl, ENRICH_TIMEOUT_MS)
      : source === "instagram"
      ? await fetchInstagramFast(finalUrl, ENRICH_TIMEOUT_MS)
      : await fetchWebsiteFast(finalUrl, ENRICH_TIMEOUT_MS);
  return { source, ...parsed };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
