import { Link, Project } from '../types'

// Dates relative to 2026-06-07
export const mockLinks: Link[] = [
  {
    id: '1',
    descriptor: 'why',
    title: 'deep work is the real competitive advantage',
    thumbnail: 'https://picsum.photos/seed/lnk1/400/400',
    url: 'https://youtube.com/watch?v=ioNqpJGrfVM',
    source: 'youtube',
    tags: ['#productivity', '#career', '#deep-work', '#focus', '#books'],
    summary:
      'Cal Newport argues that the ability to focus without distraction is becoming increasingly rare — and simultaneously more valuable. A compelling case for restructuring how you spend your working hours.',
    reminderEnabled: true,
    projectId: '2',
    consumeTime: '12m',
    savedAt: '2026-06-05T10:00:00Z',
  },
  {
    id: '2',
    descriptor: 'building',
    title: 'a personal knowledge base that actually works',
    thumbnail: 'https://picsum.photos/seed/lnk2/400/400',
    url: 'https://example.com/knowledge-base',
    source: 'website',
    tags: ['#productivity', '#tools', '#knowledge', '#pkm'],
    summary:
      'A practical guide to building a second brain using a combination of Obsidian, tagging conventions, and weekly review habits.',
    reminderEnabled: false,
    projectId: null,
    consumeTime: '8m',
    savedAt: '2026-06-04T14:30:00Z',
  },
  {
    id: '3',
    descriptor: 'the best',
    title: 'VS Code extensions for 2026',
    thumbnail: 'https://picsum.photos/seed/lnk3/400/400',
    url: 'https://example.com/vscode-extensions',
    source: 'website',
    tags: ['#dev', '#tools', '#productivity'],
    summary:
      'A curated list of VS Code extensions that meaningfully improve the development experience in 2026, with a focus on AI-assisted coding tools.',
    reminderEnabled: false,
    projectId: '1',
    consumeTime: '6m',
    savedAt: '2026-06-03T09:00:00Z',
  },
  {
    id: '4',
    descriptor: 'how to',
    title: 'negotiate a higher salary (scripts included)',
    thumbnail: 'https://picsum.photos/seed/lnk4/400/400',
    url: 'https://example.com/salary-negotiation',
    source: 'website',
    tags: ['#career', '#finance', '#negotiation'],
    summary:
      'Exact scripts and frameworks for negotiating compensation at every stage — offer, review, and promotion. Includes counter-offer language that works.',
    reminderEnabled: true,
    projectId: '2',
    consumeTime: '18m',
    savedAt: '2026-05-31T11:00:00Z',
  },
  {
    id: '5',
    descriptor: 'understanding',
    title: 'compound interest visually',
    thumbnail: 'https://picsum.photos/seed/lnk5/400/400',
    url: 'https://example.com/compound-interest',
    source: 'website',
    tags: ['#finance', '#investing', '#learning'],
    summary:
      'Interactive visualisations that make the exponential nature of compound interest click — includes comparisons between starting at 22 vs 32.',
    reminderEnabled: false,
    projectId: '3',
    consumeTime: '5m',
    savedAt: '2026-05-30T16:00:00Z',
  },
  {
    id: '6',
    descriptor: 'react 19',
    title: 'new features deep dive',
    thumbnail: 'https://picsum.photos/seed/lnk6/400/400',
    url: 'https://youtube.com/watch?v=abc123',
    source: 'youtube',
    tags: ['#dev', '#react', '#frontend'],
    summary:
      'A thorough walkthrough of React 19 changes — server components, the new compiler, and the use() hook — with practical examples for each.',
    reminderEnabled: false,
    projectId: '1',
    consumeTime: '22m',
    savedAt: '2026-05-29T08:00:00Z',
  },
  {
    id: '7',
    descriptor: 'how to',
    title: 'validate a startup idea in 48 hours',
    thumbnail: 'https://picsum.photos/seed/lnk7/400/400',
    url: 'https://example.com/validate-startup',
    source: 'website',
    tags: ['#startup', '#entrepreneurship', '#product'],
    summary:
      'A repeatable framework for testing whether a startup idea has real demand before building anything — using landing pages, manual outreach, and a 48-hour deadline.',
    reminderEnabled: true,
    projectId: '1',
    consumeTime: '9m',
    savedAt: '2026-05-22T12:00:00Z',
  },
  {
    id: '8',
    descriptor: 'the psychology',
    title: 'behind why habits stick',
    thumbnail: 'https://picsum.photos/seed/lnk8/400/400',
    url: 'https://youtube.com/watch?v=def456',
    source: 'youtube',
    tags: ['#habits', '#psychology', '#productivity'],
    summary:
      'James Clear explains the neurological loop behind habit formation and how to deliberately design cue-routine-reward cycles for the behaviours you want.',
    reminderEnabled: false,
    projectId: null,
    consumeTime: '14m',
    savedAt: '2026-05-21T10:00:00Z',
  },
  {
    id: '9',
    descriptor: 'the best',
    title: 'landing page frameworks for indie hackers',
    thumbnail: 'https://picsum.photos/seed/lnk9/400/400',
    url: 'https://example.com/landing-pages',
    source: 'website',
    tags: ['#startup', '#product', '#design'],
    summary: 'A roundup of the fastest ways to ship a high-converting landing page without hiring a designer.',
    reminderEnabled: false,
    projectId: '1',
    consumeTime: '6m',
    savedAt: '2026-05-20T09:00:00Z',
  },
  {
    id: '15',
    descriptor: 'choosing',
    title: 'a tech stack for your first SaaS',
    thumbnail: 'https://picsum.photos/seed/lnk15/400/400',
    url: 'https://example.com/saas-tech-stack',
    source: 'website',
    tags: ['#dev', '#startup', '#product'],
    summary: 'A pragmatic breakdown of tech stack choices for solo founders — what to optimise for speed, what to avoid, and when to revisit.',
    reminderEnabled: false,
    projectId: '4',
    consumeTime: '10m',
    savedAt: '2026-05-19T10:00:00Z',
  },
  {
    id: '10',
    descriptor: 'asking for',
    title: 'a raise without burning bridges',
    thumbnail: 'https://picsum.photos/seed/lnk10/400/400',
    url: 'https://example.com/asking-raise',
    source: 'website',
    tags: ['#career', '#negotiation'],
    summary: 'A calm, evidence-based approach to requesting a raise — including timing, framing, and what to do if the answer is no.',
    reminderEnabled: false,
    projectId: '2',
    consumeTime: '7m',
    savedAt: '2026-05-19T14:00:00Z',
  },
  {
    id: '11',
    descriptor: 'building',
    title: 'a second income stream while employed',
    thumbnail: 'https://picsum.photos/seed/lnk11/400/400',
    url: 'https://youtube.com/watch?v=ghi789',
    source: 'youtube',
    tags: ['#career', '#finance', '#startup'],
    summary: 'Real strategies for building side income without burning out — focused on low-overhead, high-leverage options.',
    reminderEnabled: true,
    projectId: null,
    consumeTime: '19m',
    savedAt: '2026-05-18T10:00:00Z',
  },
  {
    id: '12',
    descriptor: 'index funds',
    title: 'explained in plain English',
    thumbnail: 'https://picsum.photos/seed/lnk12/400/400',
    url: 'https://example.com/index-funds',
    source: 'website',
    tags: ['#finance', '#investing'],
    summary: 'A no-jargon explainer on what index funds are, why they outperform most active funds, and how to start investing in them.',
    reminderEnabled: false,
    projectId: '3',
    consumeTime: '8m',
    savedAt: '2026-05-17T11:00:00Z',
  },
  {
    id: '13',
    descriptor: 'the 4%',
    title: 'rule and when it actually works',
    thumbnail: 'https://picsum.photos/seed/lnk13/400/400',
    url: 'https://example.com/four-percent-rule',
    source: 'website',
    tags: ['#finance', '#investing'],
    summary: 'A deep dive into the origins of the 4% withdrawal rule, the assumptions behind it, and how to adapt it for early retirement.',
    reminderEnabled: true,
    projectId: null,
    consumeTime: '11m',
    savedAt: '2026-05-16T09:00:00Z',
  },
  {
    id: '14',
    descriptor: 'crypto',
    title: 'portfolio sizing without gambling',
    thumbnail: 'https://picsum.photos/seed/lnk14/400/400',
    url: 'https://example.com/crypto-allocation',
    source: 'website',
    tags: ['#finance', '#investing', '#crypto'],
    summary: 'How to think about crypto as a small, risk-isolated allocation within a broader portfolio — not a replacement for one.',
    reminderEnabled: false,
    projectId: null,
    consumeTime: '9m',
    savedAt: '2026-05-15T15:00:00Z',
  },
]

export const mockProjects: Project[] = [
  { id: '1', name: 'App Launch Ideas', linkCount: 4 },
  { id: '2', name: 'Career Growth', linkCount: 3 },
  { id: '3', name: 'Finance & Investing', linkCount: 2 },
  { id: '4', name: 'Home Renovation For Faridabad Haryana India', linkCount: 1 },
]

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
