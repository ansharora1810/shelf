import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Alert, Keyboard, Pressable, StyleSheet, Text } from 'react-native'
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { useShelf } from '../store/shelf'
import { Project } from '../types'
import { Colors, FontFamily, Radius, Spacing } from '../constants/tokens'

const MAX_NAME = 20

function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export const EditProjectSheet = forwardRef<
  BottomSheetModal,
  { project: Project | null; onDeleted: () => void }
>(({ project, onDeleted }, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null)
  useImperativeHandle(ref, () => sheetRef.current as BottomSheetModal)

  const { upsertProject, deleteProject } = useShelf()
  const openedRef = useRef(false)
  const [name, setName] = useState('')

  const trimmed = name.trim()

  const save = () => {
    if (!trimmed || !project) return
    upsertProject({ id: project.id, name: toTitleCase(trimmed) })
    Keyboard.dismiss()
    sheetRef.current?.dismiss()
  }

  const confirmDelete = () => {
    if (!project) return
    Alert.alert('Delete project?', 'Links stay on your shelf and become unassigned.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteProject(project.id)
          sheetRef.current?.dismiss()
          onDeleted()
        },
      },
    ])
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
      enableDynamicSizing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBg}
      onChange={index => {
        if (index >= 0 && !openedRef.current) {
          openedRef.current = true
          setName(project?.name ?? '')
        }
      }}
      onDismiss={() => {
        openedRef.current = false
      }}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>Edit project</Text>
        <BottomSheetTextInput
          style={styles.input}
          placeholder="Project name"
          placeholderTextColor={Colors.textSecondary}
          value={name}
          onChangeText={setName}
          maxLength={MAX_NAME}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <Text style={styles.counter}>
          {name.length}/{MAX_NAME}
        </Text>
        <Pressable
          style={[styles.button, !trimmed && styles.buttonDisabled]}
          onPress={save}
          disabled={!trimmed}
        >
          <Text style={styles.buttonText}>Save</Text>
        </Pressable>
        <Pressable style={styles.deleteButton} onPress={confirmDelete}>
          <Text style={styles.deleteText}>Delete project</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  )
})

EditProjectSheet.displayName = 'EditProjectSheet'

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
    paddingBottom: 40,
    gap: 10,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 24,
    color: Colors.primary,
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
  counter: {
    alignSelf: 'flex-end',
    fontFamily: FontFamily.sans,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 16,
    color: Colors.surface,
  },
  deleteButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteText: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    color: Colors.danger,
  },
})
