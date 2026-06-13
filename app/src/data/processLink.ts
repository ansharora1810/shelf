import { Source } from '../types'

export interface ProcessedLink {
  name: string
  tags: string[]
  summary: string
  thumbnail: string
  source: Source
  consumeTime: string
}

// Accept bare domains (e.g. "amazon.in") by defaulting the scheme to https.
export function normalizeUrl(value: string): string {
  const trimmed = value.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function isValidLink(value: string): boolean {
  try {
    const url = new URL(normalizeUrl(value))
    return (url.protocol === 'http:' || url.protocol === 'https:') && /\.[a-z]{2,}$/i.test(url.hostname)
  } catch {
    return false
  }
}

function inferSource(url: string): Source {
  if (/(youtube\.com|youtu\.be)/i.test(url)) return 'youtube'
  if (/instagram\.com/i.test(url)) return 'instagram'
  return 'website'
}

const SOURCE_TAGS: Record<Source, string[]> = {
  youtube: ['#video', '#watch-later'],
  instagram: ['#instagram', '#inspo'],
  website: ['#article', '#read-later'],
}

function deriveName(url: string): string {
  try {
    const parsed = new URL(url)
    const slug = parsed.pathname.split('/').filter(Boolean).pop() ?? ''
    const words = slug
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()
    if (words) return words.replace(/\b\w/g, c => c.toUpperCase())
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'Saved link'
  }
}

// Used when the backend is unavailable or errors: a valid ProcessedLink with
// empty AI fields so the user can fill name/tags in manually and still save.
export function fallbackProcessed(url: string): ProcessedLink {
  const seed = Math.random().toString(36).slice(2, 8)
  return {
    name: '',
    tags: [],
    summary: '',
    thumbnail: `https://picsum.photos/seed/${seed}/400/400`,
    source: inferSource(url),
    consumeTime: '',
  }
}

// Mocked stand-in for the backend's AI parse. The ProcessedLink shape is the
// contract; swap the body for a real fetch once the API exists.
export async function processLink(url: string): Promise<ProcessedLink> {
  const source = inferSource(url)
  await new Promise(resolve => setTimeout(resolve, 1600))
  const seed = Math.random().toString(36).slice(2, 8)
  return {
    name: deriveName(url),
    tags: SOURCE_TAGS[source],
    summary: '',
    thumbnail: `https://picsum.photos/seed/${seed}/400/400`,
    source,
    consumeTime: '',
  }
}
