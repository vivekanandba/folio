// Progress persistence and routing — the two modules that decide what a
// returning visitor sees, neither of which had ever executed under test.
//
// Progress is the one place in folio holding data the user cannot recreate:
// a lost or corrupted store silently erases months of revision history. The
// migration path (v1 → v2) and the import/export round-trip are therefore
// tested for what they PRESERVE, not just for not throwing.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
installDomStub()

const progress = await import('../src/progress.ts')
const router = await import('../src/router.ts')
const { el, clear, prettyId } = await import('../src/dom.ts')

const store = () => globalThis.localStorage as unknown as Storage
const reset = (): void => store().clear()

const result = (over: Record<string, unknown> = {}) => ({
  packId: 'p1',
  sessionId: 's1',
  kind: 'quiz',
  score: 4,
  maxScore: 5,
  completedAt: new Date().toISOString(),
  ...over,
})

/* -------------------------------------------------------------- progress --- */

test('an empty store loads as a valid v2 shape', () => {
  reset()
  const s = progress.loadProgress()
  assert.equal(s.version, 2)
  assert.deepEqual(s.sessions, {})
  assert.deepEqual(s.concepts, {})
  assert.ok(Array.isArray(s.attempts))
})

test('a saved session result round-trips', () => {
  reset()
  progress.saveSessionResult(result() as never, ['c1'])
  const got = progress.getSessionResult('p1', 's1')
  assert.ok(got, 'the result should be retrievable')
  assert.equal(got.score, 4)
  assert.equal(got.maxScore, 5)
})

test('saving a result records an attempt and a daily count', () => {
  reset()
  progress.saveSessionResult(result() as never, ['c1'])
  const s = progress.loadProgress()
  assert.equal(s.attempts.length, 1, 'one attempt recorded')
  assert.equal(Object.values(s.daily).reduce((a, b) => a + b, 0), 1)
})

test('pack completion counts only sessions actually done', () => {
  reset()
  progress.saveSessionResult(result({ sessionId: 's1' }) as never, [])
  progress.saveSessionResult(result({ sessionId: 's3' }) as never, [])
  const c = progress.packCompletion('p1', ['s1', 's2', 's3', 's4'])
  assert.deepEqual(c, { done: 2, total: 4 })
})

test('completion never counts another pack\'s work', () => {
  reset()
  progress.saveSessionResult(result({ packId: 'other', sessionId: 's1' }) as never, [])
  assert.deepEqual(progress.packCompletion('p1', ['s1']), { done: 0, total: 1 })
})

test('resume points at the most recent session of the last pack', () => {
  reset()
  progress.saveSessionResult(result({ sessionId: 'old', completedAt: '2026-01-01T00:00:00.000Z' }) as never, [])
  progress.saveSessionResult(result({ sessionId: 'new', completedAt: '2026-06-01T00:00:00.000Z' }) as never, [])
  const r = progress.getResume()
  assert.equal(r?.packId, 'p1')
  assert.equal(r?.last?.sessionId, 'new')
})

test('resume is null before anything has been done', () => {
  reset()
  assert.equal(progress.getResume(), null)
})

test('marking a concept learned is idempotent about its timestamp', () => {
  reset()
  progress.markConceptLearned('p1', 'c1')
  const first = progress.getConceptState('p1', 'c1')?.learnedAt
  assert.ok(first, 'learnedAt should be set')
  progress.markConceptLearned('p1', 'c1')
  assert.equal(progress.getConceptState('p1', 'c1')?.learnedAt, first, 'must not be overwritten')
})

test('a concept review records SRS state', () => {
  reset()
  // (packId, conceptId, normalized) — this used to be called with seven
  // arguments from an older signature and still passed, because the extras
  // were simply ignored. It was asserting against a call the app never makes.
  progress.recordConceptReview('p1', 'c1', 1)
  const st = progress.getConceptState('p1', 'c1')
  assert.ok(st, 'concept state should exist after a review')
})

test('export → import round-trips the whole store', () => {
  reset()
  progress.saveSessionResult(result() as never, ['c1'])
  progress.markConceptLearned('p1', 'c2')
  const exported = progress.exportProgress()

  reset()
  assert.equal(progress.getSessionResult('p1', 's1'), undefined, 'store really was cleared')

  const res = progress.importProgress(exported)
  assert.equal(res.ok, true, `import should succeed: ${res.error ?? ''}`)
  assert.equal(progress.getSessionResult('p1', 's1')?.score, 4, 'session survived the round-trip')
  assert.ok(progress.getConceptState('p1', 'c2')?.learnedAt, 'concept survived the round-trip')
})

test('a backup exported before milestones existed still imports', () => {
  // The milestones map was added WITHOUT bumping the store version, precisely
  // so this keeps working: importProgress refuses anything whose version is
  // not 2, and every ledger a learner already exported says 2.
  reset()
  const preFeature = JSON.stringify({
    version: 2,
    sessions: { 'p1::s1': { packId: 'p1', sessionId: 's1', kind: 'quiz', score: 4, maxScore: 5, completedAt: '2026-09-01T00:00:00.000Z' } },
    concepts: {},
    attempts: [],
    daily: { '2026-09-01': 1 },
  })
  const res = progress.importProgress(preFeature)
  assert.equal(res.ok, true, `a pre-milestone backup must import: ${res.error ?? ''}`)
  assert.equal(progress.getSessionResult('p1', 's1')?.score, 4)
  assert.deepEqual(
    progress.earnedMilestones({ halls: [] }),
    [],
    'and starts with an empty wall rather than a crash',
  )
})

test('a plaque is awarded once, recorded, and never awarded again', () => {
  reset()
  const halls = [{ packId: 'p1', title: 'Hall One', sessionIds: ['s1'] }]
  const first = progress.saveSessionResult(result() as never, ['c1'], { halls })
  assert.ok(first.length > 0, 'finishing the only session in a hall should earn something')
  assert.ok(first.some((m) => m.id === 'first-exhibit'), 'including the first exhibit')
  assert.ok(first.some((m) => m.id === 'hall-complete:p1'), 'and the hall being complete')

  const again = progress.saveSessionResult(result({ sessionId: 's2' }) as never, ['c1'], { halls })
  assert.ok(
    !again.some((m) => m.id === 'first-exhibit'),
    'the first exhibit cannot be first a second time',
  )

  // And it is on the wall, with a date, readable later.
  const wall = progress.earnedMilestones({ halls })
  assert.ok(wall.some((row) => row.milestone.id === 'first-exhibit'), 'the plaque is kept')
  assert.match(wall[0].at, /^\d{4}-\d{2}-\d{2}T/, 'and carries when it was earned')
})

test('a plaque survives a reload, because it lives in the store', () => {
  reset()
  const halls = [{ packId: 'p1', title: 'Hall One', sessionIds: ['s1'] }]
  progress.saveSessionResult(result() as never, ['c1'], { halls })
  const exported = progress.exportProgress()
  assert.match(exported, /"milestones"/, 'the ledger carries the wall')

  reset()
  assert.deepEqual(progress.earnedMilestones({ halls }), [], 'cleared')
  progress.importProgress(exported)
  assert.ok(
    progress.earnedMilestones({ halls }).some((r) => r.milestone.id === 'first-exhibit'),
    'and comes back with the ledger',
  )
})

test('a plaque stays on the wall after the thing it records has lapsed', () => {
  // The whole permanence promise, and the one way it was quietly broken: the
  // shelf used to read its inscriptions off the CURRENTLY-satisfied set, so a
  // streak plaque disappeared the day the streak did — and detect() refuses to
  // re-award what is already recorded, so it was gone for good.
  reset()
  const storage = globalThis.localStorage as unknown as Storage
  const day = (back: number): string =>
    new Date(Date.now() - back * 86400000).toISOString().slice(0, 10)

  // Three days running, ending today: streak-3 is live and gets awarded.
  storage.setItem('folio-progress-v2', JSON.stringify({
    version: 2, sessions: {}, concepts: {}, attempts: [],
    daily: { [day(0)]: 1, [day(1)]: 1, [day(2)]: 1 },
  }))
  const earned = progress.recordConceptReview('p1', 'c1', 1)
  assert.ok(earned.some((m) => m.id === 'streak-3'), 'precondition: the streak plaque was earned')

  // Now let it lapse — the same ledger, but the visits are old.
  const lapsed = JSON.parse(progress.exportProgress()) as { daily: Record<string, number> }
  lapsed.daily = { [day(4)]: 1, [day(5)]: 1, [day(6)]: 1 }
  storage.setItem('folio-progress-v2', JSON.stringify(lapsed))

  const wall = progress.earnedMilestones({ halls: [] })
  assert.ok(
    wall.some((row) => row.milestone.id === 'streak-3'),
    'a plaque records what WAS earned; a broken streak cannot unearn it',
  )
  assert.equal(
    wall.find((row) => row.milestone.id === 'streak-3')?.milestone.title,
    'Three nights running',
    'and it still reads correctly',
  )
})

test('a hall that has left the catalog keeps its plaque, named as best it can', () => {
  reset()
  const halls = [{ packId: 'p1', title: 'Hall One', sessionIds: ['s1'] }]
  progress.saveSessionResult(result() as never, [], { halls })
  assert.ok(
    progress.earnedMilestones({ halls }).some((r) => r.milestone.title === 'Hall One — complete'),
  )
  // The pack is gone from the catalog — retired, renamed, whatever. The plaque
  // is not: it falls back to the id rather than vanishing off the wall.
  const orphaned = progress.earnedMilestones({ halls: [] })
  assert.ok(
    orphaned.some((r) => r.milestone.id === 'hall-complete:p1'),
    'an orphaned hall plaque must survive',
  )
})

test('importing rubbish is refused and leaves the store intact', () => {
  reset()
  progress.saveSessionResult(result() as never, [])
  for (const bad of ['not json at all', '{"version":"nope"}', '[]', 'null']) {
    const res = progress.importProgress(bad)
    assert.equal(res.ok, false, `"${bad}" must be refused`)
    assert.ok(res.error, 'a refusal must say why')
  }
  assert.equal(progress.getSessionResult('p1', 's1')?.score, 4, 'existing progress survived')
})

test('a corrupted localStorage blob degrades to empty, not a crash', () => {
  reset()
  store().setItem('folio-progress-v2', '{ this is not json')
  const s = progress.loadProgress()
  assert.equal(s.version, 2, 'a corrupt store must not take the app down')
})

test('a v1 store migrates without losing sessions', () => {
  reset()
  store().setItem(
    'folio-progress-v1',
    JSON.stringify({
      version: 1,
      lastPackId: 'p1',
      sessions: { 'p1::s1': result({ completedAt: '2026-02-02T10:00:00.000Z' }) },
    }),
  )
  const s = progress.loadProgress()
  assert.equal(s.version, 2, 'migrated to v2')
  assert.equal(s.sessions['p1::s1']?.score, 4, 'the v1 session survived migration')
  assert.equal(s.attempts.length, 1, 'history was seeded from completedAt')
  assert.equal(s.daily['2026-02-02'], 1, 'the daily count was seeded on the right day')
})

/* ---------------------------------------------------------------- router --- */

test('parseHash maps every route shape', () => {
  const cases: [string, Record<string, string>][] = [
    ['', { name: 'floor' }],
    ['#/', { name: 'floor' }],
    ['#/halls', { name: 'hub' }],
    ['#/today', { name: 'today' }],
    ['#/report', { name: 'report' }],
    ['#/pack/p1', { name: 'pack', packId: 'p1' }],
    ['#/pack/p1/concept/c1', { name: 'concept', packId: 'p1', conceptId: 'c1' }],
    ['#/pack/p1/session/s1', { name: 'session', packId: 'p1', sessionId: 's1' }],
    ['#/nonsense', { name: 'notfound' }],
  ]
  for (const [hash, expected] of cases) {
    location.hash = hash
    assert.deepEqual(router.parseHash(), expected, `for hash "${hash}"`)
  }
})

test('href and parseHash are inverses', () => {
  const routes = [
    { name: 'hub' },
    { name: 'today' },
    { name: 'floor' },
    { name: 'report' },
    { name: 'pack', packId: 'p1' },
    { name: 'concept', packId: 'p1', conceptId: 'c1' },
    { name: 'session', packId: 'p1', sessionId: 's1' },
  ]
  for (const route of routes) {
    location.hash = router.href(route as never)
    assert.deepEqual(router.parseHash(), route, `round-trip for ${route.name}`)
  }
})

test('navigate changes the route, and onRoute is told', () => {
  location.hash = '#/'
  const seen: string[] = []
  const stop = router.onRoute((r) => seen.push(r.name))
  assert.deepEqual(seen, ['floor'], 'the handler fires immediately with the current route')

  router.navigate({ name: 'pack', packId: 'p1' } as never)
  assert.deepEqual(seen, ['floor', 'pack'], 'and again on navigation')

  stop()
  router.navigate({ name: 'report' } as never)
  assert.deepEqual(seen, ['floor', 'pack'], 'unsubscribing actually stops the handler')
})

/* ------------------------------------------------------------------- dom --- */

test('el builds elements with classes, attributes and children', () => {
  const node = el('div', { class: 'card', 'data-id': '7' }, ['hello'])
  assert.equal(node.className, 'card')
  assert.equal(node.getAttribute('data-id'), '7')
  assert.equal(node.textContent, 'hello')
})

test('el nests element children', () => {
  const child = el('span', {}, ['inner'])
  const parent = el('div', {}, [child])
  assert.equal(parent.textContent, 'inner')
})

test('clear empties a node', () => {
  const node = el('div', {}, ['a', el('b', {}, ['c'])])
  clear(node as never)
  assert.equal(node.textContent, '')
})

test('prettyId turns kebab-case into a title', () => {
  assert.equal(prettyId('relations-functions'), 'Relations Functions')
  assert.equal(prettyId('single'), 'Single')
})

test('importing a structurally wrong backup is refused with a specific reason', () => {
  // Each branch names what is missing. A single generic "invalid backup" would
  // leave someone holding a file they cannot fix.
  reset()
  const base = { version: 2, sessions: {}, concepts: {}, attempts: [], daily: {} }
  const cases: [string, Record<string, unknown>, RegExp][] = [
    ['no sessions', { ...base, sessions: undefined }, /session/i],
    ['sessions is an array', { ...base, sessions: [] }, /session/i],
    ['no concepts', { ...base, concepts: undefined }, /concept/i],
    ['concepts is an array', { ...base, concepts: [] }, /concept/i],
    ['no attempts', { ...base, attempts: undefined }, /attempt/i],
    ['attempts is an object', { ...base, attempts: {} }, /attempt/i],
    ['no daily log', { ...base, daily: undefined }, /daily/i],
    ['wrong version', { ...base, version: 7 }, /version/i],
  ]
  for (const [name, payload, expected] of cases) {
    const res = progress.importProgress(JSON.stringify(payload))
    assert.equal(res.ok, false, `${name} must be refused`)
    assert.match(res.error ?? '', expected, `${name} should say which part is wrong`)
  }
})

test('a structurally valid backup is accepted', () => {
  reset()
  const ok = progress.importProgress(
    JSON.stringify({ version: 2, sessions: {}, concepts: {}, attempts: [], daily: {} }),
  )
  assert.equal(ok.ok, true, `a well-formed empty backup should import: ${ok.error ?? ''}`)
})
