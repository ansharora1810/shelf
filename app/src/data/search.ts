import { Link } from '../types'

export function allTags(links: Link[]): string[] {
  const freq: Record<string, number> = {}
  for (const link of links) {
    for (const tag of link.tags) freq[tag] = (freq[tag] ?? 0) + 1
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
}

// Client-side stand-in for the backend's semantic search. Swap for the
// embeddings API later; the (query, links) -> Link[] contract stays the same.
export function searchLinks(query: string, links: Link[]): Link[] {
  const q = query.trim().toLowerCase().replace(/^#/, '')
  if (!q) return []
  return links.filter(link => {
    const haystack = [link.title, link.descriptor, link.summary, ...link.tags].join(' ').toLowerCase()
    return haystack.includes(q)
  })
}
