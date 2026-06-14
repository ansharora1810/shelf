// Client-side input validation only. Source classification, dedup
// normalization, and enrichment are backend-authoritative (see CONTRACT.md).

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
