import { useEffect } from 'react'
import { supabase } from '../supabase'
import { ItemRow } from '../database.types'
import { Link } from '../../types'
import { fetchViaWebView } from './WebViewFetcher'
import { detectSource } from './source'
import { logFetch } from './log'
import { MAX_APP_FETCH_ATTEMPTS } from '../../constants/pipeline'

// Client-assisted fetch (PRD §8.2). The app drives `fetch_failed` rows: it claims
// one by atomically stamping `dispatched_at` (set-if-null) and bumping the attempt
// counter, fetches the body on its residential IP, then writes `fetched` — the
// same body-obtained state the backend writes. The residential-fetch provenance
// lives in `app_fetch_attempts` (> 0), not a distinct status.
//
// `dispatched_at` is the one claim marker shared with the backend drainers — a
// status change auto-nulls it (DB trigger), so a successful fetch frees the slot
// for free. The set-if-null gate is the exclusion: a second pickup (remount,
// reordered realtime) finds `dispatched_at` already set and updates zero rows, so
// the fetch and the increment happen exactly once. There is no in-memory guard
// and no retry interval — a failed attempt leaves the claim in place and the
// watchdog releases it after a lease (re-exposing it via realtime); the count gate
// finalizes it once the cap is hit. The app never writes `failed`.
export function useClientFetchQueue(links: Link[], pushRow: (row: ItemRow) => void) {
  useEffect(() => {
    const pending = links.filter(
      l => l.status === 'fetch_failed' && l.appFetchAttempts < MAX_APP_FETCH_ATTEMPTS,
    )
    for (const link of pending) void processLink(link, pushRow)
  }, [links, pushRow])
}

async function processLink(link: Link, pushRow: (row: ItemRow) => void): Promise<void> {
  const attempt = link.appFetchAttempts + 1

  // Exclusive claim: only the writer that flips `dispatched_at` from null wins.
  // A losing claim (already claimed, or count exhausted) updates zero rows — the
  // common, expected case for a re-fired effect, so it stays silent.
  const claim = await supabase
    .from('items')
    .update({ dispatched_at: new Date().toISOString(), app_fetch_attempts: attempt })
    .eq('id', link.id)
    .eq('status', 'fetch_failed')
    .is('dispatched_at', null)
    .lt('app_fetch_attempts', MAX_APP_FETCH_ATTEMPTS)
    .select('id')
  if (claim.error) {
    logFetch(link.id, 'claim-error', claim.error.message)
    return
  }
  if (!claim.data?.length) return
  logFetch(link.id, 'claim', `attempt=${attempt}/${MAX_APP_FETCH_ATTEMPTS}`)

  const source = detectSource(link.url, link.source)
  logFetch(link.id, 'fetch-start', `source=${source} url=${link.url}`)
  const content = await fetchViaWebView(link.id, link.url, source)
  if (!content || (!content.rawContent && !content.title && !content.thumbnailUrl)) {
    // Leave the claim in place; the watchdog releases it (lease) for a retry.
    logFetch(link.id, 'fetch-empty', 'no content; awaiting watchdog release')
    return
  }

  const patch: Partial<ItemRow> = { status: 'fetched' }
  if (content.rawContent) patch.raw_content = content.rawContent
  if (content.title && !link.name) patch.name = content.title
  if (content.thumbnailUrl && !link.thumbnail) patch.thumbnail_url = content.thumbnailUrl
  if (content.consumeTime != null && link.consumeTime == null) patch.consume_time = content.consumeTime

  // Status change auto-nulls dispatched_at (trigger), freeing the row for enrich.
  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', link.id)
    .eq('status', 'fetch_failed')
    .select()
  if (error || !data?.length) {
    logFetch(link.id, 'write-lost', error?.message ?? 'row already advanced')
    return
  }
  logFetch(link.id, 'client_fetched', `body=${!!patch.raw_content} name=${!!patch.name} thumb=${!!patch.thumbnail_url}`)
  pushRow(data[0])
}
