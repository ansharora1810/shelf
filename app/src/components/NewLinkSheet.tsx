import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Keyboard, Pressable, ScrollView, StyleSheet, Text } from 'react-native'
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { useShelf } from '../store/shelf'
import { isValidLink, normalizeUrl } from '../data/processLink'
import { Colors, FontFamily, Radius, Spacing } from '../constants/tokens'

export const NewLinkSheet = forwardRef<BottomSheetModal, { presetProjectId: string | null }>(
  ({ presetProjectId }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null)
    useImperativeHandle(ref, () => sheetRef.current as BottomSheetModal)

    const { projects, createItem } = useShelf()

    const [url, setUrl] = useState('')
    const [projectId, setProjectId] = useState<string | null>(presetProjectId)
    const [submitting, setSubmitting] = useState(false)
    const [failed, setFailed] = useState(false)

    const snapPoints = useMemo(() => ['50%'], [])

    // Selected project first so it's visible without scrolling the row.
    const orderedProjects = useMemo(() => {
      if (!presetProjectId) return projects
      const preset = projects.find(p => p.id === presetProjectId)
      if (!preset) return projects
      return [preset, ...projects.filter(p => p.id !== presetProjectId)]
    }, [projects, presetProjectId])

    const initForm = () => {
      setUrl('')
      setProjectId(presetProjectId)
      setSubmitting(false)
      setFailed(false)
    }

    // Keep the default project in sync with the active project while untouched.
    useEffect(() => setProjectId(presetProjectId), [presetProjectId])

    const canAdd = isValidLink(url) && !submitting

    // Hand the link to the backend and dismiss immediately — enrichment (name,
    // thumbnail, tags) happens in the worker and streams into the feed card,
    // which shows a loading state until it lands. No need to wait here.
    const add = () => {
      if (!canAdd) return
      setSubmitting(true)
      setFailed(false)
      Keyboard.dismiss()
      createItem(normalizeUrl(url), projectId)
        .then(() => sheetRef.current?.dismiss())
        .catch(() => {
          setFailed(true)
          setSubmitting(false)
        })
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
        onDismiss={initForm}
      >
        <BottomSheetScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>New link</Text>

          <Text style={styles.label}>Link</Text>
          <BottomSheetTextInput
            style={styles.input}
            placeholder="https://…"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            autoFocus
            editable={!submitting}
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={add}
            returnKeyType="go"
          />
          {failed ? (
            <Text style={styles.errorNote}>Couldn’t add that link — try again.</Text>
          ) : (
            <Text style={styles.hint}>Paste a link — we’ll do the rest.</Text>
          )}

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

          <Pressable style={[styles.button, !canAdd && styles.buttonDisabled]} onPress={add} disabled={!canAdd}>
            <Text style={styles.buttonText}>{submitting ? 'Adding…' : 'Add'}</Text>
          </Pressable>
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
