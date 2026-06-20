import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebViewMessageEvent } from 'react-native-webview'
import { ExtractedContent, FetchSource, Recipe } from './types'
import { recipeFor } from './recipes'
import { logFetch } from './log'
import { WEBVIEW_FETCH_TIMEOUT_MS } from '../../constants/pipeline'

type Job = {
  itemId: string
  recipe: Recipe
  resolve: (value: ExtractedContent | null) => void
}

type ActiveJob = { itemId: string; recipe: Recipe }

// Bridges the async queue and the mounted <WebView>. One job runs at a time;
// the host re-renders the WebView for each job and reports the result here.
class FetcherController {
  private queue: Job[] = []
  private active: Job | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private onJobChange: ((job: ActiveJob | null) => void) | null = null

  bind(onJobChange: (job: ActiveJob | null) => void) {
    this.onJobChange = onJobChange
    return () => {
      if (this.onJobChange === onJobChange) this.onJobChange = null
    }
  }

  enqueue(itemId: string, recipe: Recipe): Promise<ExtractedContent | null> {
    return new Promise(resolve => {
      this.queue.push({ itemId, recipe, resolve })
      this.pump()
    })
  }

  private pump() {
    if (this.active || this.queue.length === 0 || !this.onJobChange) return
    this.active = this.queue.shift() ?? null
    if (!this.active) return
    const { itemId, recipe } = this.active
    this.timer = setTimeout(() => {
      logFetch(itemId, 'wv-timeout', `${WEBVIEW_FETCH_TIMEOUT_MS}ms`)
      this.finish(null)
    }, WEBVIEW_FETCH_TIMEOUT_MS)
    this.onJobChange({ itemId, recipe })
  }

  reportResult(value: ExtractedContent | null) {
    this.finish(value)
  }

  private finish(value: ExtractedContent | null) {
    if (!this.active) return
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const { resolve } = this.active
    this.active = null
    this.onJobChange?.(null)
    resolve(value)
    this.pump()
  }
}

const controller = new FetcherController()

export function fetchViaWebView(
  itemId: string,
  url: string,
  source: FetchSource,
): Promise<ExtractedContent | null> {
  return controller.enqueue(itemId, recipeFor(source, url))
}

// Must be mounted once inside the provider tree for fetchViaWebView to work.
// Renders an offscreen, non-interactive WebView driven by the controller.
export function WebViewFetcherHost() {
  const [active, setActive] = useState<ActiveJob | null>(null)
  const webViewRef = useRef<WebView>(null)

  useEffect(() => controller.bind(setActive), [])

  const onMessage = (event: WebViewMessageEvent) => {
    logFetch(active?.itemId ?? '?', 'wv-msg', (event.nativeEvent.data || '').slice(0, 12000))
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as ExtractedContent | null
      controller.reportResult(parsed)
    } catch {
      controller.reportResult(null)
    }
  }

  if (!active) return null
  const { itemId, recipe } = active

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <WebView
        key={recipe.navigateUrl}
        ref={webViewRef}
        source={{ uri: recipe.navigateUrl }}
        userAgent={recipe.userAgent}
        javaScriptEnabled
        domStorageEnabled
        injectedJavaScript={recipe.beforeContentLoaded ? undefined : recipe.extractorJs}
        injectedJavaScriptBeforeContentLoaded={
          recipe.beforeContentLoaded ? recipe.extractorJs : undefined
        }
        onMessage={onMessage}
        onError={(e) => { logFetch(itemId, 'wv-error', e.nativeEvent); controller.reportResult(null) }}
        onHttpError={(e) => { logFetch(itemId, 'wv-http', `${e.nativeEvent.statusCode} ${e.nativeEvent.url}`); controller.reportResult(null) }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    width: 1,
    height: 1,
    left: -10000,
    top: -10000,
    opacity: 0,
  },
})
