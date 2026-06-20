import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { AppState } from 'react-native'
import * as Linking from 'expo-linking'
import { Link, Project, Source } from '../types'
import { supabase } from '../lib/supabase'
import { ItemRow, ItemStatus, ProjectRow } from '../lib/database.types'
import { isHandover } from '../share/transport'
import { useAuth } from './auth'
import { WebViewFetcherHost, useClientFetchQueue } from '../lib/fetch-fallback'

// Pull the shared URL out of a handover deep link (PRD §8.10). openHostApp's
// native URL builder drops the `?` (so the value lands on the path, not as a
// query) and re-encodes it several times, so match `url=` directly and decode
// until it's an http(s) URL — a fully-decoded shared link always is.
function parseSharedUrl(deepLink: string): string | null {
  const match = deepLink.match(/url=(.+)$/i)
  if (!match) return null
  let out = match[1]
  for (let i = 0; i < 5 && !/^https?:\/\//i.test(out); i += 1) {
    try {
      out = decodeURIComponent(out)
    } catch {
      break
    }
  }
  return /^https?:\/\//i.test(out) ? out : null
}

// Columns the client actually needs (the mapItem set). Excludes the heavy
// embedding (768 floats) and raw_content — both server-only — so the bulk load
// stays small (§11.1). Realtime still carries them on changed rows; harmless.
const ITEM_COLUMNS =
  'id, name, thumbnail_url, url, source, status, tags, summary, reminder_enabled, project_id, consume_time, created_at, app_fetch_attempts'

// Exactly the columns ITEM_COLUMNS selects — also what every other caller (full
// rows from realtime / create / update) structurally satisfies.
type MappableItem = Pick<
  ItemRow,
  | 'id' | 'name' | 'thumbnail_url' | 'url' | 'source' | 'status' | 'tags'
  | 'summary' | 'reminder_enabled' | 'project_id' | 'consume_time'
  | 'created_at' | 'app_fetch_attempts'
>

export function mapItem(row: MappableItem): Link {
  return {
    id: row.id,
    name: row.name ?? '',
    thumbnail: row.thumbnail_url ?? '',
    url: row.url ?? '',
    source: (row.source ?? 'website') as Source,
    status: row.status as ItemStatus,
    tags: row.tags,
    summary: row.summary ?? '',
    reminderEnabled: row.reminder_enabled,
    projectId: row.project_id,
    consumeTime: row.consume_time,
    savedAt: row.created_at,
    appFetchAttempts: row.app_fetch_attempts,
  }
}

function mapProject(row: ProjectRow): Project {
  return { id: row.id, name: row.name }
}

export type CreateResult = { item: Link; deduped: boolean }

export type ItemEdit = {
  name?: string
  tags?: string[]
  projectId?: string | null
  reminderEnabled?: boolean
}

export type ProjectDraft = { id?: string; name: string }

interface ShelfContextValue {
  links: Link[]
  projects: Project[]
  getLinkById: (id: string) => Link | undefined
  getLinksForProject: (projectId: string) => Link[]
  createItem: (url: string, projectId: string | null) => Promise<CreateResult>
  updateItem: (id: string, edit: ItemEdit) => Promise<void>
  addItemTags: (id: string, tags: string[]) => Promise<void>
  deleteLink: (id: string) => Promise<void>
  upsertProject: (draft: ProjectDraft) => Promise<Project>
  deleteProject: (id: string, deleteItems: boolean) => Promise<void>
}

const ShelfContext = createContext<ShelfContextValue | null>(null)

function upsertById<T extends { id: string }>(list: T[], row: T): T[] {
  const index = list.findIndex(x => x.id === row.id)
  if (index === -1) return [row, ...list]
  const next = [...list]
  next[index] = row
  return next
}

export function ShelfProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [links, setLinks] = useState<Link[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  const reconcile = useCallback(async () => {
    if (!userId) return
    const [items, projs] = await Promise.all([
      supabase.from('items').select(ITEM_COLUMNS),
      supabase.from('projects').select('*'),
    ])
    if (!items.error && items.data) setLinks(items.data.map(mapItem))
    if (!projs.error && projs.data) setProjects(projs.data.map(mapProject))
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setLinks([])
      setProjects([])
      return
    }
    void reconcile()
  }, [userId, reconcile])

  useEffect(() => {
    if (!userId) return
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void reconcile()
    })
    return () => sub.remove()
  }, [userId, reconcile])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel(`shelf:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'items' },
        payload => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            if (id) setLinks(prev => prev.filter(l => l.id !== id))
            return
          }
          setLinks(prev => upsertById(prev, mapItem(payload.new as ItemRow)))
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        payload => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            if (id) setProjects(prev => prev.filter(p => p.id !== id))
            return
          }
          setProjects(prev => upsertById(prev, mapProject(payload.new as ProjectRow)))
        },
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') void reconcile()
      })
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, reconcile])

  const pushRow = useCallback((row: ItemRow) => {
    setLinks(prev => upsertById(prev, mapItem(row)))
  }, [])

  useClientFetchQueue(links, pushRow)

  const getLinkById = useCallback((id: string) => links.find(l => l.id === id), [links])

  const getLinksForProject = useCallback(
    (projectId: string) => links.filter(l => l.projectId === projectId),
    [links],
  )

  const createItem = useCallback(async (url: string, projectId: string | null): Promise<CreateResult> => {
    const { data, error } = await supabase.functions.invoke('create-item', {
      body: { url, project_id: projectId },
    })
    if (error || !data?.item) throw error ?? new Error('Create failed')
    const item = mapItem(data.item as ItemRow)
    setLinks(prev => upsertById(prev, item))
    return { item, deduped: Boolean(data.deduped) }
  }, [])

  // Handover transport (PRD §8.10): the share extension opens the app with the
  // shared URL on builds where it can't authenticate itself. Save it here, once
  // a session exists — holding it across login if the user isn't signed in yet.
  const pendingShareRef = useRef<string | null>(null)

  const flushPendingShare = useCallback(() => {
    const url = pendingShareRef.current
    if (!url || !userId) return
    pendingShareRef.current = null
    createItem(url, null).catch(() => {
      pendingShareRef.current = url
    })
  }, [userId, createItem])

  // Keep the link subscription mounted once; flush below reacts to sign-in.
  const flushRef = useRef(flushPendingShare)
  flushRef.current = flushPendingShare

  useEffect(() => {
    if (!isHandover) return
    const onLink = (deepLink: string | null) => {
      const url = deepLink ? parseSharedUrl(deepLink) : null
      if (!url) return
      pendingShareRef.current = url
      flushRef.current()
    }
    void Linking.getInitialURL().then(onLink)
    const sub = Linking.addEventListener('url', e => onLink(e.url))
    return () => sub.remove()
  }, [])

  useEffect(() => {
    flushPendingShare()
  }, [flushPendingShare])

  const updateItem = useCallback(async (id: string, edit: ItemEdit): Promise<void> => {
    const patch: Partial<ItemRow> = {}
    if (edit.name !== undefined) patch.name = edit.name
    if (edit.tags !== undefined) patch.tags = edit.tags
    if (edit.projectId !== undefined) patch.project_id = edit.projectId
    if (edit.reminderEnabled !== undefined) patch.reminder_enabled = edit.reminderEnabled
    const { data, error } = await supabase.from('items').update(patch).eq('id', id).select().single()
    if (error) throw error
    if (data) setLinks(prev => upsertById(prev, mapItem(data)))
  }, [])

  // Additive merge (atomic, server-side) so the manual-add Save preserves any
  // AI tags the worker may write concurrently. Never replaces the array.
  const addItemTags = useCallback(async (id: string, tags: string[]): Promise<void> => {
    if (tags.length === 0) return
    const { error } = await supabase.rpc('add_item_tags', { p_id: id, p_tags: tags })
    if (error) throw error
    setLinks(prev =>
      prev.map(l => (l.id === id ? { ...l, tags: Array.from(new Set([...l.tags, ...tags])) } : l)),
    )
  }, [])

  const deleteLink = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (error) throw error
    setLinks(prev => prev.filter(l => l.id !== id))
  }, [])

  const upsertProject = useCallback(async (draft: ProjectDraft): Promise<Project> => {
    if (draft.id) {
      const { data, error } = await supabase
        .from('projects')
        .update({ name: draft.name })
        .eq('id', draft.id)
        .select()
        .single()
      if (error) throw error
      const project = mapProject(data)
      setProjects(prev => upsertById(prev, project))
      return project
    }
    const { data, error } = await supabase.from('projects').insert({ name: draft.name }).select().single()
    if (error) throw error
    const project = mapProject(data)
    setProjects(prev => upsertById(prev, project))
    return project
  }, [])

  const deleteProject = useCallback(async (id: string, deleteItems: boolean): Promise<void> => {
    if (deleteItems) {
      const { error } = await supabase.from('items').delete().eq('project_id', id)
      if (error) throw error
      setLinks(prev => prev.filter(l => l.projectId !== id))
    } else {
      const { error } = await supabase.from('items').update({ project_id: null }).eq('project_id', id)
      if (error) throw error
      setLinks(prev => prev.map(l => (l.projectId === id ? { ...l, projectId: null } : l)))
    }
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) throw error
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      links,
      projects,
      getLinkById,
      getLinksForProject,
      createItem,
      updateItem,
      addItemTags,
      deleteLink,
      upsertProject,
      deleteProject,
    }),
    [links, projects, getLinkById, getLinksForProject, createItem, updateItem, addItemTags, deleteLink, upsertProject, deleteProject],
  )

  return (
    <ShelfContext.Provider value={value}>
      {children}
      <WebViewFetcherHost />
    </ShelfContext.Provider>
  )
}

export function useShelf(): ShelfContextValue {
  const ctx = useContext(ShelfContext)
  if (!ctx) throw new Error('useShelf must be used within ShelfProvider')
  return ctx
}
