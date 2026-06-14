import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders, handleOptions } from "../_shared/cors.ts";
import { classifySource } from "../_shared/source.ts";
import { resolveFinalUrl, getParser } from "../_shared/parsers/index.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const WORKER_SECRET = Deno.env.get("WORKER_SECRET")!;

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

interface GeminiResult {
  name: string;
  summary: string;
  tags: string[];
}

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
  if (!item_id || mode !== "process") {
    return json({ error: "item_id and mode='process' are required" }, 400);
  }

  // Service-role client bypasses RLS — every write is scoped by item_id.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Wrap everything so the worker never throws unhandled.
  try {
    await processItem(supabase, item_id);
  } catch (err) {
    console.error(`process-item unhandled error for ${item_id}:`, err);
  }

  // Always 200 to pg_net — caller doesn't act on the response body.
  return json({ ok: true });
});

// ---------------------------------------------------------------------------
// Core processing logic
// ---------------------------------------------------------------------------

async function processItem(
  supabase: ReturnType<typeof createClient>,
  itemId: string
): Promise<void> {
  // 1. Load the row.
  const { data: item, error: loadError } = await supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (loadError || !item) {
    console.error(`process-item: row not found for ${itemId}`, loadError);
    return;
  }

  // 2. Guard: only process if still in processing state (zombie / late retry → no-op).
  if (item.status !== "processing") {
    return;
  }

  // Resolve the redirect and classify on the destination — a shortened link to
  // YouTube/Instagram must be parsed as such, not as a generic website.
  // Prefer the canonical (scheme-bearing) URL so redirect resolution and the
  // parsers' own fetches operate on an absolute URL.
  const url: string = item.normalized_url ?? item.url ?? "";
  const finalUrl = await resolveFinalUrl(url, 8_000);
  const source = classifySource(finalUrl);

  // 3. Fetch full content.
  let rawContent: string | null = null;
  let consumeTime: number | null = null;
  let thumbnailUrl: string | null = null;

  try {
    const fetched = await getParser(source).fetchContent(finalUrl);
    rawContent = fetched.rawContent;
    consumeTime = fetched.consumeTime;
    thumbnailUrl = fetched.thumbnailUrl;
  } catch (err) {
    console.error(`process-item: content fetch failed for ${itemId}:`, err);
    // Proceed with nulls — degrade to ready with what we have.
  }

  // 4. Build the prompt context for Gemini.
  const promptContext = buildPromptContext(item.name, rawContent, url, source);

  // 5. One Gemini call for structured output.
  let aiResult: GeminiResult | null = null;
  try {
    aiResult = await callGemini(promptContext);
  } catch (err) {
    console.error(`process-item: Gemini call failed for ${itemId}:`, err);
  }

  // 6. Determine final status.
  // failed = nothing usable at all (no raw content, no title, no AI result).
  const hasAnything = rawContent || item.name || aiResult;
  const finalStatus = hasAnything ? "ready" : "failed";

  // 7. Guarded terminal write — WHERE id = :itemId AND status = 'processing' so a
  //    watchdog that already failed the row wins and we no-op. Tags are NOT written
  //    here: they're appended atomically below so a concurrent manual-add tag merge
  //    can't be clobbered by a stale read-modify-write.
  const { data: written, error: updateError } = await supabase
    .from("items")
    .update({
      status: finalStatus,
      // Correct the source from the resolved destination (create may have
      // classified a shortened link as 'website' before resolving it).
      source,
      raw_content: rawContent,
      // summary is AI-owned and always written when available.
      summary: aiResult?.summary ?? null,
      // name: only fill if the row has no name yet (coalesce(nullif(name,''), ai_name)).
      name: item.name?.trim() ? item.name : (aiResult?.name ?? item.name),
      // consume_time + thumbnail: coalesce — backfill only what create missed.
      consume_time: item.consume_time ?? consumeTime,
      thumbnail_url: item.thumbnail_url ?? thumbnailUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("status", "processing") // the guard
    .select("id");

  if (updateError) {
    console.error(`process-item: terminal write failed for ${itemId}:`, updateError);
    return;
  }

  // 8. Append AI tags atomically (tags || new), only if we won the terminal write.
  //    Same path as the manual-add Save — both writers append, neither replaces.
  const aiTags = aiResult?.tags ?? [];
  if (written && written.length > 0 && aiTags.length > 0) {
    const { error: tagError } = await supabase.rpc("add_item_tags", { p_id: itemId, p_tags: aiTags });
    if (tagError) console.error(`process-item: tag merge failed for ${itemId}:`, tagError);
  }
}

// ---------------------------------------------------------------------------
// Gemini structured-output call
// ---------------------------------------------------------------------------

function buildPromptContext(
  name: string | null,
  rawContent: string | null,
  url: string,
  source: string
): string {
  const parts: string[] = [];
  if (name) parts.push(`Title: ${name}`);
  parts.push(`URL: ${url}`);
  parts.push(`Source type: ${source}`);
  if (rawContent) {
    // Truncate to keep well within the context limit and edge cost.
    const truncated = rawContent.slice(0, 12_000);
    parts.push(`Content:\n${truncated}`);
  }
  return parts.join("\n\n");
}

// Flash-Lite occasionally returns a valid summary but an empty/absent tags
// array despite the schema. Retry a few times until tags arrive (cheap, async).
async function callGemini(context: string): Promise<GeminiResult> {
  let last: GeminiResult = { name: "", summary: "", tags: [] };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await callGeminiOnce(context);
    if (result.tags.length > 0) return result;
    last = result;
  }
  return last;
}

async function callGeminiOnce(context: string): Promise<GeminiResult> {
  const prompt = `You are a content librarian. Given the following content, produce a structured JSON response.

${context}

Rules:
- name: a concise, descriptive title (max 80 characters)
- summary: 1-3 sentence summary of what this content is about
- tags: exactly 10 tags, each kebab-case with a leading #, e.g. #deep-work. Be specific and useful for discovery.`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          summary: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" },
            minItems: 10,
            maxItems: 10,
          },
        },
        required: ["name", "summary", "tags"],
      },
    },
  };

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const parsed: GeminiResult = JSON.parse(text);

  // Enforce the tag format contract — filter and normalise defensively.
  parsed.tags = normalizeAiTags(parsed.tags);

  return parsed;
}

function normalizeAiTags(tags: unknown[]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .filter((t): t is string => typeof t === "string")
    .map((t) => {
      const slug = t.startsWith("#") ? t : `#${t}`;
      // Enforce kebab-case: lowercase, replace spaces/underscores with hyphens.
      return slug.toLowerCase().replace(/[\s_]+/g, "-");
    })
    .slice(0, 10);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
