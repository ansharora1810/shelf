import { useEffect, useState } from 'react'
import { LayoutChangeEvent, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../constants/tokens'

const BAND_WIDTH = 64
const SWEEP_DURATION = 1200

// Provisional text (e.g. the host) shown while a value is loading: rendered in
// a muted color with a highlight band sweeping left→right across it. The muting
// signals "not final"; the sweep signals "incoming". When the real value
// arrives the caller swaps this out for a normal <Text>.
export function ShimmerText({
  text,
  style,
  numberOfLines,
}: {
  text: string
  style?: StyleProp<TextStyle>
  numberOfLines?: number
}) {
  const [width, setWidth] = useState(0)
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: SWEEP_DURATION, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    )
  }, [progress])

  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-BAND_WIDTH, width]) }],
  }))

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {/* style (typography) first, muted color last so it always wins — the
          muting is what signals "provisional", regardless of caller color. */}
      <Text style={[style, styles.text]} numberOfLines={numberOfLines}>
        {text}
      </Text>
      {width > 0 && (
        <Animated.View style={[styles.band, bandStyle]} pointerEvents="none">
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.85)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  text: {
    color: Colors.textSecondary,
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: BAND_WIDTH,
  },
})
