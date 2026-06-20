-- Shelf — hybrid search (PRD §11.1): semantic (pgvector) + fuzzy (pg_trgm).
--
-- Adds the embedding column + indexes and the two search RPCs the POST /search
-- Edge Function composes (SemanticSearch / FuzzySearch strategies, merged by RRF
-- in TS). Embeddings are gemini-embedding-001 @ 768 dims, L2-normalized, written
-- by enrich-item at processing time. Re-embed-on-edit is v2 — no trigger here.
--
-- The vector + pg_trgm extensions live in the `extensions` schema (matching the
-- baseline's pgcrypto/moddatetime). Types, opclasses, and the operators used by
-- the RPCs are schema-qualified or reached via each function's search_path.

begin;

set local search_path = public, extensions;

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists vector  with schema extensions;  -- pgvector: vector type, hnsw
create extension if not exists pg_trgm with schema extensions;  -- trigram similarity + gin/gist opclasses

-- ── Embedding column ─────────────────────────────────────────────────────────
-- One 768-dim vector per item over the §11.1 structured string (Title/Tags/Summary).
-- Null until enrich-item embeds the row (or for items that failed to embed).
alter table public.items add column if not exists embedding extensions.vector(768);

-- ── Indexes ──────────────────────────────────────────────────────────────────
-- HNSW cosine over the embedded rows only (partial — most rows are embedded, but
-- non-ready / failed-to-embed rows carry null and are skipped by the index).
create index if not exists items_embedding_hnsw_idx
  on public.items using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

-- Trigram GIN on name for fuzzy. Tags are a short text[] matched in-memory by the
-- fuzzy RPC (unnest + similarity), so they need no separate index at this scale.
create index if not exists items_name_trgm_idx
  on public.items using gin (name extensions.gin_trgm_ops);

-- ── Search strategy RPCs ─────────────────────────────────────────────────────
-- Both are SECURITY INVOKER (the default): called through the caller's JWT, so
-- RLS scopes every read to the caller's own rows — no explicit user_id needed.
-- Each returns rows already ordered by relevance; the Edge Function reads array
-- position as the per-strategy rank for RRF.

-- The query embedding arrives as a pgvector text literal ("[a,b,...]") and is
-- cast inside — sidesteps PostgREST vector-coercion ambiguity over the wire.
create or replace function public.shelf_search_semantic(
  p_query_embedding text,
  p_limit int default 50
)
returns setof public.items
language sql
stable
set search_path = public, extensions
as $$
  select *
  from public.items
  where status = 'ready'
    and embedding is not null
  order by embedding <=> p_query_embedding::extensions.vector
  limit p_limit;
$$;

create or replace function public.shelf_search_fuzzy(
  p_query text,
  p_threshold real default 0.2,
  p_limit int default 50
)
returns setof public.items
language sql
stable
set search_path = public, extensions
as $$
  select *
  from public.items
  where status = 'ready'
    and (
      similarity(coalesce(name, ''), p_query) >= p_threshold
      or exists (
        select 1 from unnest(tags) as t
        where similarity(ltrim(t, '#'), p_query) >= p_threshold
      )
    )
  order by greatest(
    similarity(coalesce(name, ''), p_query),
    coalesce((select max(similarity(ltrim(t, '#'), p_query)) from unnest(tags) as t), 0)
  ) desc
  limit p_limit;
$$;

-- Only signed-in users search their own shelf; anon never reaches these (the
-- Edge Function is verify_jwt=true) and RLS would return nothing anyway.
revoke execute on function public.shelf_search_semantic(text, int)    from public;
revoke execute on function public.shelf_search_fuzzy(text, real, int) from public;
grant  execute on function public.shelf_search_semantic(text, int)    to authenticated, service_role;
grant  execute on function public.shelf_search_fuzzy(text, real, int) to authenticated, service_role;

commit;
