// The one switch. A build-time env var (inlined by Metro into both the app and
// the share-extension bundles) decides how a shared link reaches the backend:
//
//   app-group (default) — the extension reads the shared session and calls
//     `create-item` itself, in place. Ships, and is the simulator dev loop.
//   handover            — free-account on-device builds where App Groups can't
//     be provisioned: the extension opens the app, and the app does the save.
//
// `app.config.js` reads the same var to strip the App Group entitlement for
// handover builds. See PRD §8.10. Kept dependency-free so importing it into the
// constrained extension bundle pulls nothing extra in.
export type ShareTransport = 'app-group' | 'handover'

export const SHARE_TRANSPORT: ShareTransport =
  process.env.EXPO_PUBLIC_SHARE_TRANSPORT === 'handover' ? 'handover' : 'app-group'

export const isHandover = SHARE_TRANSPORT === 'handover'

// The extension hands a URL to the app as a query on the root path, so
// expo-router stays on home (no dedicated route to 404 on).
export function buildHandoverPath(url: string): string {
  return `?url=${encodeURIComponent(url)}`
}
