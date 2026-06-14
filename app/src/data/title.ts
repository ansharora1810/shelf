// First two words render in the accent colour, the remainder in primary —
// a pure client-side rule replacing the old descriptor/title split.
export function titleAccent(name: string): { accent: string; rest: string } {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return { accent: '', rest: '' }
  const accent = words.slice(0, 2).join(' ')
  const rest = words.slice(2).join(' ')
  return { accent, rest }
}

export function formatConsumeTime(seconds: number): string {
  if (seconds < 60) return '<1m'
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
