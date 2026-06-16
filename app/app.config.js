// Build-time half of the share-transport switch (PRD §8.10). The base config
// lives in app.json; this only diverges for the `handover` transport.
//
// Default (`app-group`): returns app.json untouched — App Groups stay in, which
// is what the simulator and a shipped (paid-account) build both need.
//
// `handover` (free-account on-device builds): App Groups can't be provisioned,
// so strip the entitlement + Info.plist keys and insert the withoutAppGroups
// plugin BEFORE expo-share-extension (so it runs last and removes the App Group
// that plugin re-adds to both targets). The same EXPO_PUBLIC_SHARE_TRANSPORT
// var drives the runtime flow in src/share/transport.ts.
const HANDOVER = process.env.EXPO_PUBLIC_SHARE_TRANSPORT === 'handover'

const APP_GROUPS = 'com.apple.security.application-groups'

const pluginName = entry => (Array.isArray(entry) ? entry[0] : entry)

function insertBefore(plugins, target, plugin) {
  const next = [...plugins]
  const i = next.findIndex(p => pluginName(p) === target)
  next.splice(i === -1 ? next.length : i, 0, plugin)
  return next
}

module.exports = ({ config }) => {
  if (!HANDOVER) return config

  const entitlements = { ...config.ios?.entitlements }
  delete entitlements[APP_GROUPS]
  const infoPlist = { ...config.ios?.infoPlist }
  delete infoPlist.AppGroup
  delete infoPlist.AppGroupIdentifier

  return {
    ...config,
    ios: { ...config.ios, entitlements, infoPlist },
    plugins: insertBefore(config.plugins ?? [], 'expo-share-extension', './plugins/withoutAppGroups'),
  }
}
