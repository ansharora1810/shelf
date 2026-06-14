import { Ionicons } from '@expo/vector-icons'

type IconName = keyof typeof Ionicons.glyphMap

// Brand logos for a known subset of hosts; everything else falls back to a
// globe. Matched by suffix so the bare host and any subdomain both hit. This
// set can grow independently of which sources have dedicated parsers.
const LOGOS: { host: string; icon: IconName }[] = [
  { host: 'youtube.com', icon: 'logo-youtube' },
  { host: 'instagram.com', icon: 'logo-instagram' },
  { host: 'tiktok.com', icon: 'logo-tiktok' },
  { host: 'twitter.com', icon: 'logo-twitter' },
  { host: 'x.com', icon: 'logo-twitter' },
  { host: 'reddit.com', icon: 'logo-reddit' },
  { host: 'facebook.com', icon: 'logo-facebook' },
  { host: 'pinterest.com', icon: 'logo-pinterest' },
  { host: 'linkedin.com', icon: 'logo-linkedin' },
  { host: 'github.com', icon: 'logo-github' },
  { host: 'vimeo.com', icon: 'logo-vimeo' },
  { host: 'twitch.tv', icon: 'logo-twitch' },
  { host: 'medium.com', icon: 'logo-medium' },
]

export function sourceIcon(source: string): IconName {
  const host = source.toLowerCase()
  for (const { host: base, icon } of LOGOS) {
    if (host === base || host.endsWith(`.${base}`)) return icon
  }
  return 'globe-outline'
}
