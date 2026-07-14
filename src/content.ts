import type {
  Catalog,
  ConceptMeta,
  FolioPackMeta,
  Session,
  SheetDoc,
} from './types'

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

/** Normalize v1 packs (flat concepts/sessions) into curriculum shape. */
export function normalizePackMeta(raw: FolioPackMeta): FolioPackMeta {
  if (raw.curriculum?.sessions?.length) {
    return {
      ...raw,
      schemaVersion: 2,
      curriculum: {
        sheet: raw.curriculum.sheet,
        concepts: raw.curriculum.concepts,
        sessions: raw.curriculum.sessions.map((s) =>
          s.replace(/\.json$/, '').replace(/^\d+-/, ''),
        ),
      },
    }
  }
  return {
    ...raw,
    schemaVersion: 2,
    curriculum: {
      concepts: raw.concepts ?? [],
      sessions: (raw.sessions ?? []).map((s) =>
        s.replace(/\.json$/, '').replace(/^\d+-/, ''),
      ),
    },
  }
}

export function packSessions(meta: FolioPackMeta): string[] {
  return normalizePackMeta(meta).curriculum.sessions
}

export function packConcepts(meta: FolioPackMeta): string[] {
  return normalizePackMeta(meta).curriculum.concepts
}

export async function loadPackMeta(packPath: string): Promise<FolioPackMeta> {
  const res = await fetch(contentUrl('content', packPath, 'folio.json'))
  if (!res.ok) throw new Error(`Failed to load pack ${packPath}`)
  const raw = (await res.json()) as FolioPackMeta
  return normalizePackMeta(raw)
}

export function parseConceptMarkdown(id: string, raw: string): ConceptMeta {
  let title = id
  let summary: string | undefined
  let relatedSessions: string[] = []
  let body = raw
  if (raw.startsWith('---')) {
    const end = raw.indexOf('---', 3)
    if (end !== -1) {
      const fm = raw.slice(3, end).trim()
      body = raw.slice(end + 3).replace(/^\n+/, '')
      for (const line of fm.split('\n')) {
        const m = line.match(/^(\w+):\s*(.*)$/)
        if (!m) continue
        const key = m[1]
        const val = m[2].trim()
        if (key === 'title') title = val
        else if (key === 'summary') summary = val
        else if (key === 'relatedSessions') {
          const inner = val.replace(/^\[/, '').replace(/\]$/, '')
          relatedSessions = inner
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        }
      }
    }
  }
  return { id, title, summary, relatedSessions, body }
}

export async function loadConcept(
  packPath: string,
  conceptId: string,
): Promise<ConceptMeta> {
  const res = await fetch(
    contentUrl('content', packPath, 'concepts', `${conceptId}.md`),
  )
  if (!res.ok) throw new Error(`Failed to load concept ${conceptId}`)
  return parseConceptMarkdown(conceptId, await res.text())
}

/** @deprecated prefer loadConcept — returns markdown body only */
export async function loadConceptMarkdown(
  packPath: string,
  conceptId: string,
): Promise<string> {
  const c = await loadConcept(packPath, conceptId)
  return c.body
}

export async function loadSession(
  packPath: string,
  sessionFile: string,
): Promise<Session> {
  const stem = sessionFile
    .replace(/\.json$/, '')
    .replace(/^\d+-/, '')
  const file = `${stem}.json`
  const res = await fetch(contentUrl('content', packPath, 'sessions', file))
  if (!res.ok) throw new Error(`Failed to load session ${sessionFile}`)
  return res.json()
}

export async function loadSheet(packPath: string, sheetFile: string): Promise<SheetDoc> {
  const res = await fetch(contentUrl('content', packPath, sheetFile))
  if (!res.ok) throw new Error(`Failed to load sheet ${sheetFile}`)
  return res.json()
}

/** Legacy route ids with numeric prefixes → stable id */
export function canonicalizeSessionId(sessionId: string): string {
  return sessionId.replace(/^\d+-/, '')
}
