import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebViewMessageEvent } from 'react-native-webview'
import { ExtractedContent, FetchSource, Recipe } from './types'
import { recipeFor } from './recipes'
import { WEBVIEW_FETCH_TIMEOUT_MS, DEBUG_PARSING } from '../../constants/pipeline'

type Job = {
  recipe: Recipe
  resolve: (value: ExtractedContent | null) => void
}

// Bridges the async queue and the mounted <WebView>. One job runs at a time;
// the host re-renders the WebView for each job and reports the result here.
class FetcherController {
  private queue: Job[] = []
  private active: Job | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private onJobChange: ((recipe: Recipe | null) => void) | null = null

  bind(onJobChange: (recipe: Recipe | null) => void) {
    this.onJobChange = onJobChange
    return () => {
      if (this.onJobChange === onJobChange) this.onJobChange = null
    }
  }

  enqueue(recipe: Recipe): Promise<ExtractedContent | null> {
    return new Promise(resolve => {
      this.queue.push({ recipe, resolve })
      this.pump()
    })
  }

  private pump() {
    if (this.active || this.queue.length === 0 || !this.onJobChange) return
    this.active = this.queue.shift() ?? null
    if (!this.active) return
    this.timer = setTimeout(() => this.finish(null), WEBVIEW_FETCH_TIMEOUT_MS)
    this.onJobChange(this.active.recipe)
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
  url: string,
  source: FetchSource,
): Promise<ExtractedContent | null> {
  return controller.enqueue(recipeFor(source, url))
}

// Must be mounted once inside the provider tree for fetchViaWebView to work.
// Renders an offscreen, non-interactive WebView driven by the controller.
export function WebViewFetcherHost() {
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const webViewRef = useRef<WebView>(null)

  useEffect(() => controller.bind(setRecipe), [])

  const onMessage = (event: WebViewMessageEvent) => {
    if (DEBUG_PARSING) console.log('[wv-msg]', (event.nativeEvent.data || '').slice(0, 12000))
    try {
      const parsed = JSON.parse(event.nativeEvent.data) as ExtractedContent | null
      controller.reportResult(parsed)
    } catch {
      controller.reportResult(null)
    }
  }

  if (!recipe) return null

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
        onError={(e) => { if (DEBUG_PARSING) console.log('[wv-error]', JSON.stringify(e.nativeEvent)); controller.reportResult(null) }}
        onHttpError={(e) => { if (DEBUG_PARSING) console.log('[wv-http]', e.nativeEvent.statusCode, e.nativeEvent.url); controller.reportResult(null) }}
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
