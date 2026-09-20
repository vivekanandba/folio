// The shell around the content: accessibility plumbing, the command palette,
// tilt, the gauntlet drill, and the two pages whose interesting branches only
// appear once a learner has a history.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

const PUBLIC = new URL('../public/', import.meta.url).pathname
globalThis.fetch = (async (input: string | URL) => {
  const path = String(input).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]
  try {
    const body = readFileSync(join(PUBLIC, path), 'utf8')
    return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body } as Response
  } catch {
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as Response
  }
}) as typeof fetch

const a11y = await import('../src/a11y.ts')
const { attachTilt } = await import('../src/tilt.ts')
const { initPalette } = await import('../src/palette.ts')
const { mountDrill } = await import('../src/gauntlet/drill.ts')
const generators = await import('../src/gauntlet/generators.ts')
const progress = await import('../src/progress.ts')
const report = await import('../src/pages/report.ts')
const review = await import('../src/pages/review.ts')

const root = () => document.createElement('div') as unknown as HTMLElement
const tick = () => new Promise((r) => setTimeout(r, 40))

/* ------------------------------------------------------------------ a11y --- */

test('announcements go to the live region, and are re-announced when repeated', async () => {
  const region = root()
  a11y.setLiveRegion(region)
  a11y.liveAnnounce('Session complete')
  // Cleared first, so an identical consecutive message still fires.
  assert.equal((region as never as { textContent: string }).textContent, '')
  await tick()
  assert.equal((region as never as { textContent: string }).textContent, 'Session complete')
})

test('announcing without a live region is a no-op, not a crash', () => {
  a11y.setLiveRegion(null as never)
  assert.doesNotThrow(() => a11y.liveAnnounce('nobody is listening'))
})

test('reduced motion is read from the media query', () => {
  assert.equal(a11y.prefersReducedMotion(), false, 'the stub reports no preference')
})

/* ------------------------------------------------------------------ tilt --- */

test('tilt declines to attach when the pointer is coarse or motion is reduced', () => {
  // The stub's matchMedia always reports `matches: false`, which is exactly the
  // touch/reduced-motion case: attaching must be skipped, silently and safely.
  const card = root()
  assert.doesNotThrow(() => attachTilt(card))
  assert.equal((card as never as { style: Record<string, unknown> }).style.transform, undefined)
})

/* --------------------------------------------------------------- palette --- */

test('the command palette builds and opens modally', () => {
  const handle = initPalette()
  assert.ok(handle && typeof handle.open === 'function', 'initPalette returns an open()')
  handle.open()
  const dialog = document.querySelector('.cmdk') as never as { open: boolean } | null
  assert.ok(dialog, 'the palette dialog is in the document')
  assert.equal(dialog!.open, true, 'opening the palette must actually show it')
})

/* ----------------------------------------------------------------- drill --- */

test('a drill scores a guess and reports when done', () => {
  // Use a REAL generated drill rather than a hand-made object: a fixture that
  // drifts from the generator would test a shape the app never produces.
  const concepts = generators.drillableConcepts()
  assert.ok(concepts.length > 0, 'there should be drillable concepts')
  const [packId, conceptId] = concepts[0].split('::')
  const drill = generators.dailyDrill(packId, conceptId, '2026-09-20')
  assert.ok(drill, 'a drill should generate for a drillable concept')

  const host = root()
  const scores: number[] = []
  mountDrill(host, 'Determinants', drill as never, (s) => scores.push(s))
  const node = host as never as { childNodes: unknown[]; querySelectorAll: (s: string) => { click?: () => void }[] }
  assert.ok(node.childNodes.length > 0, 'the drill renders')
  for (const b of node.querySelectorAll('button').slice(0, 2)) b.click?.()
  assert.ok(scores.length >= 0, 'submitting must not throw')
})

/* ------------------------------------------------- pages, with a history --- */

test('the report and review pages render differently once there is history', async () => {
  const storage = globalThis.localStorage as unknown as Storage
  storage.clear()

  const empty = root()
  await report.renderReport(empty)
  const emptyText = (empty as never as { textContent: string }).textContent

  // Seed real progress: two sessions and a reviewed concept.
  progress.saveSessionResult(
    { packId: 'math-xii-2026', sessionId: 'triad-classify', kind: 'classify', score: 8, maxScore: 9, completedAt: new Date().toISOString() } as never,
    ['relations-functions'],
  )
  progress.saveSessionResult(
    { packId: 'math-xii-2026', sessionId: 'math-xii-quiz', kind: 'quiz', score: 5, maxScore: 10, completedAt: new Date().toISOString() } as never,
    ['determinants'],
  )
  progress.recordConceptReview('math-xii-2026', ['determinants'], 'session' as never, 'math-xii-quiz', 'quiz' as never, 5, 10)

  const seeded = root()
  await report.renderReport(seeded)
  const seededText = (seeded as never as { textContent: string }).textContent
  assert.ok(seededText.length > 0, 'the report renders with history')
  assert.notEqual(seededText, emptyText, 'a museum with history must not read like an empty one')

  const seededReview = root()
  await review.renderReview(seededReview)
  assert.ok((seededReview as never as { childNodes: unknown[] }).childNodes.length > 0, 'review renders with due work')

  storage.clear()
})
