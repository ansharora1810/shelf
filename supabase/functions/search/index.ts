import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleOptions, json } from "../_shared/cors.ts";
import { makeLogger } from "../_shared/log.ts";
import { embedText, toVectorLiteral } from "../_shared/embedding.ts";

// POST /search (PRD §11.1) — hybrid search over the user's shelf.
//
// A `Search` Composite runs two `ISearch` Strategies — SemanticSearch (pgvector
// cosine over the embedding) and FuzzySearch (pg_trgm over name + tags) — and
// fuses their ranked lists with Reciprocal Rank Fusion. Adding a third strategy
// (e.g. BM25) is one class + one array entry; the merge is untouched.
//
// verify_jwt=true: the platform rejects anon before this runs. We still build a
// caller-JWT client so the strategy RPCs read through RLS (the user's own rows).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const PER_STRATEGY_LIMIT = 50;
const RRF_K = 60; // dampens top-rank dominance so cross-strategy agreement wins

type DB = ReturnType<typeof createClient>;
type Item = Record<string, unknown> & { id: string };

interface ISearch {
  search(): Promise<Item[]>;
}

class SemanticSearch implements ISearch {
  constructor(private db: DB, private queryEmbedding: string) {}
  async search(): Promise<Item[]> {
    const { data, error } = await this.db.rpc("shelf_search_semantic", {
      p_query_embedding: this.queryEmbedding,
      p_limit: PER_STRATEGY_LIMIT,
    });
    if (error) throw error;
    return (data ?? []) as Item[];
  }
}

class FuzzySearch implements ISearch {
  constructor(private db: DB, private query: string) {}
  async search(): Promise<Item[]> {
    const { data, error } = await this.db.rpc("shelf_search_fuzzy", {
      p_query: this.query,
      p_limit: PER_STRATEGY_LIMIT,
    });
    if (error) throw error;
    return (data ?? []) as Item[];
  }
}

class Search implements ISearch {
  constructor(private strategies: ISearch[]) {}
  async search(): Promise<Item[]> {
    // allSettled so one strategy failing (e.g. a transient RPC error) still
    // returns the other's results rather than the whole search failing.
    const settled = await Promise.allSettled(this.strategies.map((s) => s.search()));
    const lists = settled
      .filter((r): r is PromiseFulfilledResult<Item[]> => r.status === "fulfilled")
      .map((r) => r.value);
    return rrfMerge(lists);
  }
}

// Reciprocal Rank Fusion: score(item) = Σ 1/(k + rank) over the lists it appears
// in. Scale-invariant (cosine distance vs trigram similarity never compared) and
// rewards items both strategies surface near the top.
function rrfMerge(lists: Item[][]): Item[] {
  const scored = new Map<string, { row: Item; score: number }>();
  for (const list of lists) {
    list.forEach((row, idx) => {
      const contribution = 1 / (RRF_K + idx + 1);
      const entry = scored.get(row.id);
      if (entry) entry.score += contribution;
      else scored.set(row.id, { row, score: contribution });
    });
  }
  return [...scored.values()].sort((a, b) => b.score - a.score).map((e) => e.row);
}

// Strip the heavy, app-irrelevant columns before responding.
function leanItem(row: Item): Record<string, unknown> {
  const { embedding: _embedding, raw_content: _rawContent, ...rest } = row;
  return rest;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return handleOptions();
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const log = makeLogger("search", user.id);

  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const query = body.query?.trim();
  if (!query) return json({ items: [] });

  // Semantic + fuzzy by default; if the query embedding fails (rate limit /
  // network), degrade to fuzzy-only rather than returning nothing.
  const strategies: ISearch[] = [new FuzzySearch(supabase, query)];
  try {
    const queryVector = await embedText(query, "RETRIEVAL_QUERY", log);
    strategies.unshift(new SemanticSearch(supabase, toVectorLiteral(queryVector)));
  } catch (err) {
    log.error("query-embed-failed", err);
  }

  try {
    const items = (await new Search(strategies).search()).map(leanItem);
    log.info("done", `query="${query}" results=${items.length}`);
    return json({ items });
  } catch (err) {
    log.error("search-failed", err);
    return json({ error: "Search failed" }, 500);
  }
});
