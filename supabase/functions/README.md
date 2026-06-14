# Shelf Edge Functions

Two Deno/TypeScript functions deployed on Supabase Edge Functions.

## Functions

### `create-item` — `POST /functions/v1/create-item`

The user-facing create endpoint. `verify_jwt = true` — the Supabase gateway validates the caller's JWT before the function runs.

**What it does:**
1. Extracts `user_id` from the validated JWT.
2. Normalises the URL and classifies its source (`youtube` / `instagram` / `website`).
3. Deduplicates: if the user already has an item with the same `normalized_url`, returns it with `deduped: true` (and optionally files it into a project if the existing item has none).
4. Performs fast non-AI enrichment (OG/Twitter meta, YouTube oEmbed) under a 3 s timeout — slow or unreachable origins proceed with `null` fields.
5. Inserts the row at `status = 'processing'`, returns `{ item, deduped: false }`.
6. The DB trigger fires `process-item` asynchronously via `pg_net`.

**Request body:** `{ url: string, project_id?: string | null }`

**Response:** `{ item: ItemRow, deduped: boolean }`

---

### `process-item` — `POST /functions/v1/process-item`

The async worker. `verify_jwt = false` — called by the DB system, not a user. Protected by the `x-worker-secret` header.

**What it does:**
1. Validates the `x-worker-secret` header.
2. Loads the item by `item_id`; no-ops if `status != 'processing'` (zombie guard).
3. Fetches full content by source (website text, YouTube transcript, Instagram caption).
4. Calls Gemini 2.5 Flash-Lite once for structured `{ name, summary, tags[10] }` output.
5. Writes the terminal state in a **single guarded update** (`WHERE id = ? AND status = 'processing'`):
   - `status` → `ready` (or `failed` if nothing usable at all)
   - `summary` — AI-owned, always written
   - `tags` — union of existing user tags and AI tags (`#all` is a client-side default view, never persisted)
   - `name` — only filled when the create left it blank (`coalesce` logic)
   - `consume_time` — only filled when not already set
   - `raw_content` — immutable base for future embeddings (v2)

**Request body (from pg_net trigger):** `{ item_id: string, mode: "process" }`

**Response:** `{ ok: true }` (always 200 to pg_net; errors are logged)

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
| `SUPABASE_URL` | Platform (auto) | Both functions |
| `SUPABASE_ANON_KEY` | Platform (auto) | `create-item` only |
| `SUPABASE_SERVICE_ROLE_KEY` | Platform (auto) | `process-item` only |
| `GEMINI_API_KEY` | You (secret) | `process-item` only — without it the worker still lands `ready`, just with no AI name/summary/tags |
| `WORKER_SECRET` | You (secret) | `process-item` header check; must equal the Vault `worker_secret` the trigger reads |

---

## Deployment

```bash
# Deploy both functions
supabase functions deploy create-item --project-ref hpnxuouiyrhlqabkgmis
supabase functions deploy process-item --project-ref hpnxuouiyrhlqabkgmis
```

Or via the Supabase MCP tool:
```
mcp__supabase__deploy_edge_function({ function_name: "create-item" })
mcp__supabase__deploy_edge_function({ function_name: "process-item" })
```

---

## pg_net trigger (deployed)

The `items_fire_worker` AFTER INSERT trigger (migration `shelf_worker_trigger`) calls `process-item`
via `pg_net`, reading the shared secret from **Supabase Vault** (secret name `worker_secret`) rather
than a GUC or an inline literal:

```sql
-- public.shelf_fire_worker() (security definer)
perform net.http_post(
  url     => 'https://hpnxuouiyrhlqabkgmis.supabase.co/functions/v1/process-item',
  body    => jsonb_build_object('item_id', new.id::text, 'mode', 'process'),
  headers => jsonb_build_object(
               'Content-Type', 'application/json',
               'x-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'worker_secret')
             )
);
```

Fires only `when (new.status = 'processing' and new.type = 'link')`. Fire-and-forget.

**To activate the worker, set the secret in two places (must match):**
1. Vault secret `worker_secret` — `select vault.create_secret('<value>', 'worker_secret');`
2. Function env `WORKER_SECRET` (dashboard or `supabase secrets set WORKER_SECRET=<value>`)
