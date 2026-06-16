const { withEntitlementsPlist, withInfoPlist, IOSConfig } = require('expo/config-plugins')
const plist = require('@expo/plist').default
const fs = require('fs')
const path = require('path')

const APP_GROUPS = 'com.apple.security.application-groups'
const INFO_KEYS = ['AppGroup', 'AppGroupIdentifier']

function extensionFiles(cfg) {
  const name = `${IOSConfig.XcodeUtils.sanitizedName(cfg.name)}ShareExtension`
  const dir = path.join(cfg.modRequest.platformProjectRoot, name)
  return { entitlements: path.join(dir, `${name}.entitlements`), infoPlist: path.join(dir, 'Info.plist') }
}

function editPlistFile(file, mutate) {
  if (!fs.existsSync(file)) return
  const parsed = plist.parse(fs.readFileSync(file, 'utf8'))
  mutate(parsed)
  fs.writeFileSync(file, plist.build(parsed))
}

// Free Apple "Personal Team" accounts can't provision App Groups, so a build
// carrying the entitlement fails code-signing — and react-native-mmkv throws if
// `AppGroupIdentifier` is in Info.plist but the container is inaccessible, which
// would crash both the app and the extension at launch. expo-share-extension
// adds the App Group to both targets' entitlements AND Info.plists
// unconditionally; this plugin removes all four for the `handover` transport,
// keeping everything else (notably the extension's HostAppScheme). See PRD §8.10.
//
// It must run after expo-share-extension. Mods of a given type run
// last-registered-first, so app.config.js inserts this plugin BEFORE
// expo-share-extension, which makes it run last in each phase.
module.exports = function withoutAppGroups(config) {
  config = withEntitlementsPlist(config, cfg => {
    delete cfg.modResults[APP_GROUPS]
    editPlistFile(extensionFiles(cfg).entitlements, p => delete p[APP_GROUPS])
    return cfg
  })

  config = withInfoPlist(config, cfg => {
    INFO_KEYS.forEach(k => delete cfg.modResults[k])
    editPlistFile(extensionFiles(cfg).infoPlist, p => INFO_KEYS.forEach(k => delete p[k]))
    return cfg
  })

  return config
}
