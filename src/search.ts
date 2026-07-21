import { loadCatalog, loadPackMeta, loadSession } from './content'
import { prettyId } from './dom'
import { href, type Route } from './router'
import { kindLabel } from './sessions'

export interface SearchDoc {
  type: 'pack' | 'concept' | 'session'
  title: string
  subtitle: string
  haystack: string
  route: Route
  href: string
}

let indexPromise: Promise<SearchDoc[]> | null = null

/** Build (once) a flat search index across every pack, concept, and session. */
export function buildIndex(): Promise<SearchDoc[]> {
  if (!indexPromise) indexPromise = build()
  return indexPromise
}

async function build(): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = []
  const catalog = await loadCatalog()
  const packs = await Promise.all(
    catalog.packs.map(async (ref) => ({ ref, meta: await loadPackMeta(ref.path) })),
  )

  for (const { ref, meta } of packs) {
    const packRoute: Route = { name: 'pack', packId: meta.id }
    docs.push({
      type: 'pack',
      title: meta.title,
      subtitle: meta.subject,
      haystack: `${meta.title} ${meta.subject} ${meta.summary} ${meta.tags.join(' ')}`.toLowerCase(),
      route: packRoute,
      href: href(packRoute),
    })

    for (const cid of meta.concepts) {
      const r: Route = { name: 'concept', packId: meta.id, conceptId: cid }
      const title = prettyId(cid)
      docs.push({
        type: 'concept',
        title,
        subtitle: meta.title,
        haystack: `${title} ${cid} ${meta.title}`.toLowerCase(),
        route: r,
        href: href(r),
      })
    }

    const sessions = await Promise.all(
      meta.sessions.map((f) => loadSession(ref.path, f).catch(() => null)),
    )
    for (const s of sessions) {
      if (!s) continue
      const r: Route = { name: 'session', packId: meta.id, sessionId: s.id }
      docs.push({
        type: 'session',
        title: s.title,
        subtitle: kindLabel(s.kind),
        haystack: `${s.title} ${kindLabel(s.kind)} ${s.conceptIds.join(' ')} ${meta.title}`.toLowerCase(),
        route: r,
        href: href(r),
      })
    }
  }
  return docs
}

function subseq(hay: string, needle: string): boolean {
  let i = 0
  for (const ch of hay) {
    if (ch === needle[i]) i += 1
    if (i === needle.length) return true
  }
  return false
}

function rank(d: SearchDoc, term: string): number {
  const t = d.title.toLowerCase()
  if (t.startsWith(term)) return 100
  if (t.includes(term)) return 60
  if (d.haystack.includes(term)) return 30
  return subseq(d.haystack, term) ? 10 : 0
}

export function query(index: SearchDoc[], q: string): SearchDoc[] {
  const term = q.trim().toLowerCase()
  if (!term) return index.slice(0, 20)
  return index
    .map((d) => ({ d, score: rank(d, term) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((x) => x.d)
}
