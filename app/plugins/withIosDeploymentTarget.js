const { withXcodeProject } = require('expo/config-plugins')

const DEPLOYMENT_TARGET = '16.4'

// expo-share-extension hardcodes the extension target to iOS 15.1, but Expo SDK
// 56 modules require 16.4. Force every build configuration in the app project
// (main app + share extension) to 16.4 so the extension compiles.
module.exports = function withIosDeploymentTarget(config) {
  return withXcodeProject(config, config => {
    const project = config.modResults
    const configurations = project.pbxXCBuildConfigurationSection()
    for (const key of Object.keys(configurations)) {
      const buildSettings = configurations[key].buildSettings
      if (buildSettings && buildSettings.IPHONEOS_DEPLOYMENT_TARGET !== undefined) {
        buildSettings.IPHONEOS_DEPLOYMENT_TARGET = DEPLOYMENT_TARGET
      }
    }
    return config
  })
}
