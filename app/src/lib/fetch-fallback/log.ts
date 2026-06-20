import { DEBUG_PARSING } from '../../constants/pipeline'

// One log shape for the whole client-assisted fetch so every line for a single
// item can be grepped by `item=<id>`:
//
//   <iso-timestamp> [shelf:fetch] item=<id> <event> <detail?>
//
// e.g. 2026-06-20T12:34:56.789Z [shelf:fetch] item=abc123 wv-http 403 https://…
//
// Gated by DEBUG_PARSING — the single switch for this module's logging (off for
// release). Objects are JSON-stringified; strings are passed through verbatim.
export function logFetch(itemId: string, event: string, detail?: unknown): void {
  if (!DEBUG_PARSING) return
  const tail =
    detail === undefined
      ? ''
      : ` ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`
  console.log(`${new Date().toISOString()} [shelf:fetch] item=${itemId} ${event}${tail}`)
}
