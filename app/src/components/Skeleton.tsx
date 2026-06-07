import { useEffect } from 'react'
import { DimensionValue, StyleProp, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

export function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width: DimensionValue
  height: number
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const pulse = useSharedValue(0.5)

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }), -1, true)
  }, [pulse])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: '#E2DCD2' }, animatedStyle, style]}
    />
  )
}
