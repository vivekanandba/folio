import type {
  Attempt,
  ConceptSrsState,
  ProgressStore,
  ProgressStoreV2,
  ReviewSource,
  SessionKind,
  SessionResult,
} from './types'
import { describe, detect, type Milestone, type MilestoneCtx } from './milestones'
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

/**
 * Award whatever this save has just earned, stamp it into the store, and hand
 * it back for the page to celebrate. Called with the store already updated and
 * before it is persisted, so the plaques and the progress land together — a
 * milestone recorded without the progress that earned it would be a lie, and
 * the reverse would silently lose the moment.
 */
function award(store: ProgressStoreV2, ctx: MilestoneCtx): Milestone[] {
  const earned = detect(store, ctx)
  if (!earned.length) return []
  const at = new Date().toISOString()
  store.milestones = { ...(store.milestones ?? {}) }
  for (const m of earned) store.milestones[m.id] = at
  return earned
}

/** No halls given means hall-shaped plaques simply are not assessed this time. */
const NO_HALLS: MilestoneCtx = { halls: [] }

/**
 * Award whatever the store ALREADY qualifies for but has not been given, with
 * no new progress attached. The session page uses this for the hall-shaped
 * plaques, which it cannot judge until the catalog has loaded: progress is
 * saved the instant the learner finishes, and the plaques that need wider
 * knowledge follow a beat later rather than being missed on the very save
 * that earned them.
 */
export function awardMilestones(ctx: MilestoneCtx): Milestone[] {
  const store = loadProgress()
  const earned = award(store, ctx)
  if (earned.length) persist(store)
  return earned
}

/**
 * Persist a completed session AND fold it into each linked concept's SRS
 * state. Returns the plaques this earned, newest first.
 */
export function saveSessionResult(
  result: SessionResult,
  conceptIds: string[] = [],
  ctx: MilestoneCtx = NO_HALLS,
): Milestone[] {
  const store = loadProgress()
  store.sessions[`${result.packId}::${result.sessionId}`] = result
  const n = normalize(result.score, result.maxScore)
  applyReview(store, result.packId, conceptIds, n, 'session', result.sessionId, result.kind)
  const earned = award(store, ctx)
  persist(store)
  return earned
}

/** Record a flashcard review round for one concept. */
export function recordConceptReview(
  packId: string,
  conceptId: string,
  normalized: number,
  ctx: MilestoneCtx = NO_HALLS,
): Milestone[] {
  const store = loadProgress()
  applyReview(store, packId, [conceptId], normalized, 'flashcard', conceptId)
  const earned = award(store, ctx)
  persist(store)
  return earned
}

/**
 * Every plaque on the wall, newest first — the Acquisitions shelf reads this.
 *
 * Inscriptions come from describe(), NOT from satisfied(). Earlier this read
 * the words off the currently-satisfied set, which quietly emptied the wall:
 * a streak plaque vanished the day the streak lapsed, a `solid` plaque the
 * first time a concept slipped, a hall plaque the moment the pack gained a
 * session — and detect() refuses to re-award what is already recorded, so each
 * was gone for good. A plaque records what WAS earned; nothing later can
 * unearn it.
 */
export function earnedMilestones(ctx: MilestoneCtx): { milestone: Milestone; at: string }[] {
  const recorded = Object.entries(loadProgress().milestones ?? {})
  return recorded
    // The map comes back from importProgress unvalidated. A string is not a
    // date: `"<script>alert(1)"` would render as `Recorded <script>ale` and
    // sort arbitrarily against the real timestamps, scrambling the shelf's
    // stated order. Check the shape the comment claims to check
    // (CON-VER-005 — a guard that misdescribes itself is worse than none).
    .filter(([, at]) => typeof at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(at))
    .map(([id, at], order) => ({ milestone: describe(id, ctx), at, order }))
    .filter((row): row is { milestone: Milestone; at: string; order: number } => !!row.milestone)
    // Newest first. A whole batch earned in one save shares a timestamp, so
    // ties fall back to reverse award order, which puts the weightier plaque
    // (a longer streak, a higher tier) above the one that came with it.
    .sort((a, b) => b.at.localeCompare(a.at) || b.order - a.order)
    .map(({ milestone, at }) => ({ milestone, at }))
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

/** Serialize the whole store for a downloadable backup. */
export function exportProgress(): string {
  return JSON.stringify(loadProgress(), null, 2)
}

/**
 * Replace the store from a backup file's text. Structural validation only —
 * enough to refuse garbage without being brittle about forward-compat fields.
 */
export function importProgress(json: string): { ok: boolean; error?: string } {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, error: 'Not valid JSON.' }
  }
  const d = data as Partial<ProgressStoreV2> | null
  if (!d || typeof d !== 'object') return { ok: false, error: 'Not a folio backup.' }
  if (d.version !== 2) return { ok: false, error: `Unsupported backup version (${String(d.version)}).` }
  if (!d.sessions || typeof d.sessions !== 'object' || Array.isArray(d.sessions)) {
    return { ok: false, error: 'Backup is missing session records.' }
  }
  if (!d.concepts || typeof d.concepts !== 'object' || Array.isArray(d.concepts)) {
    return { ok: false, error: 'Backup is missing concept states.' }
  }
  if (!Array.isArray(d.attempts)) return { ok: false, error: 'Backup is missing the attempt log.' }
  if (!d.daily || typeof d.daily !== 'object' || Array.isArray(d.daily)) {
    return { ok: false, error: 'Backup is missing the daily log.' }
  }
  persist(d as ProgressStoreV2)
  return { ok: true }
}
