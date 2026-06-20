# Shelf v1 — backend ↔ frontend contract

The single source of truth for the shapes the create endpoint, the worker, and the
frontend data layer must agree on. Schema is already live (project `hpnxuouiyrhlqabkgmis`).
DB types: `app/src/lib/database.types.ts`. PRD: `.claude/prd/PRD.md`.

## Tables (live)

`items` and `projects`, both `user_id`-scoped by RLS (`user_id = auth.uid()`).
`user_id` defaults to `auth.uid()` — direct-client and JWT-context inserts never pass it.

`items` columns: `id, user_id, type('link'|'image'|'pdf', default 'link'), url, normalized_url,
status('awaiting_upload'|'started'|'fetched'|'fetch_failed'|'client_fetched'|'ready'|'failed', default 'started'),
status_changed_at, dispatched_at(timestamptz, nullable), app_fetch_attempts(int default 0), raw_content, name,
tags(text[] default {}), summary, thumbnail_url, consume_time(int seconds, nullable),
project_id(fk→projects, on delete set null), reminder_enabled(bool default false),
source('youtube'|'instagram'|'website'), created_at, updated_at`.

The staged-pipeline lifecycle (PRD §11.1) supersedes the single-stage `processing → ready/failed`:
`started` (created, awaiting backend fetch) → `fetch-item` → `fetched` (body obtained) **or**
`fetch_failed` (no body — the app fetches via webview on its residential IP) → `client_fetched` →
`enrich-item` (one Gemini call over the body) → `ready`. `failed` is terminal. The app **never** writes
`failed`: on a `fetch_failed` row it increments `app_fetch_attempts` (claim-then-work) then, on success,
atomically writes `status='client_fetched'` + `raw_content`; the watchdog finalizes exhausted rows.

`projects` columns: `id, user_id, name(1–20 chars), created_at, updated_at`.

- No `embedding` column (semantic search is v2).
- Dedup: partial unique index `(user_id, normalized_url) where type='link' and normalized_url is not null`.
- `items` DELETE is RLS-blocked on all non-terminal states; allowed only on `ready` / `failed`.
- Both tables are in the `supabase_realtime` publication. The app subscribes to non-terminal rows and
  picks up `fetch_failed` to drive its webview fetch.
- `status_changed_at` is maintained by the `items_set_status_changed_at` BEFORE trigger (on insert and
  whenever `status` changes) — no writer sets it manually. The same trigger **nulls `dispatched_at` on
  any status change**, so the dispatch claim is always scoped to the current stage. The
  `app_fetch_attempts` increment doesn't change status, so it doesn't bump either; deadlines measure
  true time-in-state.
- **Dispatch is paced, not trigger-fired (PRD §11.2).** The `items` table *is* the queue, partitioned
  by `status`: `started` = fetch queue, `fetched`/`client_fetched` = enrich queue. Two pg_cron drainers
  (`shelf-drain-fetch`, `shelf-drain-enrich`, every 5s) replace the old immediate-fire triggers: each
  counts in-flight rows (`dispatched_at IS NOT NULL`) for its stage, and while below its cap `K` claims
  undispatched rows (`FOR UPDATE SKIP LOCKED`), stamps `dispatched_at = now()`, and fires the worker via
  pg_net (same payload as before). Surplus waits durably in-state instead of being dropped past the Edge
  concurrency ceiling. `K_fetch`/`K_enrich` are tunable constants in the drainer functions. A third
  hourly cron job prunes `cron.job_run_details` to 24h.
- Watchdog `shelf_watchdog()` runs every minute via pg_cron (PRD §11.1), keyed on `status` only —
  unchanged by §11.2 (`dispatched_at` doesn't reset any deadline; queue-wait counts against the budget):
  - `started` past 90s (time-in-state) → `fetch_failed`
  - `fetched`/`client_fetched` past 90s (time-in-state) → `failed`
  - `fetch_failed` with `app_fetch_attempts >= 3` → `failed` (**count-gated, no time predicate**)
  - `awaiting_upload` past 3 min → `failed`

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
   `source`, `project_id`, `status='started'`. Leave `name`, `summary`, `tags`, `raw_content`,
   `consume_time`, `thumbnail_url` for the workers. `status_changed_at` is set by the BEFORE trigger —
   never written here (and `processing_started_at` no longer exists).
6. Return `{ item: <full row>, deduped: false }`. The row sits at `started`; the `shelf-drain-fetch`
   pg_cron drainer claims it (≤5s) and fires `fetch-item` via pg_net (PRD §11.2 — no insert trigger).

**Errors:** any failure that prevents inserting a row → non-2xx so the app shows "try again"
(nothing enters the feed). A slow/empty origin is NOT an error — insert with whatever resolved.

## Edge function: `fetch-item` (fetch stage, `mode='fetch'`)

Invoked by the `shelf-drain-fetch` pg_cron drainer via pg_net (PRD §11.2): **`POST { item_id: string, mode: 'fetch' }`**.
`verify_jwt = false` (called by the system, not a user); protect with a shared-secret header
(`x-worker-secret`, value from env). Uses the **service-role key** (env `SUPABASE_SERVICE_ROLE_KEY`,
auto-injected) — bypasses RLS; scope every write by `item_id`.

**Behavior — fetch raw content only; no Gemini:**
1. Load row by `item_id`. If `status != 'started'`, no-op (zombie/late retry).
2. Resolve redirects, classify the destination, fetch full content by source → `title`,
   `raw_content`, `consume_time`, `thumbnail_url`.
3. **Status decision (PRD §11.1):** `fetched` only if a usable **body** was obtained
   (`raw_content` non-empty after trim); otherwise `fetch_failed` — even when a title/thumbnail
   were obtained (e.g. YouTube oEmbed yields title + thumbnail but no body → `fetch_failed`).
4. **Single guarded write** (status + content together) — `UPDATE items SET … WHERE id = :item_id
   AND status = 'started'`: `status` = `fetched`/`fetch_failed`, corrected `source`, `raw_content`,
   `name` = user-set name else fetched title, `consume_time`/`thumbnail_url` coalesced. Persists
   whatever title/thumbnail/source it got either way, so the app augments rather than starts blank.

The `fetched` write lands the row in the enrich queue; the `shelf-drain-enrich` drainer claims it (≤5s)
and fires `enrich-item` via pg_net (PRD §11.2 — no update trigger). A `fetch_failed` row is handed to
the app (Realtime push + reconcile GETs) to fetch the body on its residential IP, then `client_fetched`.

## Edge function: `enrich-item` (AI stage, `mode='enrich'`)

Invoked by the `shelf-drain-enrich` pg_cron drainer via pg_net when a row sits in `fetched`/`client_fetched` (PRD §11.2):
**`POST { item_id: string, mode: 'enrich' }`**. Same scaffolding (`verify_jwt = false`,
`x-worker-secret`, service-role key, always-200).

**Behavior:**
1. Load row by `item_id`. If `status not in ('fetched','client_fetched')`, no-op.
2. Build the prompt from `name`/title + `raw_content` + `url`. Fetch the user's tag vocabulary
   (`get_user_tags`) and bias the model toward reuse.
3. One **Gemini 2.5 Flash-Lite** structured-output call → `{ name, summary, tags[] }` (3–6 tags,
   each kebab-case with a leading `#`). Key in env `GEMINI_API_KEY`.
4. **Guarded terminal write** — `UPDATE items SET … WHERE id = :item_id AND status IN
   ('fetched','client_fetched')` (`ready` excluded so this write can't self-trigger the enrich kick):
   - `status` = `'ready'` (`failed` reserved for the truly-nothing case — by this stage there's
     almost always a body or title)
   - `summary` = AI summary (AI-owned)
   - `name` = user-set / fetched name, else AI name, else keep
5. `add_item_tags` RPC (atomic append: `tags || ai_tags`) — only if the guarded write won, so a
   concurrent manual-add tag merge is never clobbered.

No `reembed` mode in v1 (v2). No retry/`reprocess` endpoint in v1 (failed → user removes + re-adds).

## Frontend data model (camelCase) — mapping from `ItemRow`

The frontend's `Link`/`Item` type maps DB snake_case → camelCase. Key changes from the mock model:
- **Drop `descriptor`.** DB has a single `name`. Card + detail render the **first two words of `name`
  in `accent`, the rest in `primary`** — a pure client-side rule (a `titleAccent(name)` helper). No
  `descriptor`/`title` split anywhere.
- **`consumeTime` is `number | null` (seconds).** A client-side `formatConsumeTime(seconds)` produces
  the badge label (e.g. 720 → "12m", 3720 → "1h 2m"). Badge hidden when null/0.
- `status: ItemStatus` drives card state: `started`/`fetched`/`client_fetched` → skeleton fill-in;
  `fetch_failed` → the app fetches the body via its hidden webview (claim-then-work: increment
  `app_fetch_attempts` first, then atomically write `client_fetched` + `raw_content` on success);
  `failed` → Remove affordance (v1, no retry); `ready` → normal.
- `savedAt` ← `created_at`. `reminderEnabled` ← `reminder_enabled`. `thumbnail` ← `thumbnail_url`.
  `projectId` ← `project_id`.
- `Project` loses stored `linkCount` — membership/count is derived client-side from the item list.

## Create + edit wiring (frontend)

- Manual add: `supabase.functions.invoke('create-item', { body: { url, project_id } })` → on
  `deduped` show "Already in your shelf" + surface existing item; else popup expands with returned
  non-AI fields → Save = `PUT` (supabase `.update()`) of user `name`/`tags`/`project_id`/`reminder_enabled`.
- Plain CRUD is direct supabase client + RLS: `GET` = `.select('*')`, edit = `.update()`,
  delete item = `.delete()` (rejected on any non-terminal state), upsert project = `.insert()`/`.update()`,
  delete project = `.delete()` after first nulling or deleting member items per the `delete_items` choice.
- Realtime: subscribe to `items` changes where `user_id = me` (filter client-side on payload) for
  non-terminal fill-in **and** to pick up `fetch_failed` rows to drive the client-assisted fetch.
  Reconcile via full parallel `GET items`+`GET projects` on session-acquired, foreground, network
  reconnect, and realtime re-subscribe — also recovers missed `fetch_failed` pushes. No polling.
- All data access gated on an authenticated session; re-fetch on logout→login.
