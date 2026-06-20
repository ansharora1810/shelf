import { ItemStatus } from '../lib/database.types'

const IN_PROGRESS: ReadonlySet<ItemStatus> = new Set<ItemStatus>([
  'started',
  'fetched',
  'fetch_failed',
  'client_fetched',
])

// Non-terminal states that still show the shimmer placeholder. `ready` renders
// the real title; `failed` keeps the existing remove/delete path.
export function isProcessing(status: ItemStatus): boolean {
  return IN_PROGRESS.has(status)
}
