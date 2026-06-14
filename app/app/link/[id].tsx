import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Dimensions,
  StyleSheet,
  Alert,
} from 'react-native'
import * as Linking from 'expo-linking'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { useShelf } from '../../src/store/shelf'
import { Thumbnail } from '../../src/components/Thumbnail'
import { sourceIcon } from '../../src/data/source'
import { titleAccent, formatConsumeTime } from '../../src/data/title'
import { Colors, FontFamily, Spacing, Radius } from '../../src/constants/tokens'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const THUMBNAIL_HEIGHT = 280
const PARALLAX_FACTOR = 0.2

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

export default function LinkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { getLinkById, deleteLink, updateItem } = useShelf()
  const link = getLinkById(id)

  const scrollY = useSharedValue(0)
  const [reminder, setReminder] = useState(link?.reminderEnabled ?? false)

  const toggleReminder = (value: boolean) => {
    setReminder(value)
    if (link) updateItem(link.id, { reminderEnabled: value }).catch(() => setReminder(!value))
  }

  const scrollHandler = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y
  })

  const thumbnailStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [0, THUMBNAIL_HEIGHT],
          [0, -THUMBNAIL_HEIGHT * PARALLAX_FACTOR],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }))

  if (!link) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.notFound}>Link not found</Text>
      </SafeAreaView>
    )
  }

  const { accent, rest } = titleAccent(link.name)

  const openOriginal = () => Linking.openURL(link.url)

  const confirmDelete = () => {
    Alert.alert('Delete link?', 'This removes it from your shelf and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteLink(link.id)
            .then(() => router.back())
            .catch(() =>
              Alert.alert('Still processing', 'This link is being processed — try again in a moment.'),
            )
        },
      },
    ])
  }

  return (
    <View style={styles.screen}>
      {/* Parallax thumbnail — pinned behind the content, which scrolls up over it */}
      <Animated.View style={[styles.thumbnailWrap, thumbnailStyle as object]}>
        <Thumbnail
          uri={link.thumbnail}
          source={link.source}
          name={link.name}
          width={SCREEN_WIDTH}
          height={THUMBNAIL_HEIGHT}
          radius={0}
          iconSize={88}
        />
      </Animated.View>

      <AnimatedScrollView
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Body */}
        <View style={styles.body}>
          {/* Title */}
          <Text style={styles.title}>
            {accent ? <Text style={styles.titleDescriptor}>{accent} </Text> : null}
            <Text style={styles.titleMain}>{rest}</Text>
          </Text>

          {/* Source + consume time */}
          <View style={styles.metaWrap}>
            <View style={styles.sourceRow}>
              <Ionicons name={sourceIcon(link.source)} size={14} color={Colors.primary} />
              <Text style={styles.sourceDomain}>{link.source}</Text>
            </View>
            {link.consumeTime ? (
              <View style={styles.consumeRow}>
                <Ionicons name="time-outline" size={14} color={Colors.accent} />
                <Text style={styles.consumeText}>{formatConsumeTime(link.consumeTime)}</Text>
              </View>
            ) : null}
          </View>

          {/* Summary */}
          <Text style={styles.summary}>{link.summary}</Text>

          {/* Tags */}
          <View style={styles.tagsWrap}>
            {link.tags.map(tag => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          {/* Reminder */}
          <View style={styles.reminderRow}>
            <View>
              <Text style={styles.reminderLabel}>Nudge me</Text>
              <Text style={styles.reminderSub}>Send me a gentle poke to come back to this</Text>
            </View>
            <Switch
              value={reminder}
              onValueChange={toggleReminder}
              trackColor={{ false: '#D9D3C8', true: Colors.primary }}
              thumbColor={Colors.surface}
            />
          </View>
        </View>
      </AnimatedScrollView>

      {/* Back button — overlays the thumbnail */}
      <Pressable style={[styles.backButton, { top: insets.top + 8 }]} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={Colors.primary} />
      </Pressable>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.openButton} onPress={openOriginal}>
          <Text style={styles.openButtonText}>Open link</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.surface} />
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={confirmDelete}>
          <Text style={styles.deleteButtonText}>Delete</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notFound: {
    fontFamily: FontFamily.sans,
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(242,237,228,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: THUMBNAIL_HEIGHT,
    paddingBottom: 160,
  },
  thumbnailWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: THUMBNAIL_HEIGHT,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  body: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.screenH,
    paddingTop: 24,
    gap: 16,
  },
  title: {
    lineHeight: 36,
  },
  titleDescriptor: {
    fontFamily: FontFamily.serif,
    fontSize: 28,
    color: Colors.accent,
  },
  titleMain: {
    fontFamily: FontFamily.serif,
    fontSize: 28,
    color: Colors.primary,
  },
  metaWrap: {
    gap: 8,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceDomain: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.primary,
  },
  consumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  consumeText: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.accent,
  },
  summary: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
    color: Colors.primary,
    lineHeight: 22,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.primary,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  reminderLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    color: Colors.primary,
  },
  reminderSub: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenH,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: Colors.background,
    gap: 12,
  },
  openButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.card,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  openButtonText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 16,
    color: Colors.surface,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  deleteButtonText: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    color: Colors.danger,
  },
})
