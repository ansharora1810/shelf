# Shelf v1 — backend ↔ frontend contract

The single source of truth for the shapes the create endpoint, the worker, and the
frontend data layer must agree on. Schema is already live (project `hpnxuouiyrhlqabkgmis`).
DB types: `app/src/lib/database.types.ts`. PRD: `.claude/prd/PRD.md`.

## Tables (live)

`items` and `projects`, both `user_id`-scoped by RLS (`user_id = auth.uid()`).
`user_id` defaults to `auth.uid()` — direct-client and JWT-context inserts never pass it.

`items` columns: `id, user_id, type('link'|'image'|'pdf', default 'link'), url, normalized_url,
status('awaiting_upload'|'processing'|'ready'|'failed', default 'processing'),
processing_started_at, raw_content, name, tags(text[] default {}), summary, thumbnail_url,
consume_time(int seconds, nullable), project_id(fk→projects, on delete set null),
reminder_enabled(bool default false), source('youtube'|'instagram'|'website'), created_at, updated_at`.

`projects` columns: `id, user_id, name(1–20 chars), created_at, updated_at`.

- No `embedding` column (semantic search is v2).
- Dedup: partial unique index `(user_id, normalized_url) where type='link' and normalized_url is not null`.
- `items` DELETE is RLS-blocked while `status='processing'`.
- Both tables are in the `supabase_realtime` publication.
- Watchdog `shelf_watchdog()` runs every minute via pg_cron: fails `processing` rows older than
  120s and `awaiting_upload` rows older than 3 min.

## URL normalization (must be identical in create fn AND frontend dedup awareness)

`normalized_url` is the dedup key. Algorithm (conservative — under-normalize over over-normalize):
1. lowercase scheme + host
2. strip default port (`:80`/`:443`)
3. drop the URL fragment (`#…`)
4. remove trailing slash from path
5. strip tracking params: `utm_*`, `fbclid`, `gclid`, `igshid`, `si`, `mc_eid`, `mc_cid`, `_ga`, `ref`, `ref_src`
6. **keep meaningful params** (e.g. YouTube `?v=`, `?id=`) and sort remaining params alphabetically

Provide this as a shared helper. The frontend does NOT compute it (server owns dedup); it only
needs to handle the `deduped` response flag.

## Source classification

`youtube` (`youtube.com`/`youtu.be`), `instagram` (`instagram.com`), else `website`
(TikTok, X, etc. → `website` in v1). Backend-authoritative; the frontend's old `inferSource` is removed.

## Edge function: `create-item` (POST `/items`)

Invoked from the app as `supabase.functions.invoke('create-item', { body })` (JWT auto-attached).
Also called by the share extension (v2) with an App Group JWT. `verify_jwt = true`.

**Request:** `{ url: string, project_id?: string | null }`

**Behavior (fast path, target < 2s feel):**
1. Verify JWT → `user_id = sub`.
2. Normalize URL, classify source.
3. Dedup: look up existing `(user_id, normalized_url)`.
   - Exists → if the existing item has no project and `project_id` was supplied, set it.
     Return `{ item, deduped: true }` (200). Do NOT error, do NOT re-insert.
4. Fast non-AI enrichment under a tight timeout (~1.5–3s; on timeout return what arrived):
   - website: fetch HTML, parse OG/Twitter tags → `title`, `thumbnail_url`.
   - youtube: oEmbed (`https://www.youtube.com/oembed?url=…&format=json`) → `title`, `thumbnail_url`.
   - instagram: oEmbed/OG best-effort → `title`, `thumbnail_url` (fragile, may be null).
5. Insert row (uses caller JWT so RLS sets `user_id`): `type='link'`, `url`, `normalized_url`,
   `source`, `name = title` (nullable), `thumbnail_url`, `project_id`, `status='processing'`,
   `processing_started_at = now()`. Leave `summary`, `tags`, `raw_content`, `consume_time` for the worker.
6. Return `{ item: <full row>, deduped: false }`. The AFTER INSERT trigger (pg_net) fires the worker.

**Errors:** any failure that prevents inserting a row → non-2xx so the app shows "try again"
(nothing enters the feed). A slow/empty origin is NOT an error — insert with whatever resolved.

## Edge function: `process-item` (the worker, `mode='process'`)

Invoked by the DB trigger via pg_net: **`POST { item_id: string, mode: 'process' }`**.
`verify_jwt = false` (called by the system, not a user); protect with a shared-secret header
(`x-worker-secret`, value from env). Uses the **service-role key** (env `SUPABASE_SERVICE_ROLE_KEY`,
auto-injected) — bypasses RLS; scope every write by `item_id`.

**Behavior:**
1. Load row by `item_id`. If `status != 'processing'`, no-op (zombie/late retry — §8.2).
2. Fetch full content by source → build `raw_content`:
   - website: full page text (boilerplate-stripped). Compute `consume_time` = `round(words / 225 * 60)` seconds.
   - youtube: transcript (unofficial; fall back to description if unavailable). `consume_time` =
     video length in seconds if obtainable (scrape `lengthSeconds` from the watch page), else leave null.
   - instagram: caption text. `consume_time` = null.
3. One **Gemini 2.5 Flash-Lite** structured-output call over `raw_content` (+ title) →
   `{ name: string, summary: string, tags: string[] }` (exactly 10 tags, each kebab-case with a
   leading `#`, e.g. `#deep-work`). Key in env `GEMINI_API_KEY`.
4. **Guarded terminal write** — `UPDATE items SET … WHERE id = :item_id AND status = 'processing'`:
   - `summary` = AI summary (always; AI-owned, immutable)
   - `tags` = union(existing tags, AI tags) — never clobber user tags
   - `name` = `coalesce(nullif(name,''), ai_name)` — only fills when create left it blank; never
     clobbers a parsed title or a user edit
   - `consume_time` = `coalesce(consume_time, computed)`
   - `raw_content` = built content (immutable base; v2 embedding source)
   - `status` = `'ready'`
5. Degrade gracefully: a missing transcript/caption/parse still lands at `ready` with `#all` + whatever
   parsed. `status='failed'` (same guard) is reserved for "nothing usable produced" (URL unreachable
   and no title). The watchdog is the backstop if the worker crashes.

No `reembed` mode in v1 (v2). No retry/`reprocess` endpoint in v1 (failed → user removes + re-adds).

## Frontend data model (camelCase) — mapping from `ItemRow`

The frontend's `Link`/`Item` type maps DB snake_case → camelCase. Key changes from the mock model:
- **Drop `descriptor`.** DB has a single `name`. Card + detail render the **first two words of `name`
  in `accent`, the rest in `primary`** — a pure client-side rule (a `titleAccent(name)` helper). No
  `descriptor`/`title` split anywhere.
- **`consumeTime` is `number | null` (seconds).** A client-side `formatConsumeTime(seconds)` produces
  the badge label (e.g. 720 → "12m", 3720 → "1h 2m"). Badge hidden when null/0.
- `status: ItemStatus` is new and drives card state: `processing` → skeleton fill-in; `failed` →
  Remove affordance (v1, no retry); `ready` → normal.
- `savedAt` ← `created_at`. `reminderEnabled` ← `reminder_enabled`. `thumbnail` ← `thumbnail_url`.
  `projectId` ← `project_id`.
- `Project` loses stored `linkCount` — membership/count is derived client-side from the item list.

## Create + edit wiring (frontend)

- Manual add: `supabase.functions.invoke('create-item', { body: { url, project_id } })` → on
  `deduped` show "Already in your shelf" + surface existing item; else popup expands with returned
  non-AI fields → Save = `PUT` (supabase `.update()`) of user `name`/`tags`/`project_id`/`reminder_enabled`.
- Plain CRUD is direct supabase client + RLS: `GET` = `.select('*')`, edit = `.update()`,
  delete item = `.delete()` (will be rejected while processing), upsert project = `.insert()`/`.update()`,
  delete project = `.delete()` after first nulling or deleting member items per the `delete_items` choice.
- Realtime: subscribe to `items` changes where `user_id = me` (filter client-side on payload) for
  non-terminal fill-in. Reconcile via full parallel `GET items`+`GET projects` on session-acquired,
  foreground, network reconnect, and realtime re-subscribe. No polling.
- All data access gated on an authenticated session; re-fetch on logout→login.
