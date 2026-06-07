import { useEffect, useState } from 'react'
import { Dimensions, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Colors, FontFamily, Radius, Spacing } from '../constants/tokens'

const SCREEN_WIDTH = Dimensions.get('window').width
const PANEL_WIDTH = Math.min(320, SCREEN_WIDTH * 0.82)
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type IconName = keyof typeof Ionicons.glyphMap

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  const progress = useSharedValue(0)
  const [notifications, setNotifications] = useState(true)

  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, { duration: 260, easing: Easing.out(Easing.cubic) })
  }, [open, progress])

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.4 }))
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-PANEL_WIDTH, 0]) }],
  }))

  return (
    <>
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents={open ? 'auto' : 'none'}
        onPress={onClose}
      />
      <Animated.View
        style={[styles.panel, { width: PANEL_WIDTH, paddingTop: insets.top + 16 }, panelStyle]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.account}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={26} color={Colors.surface} />
            </View>
            <Text style={styles.accountName}>Ansh Arora</Text>
            <Text style={styles.accountEmail}>ansh@example.com</Text>
          </View>

          <Section title="Subscription">
            <Row icon="sparkles-outline" label="Free trial" detail="4 days left" />
            <Row icon="card-outline" label="Manage subscription" chevron />
          </Section>

          <Section title="Notifications">
            <View style={styles.row}>
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              <Text style={styles.rowLabel}>Reminders</Text>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#D9D3C8', true: Colors.primary }}
                thumbColor={Colors.surface}
              />
            </View>
          </Section>

          <Section title="About">
            <Row icon="lock-closed-outline" label="Privacy policy" chevron />
            <Row icon="document-text-outline" label="Terms of service" chevron />
            <Row icon="information-circle-outline" label="Version" detail="1.0.0" />
          </Section>
        </ScrollView>
      </Animated.View>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Row({
  icon,
  label,
  detail,
  chevron,
}: {
  icon: IconName
  label: string
  detail?: string
  chevron?: boolean
}) {
  return (
    <Pressable style={styles.row}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} /> : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: '#000',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 4, height: 0 },
    elevation: 16,
  },
  scroll: {
    paddingHorizontal: Spacing.screenH,
    paddingBottom: 40,
  },
  account: {
    paddingVertical: 20,
    gap: 6,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  accountName: {
    fontFamily: FontFamily.serif,
    fontSize: 22,
    color: Colors.primary,
  },
  accountEmail: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowLabel: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: 15,
    color: Colors.primary,
  },
  rowDetail: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.textSecondary,
  },
})
