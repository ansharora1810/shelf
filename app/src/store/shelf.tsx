import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react'
import { Link, Project } from '../types'
import { mockLinks, mockProjects } from '../data/mock'

// In-memory store seeded from mock data. Mutators mirror the planned CRUD API
// surface (PRD §9): `upsert` maps to POST (create when no id, update when id
// present) and `delete` maps to DELETE. Swapping these bodies for network
// calls later requires no changes in the screens.

export type LinkDraft = Omit<Link, 'id'> & { id?: string }
export type ProjectDraft = { id?: string; name: string }

type RawProject = { id: string; name: string }

interface ShelfContextValue {
  links: Link[]
  projects: Project[]
  getLinkById: (id: string) => Link | undefined
  getLinksForProject: (projectId: string) => Link[]
  upsertLink: (draft: LinkDraft) => Link
  deleteLink: (id: string) => void
  upsertProject: (draft: ProjectDraft) => Project
  deleteProject: (id: string) => void
}

const ShelfContext = createContext<ShelfContextValue | null>(null)

let idSequence = 0
function newId(prefix: string): string {
  idSequence += 1
  return `${prefix}-${Date.now()}-${idSequence}`
}

export function ShelfProvider({ children }: { children: ReactNode }) {
  const [links, setLinks] = useState<Link[]>(mockLinks)
  const [rawProjects, setRawProjects] = useState<RawProject[]>(
    mockProjects.map(({ id, name }) => ({ id, name })),
  )

  const projects = useMemo<Project[]>(
    () =>
      rawProjects.map(p => ({
        ...p,
        linkCount: links.reduce((count, link) => (link.projectId === p.id ? count + 1 : count), 0),
      })),
    [rawProjects, links],
  )

  const getLinkById = useCallback((id: string) => links.find(l => l.id === id), [links])

  const getLinksForProject = useCallback(
    (projectId: string) => links.filter(l => l.projectId === projectId),
    [links],
  )

  const upsertLink = useCallback((draft: LinkDraft): Link => {
    const link: Link = draft.id ? (draft as Link) : { ...draft, id: newId('link') }
    setLinks(prev => {
      const index = prev.findIndex(l => l.id === link.id)
      if (index === -1) return [link, ...prev]
      const next = [...prev]
      next[index] = link
      return next
    })
    return link
  }, [])

  const deleteLink = useCallback((id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id))
  }, [])

  const upsertProject = useCallback((draft: ProjectDraft): Project => {
    const id = draft.id ?? newId('project')
    setRawProjects(prev => {
      const index = prev.findIndex(p => p.id === id)
      if (index === -1) return [...prev, { id, name: draft.name }]
      const next = [...prev]
      next[index] = { id, name: draft.name }
      return next
    })
    return { id, name: draft.name, linkCount: 0 }
  }, [])

  const deleteProject = useCallback((id: string) => {
    setRawProjects(prev => prev.filter(p => p.id !== id))
    setLinks(prev => prev.map(l => (l.projectId === id ? { ...l, projectId: null } : l)))
  }, [])

  const value = useMemo(
    () => ({
      links,
      projects,
      getLinkById,
      getLinksForProject,
      upsertLink,
      deleteLink,
      upsertProject,
      deleteProject,
    }),
    [links, projects, getLinkById, getLinksForProject, upsertLink, deleteLink, upsertProject, deleteProject],
  )

  return <ShelfContext.Provider value={value}>{children}</ShelfContext.Provider>
}

export function useShelf(): ShelfContextValue {
  const ctx = useContext(ShelfContext)
  if (!ctx) throw new Error('useShelf must be used within ShelfProvider')
  return ctx
}
