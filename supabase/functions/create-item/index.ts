import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { normalizeUrl } from "../_shared/url.ts";
import { classifySource } from "../_shared/source.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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
  // Insert the row at `started` and return immediately. All enrichment
  // (title, thumbnail, resolved source, content, AI tags) is the worker's job,
  // fired by the AFTER INSERT trigger — so this stays a sub-100ms DB op and the
  // share sheet confirms instantly. `source` is a network-free best-effort from
  // the normalized host; fetch-item corrects it after resolving redirects.
  // Uses caller JWT → RLS sets user_id = auth.uid(). `status_changed_at` is set
  // by the items_set_status_changed_at trigger — never written here.
  // -------------------------------------------------------------------------
  const { data: item, error: insertError } = await supabase
    .from("items")
    .insert({
      type: "link",
      url: rawUrl,
      normalized_url: normalizedUrl,
      source: classifySource(normalizedUrl),
      project_id: body.project_id ?? null,
      status: "started",
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
