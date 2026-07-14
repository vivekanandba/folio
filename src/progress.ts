import type {
  ConceptProgress,
  ProgressStore,
  ProgressStoreV2,
  SessionProgress,
} from './types'

const KEY_V1 = 'folio-progress-v1'
const KEY_V2 = 'folio-progress-v2'

function emptyV2(): ProgressStoreV2 {
  return { version: 2, sessions: {}, concepts: {} }
}

function migrateV1(raw: string): ProgressStoreV2 {
  const v1 = JSON.parse(raw) as ProgressStore
  const out = emptyV2()
  out.lastPackId = v1.lastPackId
  for (const [key, result] of Object.entries(v1.sessions ?? {})) {
    out.sessions[key] = {
      attempts: [
        {
          at: result.completedAt,
          score: result.score,
          maxScore: result.maxScore,
        },
      ],
      bestScore: result.score,
      bestMax: result.maxScore,
      completedAt: result.completedAt,
    }
  }
  return out
}

export function loadProgress(): ProgressStoreV2 {
  try {
    const v2 = localStorage.getItem(KEY_V2)
    if (v2) return JSON.parse(v2) as ProgressStoreV2
    const v1 = localStorage.getItem(KEY_V1)
    if (v1) {
      const migrated = migrateV1(v1)
      localStorage.setItem(KEY_V2, JSON.stringify(migrated))
      return migrated
    }
    return emptyV2()
  } catch {
    return emptyV2()
  }
}

function save(store: ProgressStoreV2): void {
  localStorage.setItem(KEY_V2, JSON.stringify(store))
}

export function sessionKey(packId: string, sessionId: string): string {
  return `${packId}::${sessionId}`
}

export function recordAttempt(opts: {
  packId: string
  sessionId: string
  score: number
  maxScore: number
  reflectionOnly?: boolean
  conceptIds?: string[]
  conceptDeltas?: Record<string, number>
}): void {
  const store = loadProgress()
  const key = sessionKey(opts.packId, opts.sessionId)
  const prev = store.sessions[key]
  const at = new Date().toISOString()
  const attempt = { at, score: opts.score, maxScore: opts.maxScore }
  const next: SessionProgress = {
    attempts: [...(prev?.attempts ?? []), attempt],
    bestScore: Math.max(prev?.bestScore ?? 0, opts.score),
    bestMax: Math.max(prev?.bestMax ?? 0, opts.maxScore),
    completedAt: at,
    reflectionOnly: opts.reflectionOnly || prev?.reflectionOnly,
  }
  if (opts.reflectionOnly) next.reflectionOnly = true
  store.sessions[key] = next
  store.lastPackId = opts.packId

  if (!opts.reflectionOnly && opts.conceptIds) {
    for (const cid of opts.conceptIds) {
      const ratio = opts.maxScore > 0 ? opts.score / opts.maxScore : 0
      const delta = opts.conceptDeltas?.[cid] ?? ratio
      const cur = store.concepts[cid] ?? { strength: 0 }
      const strength = Math.min(1, Math.max(0, cur.strength * 0.5 + delta * 0.5))
      store.concepts[cid] = {
        strength,
        lastPracticedAt: at,
      }
    }
  }
  save(store)
}

/** Back-compat wrapper used by older call sites */
export function saveSessionResult(result: {
  packId: string
  sessionId: string
  kind: string
  score: number
  maxScore: number
  completedAt: string
  reflectionOnly?: boolean
  conceptIds?: string[]
}): void {
  recordAttempt({
    packId: result.packId,
    sessionId: result.sessionId,
    score: result.score,
    maxScore: result.maxScore,
    reflectionOnly: result.reflectionOnly,
    conceptIds: result.conceptIds,
  })
}

export function getSessionProgress(
  packId: string,
  sessionId: string,
): SessionProgress | undefined {
  return loadProgress().sessions[sessionKey(packId, sessionId)]
}

/** Legacy helper returning a v1-like stamp for UI */
export function getSessionResult(
  packId: string,
  sessionId: string,
): { score: number; maxScore: number; completedAt?: string } | undefined {
  const p = getSessionProgress(packId, sessionId)
  if (!p?.completedAt) return undefined
  return {
    score: p.bestScore,
    maxScore: p.bestMax,
    completedAt: p.completedAt,
  }
}

export function packCompletion(
  packId: string,
  sessionIds: string[],
): { done: number; total: number } {
  const store = loadProgress()
  const done = sessionIds.filter(
    (id) => store.sessions[sessionKey(packId, id)]?.completedAt,
  ).length
  return { done, total: sessionIds.length }
}

export function nextIncompleteSession(
  packId: string,
  sessionIds: string[],
): string | undefined {
  const store = loadProgress()
  return sessionIds.find((id) => !store.sessions[sessionKey(packId, id)]?.completedAt)
}

export function weakConcepts(
  concepts: { id: string }[],
  store = loadProgress(),
  limit = 3,
): { id: string; strength: number }[] {
  return concepts
    .map((c) => ({
      id: c.id,
      strength: store.concepts[c.id]?.strength ?? 0,
    }))
    .filter((c) => c.strength < 0.7)
    .sort((a, b) => a.strength - b.strength)
    .slice(0, limit)
}

export function getConceptProgress(conceptId: string): ConceptProgress | undefined {
  return loadProgress().concepts[conceptId]
}

export { migrateV1 as _migrateV1ForTests, KEY_V1, KEY_V2, emptyV2 }
