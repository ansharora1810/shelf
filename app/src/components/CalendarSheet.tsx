import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import {
  MonthCell,
  WEEKDAY_LABELS,
  monthCells,
  monthLabel,
  parseKey,
  todayKey,
} from '../data/dates'
import { Colors, FontFamily, Spacing } from '../constants/tokens'

type Props = {
  activeDate: string | null
  markedDays: Set<string>
  onSelect: (key: string) => void
}

export const CalendarSheet = forwardRef<BottomSheetModal, Props>(
  ({ activeDate, markedDays, onSelect }, ref) => {
    const sheetRef = useRef<BottomSheetModal>(null)
    useImperativeHandle(ref, () => sheetRef.current as BottomSheetModal)
    const openedRef = useRef(false)

    const now = new Date()
    const [view, setView] = useState({ year: now.getFullYear(), month: now.getMonth() })

    const cells = monthCells(view.year, view.month)
    const weeks: (MonthCell | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
    const today = todayKey()

    const goPrev = () =>
      setView(v => (v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }))
    const goNext = () =>
      setView(v => (v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }))

    const select = (key: string) => {
      onSelect(key)
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
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBg}
        onChange={index => {
          if (index >= 0 && !openedRef.current) {
            openedRef.current = true
            if (activeDate) {
              setView(parseKey(activeDate))
            } else if (markedDays.size > 0) {
              setView(parseKey(Array.from(markedDays).sort().pop() as string))
            } else {
              setView({ year: now.getFullYear(), month: now.getMonth() })
            }
          }
        }}
        onDismiss={() => {
          openedRef.current = false
        }}
      >
        <BottomSheetView style={styles.content}>
          <View style={styles.monthRow}>
            <Pressable onPress={goPrev} hitSlop={10}>
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel(view.year, view.month)}</Text>
            <Pressable onPress={goNext} hitSlop={10}>
              <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Text key={i} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((cell, ci) => {
                if (!cell) return <View key={ci} style={styles.cell} />
                const selected = cell.key === activeDate
                const isToday = cell.key === today
                const marked = markedDays.has(cell.key)
                return (
                  <Pressable key={ci} style={styles.cell} onPress={() => select(cell.key)}>
                    <View style={[styles.dayCircle, selected && styles.daySelected]}>
                      <Text
                        style={[
                          styles.dayText,
                          selected && styles.daySelectedText,
                          isToday && !selected && styles.dayToday,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                    {marked && !selected ? <View style={styles.dot} /> : null}
                  </Pressable>
                )
              })}
            </View>
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    )
  },
)

CalendarSheet.displayName = 'CalendarSheet'

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
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  monthLabel: {
    fontFamily: FontFamily.serif,
    fontSize: 20,
    color: Colors.primary,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.sansMedium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
    color: Colors.primary,
  },
  daySelectedText: {
    color: Colors.surface,
  },
  dayToday: {
    color: Colors.accent,
    fontFamily: FontFamily.sansMedium,
  },
  dot: {
    position: 'absolute',
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
})
