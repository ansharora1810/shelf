const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function localKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dayKey(iso: string): string {
  return localKey(new Date(iso))
}

export function todayKey(): string {
  return localKey(new Date())
}

export function parseKey(key: string): { year: number; month: number } {
  const [year, month] = key.split('-').map(Number)
  return { year, month: month - 1 }
}

export function formatDayHeading(key: string): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${day} ${MONTHS[month - 1]}`
}

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`
}

export interface MonthCell {
  key: string
  day: number
}

// 7-column grid for the month: leading nulls pad to the first weekday,
// trailing nulls fill the final week.
export function monthCells(year: number, month: number): (MonthCell | null)[] {
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (MonthCell | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ key: localKey(new Date(year, month, day)), day })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
