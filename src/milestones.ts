import { computeStreak, masteryBand } from './srs'
import type { ProgressStoreV2 } from './types'

/**
 * What the museum notices.
 *
 * folio has always recorded a streak, a mastery band and a completion count,
 * and then said nothing about any of them — a number on a stat tile is not a
 * reward. These are the moments worth a plaque, and every one of them is
 * derived from something the learner actually did (CON-DATA-001). There is no
 * XP here, no points, nothing handed out for showing up.
 *
 * Detection is a PURE function of the store: no clock beyond what `srs.ts`
 * already reads, no DOM, no storage. That is what makes "fires exactly once"
 * and "cannot fire at all" both testable.
 */

export interface Hall {
  packId: string
  title: string
  /** Session ids as `progress.ts` keys them, not filenames. */
  sessionIds: string[]
}

export interface MilestoneCtx {
  halls: Hall[]
}

export interface Milestone {
  /** Stable key. Per-hall plaques are `hall-complete:<packId>`. */
  id: string
  /** What is engraved on it. */
  title: string
  /** The curator's line, shown under the title. */
  note: string
}

/**
 * Every id detection can produce, with per-hall plaques collapsed to their
 * prefix. Declared so a rule added without a matching entry is caught by a
 * test rather than by a reader noticing an undescribed plaque.
 */
export const MILESTONE_IDS = [
  'first-exhibit',
  'first-flawless',
  'hall-complete',
  'every-hall',
  'streak-3',
  'streak-7',
  'streak-30',
  'streak-100',
  'solid-1',
  'solid-10',
  'solid-25',
  'solid-50',
  'visits-10',
  'visits-50',
  'visits-100',
  'visits-250',
] as const

export type MilestoneId = (typeof MILESTONE_IDS)[number]

/** Tiered plaques: [threshold, inscription, line]. */
const STREAKS: [number, string, string][] = [
  [3, 'Three nights running', 'The museum has started expecting you.'],
  [7, 'A week of nights', 'Seven visits in a row. The lamps are staying warm.'],
  [30, 'A month of nights', 'Thirty consecutive days. This is a habit now, not an intention.'],
  [100, 'A hundred nights', 'One hundred days unbroken. Very few collections are kept this well.'],
]

const SOLID: [number, string, string][] = [
  [1, 'First lamp lit', 'A concept has reached solid. It will hold now between visits.'],
  [10, 'Ten lamps lit', 'Ten concepts solid — a wing of the museum is properly furnished.'],
  [25, 'Twenty-five lamps', 'Twenty-five concepts solid. The dark patches are getting rarer.'],
  [50, 'Fifty lamps', 'Fifty concepts solid. The floor is bright from the door.'],
]

const VISITS: [number, string, string][] = [
  [10, 'Ten visits logged', 'Ten reviews recorded. The curator has begun keeping notes.'],
  [50, 'Fifty visits logged', 'Fifty reviews. The forgetting curve has real data to argue with.'],
  [100, 'A hundred visits', 'One hundred reviews recorded in this collection.'],
  [250, 'Two hundred and fifty visits', 'A long acquaintance with the same rooms.'],
]

/** Every plaque this store currently qualifies for, earned or not yet recorded. */
export function satisfied(store: ProgressStoreV2, ctx: MilestoneCtx): Milestone[] {
  const out: Milestone[] = []
  const results = Object.values(store.sessions ?? {})

  if (results.length > 0) {
    out.push({
      id: 'first-exhibit',
      title: 'First exhibit',
      note: 'You finished something. The museum has a record of you now.',
    })
  }

  // maxScore > 0 matters: an explainer scores 0 of 0, and `score === maxScore`
  // would make clicking through one a flawless run.
  if (results.some((r) => r.maxScore > 0 && r.score === r.maxScore)) {
    out.push({
      id: 'first-flawless',
      title: 'A flawless run',
      note: 'Every answer right, start to finish.',
    })
  }

  for (const hall of ctx.halls) {
    // An empty hall would be vacuously complete — a plaque for a room with
    // nothing in it.
    if (!hall.sessionIds.length) continue
    const done = hall.sessionIds.every((id) => store.sessions?.[`${hall.packId}::${id}`])
    if (done) {
      out.push({
        id: `hall-complete:${hall.packId}`,
        title: `${hall.title} — complete`,
        note: 'Every exhibit in this hall has been played at least once.',
      })
    }
  }

  if (ctx.halls.length > 0) {
    const visitedAll = ctx.halls.every((hall) =>
      hall.sessionIds.some((id) => store.sessions?.[`${hall.packId}::${id}`]),
    )
    if (visitedAll) {
      out.push({
        id: 'every-hall',
        title: 'Every hall visited',
        note: 'There is no room in this museum you have not walked into.',
      })
    }
  }

  const streak = computeStreak(store.daily ?? {})
  for (const [days, title, note] of STREAKS) {
    if (streak >= days) out.push({ id: `streak-${days}`, title, note })
  }

  const solid = Object.values(store.concepts ?? {}).filter(
    (c) => c.reviewCount > 0 && masteryBand(c.mastery) === 'solid',
  ).length
  for (const [count, title, note] of SOLID) {
    if (solid >= count) out.push({ id: `solid-${count}`, title, note })
  }

  // The attempt log is capped at 500 in progress.ts, so every tier here sits
  // below that — a threshold above the cap could never be crossed.
  const visits = (store.attempts ?? []).length
  for (const [count, title, note] of VISITS) {
    if (visits >= count) out.push({ id: `visits-${count}`, title, note })
  }

  return out
}

/**
 * What to celebrate now: everything qualified for that is not already on the
 * wall. Deliberately NOT a before/after diff — a learner who has been using
 * folio since before plaques existed has genuinely earned theirs, and a diff
 * would mean a milestone crossed during a save that lacked hall information
 * could never fire at all.
 */
export function detect(store: ProgressStoreV2, ctx: MilestoneCtx): Milestone[] {
  const already = store.milestones ?? {}
  return satisfied(store, ctx).filter((m) => !already[m.id])
}
