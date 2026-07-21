import type { Catalog, FolioPackMeta, Session } from './types'

const base = import.meta.env.BASE_URL

export function contentUrl(...parts: string[]): string {
  const path = parts.join('/').replace(/\/+/g, '/')
  return `${base}${path.replace(/^\//, '')}`
}

// Promise cache: dedupes concurrent requests and persists results across navigations.
const cache = new Map<string, Promise<unknown>>()

function cachedFetch<T>(url: string, parse: (r: Response) => Promise<T>, err: string): Promise<T> {
  let p = cache.get(url) as Promise<T> | undefined
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(err)
        return parse(r)
      })
      .catch((e) => {
        cache.delete(url) // don't cache failures — allow a retry on next visit
        throw e
      })
    cache.set(url, p)
  }
  return p
}

const asJson = <T>(r: Response) => r.json() as Promise<T>
const asText = (r: Response) => r.text()

export function loadCatalog(): Promise<Catalog> {
  return cachedFetch(contentUrl('content/catalog.json'), asJson<Catalog>, 'Failed to load catalog')
}

export function loadPackMeta(packPath: string): Promise<FolioPackMeta> {
  return cachedFetch(
    contentUrl('content', packPath, 'folio.json'),
    asJson<FolioPackMeta>,
    `Failed to load pack ${packPath}`,
  )
}

export function loadConcept(packPath: string, conceptId: string): Promise<string> {
  return cachedFetch(
    contentUrl('content', packPath, 'concepts', `${conceptId}.md`),
    asText,
    `Failed to load concept ${conceptId}`,
  )
}

export function loadSession(packPath: string, sessionFile: string): Promise<Session> {
  const file = sessionFile.endsWith('.json') ? sessionFile : `${sessionFile}.json`
  return cachedFetch(
    contentUrl('content', packPath, 'sessions', file),
    asJson<Session>,
    `Failed to load session ${sessionFile}`,
  )
}
