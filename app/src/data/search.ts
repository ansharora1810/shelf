import { Link } from '../types'
import { supabase } from '../lib/supabase'
import { mapItem } from '../store/shelf'
import { ItemRow } from '../lib/database.types'

// v1+ hybrid search (PRD §11.1): POST /search embeds the query server-side and
// fuses semantic + fuzzy results (RRF). Returns full item rows; we map them to
// Link the same way the store does. The tag browser stays client-side (allTags).
export async function searchRemote(query: string): Promise<Link[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase.functions.invoke('search', { body: { query: q } })
  if (error) throw error
  const items = (data?.items ?? []) as ItemRow[]
  return items.map(mapItem)
}

export function allTags(links: Link[]): string[] {
  const freq: Record<string, number> = {}
  for (const link of links) {
    for (const tag of link.tags) freq[tag] = (freq[tag] ?? 0) + 1
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
}
