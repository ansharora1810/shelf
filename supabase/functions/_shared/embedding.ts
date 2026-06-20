import {
  EMBED_SUMMARY_FALLBACK_CHARS,
  GEMINI_BACKOFF_MS,
  GEMINI_EMBED_DIM,
  GEMINI_EMBED_MODEL,
  GEMINI_MAX_ATTEMPTS,
} from "./constants.ts";
import { Logger } from "./log.ts";

// Shared embedding helper (PRD §11.1). Embeds via gemini-embedding-001 over the
// Gemini API (same key + endpoint family as enrich-item's Gemini call) and emits
// a 768-dim L2-normalized vector. Reused by enrich-item (RETRIEVAL_DOCUMENT at
// processing time), POST /search (RETRIEVAL_QUERY), and the backfill script.

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const EMBED_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

// RETRIEVAL_DOCUMENT for stored items, RETRIEVAL_QUERY for the search box — the
// model is trained for this asymmetry, so a query lands near the documents that
// answer it even when the wording differs (§11.1).
export type EmbedTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

// The §11.1 labelled, structured string — denser and more coherent than raw
// concatenation. Labels are omitted for absent fields (never empty placeholders).
// When summary is missing, the head of raw_content stands in (§11.1 open-item #4).
export function buildEmbeddingInput(fields: {
  name?: string | null;
  tags?: string[] | null;
  summary?: string | null;
  rawContent?: string | null;
}): string {
  const parts: string[] = [];

  const name = fields.name?.trim();
  if (name) parts.push(`Title: ${name}`);

  const tags = (fields.tags ?? [])
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);
  if (tags.length > 0) parts.push(`Tags: ${tags.join(", ")}`);

  const summary = fields.summary?.trim() ||
    fields.rawContent?.trim().slice(0, EMBED_SUMMARY_FALLBACK_CHARS);
  if (summary) parts.push(`Summary: ${summary}`);

  return parts.join("\n");
}

// pgvector text input over PostgREST: "[a,b,c,...]".
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

// One embedding call, retried with escalating backoff (free-tier 429s + the
// occasional transient error), mirroring enrich-item's callGemini pacing.
export async function embedText(
  text: string,
  taskType: EmbedTaskType,
  log?: Logger,
): Promise<number[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, GEMINI_BACKOFF_MS * attempt));
    }
    try {
      return await embedOnce(text, taskType);
    } catch (err) {
      lastErr = err;
      log?.error(
        "embed-retry",
        `attempt=${attempt + 1}/${GEMINI_MAX_ATTEMPTS} ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("embedText failed");
}

async function embedOnce(text: string, taskType: EmbedTaskType): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBED_MODEL}`,
      content: { parts: [{ text }] },
      taskType,
      outputDimensionality: GEMINI_EMBED_DIM,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini embed error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const values: unknown = data?.embedding?.values;
  if (!Array.isArray(values) || values.length !== GEMINI_EMBED_DIM) {
    throw new Error(
      `Gemini embed returned ${Array.isArray(values) ? values.length : "no"} dims, expected ${GEMINI_EMBED_DIM}`,
    );
  }

  // Truncated Matryoshka outputs aren't unit-length — normalize so cosine
  // distance behaves and matches the document embeddings.
  return l2normalize(values as number[]);
}

function l2normalize(v: number[]): number[] {
  let sumSq = 0;
  for (const x of v) sumSq += x * x;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}
