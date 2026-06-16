// expo-router deep-link hook (PRD §8.10). The share extension hands a link over
// as `shelf://…url=<link>`; openHostApp delivers the value on the path (no `?`),
// which matches no route and 404s as "Unmatched Route". Send those to home —
// the shelf store's Linking listener reads the raw link and saves it.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  return path.includes('url=') ? '/' : path
}
