export type FetchSource = 'youtube' | 'instagram' | 'reddit' | 'website'

export interface ExtractedContent {
  title: string | null
  rawContent: string | null
  thumbnailUrl: string | null
  consumeTime: number | null
  author: string | null
}

// A recipe maps the saved URL to the page the WebView should load and the JS
// that runs in that page to post an ExtractedContent (or null) back to RN. The
// `beforeContentLoaded` flag injects the extractor before the page's own
// scripts run — needed for Instagram, whose login wall fires on load.
export interface Recipe {
  navigateUrl: string
  extractorJs: string
  beforeContentLoaded: boolean
  userAgent?: string
}
