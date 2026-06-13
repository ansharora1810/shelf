export type Source = 'youtube' | 'instagram' | 'website'

export interface Link {
  id: string
  descriptor: string
  title: string
  thumbnail: string
  url: string
  source: Source
  tags: string[]
  summary: string
  reminderEnabled: boolean
  projectId: string | null
  consumeTime: string
  savedAt: string // ISO date string
}

export interface Project {
  id: string
  name: string
  linkCount: number
}
