import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useShelf } from '../src/store/shelf'
import { allTags, searchRemote } from '../src/data/search'
import { Link } from '../src/types'
import { titleAccent } from '../src/data/title'
import { Colors, FontFamily, Radius, Spacing } from '../src/constants/tokens'

const SOURCE_ICONS: Record<Link['source'], 'logo-youtube' | 'logo-instagram' | 'globe-outline'> = {
  youtube: 'logo-youtube',
  instagram: 'logo-instagram',
  website: 'globe-outline',
}

export default function SearchScreen() {
  const router = useRouter()
  const { links } = useShelf()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [results, setResults] = useState<Link[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const reqId = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  // Remote hybrid search (§11.1). The request id discards out-of-order responses
  // so a slow earlier query can't overwrite a newer one's results.
  useEffect(() => {
    const q = debounced.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      setError(false)
      return
    }
    const id = ++reqId.current
    setLoading(true)
    setError(false)
    searchRemote(q)
      .then(items => {
        if (id !== reqId.current) return
        setResults(items)
        setLoading(false)
      })
      .catch(() => {
        if (id !== reqId.current) return
        setError(true)
        setLoading(false)
      })
  }, [debounced])

  const tags = useMemo(() => allTags(links), [links])
  const trimmed = query.trim()
  const hasQuery = trimmed.length > 0
  // Keep the spinner up through the debounce gap so stale results don't flash.
  const searching = hasQuery && (loading || trimmed !== debounced.trim())

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.searchBar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </Pressable>
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.input}
            placeholder="Search your shelf"
            placeholderTextColor={Colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {hasQuery && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!hasQuery ? (
          <>
            <Text style={styles.browseLabel}>Browse by tag</Text>
            <View style={styles.tagWrap}>
              {tags.map(tag => (
                <Pressable key={tag} style={styles.tagPill} onPress={() => setQuery(tag)}>
                  <Text style={styles.tagPillText}>{tag}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : searching ? (
          <View style={styles.empty}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={32} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>Couldn’t search. Check your connection and try again.</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={32} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No matches for “{trimmed}”</Text>
          </View>
        ) : (
          results.map(link => (
            <ResultRow key={link.id} link={link} onPress={() => router.push(`/link/${link.id}`)} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function ResultRow({ link, onPress }: { link: Link; onPress: () => void }) {
  const { accent, rest } = titleAccent(link.name)
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Image source={{ uri: link.thumbnail }} style={styles.thumb} contentFit="cover" transition={150} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {accent ? <Text style={styles.rowDescriptor}>{accent} </Text> : null}
          <Text style={styles.rowTitleMain}>{rest}</Text>
        </Text>
        <View style={styles.rowMeta}>
          <Ionicons name={SOURCE_ICONS[link.source]} size={13} color={Colors.textSecondary} />
          {link.tags.length > 0 && (
            <Text style={styles.rowTags} numberOfLines={1}>
              {link.tags.slice(0, 3).join('  ')}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.screenH,
    paddingTop: 10,
    paddingBottom: 14,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: 15,
    color: Colors.primary,
    padding: 0,
  },
  content: {
    paddingHorizontal: Spacing.screenH,
    paddingBottom: 120,
  },
  browseLabel: {
    fontFamily: FontFamily.serif,
    fontSize: 22,
    color: Colors.primary,
    marginTop: 8,
    marginBottom: 14,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tagPill: {
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tagPillText: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    color: Colors.primary,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
    color: Colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 12,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: Radius.card,
  },
  rowBody: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  rowTitle: {
    lineHeight: 20,
  },
  rowDescriptor: {
    fontFamily: FontFamily.serif,
    fontSize: 15,
    color: Colors.accent,
  },
  rowTitleMain: {
    fontFamily: FontFamily.serif,
    fontSize: 15,
    color: Colors.primary,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTags: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: 12,
    color: Colors.textSecondary,
  },
})
