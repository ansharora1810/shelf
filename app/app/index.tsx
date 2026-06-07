import { useState, useRef, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  StyleSheet,
} from 'react-native'
import Animated, {
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import { mockLinks, getTopTags, groupLinksByWeek } from '../src/data/mock'
import { useShelf } from '../src/store/shelf'
import { Link, Project } from '../src/types'
import { Colors, FontFamily, Spacing, Radius } from '../src/constants/tokens'
import { SpeedDialFab } from '../src/components/SpeedDialFab'
import { NewProjectSheet } from '../src/components/NewProjectSheet'
import { NewLinkSheet } from '../src/components/NewLinkSheet'
import { EditProjectSheet } from '../src/components/EditProjectSheet'
import { SettingsDrawer } from '../src/components/SettingsDrawer'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_WIDTH = (SCREEN_WIDTH - Spacing.screenH * 2) / 2.4
// Projects grid: 20px padding each side, 16px gap between columns
const PROJECT_CARD_WIDTH = Math.floor((SCREEN_WIDTH - Spacing.screenH * 2 - 16) / 2)
const PROJECT_THUMB_SIZE = Math.floor(PROJECT_CARD_WIDTH / 2)

const topTags = getTopTags(mockLinks, 5)

type Tab = { key: string; label: string }
const TABS: Tab[] = [
  { key: 'all', label: '#ALL' },
  { key: 'projects', label: 'PROJECTS' },
  ...topTags.map(tag => ({ key: tag, label: tag.toUpperCase() })),
]

type ActiveView = { type: 'tag'; key: string } | { type: 'project'; projectId: string }

// ─── Sub-components ──────────────────────────────────────────────────────────

function Header({
  project,
  onBack,
  onEdit,
  onMenu,
  onSearch,
}: {
  project: Project | null
  onBack: () => void
  onEdit: () => void
  onMenu: () => void
  onSearch: () => void
}) {
  return (
    <View style={styles.header}>
      {project ? (
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </Pressable>
      ) : (
        <Pressable onPress={onMenu} hitSlop={8}>
          <Ionicons name="menu" size={24} color={Colors.primary} />
        </Pressable>
      )}
      <Text style={styles.headerTitle} adjustsFontSizeToFit numberOfLines={1}>
        {project ? project.name : 'Shelf'}
      </Text>
      {project ? (
        <Pressable onPress={onEdit} hitSlop={8}>
          <Ionicons name="create-outline" size={22} color={Colors.primary} />
        </Pressable>
      ) : (
        <Pressable onPress={onSearch} hitSlop={8}>
          <Ionicons name="search" size={22} color={Colors.primary} />
        </Pressable>
      )}
    </View>
  )
}

function TabBar({ activeKey, onSelect }: { activeKey: string; onSelect: (key: string) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBarScroll}
      contentContainerStyle={styles.tabBarContent}
    >
      {TABS.map(tab => {
        const active = tab.key === activeKey
        return (
          <Pressable key={tab.key} onPress={() => onSelect(tab.key)} style={styles.tabItem}>
            <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            {active && <View style={styles.tabUnderline} />}
          </Pressable>
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
        {link.duration ? <DurationBadge duration={link.duration} /> : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={3}>
        {link.descriptor ? <Text style={styles.cardDescriptor}>{link.descriptor} </Text> : null}
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

function TagFeed({ links }: { links: Link[] }) {
  const groups = groupLinksByWeek(links)
  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="bookmark-outline" size={36} color={Colors.textSecondary} />
        <Text style={styles.emptyText}>Nothing saved yet</Text>
        <Text style={styles.emptySubtext}>
          Share any link to Shelf from any app, or tap + to add one manually.
        </Text>
      </View>
    )
  }
  return (
    <>
      {groups.map(group => (
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
      ))}
    </>
  )
}

function ProjectCollage({ project, onPress }: { project: Project; onPress: () => void }) {
  const { getLinksForProject } = useShelf()
  const links = getLinksForProject(project.id)
  const thumbnails = links.slice(0, 4).map(l => l.thumbnail)
  const size = PROJECT_CARD_WIDTH
  const half = PROJECT_THUMB_SIZE
  const count = thumbnails.length

  const renderInner = () => {
    if (count === 0) {
      return <View style={{ width: size, height: size, backgroundColor: '#E0DAD1' }} />
    }
    if (count === 1) {
      return <Image source={{ uri: thumbnails[0] }} style={{ width: size, height: size }} contentFit="cover" />
    }
    if (count === 2) {
      return (
        <>
          <Image source={{ uri: thumbnails[0] }} style={{ width: size, height: half }} contentFit="cover" />
          <Image source={{ uri: thumbnails[1] }} style={{ width: size, height: half }} contentFit="cover" />
        </>
      )
    }
    if (count === 3) {
      return (
        <>
          <Image source={{ uri: thumbnails[0] }} style={{ width: size, height: half }} contentFit="cover" />
          <View style={{ flexDirection: 'row' }}>
            <Image source={{ uri: thumbnails[1] }} style={{ width: half, height: half }} contentFit="cover" />
            <Image source={{ uri: thumbnails[2] }} style={{ width: half, height: half }} contentFit="cover" />
          </View>
        </>
      )
    }
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: size }}>
        {thumbnails.slice(0, 4).map((uri, i) => (
          <Image key={i} source={{ uri }} style={{ width: half, height: half }} contentFit="cover" />
        ))}
      </View>
    )
  }

  return (
    <Pressable style={styles.projectCard} onPress={onPress}>
      <View style={[styles.projectCollage, { width: size, height: size }]}>
        {renderInner()}
      </View>
      <Text style={styles.projectName}>{project.name}</Text>
      <Text style={styles.projectCount}>{project.linkCount} saved</Text>
    </Pressable>
  )
}

function ProjectsGrid({
  projects,
  onProjectPress,
}: {
  projects: Project[]
  onProjectPress: (p: Project) => void
}) {
  const pairs: Project[][] = []
  for (let i = 0; i < projects.length; i += 2) {
    pairs.push(projects.slice(i, i + 2))
  }
  return (
    <View style={styles.projectsGrid}>
      {pairs.map((pair, i) => (
        <View key={i} style={styles.projectRow}>
          {pair.map(p => (
            <ProjectCollage key={p.id} project={p} onPress={() => onProjectPress(p)} />
          ))}
          {pair.length === 1 && <View style={styles.projectCard} />}
        </View>
      ))}
    </View>
  )
}

// ─── Screen ──────────────────────────────────────────────────────────────────

function linksForView(
  view: ActiveView,
  allLinks: Link[],
  linksForProject: (projectId: string) => Link[],
): Link[] {
  if (view.type === 'project') return linksForProject(view.projectId)
  if (view.key === 'all') return allLinks
  if (view.key === 'projects') return []
  return allLinks.filter(l => l.tags.includes(view.key))
}

function viewOrder(view: ActiveView): number {
  if (view.type === 'project') return TABS.findIndex(t => t.key === 'projects') + 0.5
  return TABS.findIndex(t => t.key === view.key)
}

function viewKey(view: ActiveView): string {
  return view.type === 'project' ? `project:${view.projectId}` : `tag:${view.key}`
}

const SLIDE_DURATION = 280

export default function HomeScreen() {
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'tag', key: 'all' })
  const router = useRouter()
  const { links, projects, getLinksForProject } = useShelf()
  const newProjectRef = useRef<BottomSheetModal>(null)
  const newLinkRef = useRef<BottomSheetModal>(null)
  const editProjectRef = useRef<BottomSheetModal>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const exitDir = useSharedValue(1)
  const isFirstRender = useRef(true)

  useEffect(() => {
    isFirstRender.current = false
  }, [])

  const activeTabKey = activeView.type === 'tag' ? activeView.key : 'projects'
  const activeProject =
    activeView.type === 'project' ? projects.find(p => p.id === activeView.projectId) ?? null : null

  function navigate(newView: ActiveView) {
    if (viewKey(newView) === viewKey(activeView)) return
    exitDir.value = viewOrder(newView) >= viewOrder(activeView) ? 1 : -1
    setActiveView(newView)
  }

  const slideIn = (): any => {
    'worklet'
    const d = exitDir.value
    return {
      initialValues: { transform: [{ translateX: d * SCREEN_WIDTH }] },
      animations: {
        transform: [
          { translateX: withTiming(0, { duration: SLIDE_DURATION, easing: Easing.out(Easing.cubic) }) },
        ],
      },
    }
  }

  const slideOut = (): any => {
    'worklet'
    const d = exitDir.value
    return {
      initialValues: { transform: [{ translateX: 0 }] },
      animations: {
        transform: [
          { translateX: withTiming(-d * SCREEN_WIDTH, { duration: SLIDE_DURATION, easing: Easing.out(Easing.cubic) }) },
        ],
      },
    }
  }

  function renderBody(view: ActiveView) {
    if (view.type === 'tag' && view.key === 'projects') {
      return (
        <ProjectsGrid
          projects={projects}
          onProjectPress={p => navigate({ type: 'project', projectId: p.id })}
        />
      )
    }
    return <TagFeed links={linksForView(view, links, getLinksForProject)} />
  }

  return (
    <>
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Header
        project={activeProject}
        onBack={() => navigate({ type: 'tag', key: 'projects' })}
        onEdit={() => editProjectRef.current?.present()}
        onMenu={() => setMenuOpen(true)}
        onSearch={() => router.push('/search')}
      />
      <TabBar activeKey={activeTabKey} onSelect={key => navigate({ type: 'tag', key })} />
      <View style={styles.bodyContainer}>
        <Animated.View
          key={viewKey(activeView)}
          entering={isFirstRender.current ? undefined : slideIn}
          exiting={slideOut}
          style={StyleSheet.absoluteFill}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {renderBody(activeView)}
          </ScrollView>
        </Animated.View>
      </View>
      <SpeedDialFab
        onNewProject={() => newProjectRef.current?.present()}
        onNewLink={() => newLinkRef.current?.present()}
      />
      <NewProjectSheet ref={newProjectRef} />
      <NewLinkSheet ref={newLinkRef} presetProjectId={activeProject?.id ?? null} />
      <EditProjectSheet
        ref={editProjectRef}
        project={activeProject}
        onDeleted={() => navigate({ type: 'tag', key: 'projects' })}
      />
    </SafeAreaView>
    <SettingsDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    fontSize: 30,
    color: Colors.primary,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 8,
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
  bodyContainer: {
    flex: 1,
    overflow: 'hidden',
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
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyText: {
    fontFamily: FontFamily.serif,
    fontSize: 20,
    color: Colors.primary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  projectsGrid: {
    padding: Spacing.screenH,
    gap: 20,
  },
  projectRow: {
    flexDirection: 'row',
    gap: 16,
  },
  projectCard: {
    flex: 1,
  },
  projectCollage: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  projectName: {
    fontFamily: FontFamily.serif,
    fontSize: 15,
    color: Colors.primary,
    marginTop: 9,
  },
  projectCount: {
    fontFamily: FontFamily.sans,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
})
