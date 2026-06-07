import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Keyboard, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { useShelf } from '../store/shelf'
import { ProcessedLink, fallbackProcessed, isValidLink, normalizeUrl, processLink } from '../data/processLink'
import { Skeleton } from './Skeleton'
import { Colors, FontFamily, Radius, Spacing } from '../constants/tokens'

type Phase = 'input' | 'processing' | 'ready'

export const NewLinkSheet = forwardRef<BottomSheetModal, { presetProjectId: string | null }>(
  ({ presetProjectId }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null)
    useImperativeHandle(ref, () => sheetRef.current as BottomSheetModal)

    const { projects, upsertLink } = useShelf()
    const openedRef = useRef(false)
    const requestId = useRef(0)

    const [phase, setPhase] = useState<Phase>('input')
    const [url, setUrl] = useState('')
    const [name, setName] = useState('')
    const [tagDraft, setTagDraft] = useState('')
    const [tags, setTags] = useState<string[]>([])
    const [projectId, setProjectId] = useState<string | null>(null)
    const [reminder, setReminder] = useState(false)
    const [processed, setProcessed] = useState<ProcessedLink | null>(null)
    const [failed, setFailed] = useState(false)

    const snapPoints = useMemo(() => ['40%', '92%'], [])
    const expanded = phase !== 'input'

    // Selected project first so it's visible without scrolling the row.
    const orderedProjects = useMemo(() => {
      if (!presetProjectId) return projects
      const preset = projects.find(p => p.id === presetProjectId)
      if (!preset) return projects
      return [preset, ...projects.filter(p => p.id !== presetProjectId)]
    }, [projects, presetProjectId])

    const initForm = () => {
      requestId.current += 1
      setPhase('input')
      setUrl('')
      setName('')
      setTagDraft('')
      setTags([])
      setProjectId(presetProjectId)
      setReminder(false)
      setProcessed(null)
      setFailed(false)
    }

    const startProcessing = () => {
      if (phase !== 'input' || !isValidLink(url)) return
      const reqId = (requestId.current += 1)
      const target = normalizeUrl(url)
      setPhase('processing')
      setFailed(false)
      Keyboard.dismiss()
      sheetRef.current?.snapToIndex(1)
      processLink(target)
        .then(result => {
          if (reqId !== requestId.current) return
          setProcessed(result)
          setName(result.name)
          setTags(prev => {
            const merged = [...result.tags]
            for (const tag of prev) if (!merged.includes(tag)) merged.push(tag)
            return merged
          })
          setPhase('ready')
        })
        .catch(() => {
          if (reqId !== requestId.current) return
          // Backend unavailable or errored: drop to empty, editable fields so
          // the user can fill in name/tags and still save.
          setProcessed(fallbackProcessed(target))
          setFailed(true)
          setPhase('ready')
        })
    }

    // Auto-advance once a valid link is entered (debounced so we don't fire mid-typing).
    useEffect(() => {
      if (phase !== 'input' || !isValidLink(url)) return
      const timer = setTimeout(startProcessing, 500)
      return () => clearTimeout(timer)
    }, [url, phase])

    const addTag = () => {
      const cleaned = tagDraft.trim().replace(/^#+/, '')
      if (!cleaned) return
      const tag = `#${cleaned}`
      setTags(prev => (prev.includes(tag) ? prev : [...prev, tag]))
      setTagDraft('')
    }

    const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag))

    const canSave = phase === 'ready' && name.trim().length > 0 && processed !== null

    const save = () => {
      if (!canSave || !processed) return
      upsertLink({
        descriptor: '',
        title: name.trim(),
        thumbnail: processed.thumbnail,
        url: normalizeUrl(url),
        source: processed.source,
        tags,
        summary: processed.summary,
        reminderEnabled: reminder,
        projectId,
        duration: processed.duration,
        savedAt: new Date().toISOString(),
      })
      Keyboard.dismiss()
      sheetRef.current?.dismiss()
    }

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
      ),
      [],
    )

    return (
      <BottomSheetModal
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBg}
        onChange={index => {
          if (index >= 0 && !openedRef.current) {
            openedRef.current = true
            initForm()
          }
        }}
        onDismiss={() => {
          openedRef.current = false
        }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>New link</Text>

          <Text style={styles.label}>Link</Text>
          <BottomSheetTextInput
            style={[styles.input, !expanded && styles.inputLink]}
            placeholder="https://…"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
            editable={phase === 'input'}
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={startProcessing}
            returnKeyType="go"
          />
          {!expanded && (
            <Text style={styles.hint}>Paste a link — we’ll fetch the name and tags for you.</Text>
          )}

          {expanded && (
            <>
              {failed && (
                <Text style={styles.errorNote}>
                  Couldn’t fetch details automatically — add them in below.
                </Text>
              )}
              <Text style={styles.label}>Name</Text>
              {phase === 'processing' ? (
                <Skeleton width="100%" height={50} radius={Radius.card} />
              ) : (
                <BottomSheetTextInput
                  style={styles.input}
                  placeholder="Name"
                  placeholderTextColor={Colors.textSecondary}
                  value={name}
                  onChangeText={setName}
                />
              )}

              <Text style={styles.label}>Tags</Text>
              {(tags.length > 0 || phase === 'processing') && (
                <View style={styles.tagsRow}>
                  {tags.map(tag => (
                    <Pressable key={tag} style={styles.tagChip} onPress={() => removeTag(tag)}>
                      <Text style={styles.tagChipText}>{tag}</Text>
                      <Ionicons name="close" size={13} color={Colors.primary} />
                    </Pressable>
                  ))}
                  {phase === 'processing' && (
                    <>
                      <Skeleton width={84} height={32} radius={Radius.pill} />
                      <Skeleton width={64} height={32} radius={Radius.pill} />
                      <Skeleton width={92} height={32} radius={Radius.pill} />
                    </>
                  )}
                </View>
              )}
              <View style={styles.tagInputRow}>
                <BottomSheetTextInput
                  style={[styles.input, styles.flex]}
                  placeholder="Add a tag"
                  placeholderTextColor={Colors.textSecondary}
                  autoCapitalize="none"
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                />
                <Pressable style={styles.addTagButton} onPress={addTag}>
                  <Ionicons name="add" size={22} color={Colors.surface} />
                </Pressable>
              </View>

              <Text style={styles.label}>Project</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.projectRow}
              >
                <ProjectChip label="None" active={projectId === null} onPress={() => setProjectId(null)} />
                {orderedProjects.map(p => (
                  <ProjectChip
                    key={p.id}
                    label={p.name}
                    active={projectId === p.id}
                    onPress={() => setProjectId(p.id)}
                  />
                ))}
              </ScrollView>

              <View style={styles.reminderRow}>
                <View style={styles.flex}>
                  <Text style={styles.reminderLabel}>Nudge me</Text>
                  <Text style={styles.reminderSub}>Send a gentle poke to come back to this</Text>
                </View>
                <Switch
                  value={reminder}
                  onValueChange={setReminder}
                  trackColor={{ false: '#D9D3C8', true: Colors.primary }}
                  thumbColor={Colors.surface}
                />
              </View>

              <Pressable
                style={[styles.button, !canSave && styles.buttonDisabled]}
                onPress={save}
                disabled={!canSave}
              >
                <Text style={styles.buttonText}>Save</Text>
              </Pressable>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  },
)

NewLinkSheet.displayName = 'NewLinkSheet'

function ProjectChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable style={[styles.projectChip, active && styles.projectChipActive]} onPress={onPress}>
      <Text style={[styles.projectChipText, active && styles.projectChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: Colors.surface,
  },
  handle: {
    backgroundColor: '#DEDEDE',
    width: 40,
    height: 4,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenH,
    paddingTop: 8,
    paddingBottom: 48,
    gap: 8,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    color: Colors.primary,
    marginBottom: 8,
  },
  label: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.accent,
    marginTop: 10,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: FontFamily.sans,
    fontSize: 16,
    color: Colors.primary,
  },
  inputLink: {
    marginBottom: 2,
  },
  hint: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  errorNote: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.accent,
    marginTop: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagChipText: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.primary,
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTagButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.card,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: Spacing.screenH,
  },
  projectChip: {
    maxWidth: 200,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: '#D9D3C8',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  projectChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  projectChipText: {
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: Colors.primary,
  },
  projectChipTextActive: {
    color: Colors.surface,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
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
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 16,
    color: Colors.surface,
  },
})
