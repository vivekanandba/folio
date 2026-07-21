import type {
  Attempt,
  ConceptSrsState,
  ProgressStore,
  ProgressStoreV2,
  ReviewSource,
  SessionKind,
  SessionResult,
} from './types'
import { freshState, normalize, schedule, toGrade, today } from './srs'

const KEY_V2 = 'folio-progress-v2'
const KEY_V1 = 'folio-progress-v1'
const ATTEMPT_CAP = 500

function empty(): ProgressStoreV2 {
  return { version: 2, sessions: {}, concepts: {}, attempts: [], daily: {} }
}

/** Build a v2 store from a legacy v1 blob. Carries sessions + seeds daily/attempts from
 *  completedAt. Concept SRS is not seeded (v1 lacks conceptIds) — it fills in on next review. */
function migrate(v1: ProgressStore): ProgressStoreV2 {
  const store = empty()
  store.sessions = v1.sessions ?? {}
  store.lastPackId = v1.lastPackId
  const results = Object.values(store.sessions).sort((a, b) =>
    a.completedAt.localeCompare(b.completedAt),
  )
  for (const r of results) {
    const n = normalize(r.score, r.maxScore)
    const day = r.completedAt.slice(0, 10)
    store.daily[day] = (store.daily[day] ?? 0) + 1
    store.attempts.push({
      id: `${r.packId}::${r.sessionId}::${r.completedAt}`,
      packId: r.packId,
      conceptIds: [],
      source: 'session',
      ref: r.sessionId,
      kind: r.kind,
      normalized: n,
      grade: toGrade(n),
      at: r.completedAt,
    })
  }
  return store
}

export function loadProgress(): ProgressStoreV2 {
  try {
    const raw = localStorage.getItem(KEY_V2)
    if (raw) return JSON.parse(raw) as ProgressStoreV2
    const legacy = localStorage.getItem(KEY_V1)
    if (legacy) {
      const migrated = migrate(JSON.parse(legacy) as ProgressStore)
      localStorage.setItem(KEY_V2, JSON.stringify(migrated)) // keep KEY_V1 as rollback
      return migrated
    }
    return empty()
  } catch {
    return empty()
  }
}

function persist(store: ProgressStoreV2): void {
  try {
    localStorage.setItem(KEY_V2, JSON.stringify(store))
  } catch {
    // storage full / unavailable — progress is best-effort
  }
}

function conceptKey(packId: string, conceptId: string): string {
  return `${packId}::${conceptId}`
}

function bumpDaily(store: ProgressStoreV2): void {
  const day = today()
  store.daily[day] = (store.daily[day] ?? 0) + 1
}

function pushAttempt(store: ProgressStoreV2, attempt: Attempt): void {
  store.attempts.push(attempt)
  if (store.attempts.length > ATTEMPT_CAP) {
    store.attempts.splice(0, store.attempts.length - ATTEMPT_CAP)
  }
}

function applyReview(
  store: ProgressStoreV2,
  packId: string,
  conceptIds: string[],
  normalized: number,
  source: ReviewSource,
  ref: string,
  kind?: SessionKind,
): void {
  for (const cid of conceptIds) {
    const key = conceptKey(packId, cid)
    store.concepts[key] = schedule(store.concepts[key] ?? freshState(packId, cid), normalized, kind)
  }
  pushAttempt(store, {
    id: `${packId}::${ref}::${new Date().toISOString()}`,
    packId,
    conceptIds,
    source,
    ref,
    kind,
    normalized,
    grade: toGrade(normalized),
    at: new Date().toISOString(),
  })
  bumpDaily(store)
  store.lastPackId = packId
}

/** Persist a completed session AND fold it into each linked concept's SRS state. */
export function saveSessionResult(result: SessionResult, conceptIds: string[] = []): void {
  const store = loadProgress()
  store.sessions[`${result.packId}::${result.sessionId}`] = result
  const n = normalize(result.score, result.maxScore)
  applyReview(store, result.packId, conceptIds, n, 'session', result.sessionId, result.kind)
  persist(store)
}

/** Record a flashcard review round for one concept. */
export function recordConceptReview(
  packId: string,
  conceptId: string,
  normalized: number,
): void {
  const store = loadProgress()
  applyReview(store, packId, [conceptId], normalized, 'flashcard', conceptId)
  persist(store)
}

export function getSessionResult(packId: string, sessionId: string): SessionResult | undefined {
  return loadProgress().sessions[`${packId}::${sessionId}`]
}

export function getConceptState(
  packId: string,
  conceptId: string,
): ConceptSrsState | undefined {
  return loadProgress().concepts[conceptKey(packId, conceptId)]
}

/** Mark a concept's explainer/page as read (the "Learn" step of the guided path). */
export function markConceptLearned(packId: string, conceptId: string): void {
  const store = loadProgress()
  const key = conceptKey(packId, conceptId)
  const st = store.concepts[key] ?? freshState(packId, conceptId)
  if (!st.learnedAt) st.learnedAt = new Date().toISOString()
  store.concepts[key] = st
  persist(store)
}

export function packCompletion(
  packId: string,
  sessionIds: string[],
): { done: number; total: number } {
  const store = loadProgress()
  const done = sessionIds.filter((id) => store.sessions[`${packId}::${id}`]).length
  return { done, total: sessionIds.length }
}

/** Last pack touched + the most recently completed session, for "resume where you left off". */
export function getResume(): { packId: string; last?: SessionResult } | null {
  const store = loadProgress()
  if (!store.lastPackId) return null
  let last: SessionResult | undefined
  for (const r of Object.values(store.sessions)) {
    if (r.packId === store.lastPackId && (!last || r.completedAt > last.completedAt)) last = r
  }
  return { packId: store.lastPackId, last }
}
