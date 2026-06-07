import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getProjectById, getLinksForProject, groupLinksByWeek, getTopTags } from '../../src/data/mock'
import { Link } from '../../src/types'
import { Colors, FontFamily, Spacing, Radius } from '../../src/constants/tokens'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.screenH * 2) / 2.4

const topTags = getTopTags(5)
const TABS = [
  { key: 'all', label: '#ALL' },
  { key: 'projects', label: 'PROJECTS' },
  ...topTags.map(tag => ({ key: tag, label: tag.toUpperCase() })),
]

function headerFontSize(name: string): number {
  if (name.length <= 12) return 28
  if (name.length <= 16) return 22
  return 18
}

function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function Header({ name }: { name: string }) {
  const router = useRouter()
  const displayName = toTitleCase(name)
  const fontSize = headerFontSize(displayName)

  return (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={Colors.primary} />
      </Pressable>
      <Text style={[styles.headerTitle, { fontSize }]} numberOfLines={1}>
        {displayName}
      </Text>
      <View style={styles.headerIcons}>
        <Ionicons name="search" size={22} color={Colors.primary} />
        <Ionicons name="create-outline" size={22} color={Colors.primary} />
      </View>
    </View>
  )
}

function TabBar() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBarScroll}
      contentContainerStyle={styles.tabBarContent}
    >
      {TABS.map(tab => {
        const active = tab.key === 'projects'
        return (
          <View key={tab.key} style={styles.tabItem}>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            {active && <View style={styles.tabUnderline} />}
          </View>
        )
      })}
    </ScrollView>
  )
}

function DurationBadge({ duration }: { duration: string }) {
  return (
    <View style={styles.badge}>
      <Ionicons name="time-outline" size={10} color={Colors.accent} />
      <Text style={styles.badgeText}>{duration}</Text>
    </View>
  )
}

function LinkCard({ link }: { link: Link }) {
  const router = useRouter()
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/link/${link.id}`)}>
      <View style={styles.cardImageWrap}>
        <Image
          source={{ uri: link.thumbnail }}
          style={styles.cardImage}
          contentFit="cover"
          transition={200}
        />
        <DurationBadge duration={link.duration} />
      </View>
      <Text style={styles.cardTitle} numberOfLines={3}>
        <Text style={styles.cardDescriptor}>{link.descriptor} </Text>
        <Text style={styles.cardTitleMain}>{link.title}</Text>
      </Text>
    </Pressable>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionCount}>{count} SAVED ›</Text>
    </View>
  )
}

function EmptyState() {
  return (
    <View style={styles.empty}>
      <Ionicons name="bookmark-outline" size={36} color={Colors.textSecondary} />
      <Text style={styles.emptyText}>No links in this project yet</Text>
    </View>
  )
}

function FAB() {
  return (
    <View style={styles.fab} pointerEvents="box-none">
      <Pressable style={styles.fabButton}>
        <Ionicons name="add" size={26} color={Colors.primary} />
      </Pressable>
    </View>
  )
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const project = getProjectById(id)

  if (!project) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={{ color: Colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
          Project not found
        </Text>
      </SafeAreaView>
    )
  }

  const links = getLinksForProject(id)
  const groups = groupLinksByWeek(links)

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Header name={project.name} />
      <TabBar />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          groups.map(group => (
            <View key={group.label} style={styles.weekSection}>
              <SectionHeader label={group.label} count={group.count} />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardRow}
              >
                {group.links.map(link => (
                  <LinkCard key={link.id} link={link} />
                ))}
                <View style={{ width: 8 }} />
              </ScrollView>
            </View>
          ))
        )}
      </ScrollView>
      <FAB />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenH,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerTitle: {
    fontFamily: FontFamily.serif,
    color: Colors.primary,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tabBarScroll: {
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: Spacing.screenH,
    gap: 22,
    paddingBottom: 14,
  },
  tabItem: {
    flexShrink: 0,
  },
  tabLabel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    letterSpacing: 0.7,
    color: Colors.textSecondary,
  },
  tabLabelActive: {
    color: Colors.accent,
  },
  tabUnderline: {
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
    marginTop: 4,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  weekSection: {
    marginBottom: Spacing.sectionGap,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenH,
    marginBottom: Spacing.sectionHeaderMb,
  },
  sectionLabel: {
    fontFamily: FontFamily.serif,
    fontSize: 22,
    color: Colors.primary,
  },
  sectionCount: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.accent,
  },
  cardRow: {
    paddingLeft: Spacing.screenH,
    gap: Spacing.cardGap,
  },
  card: {
    width: CARD_WIDTH,
  },
  cardImageWrap: {
    position: 'relative',
  },
  cardImage: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: Radius.card,
  },
  badge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: Colors.badgeBg,
    borderRadius: Radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontFamily: FontFamily.sans,
    fontSize: 10,
    color: Colors.accent,
  },
  cardTitle: {
    marginTop: 7,
    lineHeight: 18,
    paddingRight: 4,
  },
  cardDescriptor: {
    fontFamily: FontFamily.serif,
    fontSize: 13,
    color: Colors.accent,
  },
  cardTitleMain: {
    fontFamily: FontFamily.serif,
    fontSize: 13,
    color: Colors.primary,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontFamily: FontFamily.serif,
    fontSize: 18,
    color: Colors.primary,
  },
  fab: {
    position: 'absolute',
    bottom: 36,
    right: 20,
    alignItems: 'flex-end',
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
})
