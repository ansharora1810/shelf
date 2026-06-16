import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { close, openHostApp } from 'expo-share-extension'
import { supabase } from '../lib/supabase'
import { Colors } from '../constants/tokens'
import { buildHandoverPath, isHandover } from './transport'

type InitialProps = { url?: string; text?: string }
type Phase = 'loading' | 'ready' | 'saving' | 'done' | 'error' | 'no-auth'
type Project = { id: string; name: string }

const URL_RE = /https?:\/\/[^\s]+/i

function resolveUrl({ url, text }: InitialProps): string | null {
  if (url) return url
  return text?.match(URL_RE)?.[0] ?? null
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

// Get a live session, refreshing proactively when the token is at/near expiry —
// the extension may run long after the app last opened.
async function ensureSession() {
  const { data } = await supabase.auth.getSession()
  let session = data.session
  if (!session) return null
  const expiresInMs = (session.expires_at ?? 0) * 1000 - Date.now()
  if (expiresInMs < 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession()
    session = refreshed.session ?? session
  }
  return session
}

// Single switch (PRD §8.10): the App Group flow saves in place; the handover
// flow opens the app to save on builds where App Groups aren't provisioned.
export function ShareExtension(props: InitialProps) {
  return isHandover ? <HandoverShare {...props} /> : <AppGroupShare {...props} />
}

function AppGroupShare(props: InitialProps) {
  const url = resolveUrl(props)
  const [phase, setPhase] = useState<Phase>('loading')
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!url) {
      setPhase('error')
      return
    }
    ;(async () => {
      const session = await ensureSession()
      if (!session) {
        setPhase('no-auth')
        return
      }
      const { data } = await supabase
        .from('projects')
        .select('id, name')
        .order('created_at', { ascending: true })
      setProjects((data as Project[] | null) ?? [])
      setPhase('ready')
    })().catch(() => setPhase('error'))
  }, [url])

  const save = async () => {
    if (!url) return
    setPhase('saving')
    try {
      const { error } = await supabase.functions.invoke('create-item', {
        body: { url, project_id: projectId },
      })
      if (error) throw error
      setPhase('done')
      setTimeout(close, 900)
    } catch {
      setPhase('error')
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Save to Shelf</Text>
        <Pressable hitSlop={12} onPress={close}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {url ? (
        <View style={styles.preview}>
          <View style={styles.previewIcon}>
            <Ionicons name="link" size={16} color={Colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.previewHost}>{hostOf(url)}</Text>
            <Text style={styles.previewUrl} numberOfLines={1}>
              {url}
            </Text>
          </View>
        </View>
      ) : null}

      {phase === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      )}

      {phase === 'no-auth' && (
        <View style={styles.center}>
          <Text style={styles.message}>Open Shelf and sign in once, then try again.</Text>
          <Pressable style={styles.button} onPress={close}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.center}>
          <Text style={styles.message}>
            {url ? 'Couldn’t save — try again.' : 'No link found to save.'}
          </Text>
          <Pressable style={styles.button} onPress={url ? save : close}>
            <Text style={styles.buttonText}>{url ? 'Retry' : 'Close'}</Text>
          </Pressable>
        </View>
      )}

      {(phase === 'ready' || phase === 'saving') && (
        <>
          <Text style={styles.label}>Project</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Chip label="None" active={projectId === null} onPress={() => setProjectId(null)} />
            {projects.map(p => (
              <Chip
                key={p.id}
                label={p.name}
                active={projectId === p.id}
                onPress={() => setProjectId(p.id)}
              />
            ))}
          </ScrollView>

          <Pressable
            style={[styles.button, phase === 'saving' && styles.buttonDisabled]}
            onPress={save}
            disabled={phase === 'saving'}
          >
            {phase === 'saving' ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={styles.buttonText}>Save</Text>
            )}
          </Pressable>
        </>
      )}

      {phase === 'done' && <SavedCheck />}
    </View>
  )
}

// Handover flow: no shared session to authenticate with, so hand the URL to
// the app via the `shelf://` scheme and let it save (PRD §8.10). openHostApp
// dismisses the extension once the app opens.
function HandoverShare(props: InitialProps) {
  const url = resolveUrl(props)

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Save to Shelf</Text>
        <Pressable hitSlop={12} onPress={close}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </Pressable>
      </View>

      {url ? (
        <>
          <View style={styles.preview}>
            <View style={styles.previewIcon}>
              <Ionicons name="link" size={16} color={Colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.previewHost}>{hostOf(url)}</Text>
              <Text style={styles.previewUrl} numberOfLines={1}>
                {url}
              </Text>
            </View>
          </View>
          <Pressable style={styles.button} onPress={() => openHostApp(buildHandoverPath(url))}>
            <Text style={styles.buttonText}>Open Shelf to save</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={styles.message}>No link found to save.</Text>
          <Pressable style={styles.button} onPress={close}>
            <Text style={styles.buttonText}>Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

// A spring-in check with a soft fade — the "saved" moment before auto-close.
function SavedCheck() {
  const scale = useSharedValue(0)
  const fade = useSharedValue(0)

  useEffect(() => {
    scale.value = withSpring(1, { damping: 11, stiffness: 140 })
    fade.value = withDelay(120, withTiming(1, { duration: 260, easing: Easing.out(Easing.ease) }))
  }, [scale, fade])

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const textStyle = useAnimatedStyle(() => ({ opacity: fade.value }))

  return (
    <View style={styles.center}>
      <Animated.View style={[styles.checkCircle, circleStyle]}>
        <Ionicons name="checkmark" size={30} color={Colors.surface} />
      </Animated.View>
      <Animated.Text style={[styles.message, textStyle]}>Saved to Shelf</Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 14,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.primary,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewHost: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  previewUrl: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: Colors.accent,
    marginTop: 2,
  },
  chips: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    maxWidth: 200,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#D9D3C8',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    color: Colors.primary,
  },
  chipTextActive: {
    color: Colors.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 28,
  },
  message: {
    fontSize: 15,
    color: Colors.primary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    alignSelf: 'stretch',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.surface,
  },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
