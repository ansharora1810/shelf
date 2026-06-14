import { Link } from '../types'

export function getTopTags(links: Link[], count: number): string[] {
  const freq: Record<string, number> = {}
  for (const link of links) {
    for (const tag of link.tags) {
      freq[tag] = (freq[tag] ?? 0) + 1
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([tag]) => tag)
}

export function groupLinksByWeek(
  links: Link[],
): Array<{ label: string; count: number; links: Link[] }> {
  const sorted = [...links].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  )

  const groups = new Map<string, Link[]>()
  for (const link of sorted) {
    const label = weekLabel(link.savedAt)
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(link)
  }

  return Array.from(groups.entries()).map(([label, links]) => ({
    label,
    count: links.length,
    links,
  }))
}

function weekLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) return 'This week'
  if (diffDays < 14) return 'Last week'
  const weeks = Math.floor(diffDays / 7)
  return `${weeks} weeks ago`
}
