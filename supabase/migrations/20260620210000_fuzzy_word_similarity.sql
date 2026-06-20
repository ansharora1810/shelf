-- Fuzzy search: similarity() → word_similarity() (PRD §11.1 open-item #2).
--
-- similarity() compares whole strings, so a short query against a long title
-- scores near the floor — a "mathmatics" typo vs "The mathematics of love |
-- Hannah Fry" was 0.229, barely over the old 0.2 threshold; a longer title would
-- miss entirely. word_similarity() scores the best-matching window instead:
-- exact word matches ~1.0, that same typo ~0.62. So the default threshold rises
-- to 0.4 — comfortably catches typos while rejecting noise.

begin;

set local search_path = public, extensions;

create or replace function public.shelf_search_fuzzy(
  p_query text,
  p_threshold real default 0.4,
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
      word_similarity(p_query, coalesce(name, '')) >= p_threshold
      or exists (
        select 1 from unnest(tags) as t
        where word_similarity(p_query, ltrim(t, '#')) >= p_threshold
      )
    )
  order by greatest(
    word_similarity(p_query, coalesce(name, '')),
    coalesce((select max(word_similarity(p_query, ltrim(t, '#'))) from unnest(tags) as t), 0)
  ) desc
  limit p_limit;
$$;

commit;
