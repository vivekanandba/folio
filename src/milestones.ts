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
 * Two separations make the rest of the feature work:
 *
 *  - `satisfied()` decides WHICH plaques a store qualifies for; `describe()`
 *    knows what any plaque SAYS. They are apart because an earned plaque has
 *    to keep its words after the thing it records has lapsed — a streak ends,
 *    a concept slips out of `solid`, a hall gains a session — and a wall that
 *    quietly empties itself is the opposite of a collection.
 *  - Both are pure functions of their arguments: no DOM, no storage, no clock
 *    beyond what `srs.ts` already reads. That is what makes "fires exactly
 *    once" and "cannot fire at all" testable.
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

/** The one-offs. */
const FIXED: Record<string, { title: string; note: string }> = {
  'first-exhibit': {
    title: 'First exhibit',
    note: 'You finished something. The museum has a record of you now.',
  },
  'first-flawless': {
    title: 'A flawless run',
    note: 'Every answer right, start to finish.',
  },
  'every-hall': {
    title: 'Every hall visited',
    note: 'There is no room in this museum you have not walked into.',
  },
}

/** Tiered plaques: [threshold, inscription, line]. */
const TIERS: Record<'streak' | 'solid' | 'visits', [number, string, string][]> = {
  streak: [
    [3, 'Three nights running', 'The museum has started expecting you.'],
    [7, 'A week of nights', 'Seven visits in a row. The lamps are staying warm.'],
    [30, 'A month of nights', 'Thirty consecutive days. This is a habit now, not an intention.'],
    [100, 'A hundred nights', 'One hundred days unbroken. Very few collections are kept this well.'],
  ],
  solid: [
    [1, 'First lamp lit', 'A concept has reached solid. It will hold now between visits.'],
    [10, 'Ten lamps lit', 'Ten concepts solid — a wing of the museum is properly furnished.'],
    [25, 'Twenty-five lamps', 'Twenty-five concepts solid. The dark patches are getting rarer.'],
    [50, 'Fifty lamps', 'Fifty concepts solid. The floor is bright from the door.'],
  ],
  visits: [
    [10, 'Ten visits logged', 'Ten reviews recorded. The curator has begun keeping notes.'],
    [50, 'Fifty visits logged', 'Fifty reviews. The forgetting curve has real data to argue with.'],
    [100, 'A hundred visits', 'One hundred reviews recorded in this collection.'],
    [250, 'Two hundred and fifty visits', 'A long acquaintance with the same rooms.'],
  ],
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

/**
 * What a plaque says, whether or not the store still qualifies for it.
 *
 * This is the whole of the permanence promise. An earned plaque is looked up
 * HERE, not among the currently-satisfied ones: a streak that lapses, a
 * concept that slips below solid, or a hall that gains a new session would
 * otherwise erase a plaque the learner genuinely earned — and `detect()` would
 * refuse to award it again, so it would be gone for good.
 *
 * Returns null for an id this version does not know, so a ledger written by a
 * newer build degrades to leaving that plaque out rather than crashing.
 */
export function describe(id: string, ctx: MilestoneCtx): Milestone | null {
  // Object.hasOwn, not a truthiness check: ids come out of a ledger the
  // learner can import, and `constructor` or `toString` would otherwise find
  // something on the prototype chain — rendering a plaque with an undefined
  // inscription, or throwing out of the Curator's Report entirely. Nothing
  // here is trusted input.
  if (Object.hasOwn(FIXED, id)) return { id, ...FIXED[id] }

  if (id.startsWith('hall-complete:')) {
    const packId = id.slice('hall-complete:'.length)
    const hall = ctx.halls.find((h) => h.packId === packId)
    return {
      id,
      // A hall that has since left the catalog still had its plaque earned.
      title: `${hall?.title ?? packId} — complete`,
      note: 'Every exhibit in this hall has been played at least once.',
    }
  }

  const [kind, raw] = id.split('-')
  if (!Object.hasOwn(TIERS, kind)) return null
  const tiers = TIERS[kind as keyof typeof TIERS]
  const tier = tiers.find(([threshold]) => String(threshold) === raw)
  return tier ? { id, title: tier[1], note: tier[2] } : null
}

/** `describe` for an id known to exist — keeps `satisfied` free of null checks. */
function plaque(id: string, ctx: MilestoneCtx): Milestone {
  const m = describe(id, ctx)
  if (!m) throw new Error(`milestone ${id} has no inscription`)
  return m
}

/** Every plaque this store currently qualifies for, earned or not yet recorded. */
export function satisfied(store: ProgressStoreV2, ctx: MilestoneCtx): Milestone[] {
  const ids: string[] = []
  const results = Object.values(store.sessions ?? {})

  if (results.length > 0) ids.push('first-exhibit')

  // maxScore > 0 matters: an explainer scores 0 of 0, and `score === maxScore`
  // would make clicking through one a flawless run.
  if (results.some((r) => r.maxScore > 0 && r.score === r.maxScore)) ids.push('first-flawless')

  // Both hall rules judge the same set. A hall with no sessions in it would be
  // vacuously COMPLETE ([].every() is true) and permanently UNVISITABLE
  // ([].some() is false) — so one concepts-only or half-authored pack in the
  // catalog would hand out a plaque for an empty room and make "every hall"
  // unearnable forever, with nothing to explain why. It is not a hall yet.
  const rooms = ctx.halls.filter((hall) => hall.sessionIds.length > 0)

  for (const hall of rooms) {
    if (hall.sessionIds.every((id) => store.sessions?.[`${hall.packId}::${id}`])) {
      ids.push(`hall-complete:${hall.packId}`)
    }
  }

  if (
    rooms.length > 0 &&
    rooms.every((hall) => hall.sessionIds.some((id) => store.sessions?.[`${hall.packId}::${id}`]))
  ) {
    ids.push('every-hall')
  }

  const streak = computeStreak(store.daily ?? {})
  for (const [days] of TIERS.streak) if (streak >= days) ids.push(`streak-${days}`)

  const solid = Object.values(store.concepts ?? {}).filter(
    (c) => c.reviewCount > 0 && masteryBand(c.mastery) === 'solid',
  ).length
  for (const [count] of TIERS.solid) if (solid >= count) ids.push(`solid-${count}`)

  // The attempt log is capped at 500 in progress.ts, so every tier here sits
  // below that — a threshold above the cap could never be crossed.
  const visits = (store.attempts ?? []).length
  for (const [count] of TIERS.visits) if (visits >= count) ids.push(`visits-${count}`)

  return ids.map((id) => plaque(id, ctx))
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
