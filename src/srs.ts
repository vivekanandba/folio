import type { ConceptSrsState, Grade, SessionKind } from './types'

// --- tunables -------------------------------------------------------------
const EASE_START = 2.5
const EASE_FLOOR = 1.3
const EMA_ALPHA = 0.4 // recency bias for mastery
const NEW_PER_DAY = 4
const MAX_QUEUE = 20

/** Audit is self-report, so it's a weaker mastery signal than correctness-based kinds. */
const KIND_WEIGHT: Record<SessionKind, number> = {
  quiz: 1,
  classify: 1,
  detective: 1,
  calculator: 1,
  decision: 0.9,
  audit: 0.5,
  sequence: 1,
  estimate: 1,
  hotspot: 1,
  explainer: 0.3, // teaching, not assessment — weak mastery signal
}

// --- date helpers (yyyy-mm-dd in UTC) ------------------------------------
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const dt = new Date(iso + 'T00:00:00Z')
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// --- scoring --------------------------------------------------------------
export function normalize(score: number, max: number): number {
  if (!max || max <= 0) return 0
  return Math.min(1, Math.max(0, score / max))
}

/** Map a 0..1 performance to an SM-2 grade. 3 is the pass threshold. */
export function toGrade(n: number): Grade {
  if (n >= 0.95) return 5
  if (n >= 0.8) return 4
  if (n >= 0.6) return 3
  if (n >= 0.4) return 2
  if (n >= 0.2) return 1
  return 0
}

export function freshState(packId: string, conceptId: string): ConceptSrsState {
  return {
    packId,
    conceptId,
    ease: EASE_START,
    intervalDays: 0,
    reps: 0,
    lapses: 0,
    due: today(),
    lastReviewedAt: '',
    mastery: 0,
    reviewCount: 0,
  }
}

/**
 * One SM-2 step plus a mastery EMA. Pure — returns the next state, never mutates.
 * `normalized` is 0..1 performance; `kind` weights the mastery contribution.
 */
export function schedule(
  s: ConceptSrsState,
  normalized: number,
  kind?: SessionKind,
): ConceptSrsState {
  const q = toGrade(normalized)
  let { ease, intervalDays, reps, lapses } = s

  if (q >= 3) {
    intervalDays = reps === 0 ? 1 : reps === 1 ? 6 : Math.round(intervalDays * ease)
    reps += 1
  } else {
    reps = 0
    intervalDays = 1
    lapses += 1
  }
  ease = Math.max(EASE_FLOOR, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))

  const w = kind ? KIND_WEIGHT[kind] : 1
  const contribution = normalized * w
  const mastery =
    s.reviewCount === 0
      ? contribution
      : s.mastery * (1 - EMA_ALPHA) + contribution * EMA_ALPHA

  const t = today()
  return {
    ...s,
    ease,
    intervalDays,
    reps,
    lapses,
    due: addDays(t, intervalDays),
    lastReviewedAt: new Date().toISOString(),
    mastery: Math.min(1, Math.max(0, mastery)),
    reviewCount: s.reviewCount + 1,
  }
}

export function masteryBand(m: number): 'shaky' | 'developing' | 'solid' {
  return m < 0.5 ? 'shaky' : m < 0.8 ? 'developing' : 'solid'
}

// --- Today queue ----------------------------------------------------------
export interface ConceptRef {
  packId: string
  conceptId: string
}

export interface QueueItem {
  ref: ConceptRef
  state?: ConceptSrsState
  status: 'overdue' | 'due' | 'new'
}

/** Round-robin by pack so consecutive items aren't all from one pack. */
function interleaveByPack(items: QueueItem[]): QueueItem[] {
  const buckets = new Map<string, QueueItem[]>()
  for (const it of items) {
    const list = buckets.get(it.ref.packId) ?? []
    list.push(it)
    buckets.set(it.ref.packId, list)
  }
  const lists = [...buckets.values()]
  const out: QueueItem[] = []
  let added = true
  while (added) {
    added = false
    for (const list of lists) {
      const next = list.shift()
      if (next) {
        out.push(next)
        added = true
      }
    }
  }
  return out
}

/**
 * Build the review queue: overdue + due-today concepts, then up to NEW_PER_DAY
 * never-seen concepts, interleaved by pack and capped at MAX_QUEUE.
 */
export function buildToday(
  concepts: Record<string, ConceptSrsState>,
  allConcepts: ConceptRef[],
): QueueItem[] {
  const t = today()
  const due: QueueItem[] = []
  const fresh: QueueItem[] = []

  for (const ref of allConcepts) {
    const st = concepts[`${ref.packId}::${ref.conceptId}`]
    if (!st) {
      fresh.push({ ref, status: 'new' })
    } else if (st.due < t) {
      due.push({ ref, state: st, status: 'overdue' })
    } else if (st.due === t) {
      due.push({ ref, state: st, status: 'due' })
    }
  }

  due.sort((a, b) => (a.state!.due).localeCompare(b.state!.due)) // most overdue first
  const queue = interleaveByPack([...due, ...fresh.slice(0, NEW_PER_DAY)])
  return queue.slice(0, MAX_QUEUE)
}

/** Count consecutive days with ≥1 review, ending today or yesterday (forgiving). */
export function computeStreak(daily: Record<string, number>): number {
  const t = today()
  let cursor = daily[t] ? t : addDays(t, -1)
  if (!daily[cursor]) return 0
  let streak = 0
  while (daily[cursor]) {
    streak += 1
    cursor = addDays(cursor, -1)
  }
  return streak
}

/** Mean normalized performance over attempts within the last `days`. */
export function retentionRate(
  attempts: { normalized: number; at: string }[],
  days = 30,
): number | null {
  const cutoff = addDays(today(), -days)
  const recent = attempts.filter((a) => a.at.slice(0, 10) >= cutoff)
  if (!recent.length) return null
  return recent.reduce((acc, a) => acc + a.normalized, 0) / recent.length
}
