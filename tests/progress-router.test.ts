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
  progress.recordConceptReview('p1', ['c1'], 'session' as never, 's1', 'quiz' as never, 1, 1)
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
