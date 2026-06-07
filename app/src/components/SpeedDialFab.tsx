import { ReactNode, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { GlassContainer, GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily } from '../constants/tokens'

const GLASS = isGlassEffectAPIAvailable()
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type IconName = keyof typeof Ionicons.glyphMap
type Action = { key: string; label: string; icon: IconName; onPress: () => void }

export function SpeedDialFab({
  onNewProject,
  onNewLink,
}: {
  onNewProject: () => void
  onNewLink: () => void
}) {
  const [open, setOpen] = useState(false)
  const progress = useSharedValue(0)

  const setOpenState = (next: boolean) => {
    setOpen(next)
    progress.value = withTiming(next ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) })
  }

  const choose = (action: () => void) => {
    setOpenState(false)
    action()
  }

  const actions: Action[] = [
    { key: 'project', label: 'New project', icon: 'folder-outline', onPress: () => choose(onNewProject) },
    { key: 'link', label: 'New link', icon: 'link-outline', onPress: () => choose(onNewLink) },
  ]

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.18 }))
  const plusStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` }],
  }))

  return (
    <>
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents={open ? 'auto' : 'none'}
        onPress={() => setOpenState(false)}
      />
      <View style={styles.container} pointerEvents="box-none">
        <GlassGroup>
          {actions.map(action => (
            <MiniAction key={action.key} action={action} progress={progress} open={open} />
          ))}
          <Pressable onPress={() => setOpenState(!open)}>
            <GlassSurface style={styles.fab}>
              <Animated.View style={plusStyle}>
                <Ionicons name="add" size={28} color={Colors.primary} />
              </Animated.View>
            </GlassSurface>
          </Pressable>
        </GlassGroup>
      </View>
    </>
  )
}

function GlassGroup({ children }: { children: ReactNode }) {
  if (GLASS) {
    return (
      <GlassContainer style={styles.group} pointerEvents="box-none">
        {children}
      </GlassContainer>
    )
  }
  return (
    <View style={styles.group} pointerEvents="box-none">
      {children}
    </View>
  )
}

function GlassSurface({ style, children }: { style: object; children: ReactNode }) {
  if (GLASS) {
    return (
      <GlassView style={style} glassEffectStyle="regular" isInteractive>
        {children}
      </GlassView>
    )
  }
  return <View style={[style, styles.fallback]}>{children}</View>
}

function MiniAction({
  action,
  progress,
  open,
}: {
  action: Action
  progress: SharedValue<number>
  open: boolean
}) {
  // Drive entrance with scale (not opacity) — opacity on a view containing a
  // glass effect disables the native glass.
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [12, 0]) }, { scale: progress.value }],
  }))

  return (
    <Animated.View style={style} pointerEvents={open ? 'auto' : 'none'}>
      <Pressable onPress={action.onPress}>
        <GlassSurface style={styles.pill}>
          <View style={styles.pillInner}>
            <Ionicons name={action.icon} size={18} color={Colors.primary} />
            <Text style={styles.pillLabel}>{action.label}</Text>
          </View>
        </GlassSurface>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000',
  },
  container: {
    position: 'absolute',
    bottom: 36,
    right: 20,
    alignItems: 'flex-end',
  },
  group: {
    alignItems: 'flex-end',
    gap: 14,
  },
  fallback: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pill: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pillLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
    color: Colors.primary,
  },
})
