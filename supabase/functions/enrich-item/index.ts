import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/cors.ts";
import { Logger, makeLogger } from "../_shared/log.ts";
import {
  GEMINI_BACKOFF_MS,
  GEMINI_CONTENT_LIMIT,
  GEMINI_MAX_ATTEMPTS,
  GEMINI_TAGS_MAX,
  GEMINI_TAGS_MIN,
} from "../_shared/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const WORKER_SECRET = Deno.env.get("WORKER_SECRET")!;

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

const ENRICHABLE_STATUS = "fetched";

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
  if (!item_id || mode !== "enrich") {
    return json({ error: "item_id and mode='enrich' are required" }, 400);
  }

  // Service-role client bypasses RLS — every write is scoped by item_id.
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Wrap everything so the worker never throws unhandled.
  try {
    await enrichItem(supabase, item_id);
  } catch (err) {
    makeLogger("enrich", item_id).error("unhandled", err);
  }

  // Always 200 to pg_net — caller doesn't act on the response body.
  return json({ ok: true });
});

// ---------------------------------------------------------------------------
// AI stage — one grounded Gemini call over the fetched body → name/summary/tags.
// ---------------------------------------------------------------------------

async function enrichItem(
  supabase: ReturnType<typeof createClient>,
  itemId: string,
): Promise<void> {
  const log = makeLogger("enrich", itemId);

  // 1. Load the row.
  const { data: item, error: loadError } = await supabase
    .from("items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (loadError || !item) {
    log.error("row-not-found", loadError);
    return;
  }

  // 2. Guard: only enrich a row that has content waiting (zombie / late → no-op).
  if (item.status !== ENRICHABLE_STATUS) {
    log.debug("skip", `status=${item.status}`);
    return;
  }
  log.info("start", `status=${item.status}`);

  const url: string = item.normalized_url ?? item.url ?? "";

  // 3. Build the prompt from the title (a user-set name wins, else the
  //    fetch-stage title) + the body + URL.
  const promptContext = buildPromptContext(
    item.name?.trim() ? item.name : null,
    item.raw_content as string | null,
    url,
  );

  // 4. Fetch the user's existing tag vocabulary. Passing it to the model and
  //    biasing toward reuse is what keeps tags from fragmenting into synonyms
  //    (#ml vs #machine-learning) — the only way a tag groups items at all.
  const existingTags = await fetchUserTags(
    supabase,
    item.user_id as string,
    itemId,
    log,
  );

  // 5. One Gemini call for structured output.
  let aiResult: GeminiResult | null = null;
  try {
    aiResult = await callGemini(promptContext, existingTags, log);
  } catch (err) {
    log.error("gemini-failed", err);
  }

  // 6. Guarded terminal write — WHERE id = :itemId AND status = 'fetched' so a
  //    watchdog that already failed the row wins and we no-op. `ready` is
  //    excluded so this write can't self-trigger the enrich drainer. By this
  //    stage there's almost always a body or title, so we land `ready`;
  //    `failed` is reserved for the truly-nothing case.
  const hasAnything = item.raw_content || item.name || aiResult;
  const finalStatus = hasAnything ? "ready" : "failed";

  const { data: written, error: updateError } = await supabase
    .from("items")
    .update({
      status: finalStatus,
      // summary is AI-owned and always written when available.
      summary: aiResult?.summary ?? null,
      // name: keep a user-set / fetch-stage name; else the AI name; else keep.
      name: item.name?.trim() ? item.name : (aiResult?.name ?? item.name),
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("status", ENRICHABLE_STATUS) // the guard
    .select("id");

  if (updateError) {
    log.error("write-failed", updateError);
    return;
  }
  log.info("done", `status=${finalStatus}`);

  // 7. Append AI tags atomically (tags || new), only if we won the terminal
  //    write. Same path as the manual-add Save — both writers append, neither
  //    replaces, so a concurrent user tag merge can't be clobbered.
  const aiTags = aiResult?.tags ?? [];
  if (written && written.length > 0 && aiTags.length > 0) {
    const { error: tagError } = await supabase.rpc("add_item_tags", {
      p_id: itemId,
      p_tags: aiTags,
    });
    if (tagError) {
      log.error("tag-merge-failed", tagError);
    }
  }
}

// ---------------------------------------------------------------------------
// Gemini structured-output call
// ---------------------------------------------------------------------------

// Only non-empty signals go into the prompt. URL is always present; title and
// content are included only when present — never as empty placeholders that
// would invite the model to fill the gap by guessing.
function buildPromptContext(
  name: string | null,
  rawContent: string | null,
  url: string,
): string {
  const parts: string[] = [`URL: ${url}`];
  if (name) parts.push(`Title: ${name}`);
  if (rawContent) {
    // Truncate to keep well within the context limit and edge cost.
    parts.push(`Content:\n${rawContent.slice(0, GEMINI_CONTENT_LIMIT)}`);
  }
  return parts.join("\n\n");
}

// Flash-Lite occasionally returns a valid summary but an empty/absent tags
// array despite the schema, and the free tier rate-limits bursts. Retry with
// escalating backoff so three rapid calls don't trip the per-minute cap, and
// swallow a per-attempt failure (e.g. a 429) so the loop still gets its tries.
async function callGemini(
  context: string,
  existingTags: string[],
  log: Logger,
): Promise<GeminiResult> {
  let last: GeminiResult = { name: "", summary: "", tags: [] };
  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, GEMINI_BACKOFF_MS * attempt));
    try {
      const result = await callGeminiOnce(context, existingTags);
      if (result.tags.length > 0) return result;
      last = result;
    } catch (err) {
      log.error("gemini-retry", `attempt=${attempt + 1}/${GEMINI_MAX_ATTEMPTS} ${err instanceof Error ? err.message : err}`);
    }
  }
  return last;
}

async function callGeminiOnce(
  context: string,
  existingTags: string[],
): Promise<GeminiResult> {
  // The whole existing vocabulary goes in-context (v1). At scale this becomes a
  // semantic top-K retrieval (pgvector) so the relevant tags surface regardless
  // of how large the library grows — see PRD §8.5 / §8.6.
  const vocabulary = existingTags.length > 0
    ? `\n\nExisting tags in this user's library — reuse one of these whenever it fits the content, and mint a new tag only when none of them apply:\n${
      existingTags.join(", ")
    }\n`
    : "";

  const prompt =
    `You are a content librarian. Produce a structured JSON response using ONLY the fields provided below.

${context}${vocabulary}

Grounding rules — do not violate:
- Rely only on the fields given. Never invent facts, topics, or details that are not present.
- If the only signal is the URL (no Title, no Content), infer a generic name, summary, and tags from the URL itself — its domain and path. A general, honest description grounded in the URL is far better than a specific guess about content you cannot see.

Output rules:
- name: a concise, descriptive title (max 80 characters)
- summary: 1-3 sentence summary of what this content is about; keep it general when the only signal is the URL
- tags: always output 3 to 6 tags (never zero, never fewer than 3), each kebab-case with a leading #, e.g. #deep-work. Choose broad, reusable topic tags that other items could also share — avoid one-off phrases unique to this single item. Reuse an existing library tag above when one genuinely fits; otherwise create a fitting new tag. Even when only a title or URL is available, still produce 3 to 6 sensible tags.`;

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
            minItems: GEMINI_TAGS_MIN,
            maxItems: GEMINI_TAGS_MAX,
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
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

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
    .slice(0, GEMINI_TAGS_MAX);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The user's distinct tag vocabulary (excluding this item's own tags), so the
// model can reuse it. A failure here degrades to no-vocabulary, not a throw.
async function fetchUserTags(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  excludeId: string,
  log: Logger,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_user_tags", {
    p_user_id: userId,
    p_exclude_id: excludeId,
  });
  if (error) {
    log.error("user-tags-failed", `user=${userId} ${error.message ?? ""}`);
    return [];
  }
  return Array.isArray(data)
    ? data.filter((t): t is string => typeof t === "string")
    : [];
}
