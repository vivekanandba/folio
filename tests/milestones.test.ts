// What the museum notices, and what it refuses to notice.
//
// Every plaque here has to be EARNED from something folio already recorded
// (CON-DATA-001). So the tests that matter are the negative ones: a milestone
// that cannot be reached must never fire, and one already earned must never
// fire twice. Detection is a pure function of the store, which is what makes
// both checkable without a DOM.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
installDomStub()

const { detect, satisfied, MILESTONE_IDS } = await import('../src/milestones.ts')
const { addDays, today } = await import('../src/srs.ts')

type Store = {
  version: 2
  sessions: Record<string, unknown>
  concepts: Record<string, unknown>
  attempts: unknown[]
  daily: Record<string, number>
  milestones?: Record<string, string>
}

const HALLS = [
  { packId: 'hall-a', title: 'Hall A', sessionIds: ['a1', 'a2'] },
  { packId: 'hall-b', title: 'Hall B', sessionIds: ['b1'] },
]
const ctx = { halls: HALLS }

function store(over: Partial<Store> = {}): Store {
  return { version: 2, sessions: {}, concepts: {}, attempts: [], daily: {}, ...over }
}

function session(packId: string, id: string, score: number, maxScore: number): [string, unknown] {
  return [
    `${packId}::${id}`,
    { packId, sessionId: id, kind: 'quiz', score, maxScore, completedAt: '2026-10-01T00:00:00.000Z' },
  ]
}

function concept(mastery: number): unknown {
  return {
    packId: 'hall-a', conceptId: 'c', ease: 2.5, intervalDays: 1, reps: 1, lapses: 0,
    due: today(), lastReviewedAt: today(), mastery, reviewCount: 1,
  }
}

/** `n` consecutive days ending today — what computeStreak reads. */
function daysInARow(n: number): Record<string, number> {
  const daily: Record<string, number> = {}
  for (let i = 0; i < n; i++) daily[addDays(today(), -i)] = 1
  return daily
}

const ids = (list: { id: string }[]): string[] => list.map((m) => m.id).sort()

/* ------------------------------------------------------ nothing, yet ----- */

test('an untouched museum has earned nothing', () => {
  assert.deepEqual(satisfied(store(), ctx), [])
  assert.deepEqual(detect(store(), ctx), [])
})

test('every milestone has an inscription and a line, and no id is duplicated', () => {
  // A plaque with no words on it is a bug nobody notices until it is on a wall.
  const all = satisfied(
    store({
      sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5), session('hall-a', 'a2', 1, 5), session('hall-b', 'b1', 3, 3)]),
      concepts: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, concept(0.95)])),
      attempts: Array.from({ length: 250 }, () => ({ normalized: 1, at: '2026-10-01T00:00:00.000Z' })),
      daily: daysInARow(100),
    }),
    ctx,
  )
  assert.ok(all.length >= 10, `expected the full set to be reachable, got ${all.length}`)
  for (const m of all) {
    assert.ok(m.title.trim().length > 0, `${m.id} has no inscription`)
    assert.ok(m.note.trim().length > 0, `${m.id} has no line`)
  }
  assert.equal(new Set(all.map((m) => m.id)).size, all.length, 'ids must be unique')
})

/* ------------------------------------------------------- one at a time --- */

test('the first exhibit, and the first flawless one, are separate moments', () => {
  const scraped = store({ sessions: Object.fromEntries([session('hall-a', 'a1', 3, 5)]) })
  assert.ok(ids(satisfied(scraped, ctx)).includes('first-exhibit'))
  assert.ok(
    !ids(satisfied(scraped, ctx)).includes('first-flawless'),
    'three out of five is not flawless',
  )

  const perfect = store({ sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5)]) })
  assert.ok(ids(satisfied(perfect, ctx)).includes('first-flawless'))
})

test('a session worth zero points cannot be flawless', () => {
  // maxScore 0 would make score === maxScore trivially true. An explainer the
  // learner clicked through is not a perfect run.
  const empty = store({ sessions: Object.fromEntries([session('hall-a', 'a1', 0, 0)]) })
  assert.ok(
    !ids(satisfied(empty, ctx)).includes('first-flawless'),
    'a zero-point session must not count as flawless',
  )
})

test('a hall is complete only when every session in it is', () => {
  const half = store({ sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5)]) })
  assert.ok(!ids(satisfied(half, ctx)).includes('hall-complete:hall-a'), 'one of two is not a hall')

  const whole = store({
    sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5), session('hall-a', 'a2', 1, 5)]),
  })
  assert.ok(ids(satisfied(whole, ctx)).includes('hall-complete:hall-a'))
  assert.ok(!ids(satisfied(whole, ctx)).includes('hall-complete:hall-b'), 'hall B is untouched')
})

test('a hall with no sessions at all is not quietly complete', () => {
  // vacuous truth: every() over an empty list is true, which would hand out a
  // plaque for a hall that has nothing in it.
  const emptyHall = [{ packId: 'hall-x', title: 'Hall X', sessionIds: [] as string[] }]
  assert.deepEqual(
    ids(satisfied(store(), { halls: emptyHall })).filter((i) => i.startsWith('hall-complete')),
    [],
  )
})

test('visiting every hall needs every hall, not most of them', () => {
  const oneHall = store({ sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5)]) })
  assert.ok(!ids(satisfied(oneHall, ctx)).includes('every-hall'))

  const both = store({
    sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5), session('hall-b', 'b1', 3, 3)]),
  })
  assert.ok(ids(satisfied(both, ctx)).includes('every-hall'))
})

test('streak tiers fire at their threshold and not before', () => {
  assert.ok(!ids(satisfied(store({ daily: daysInARow(2) }), ctx)).includes('streak-3'))
  assert.ok(ids(satisfied(store({ daily: daysInARow(3) }), ctx)).includes('streak-3'))
  // A longer streak carries the shorter ones with it — they were earned.
  const long = ids(satisfied(store({ daily: daysInARow(30) }), ctx))
  assert.ok(long.includes('streak-3') && long.includes('streak-7') && long.includes('streak-30'))
  assert.ok(!long.includes('streak-100'))
})

test('mastery tiers count concepts that are actually solid', () => {
  const shaky = store({ concepts: { a: concept(0.2), b: concept(0.3) } })
  assert.ok(!ids(satisfied(shaky, ctx)).includes('solid-1'), 'shaky concepts are not solid')

  const one = store({ concepts: { a: concept(0.9), b: concept(0.3) } })
  assert.ok(ids(satisfied(one, ctx)).includes('solid-1'))
  assert.ok(!ids(satisfied(one, ctx)).includes('solid-10'))
})

/* ---------------------------------------------------------- fires once --- */

test('a milestone already on the wall is never handed out again', () => {
  const s = store({ sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5)]) })
  const first = detect(s, ctx)
  assert.ok(first.length > 0, 'precondition: something was earned')

  // Record them the way progress.ts will, then ask again.
  s.milestones = Object.fromEntries(first.map((m) => [m.id, '2026-10-31T00:00:00.000Z']))
  assert.deepEqual(detect(s, ctx), [], 'a second look must find nothing new')
})

test('detection ignores what was earned before and reports what is unrecorded', () => {
  // A learner who has been using folio since before plaques existed has
  // genuinely earned them; the curator has been keeping records all along.
  const veteran = store({
    sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5), session('hall-a', 'a2', 4, 5)]),
    daily: daysInARow(7),
  })
  const found = ids(detect(veteran, ctx))
  assert.ok(found.includes('first-exhibit'))
  assert.ok(found.includes('streak-3') && found.includes('streak-7'))
  assert.ok(found.includes('hall-complete:hall-a'))
})

test('the id list is exhaustive over what detection can produce', () => {
  // A new rule without an entry here is a plaque the report cannot describe.
  const everything = satisfied(
    store({
      sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5), session('hall-a', 'a2', 1, 5), session('hall-b', 'b1', 3, 3)]),
      concepts: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, concept(0.95)])),
      attempts: Array.from({ length: 250 }, () => ({ normalized: 1, at: '2026-10-01T00:00:00.000Z' })),
      daily: daysInARow(100),
    }),
    ctx,
  )
  for (const m of everything) {
    const base = m.id.startsWith('hall-complete:') ? 'hall-complete' : m.id
    assert.ok(
      (MILESTONE_IDS as readonly string[]).includes(base),
      `${m.id} is produced but not declared in MILESTONE_IDS`,
    )
  }
})
