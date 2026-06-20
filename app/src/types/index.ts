import { ItemSource, ItemStatus } from '../lib/database.types'

export type Source = ItemSource

export interface Link {
  id: string
  name: string
  thumbnail: string
  url: string
  source: Source
  status: ItemStatus
  tags: string[]
  summary: string
  reminderEnabled: boolean
  projectId: string | null
  consumeTime: number | null
  savedAt: string // ISO date string
  appFetchAttempts: number
}

export interface Project {
  id: string
  name: string
}
