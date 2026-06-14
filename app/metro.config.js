const { getDefaultConfig } = require('expo/metro-config')
const { withShareExtension } = require('expo-share-extension/metro')

const config = withShareExtension(getDefaultConfig(__dirname))

// expo-share-extension's rewrite only matches `index.bundle`, but on Expo SDK 56
// the default rewrite resolves the entry to `node_modules/expo-router/entry.bundle`
// first, so the extension was handed the main app bundle. Swap the resolved entry
// path for `index.share` (keeping the transform query params) when the request is
// the share extension's.
const rewriteRequestUrl = config.server.rewriteRequestUrl
config.server.rewriteRequestUrl = url => {
  const rewritten = rewriteRequestUrl(url)
  if (!url.includes('shareExtension=true')) return rewritten
  // Replace only the path's bundle entry, preserving any protocol+host. The HMR
  // server also runs URLs through here with a full `http://host/...` URL, and
  // stripping the protocol crashes Metro's bundle-options parser.
  return rewritten.replace(/^(https?:\/\/[^/]+|\/\/[^/]+)?\/[^?]*\.bundle/, '$1/index.share.bundle')
}

module.exports = config
