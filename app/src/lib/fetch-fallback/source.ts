import { FetchSource } from './types'

// The stored `source` is the link's normalized host (e.g. "youtube.com"); fall
// back to the URL host when it's missing. Matched by suffix so subdomains hit.
function matchesHost(host: string, base: string): boolean {
  return host === base || host.endsWith(`.${base}`)
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function detectSource(url: string, source: string | null): FetchSource {
  const host = (source || hostOf(url)).toLowerCase()
  if (matchesHost(host, 'youtube.com') || matchesHost(host, 'youtu.be')) return 'youtube'
  if (matchesHost(host, 'instagram.com')) return 'instagram'
  if (matchesHost(host, 'reddit.com')) return 'reddit'
  return 'website'
}
