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

const { describe, detect, satisfied, MILESTONE_IDS } = await import('../src/milestones.ts')
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

test('a pack with no sessions does not make "every hall" unearnable', () => {
  // [].some() is false, so an unfiltered every() would be false forever: one
  // concepts-only or half-authored pack in the catalog and the plaque could
  // never be earned, with nothing on screen to explain why.
  const withEmpty = [...HALLS, { packId: 'hall-wip', title: 'Work in progress', sessionIds: [] as string[] }]
  const both = store({
    sessions: Object.fromEntries([session('hall-a', 'a1', 5, 5), session('hall-b', 'b1', 3, 3)]),
  })
  assert.ok(
    ids(satisfied(both, { halls: withEmpty })).includes('every-hall'),
    'a room with nothing in it is not a hall you have failed to visit',
  )
})

test('a crafted ledger key is ignored, not rendered and not thrown', () => {
  // milestones come back from importProgress unvalidated, so these reach
  // describe() verbatim. Prototype keys must find nothing.
  // Including near-misses: split('-') looks at two segments, so an id with a
  // third would otherwise describe itself with a real tier's words and hang a
  // duplicate plaque on the wall.
  for (const id of [
    'constructor', 'toString', '__proto__', 'constructor-x', 'hasOwnProperty-3',
    'streak-3-anything', 'solid-1-x', 'visits-10-10',
    // A nameless hall plaque would read " — complete"; an arbitrary suffix
    // would put learner-supplied text straight into a heading.
    'hall-complete:', 'hall-complete:../x', 'hall-complete:a b',
  ]) {
    assert.equal(describe(id, ctx), null, `${id} must not describe a plaque`)
  }
  // And the shelf-shaped path over a poisoned store must survive.
  const poisoned = store({ milestones: { constructor: 'x', 'streak-3': '2026-01-01T00:00:00.000Z' } })
  assert.doesNotThrow(() => detect(poisoned, ctx))
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

test('a corrupt ledger renders oddly but never costs a save', () => {
  // importProgress validates that `sessions` is an object, never its values.
  // satisfied() runs inside award(), BEFORE persist() — so a throw here takes
  // down the completion handler and loses the session just finished.
  const corrupt = store({
    sessions: { 'hall-a::a1': null as never, 'hall-a::a2': undefined as never },
    concepts: { k: null as never },
  })
  assert.doesNotThrow(() => satisfied(corrupt, ctx), 'a corrupt session map must not throw')
  assert.doesNotThrow(() => detect(corrupt, ctx), 'nor must detection over it')
  assert.ok(
    ids(satisfied(corrupt, ctx)).includes('first-exhibit'),
    'the entries are still counted — this is about surviving them, not hiding them',
  )
  assert.ok(
    !ids(satisfied(corrupt, ctx)).includes('first-flawless'),
    'and a null session is certainly not a flawless run',
  )
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
