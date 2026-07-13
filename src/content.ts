import type { Catalog, FolioPackMeta, Session } from './types'

const base = import.meta.env.BASE_URL

export function contentUrl(...parts: string[]): string {
  const path = parts.join('/').replace(/\/+/g, '/')
  return `${base}${path.replace(/^\//, '')}`
}

export async function loadCatalog(): Promise<Catalog> {
  const res = await fetch(contentUrl('content/catalog.json'))
  if (!res.ok) throw new Error('Failed to load catalog')
  return res.json()
}

export async function loadPackMeta(packPath: string): Promise<FolioPackMeta> {
  const res = await fetch(contentUrl('content', packPath, 'folio.json'))
  if (!res.ok) throw new Error(`Failed to load pack ${packPath}`)
  return res.json()
}

export async function loadConcept(
  packPath: string,
  conceptId: string,
): Promise<string> {
  const res = await fetch(contentUrl('content', packPath, 'concepts', `${conceptId}.md`))
  if (!res.ok) throw new Error(`Failed to load concept ${conceptId}`)
  return res.text()
}

export async function loadSession(
  packPath: string,
  sessionFile: string,
): Promise<Session> {
  const file = sessionFile.endsWith('.json') ? sessionFile : `${sessionFile}.json`
  const res = await fetch(contentUrl('content', packPath, 'sessions', file))
  if (!res.ok) throw new Error(`Failed to load session ${sessionFile}`)
  return res.json()
}
