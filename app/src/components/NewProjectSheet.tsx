import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, Text } from 'react-native'
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { useShelf } from '../store/shelf'
import { Colors, FontFamily, Radius, Spacing } from '../constants/tokens'

const MAX_NAME = 20

function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

export const NewProjectSheet = forwardRef<BottomSheetModal>((_props, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null)
  useImperativeHandle(ref, () => sheetRef.current as BottomSheetModal)

  const { upsertProject } = useShelf()
  const [name, setName] = useState('')

  const trimmed = name.trim()

  const create = () => {
    if (!trimmed) return
    upsertProject({ name: toTitleCase(trimmed) })
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
      enableDynamicSizing
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBg}
      onDismiss={() => setName('')}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>New project</Text>
        <BottomSheetTextInput
          style={styles.input}
          placeholder="Project name"
          placeholderTextColor={Colors.textSecondary}
          value={name}
          onChangeText={setName}
          maxLength={MAX_NAME}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={create}
        />
        <Text style={styles.counter}>
          {name.length}/{MAX_NAME}
        </Text>
        <Pressable
          style={[styles.button, !trimmed && styles.buttonDisabled]}
          onPress={create}
          disabled={!trimmed}
        >
          <Text style={styles.buttonText}>Create</Text>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  )
})

NewProjectSheet.displayName = 'NewProjectSheet'

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
})
