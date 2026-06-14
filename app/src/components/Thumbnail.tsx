import { View, StyleSheet, DimensionValue } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { Source } from '../types'
import { Colors, Radius } from '../constants/tokens'

const SOURCE_ICONS: Record<Source, 'logo-youtube' | 'logo-instagram' | 'globe-outline'> = {
  youtube: 'logo-youtube',
  instagram: 'logo-instagram',
  website: 'globe-outline',
}

// Warm tints that sit harmoniously with the cream background; picked
// deterministically from the name so a thumbnail-less card still feels varied.
const FALLBACK_TINTS = ['#E7DDCB', '#EAD9C6', '#E2D6C1', '#ECDCCA', '#DDD2BE']

function tintFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_TINTS[hash % FALLBACK_TINTS.length]
}

export function Thumbnail({
  uri,
  source,
  name,
  width,
  height,
  radius = Radius.card,
  iconSize = 40,
}: {
  uri: string | null | undefined
  source: Source
  name: string
  width: DimensionValue
  height: DimensionValue
  radius?: number
  iconSize?: number
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width, height, borderRadius: radius }}
        contentFit="cover"
        transition={200}
      />
    )
  }
  return (
    <View
      style={[
        styles.fallback,
        { width, height, borderRadius: radius, backgroundColor: tintFor(name || source) },
      ]}
    >
      <Ionicons name={SOURCE_ICONS[source]} size={iconSize} color={Colors.primary} style={styles.icon} />
    </View>
  )
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  icon: {
    opacity: 0.28,
  },
})
