# Shelf Edge Functions

Four Deno/TypeScript functions deployed on Supabase Edge Functions: the staged client-assisted
fetch pipeline (`create-item` → `fetch-item` → `enrich-item`, PRD §8.2) and hybrid `search`
(PRD §11.1). Pipeline:

```
create-item → [started] → fetch-item → [fetched]        → enrich-item → [ready]
                                      → [fetch_failed] → app webview → [fetched] → enrich-item → [ready]
```

Both paths converge on `fetched`; residential-fetch provenance is captured by `app_fetch_attempts > 0`, not a distinct status.

## Functions

### `create-item` — `POST /functions/v1/create-item`

The user-facing create endpoint. `verify_jwt = true` — the Supabase gateway validates the caller's JWT before the function runs.

**What it does:**
1. Extracts `user_id` from the validated JWT.
2. Normalises the URL and classifies its source (`youtube` / `instagram` / `website`).
3. Deduplicates: if the user already has an item with the same `normalized_url`, returns it with `deduped: true` (and optionally files it into a project if the existing item has none).
4. Inserts the row at `status = 'started'` (a DB-only op; no network calls), returns `{ item, deduped: false }`. `status_changed_at` is set by the BEFORE trigger.
5. The AFTER INSERT trigger fires `fetch-item` asynchronously via `pg_net`.

**Request body:** `{ url: string, project_id?: string | null }`

**Response:** `{ item: ItemRow, deduped: boolean }`

---

### `fetch-item` — `POST /functions/v1/fetch-item`

The fetch stage (was `process-item`, descoped). `verify_jwt = false` — called by the DB system, not a user. Protected by the `x-worker-secret` header.

**What it does:**
1. Validates the `x-worker-secret` header.
2. Loads the item by `item_id`; no-ops if `status != 'started'` (zombie guard).
3. Resolves redirects, classifies the destination, fetches full content by source (website text, YouTube oEmbed, Instagram caption, Reddit JSON) → `title`, `raw_content`, `consume_time`, `thumbnail_url`. **No Gemini.**
4. **Status decision:** `fetched` only if a usable **body** (`raw_content`, non-empty after trim) was obtained; otherwise `fetch_failed` — even when a title/thumbnail were obtained (YouTube oEmbed → title+thumbnail but no body → `fetch_failed`, handed to the app's webview fetch).
5. **Single guarded write** (status + content together, `WHERE id = ? AND status = 'started'`): corrected `source`, `raw_content`, `name` (user-set else fetched title), `consume_time`/`thumbnail_url` coalesced. Whatever was parsed is persisted either way.

**Request body (from pg_net trigger):** `{ item_id: string, mode: "fetch" }`

**Response:** `{ ok: true }` (always 200 to pg_net; errors are logged)

---

### `enrich-item` — `POST /functions/v1/enrich-item`

The AI stage. `verify_jwt = false`, `x-worker-secret`, service-role key — same scaffolding as `fetch-item`.

**What it does:**
1. Validates the `x-worker-secret` header.
2. Loads the item by `item_id`; no-ops if `status != 'fetched'` (zombie guard).
3. Builds the prompt from `name`/title + `raw_content` + `url`; fetches the user's tag vocabulary (`get_user_tags`) to bias tag reuse.
4. Calls Gemini 2.5 Flash-Lite once for structured `{ name, summary, tags[3..6] }` output.
5. Embeds the final view (name + AI⋃existing tags + summary) via `gemini-embedding-001`@768 (`_shared/embedding.ts`) when landing `ready`; an embed failure degrades to a null embedding (still fuzzy-searchable).
6. Writes the terminal state in a **single guarded update** (`WHERE id = ? AND status = 'fetched'` — `ready` excluded so the write can't self-trigger):
   - `status` → `ready` (or `failed` only if nothing usable at all)
   - `summary` — AI-owned, always written; `embedding` — written only when computed
   - `name` — kept if user-set / fetched, else AI name, else unchanged
7. `add_item_tags` RPC (union of existing tags and AI tags) — only if the guarded write won.

**Request body:** `{ item_id: string, mode: "enrich" }`, or `{ item_id, mode: "embed" }` for the
embed-only primitive (regenerate `embedding` for a `ready` row — used by the one-time backfill; the
v2 re-embed-on-edit trigger will reuse it).

**Response:** `{ ok: true }` (always 200 to pg_net; errors are logged)

---

### `search` — `POST /functions/v1/search`

Hybrid search (PRD §11.1). `verify_jwt = true` — the gateway rejects anon; the function builds a
caller-JWT client so the strategy RPCs read through RLS.

**What it does:**
1. Empty query → `{ items: [] }`.
2. Embeds the query (`gemini-embedding-001`@768, `RETRIEVAL_QUERY`).
3. A `Search` Composite runs two `ISearch` strategies concurrently — `SemanticSearch`
   (`shelf_search_semantic`, pgvector cosine) and `FuzzySearch` (`shelf_search_fuzzy`,
   `word_similarity` on name + tags) — and fuses their ranked lists by **Reciprocal Rank Fusion**
   (k=60). A failed query embedding degrades to fuzzy-only.
4. Returns rows with `embedding` + `raw_content` stripped.

**Request body:** `{ query: string }`  **Response:** `{ items: ItemRow[] }`

---

## Required secrets

Set these in the Supabase dashboard under **Project Settings → Edge Functions → Secrets**, or via the CLI:

```
supabase secrets set GEMINI_API_KEY=<your-gemini-key>
supabase secrets set WORKER_SECRET=<the-shared-secret>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** by the
platform — do not (and cannot) set them: the `SUPABASE_` prefix is reserved for secrets.

| Variable | Who sets it | Used by |
|---|---|---|
| `SUPABASE_URL` | Platform (auto) | All functions |
| `SUPABASE_ANON_KEY` | Platform (auto) | `create-item` + `search` (caller-JWT client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Platform (auto) | `fetch-item` + `enrich-item` |
| `GEMINI_API_KEY` | You (secret) | `enrich-item` (AI + document embeddings) + `search` (query embedding) |
| `WORKER_SECRET` | You (secret) | `fetch-item` + `enrich-item` header check; must equal the Vault `worker_secret` the drainers read |

---

## Deployment

```bash
# Deploy all functions
supabase functions deploy create-item  --project-ref hpnxuouiyrhlqabkgmis
supabase functions deploy fetch-item   --project-ref hpnxuouiyrhlqabkgmis
supabase functions deploy enrich-item  --project-ref hpnxuouiyrhlqabkgmis
supabase functions deploy search       --project-ref hpnxuouiyrhlqabkgmis
```

Or via the Supabase MCP tool:
```
mcp__supabase__deploy_edge_function({ function_name: "create-item" })
mcp__supabase__deploy_edge_function({ function_name: "fetch-item" })
mcp__supabase__deploy_edge_function({ function_name: "enrich-item" })
```

---

## pg_net triggers (migration `client_assisted_fetch`)

Two AFTER triggers call the workers via `pg_net`, each reading the shared secret from **Supabase Vault**
(secret name `worker_secret`):

- `items_fire_worker` — `AFTER INSERT … WHEN (new.status = 'started' AND new.type = 'link')` →
  `shelf_fire_worker()` posts to `/functions/v1/fetch-item` with `mode='fetch'`.
- `items_fire_enrich` — `AFTER UPDATE … WHEN (new.status = 'fetched' AND
  old.status IS DISTINCT FROM new.status)` → `shelf_fire_enrich()` posts to `/functions/v1/enrich-item`
  with `mode='enrich'`. `ready` is excluded so enrich-item's own write can't self-trigger.

Both are fire-and-forget (at-most-once). `status_changed_at` is maintained by the
`items_set_status_changed_at` BEFORE trigger.

**To activate the workers, set the secret in two places (must match):**
1. Vault secret `worker_secret` — `select vault.create_secret('<value>', 'worker_secret');` (already set)
2. Function env `WORKER_SECRET` on **both** `fetch-item` and `enrich-item` (dashboard or
   `supabase secrets set WORKER_SECRET=<value>`)
