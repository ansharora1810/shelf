// Generated from the live Supabase schema (project hpnxuouiyrhlqabkgmis).
// Regenerate after schema changes: mcp__supabase__generate_typescript_types,
// or `supabase gen types typescript`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      items: {
        Row: {
          app_fetch_attempts: number
          consume_time: number | null
          created_at: string
          id: string
          name: string | null
          normalized_url: string | null
          project_id: string | null
          raw_content: string | null
          reminder_enabled: boolean
          source: string | null
          status: string
          status_changed_at: string | null
          summary: string | null
          tags: string[]
          thumbnail_url: string | null
          type: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          app_fetch_attempts?: number
          consume_time?: number | null
          created_at?: string
          id?: string
          name?: string | null
          normalized_url?: string | null
          project_id?: string | null
          raw_content?: string | null
          reminder_enabled?: boolean
          source?: string | null
          status?: string
          status_changed_at?: string | null
          summary?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Update: {
          app_fetch_attempts?: number
          consume_time?: number | null
          created_at?: string
          id?: string
          name?: string | null
          normalized_url?: string | null
          project_id?: string | null
          raw_content?: string | null
          reminder_enabled?: boolean
          source?: string | null
          status?: string
          status_changed_at?: string | null
          summary?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
      }
    }
  }
}

export type ItemRow = Database['public']['Tables']['items']['Row']
export type ProjectRow = Database['public']['Tables']['projects']['Row']
export type ItemStatus =
  | 'awaiting_upload'
  | 'started'
  | 'fetched'
  | 'fetch_failed'
  | 'ready'
  | 'failed'
// `source` is the link's real host (e.g. "youtube.com", "tiktok.com",
// "nytimes.com"); the app maps a known subset to logos with a fallback.
export type ItemSource = string
