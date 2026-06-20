import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { ItemRow } from '../database.types'
import { Link } from '../../types'
import { fetchViaWebView } from './WebViewFetcher'
import { detectSource } from './source'
import { MAX_APP_FETCH_ATTEMPTS, RETRY_SCAN_INTERVAL_MS } from '../../constants/pipeline'

// Claim-then-work (PRD §11.1): on each `fetch_failed` row under the attempt cap,
// increment the counter via a guarded CAS *before* fetching, then on success
// write `client_fetched` + content in a single guarded update. A failed/null
// fetch leaves the row at `fetch_failed` (count already advanced) for the
// watchdog to finalize. The app never writes `failed`.
export function useClientFetchQueue(links: Link[], pushRow: (row: ItemRow) => void) {
  const inProgress = useRef(new Set<string>())
  const [tick, setTick] = useState(0)

  // A failed attempt writes nothing new, so the effect below wouldn't re-fire
  // until the next realtime/reconcile event — which may never come, leaving the
  // row stuck at `fetch_failed` below the watchdog's count gate. Re-scan on an
  // interval (foreground only — JS timers pause in the background) so retries
  // keep firing up to the cap without depending on an external event.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), RETRY_SCAN_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const pending = links.filter(
      l =>
        l.status === 'fetch_failed' &&
        l.appFetchAttempts < MAX_APP_FETCH_ATTEMPTS &&
        !inProgress.current.has(l.id),
    )
    for (const link of pending) {
      inProgress.current.add(link.id)
      void processLink(link, pushRow).finally(() => inProgress.current.delete(link.id))
    }
  }, [links, tick, pushRow])
}

async function processLink(link: Link, pushRow: (row: ItemRow) => void): Promise<void> {
  const claim = await supabase
    .from('items')
    .update({ app_fetch_attempts: link.appFetchAttempts + 1 })
    .eq('id', link.id)
    .eq('status', 'fetch_failed')
    .eq('app_fetch_attempts', link.appFetchAttempts)
    .select('id')
  if (claim.error || !claim.data?.length) return

  const content = await fetchViaWebView(link.url, detectSource(link.url, link.source))
  if (!content || (!content.rawContent && !content.title && !content.thumbnailUrl)) return

  const patch: Partial<ItemRow> = { status: 'client_fetched' }
  if (content.rawContent) patch.raw_content = content.rawContent
  if (content.title && !link.name) patch.name = content.title
  if (content.thumbnailUrl && !link.thumbnail) patch.thumbnail_url = content.thumbnailUrl
  if (content.consumeTime != null && link.consumeTime == null) patch.consume_time = content.consumeTime

  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', link.id)
    .eq('status', 'fetch_failed')
    .select()
  if (error || !data?.length) return
  pushRow(data[0])
}
