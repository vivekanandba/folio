import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KNOWN_KINDS } from '../tools/lint/referential.ts'
import {
  KIND_WEIGHT,
  addDays,
  buildToday,
  computeStreak,
  freshState,
  normalize,
  schedule,
  toGrade,
  today,
} from '../src/srs.ts'
import type { ConceptSrsState } from '../src/types.ts'

/* The guard that would have caught PR #18's broken main before any commit:
   every kind the linter accepts must have a mastery weight, and vice versa. */
test('KIND_WEIGHT ↔ KNOWN_KINDS parity', () => {
  for (const kind of KNOWN_KINDS) {
    assert.ok(kind in KIND_WEIGHT, `KIND_WEIGHT is missing "${kind}" — this breaks CI's tsc`)
  }
  for (const kind of Object.keys(KIND_WEIGHT)) {
    assert.ok(KNOWN_KINDS.has(kind), `linter KNOWN_KINDS is missing "${kind}"`)
  }
})

test('normalize clamps, toGrade thresholds', () => {
  assert.equal(normalize(5, 10), 0.5)
  assert.equal(normalize(20, 10), 1)
  assert.equal(normalize(1, 0), 0)
  assert.equal(toGrade(1), 5)
  assert.equal(toGrade(0.8), 4)
  assert.equal(toGrade(0.6), 3)
  assert.equal(toGrade(0.59), 2)
  assert.equal(toGrade(0), 0)
})

test('scheduler: SM-2 interval ladder on success, reset on lapse', () => {
  let s = freshState('p', 'c')
  assert.equal(s.due, today())

  s = schedule(s, 1) // first success
  assert.equal(s.intervalDays, 1)
  assert.equal(s.reps, 1)

  s = schedule(s, 1) // second success
  assert.equal(s.intervalDays, 6)

  const third = schedule(s, 1) // third grows by ease
  assert.ok(third.intervalDays > 6, 'interval expands with ease')
  assert.equal(third.due, addDays(today(), third.intervalDays))

  const lapsed = schedule(third, 0.1) // failure
  assert.equal(lapsed.reps, 0)
  assert.equal(lapsed.intervalDays, 1)
  assert.equal(lapsed.lapses, third.lapses + 1)
})

test('scheduler: ease never falls below the floor; mastery stays in [0,1]', () => {
  let s = freshState('p', 'c')
  for (let i = 0; i < 20; i++) s = schedule(s, 0)
  assert.ok(s.ease >= 1.3, `ease floored (got ${s.ease})`)
  assert.ok(s.mastery >= 0 && s.mastery <= 1)
  for (let i = 0; i < 20; i++) s = schedule(s, 1, 'quiz')
  assert.ok(s.mastery <= 1)
})

test('buildToday: overdue first, new capped, interleaved across packs', () => {
  const t = today()
  const mk = (packId: string, conceptId: string, due: string): ConceptSrsState => ({
    ...freshState(packId, conceptId),
    due,
    reviewCount: 1,
  })
  const concepts: Record<string, ConceptSrsState> = {
    'a::1': mk('a', '1', addDays(t, -3)),
    'b::1': mk('b', '1', addDays(t, -1)),
    'a::2': mk('a', '2', t),
  }
  const refs = [
    { packId: 'a', conceptId: '1' }, { packId: 'a', conceptId: '2' },
    { packId: 'b', conceptId: '1' },
    // 6 brand-new concepts — more than the daily cap
    ...Array.from({ length: 6 }, (_, i) => ({ packId: 'c', conceptId: `n${i}` })),
  ]
  const queue = buildToday(concepts, refs)
  const statuses = queue.map((q) => q.status)
  assert.ok(statuses.filter((s) => s === 'new').length <= 4, 'new concepts capped per day')
  assert.ok(queue.some((q) => q.status === 'overdue') && queue.some((q) => q.status === 'due'))
  // due items must not be dropped in favour of new ones
  const dueIds = queue.filter((q) => q.status !== 'new').map((q) => `${q.ref.packId}::${q.ref.conceptId}`)
  assert.deepEqual(new Set(dueIds), new Set(['a::1', 'a::2', 'b::1']))
})

test('computeStreak: consecutive days, forgiving about today', () => {
  const t = today()
  assert.equal(computeStreak({}), 0)
  assert.equal(computeStreak({ [t]: 1 }), 1)
  assert.equal(computeStreak({ [addDays(t, -1)]: 2, [addDays(t, -2)]: 1 }), 2, 'yesterday still counts')
  assert.equal(computeStreak({ [t]: 1, [addDays(t, -1)]: 1, [addDays(t, -3)]: 1 }), 2, 'gap breaks the streak')
})
