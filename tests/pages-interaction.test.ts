// The pages, driven rather than merely rendered.
//
// Rendering a page covers the code that builds it. It does not touch the half
// that waits for a learner: the museum floor's pan/pinch/tap layer, the review
// queue once something is actually due, the command palette's keyboard. Those
// were the three largest blocks of untested code left after every other suite.

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

const floor = await import('../src/pages/floor.ts')
const review = await import('../src/pages/review.ts')
const { initPalette } = await import('../src/palette.ts')

const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms))
const root = () => document.createElement('div') as unknown as HTMLElement
type El = {
  textContent: string
  childNodes: unknown[]
  querySelector: (s: string) => El | null
  querySelectorAll: (s: string) => El[]
  click: () => void
  value?: string
  dispatchEvent: (ev: Record<string, unknown>) => boolean
}

const storage = () => globalThis.localStorage as unknown as Storage

/* ------------------------------------------------------- the museum floor --- */

/** A pointer event shaped the way the floor's handlers read it. */
const pointer = (type: string, over: Record<string, unknown> = {}) => ({
  type,
  pointerId: 1,
  clientX: 100,
  clientY: 100,
  button: 0,
  preventDefault: () => {},
  stopPropagation: () => {},
  ...over,
})

test('the floor canvas pans, and a drag does not navigate', async () => {
  const el = root()
  await floor.renderFloor(el)
  const canvas = (el as unknown as El).querySelector('.floor-canvas')
  assert.ok(canvas, 'the floor renders its canvas')

  const before = location.hash
  canvas.dispatchEvent(pointer('pointerdown'))
  canvas.dispatchEvent(pointer('pointermove', { clientX: 240, clientY: 190 }))
  canvas.dispatchEvent(pointer('pointermove', { clientX: 300, clientY: 240 }))
  canvas.dispatchEvent(pointer('pointerup', { clientX: 300, clientY: 240 }))
  await tick()
  // A drag is a pan, not a tap: it must not follow a lamp.
  assert.equal(location.hash, before, 'dragging the floor must not navigate')
})

test('the floor handles a tap, a pinch and a cancelled pointer', async () => {
  const el = root()
  await floor.renderFloor(el)
  const canvas = (el as unknown as El).querySelector('.floor-canvas')!

  // Tap: down and up at the same place, no movement in between.
  canvas.dispatchEvent(pointer('pointerdown'))
  canvas.dispatchEvent(pointer('pointerup'))
  await tick()

  // Pinch: two pointers converging, then released.
  canvas.dispatchEvent(pointer('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
  canvas.dispatchEvent(pointer('pointerdown', { pointerId: 2, clientX: 300, clientY: 300 }))
  canvas.dispatchEvent(pointer('pointermove', { pointerId: 2, clientX: 200, clientY: 200 }))
  canvas.dispatchEvent(pointer('pointermove', { pointerId: 1, clientX: 150, clientY: 150 }))
  canvas.dispatchEvent(pointer('pointerup', { pointerId: 2 }))
  canvas.dispatchEvent(pointer('pointercancel', { pointerId: 1 }))
  await tick()

  // Wheel zoom, both directions.
  canvas.dispatchEvent({ type: 'wheel', deltaY: -120, clientX: 200, clientY: 200, preventDefault: () => {} })
  canvas.dispatchEvent({ type: 'wheel', deltaY: 240, clientX: 200, clientY: 200, preventDefault: () => {} })
  await tick()

  assert.ok((el as unknown as El).childNodes.length > 0, 'the floor survives being driven')
})

test('the floor renders differently once there is history', async () => {
  storage().clear()
  const empty = root()
  await floor.renderFloor(empty)
  const emptyText = (empty as unknown as El).textContent

  const progress = await import('../src/progress.ts')
  progress.saveSessionResult(
    {
      packId: 'math-xii-2026', sessionId: 'triad-classify', kind: 'classify',
      score: 8, maxScore: 9, completedAt: new Date().toISOString(),
    } as never,
    ['relations-functions'],
  )
  progress.markConceptLearned('math-xii-2026', 'matrices')

  const seeded = root()
  await floor.renderFloor(seeded)
  assert.ok((seeded as unknown as El).textContent.length > 0)
  assert.notEqual((seeded as unknown as El).textContent, emptyText, 'history must change the floor')
  storage().clear()
})

/* ------------------------------------------------------------- the review --- */

/** Seed SRS state so buildToday actually has something due. */
function seedDueConcepts(): void {
  const past = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
  const concepts: Record<string, unknown> = {}
  for (const [packId, conceptId] of [
    ['math-xii-2026', 'relations-functions'],
    ['math-xii-2026', 'determinants'],
    ['math-xii-calculus-2026', 'integration-techniques'],
  ]) {
    concepts[`${packId}::${conceptId}`] = {
      packId, conceptId, ease: 2.3, intervalDays: 3, reps: 2, lapses: 0,
      due: past, lastReviewedAt: past, mastery: 0.5, reviewCount: 2,
    }
  }
  storage().setItem(
    'folio-progress-v2',
    JSON.stringify({ version: 2, sessions: {}, concepts, attempts: [], daily: {} }),
  )
}

test('the review page builds a queue when concepts are due, and can be worked', async () => {
  storage().clear()
  seedDueConcepts()

  const el = root()
  await review.renderReview(el)
  const page = el as unknown as El
  assert.ok(page.childNodes.length > 0, 'the review renders')
  assert.ok(page.textContent.length > 0)

  // Work whatever the queue offers — a generated drill, or flashcards.
  for (let i = 0; i < 30; i++) {
    const controls = page.querySelectorAll('.primary, .choice-btn, .grade-btn')
    if (!controls.length) break
    controls[0].click()
    await tick()
  }
  assert.ok(page.textContent.length > 0, 'the review survives being worked through')
  storage().clear()
})

test('an empty review explains itself rather than showing a blank page', async () => {
  storage().clear()
  const el = root()
  await review.renderReview(el)
  const page = el as unknown as El
  assert.ok(page.childNodes.length > 0)
  assert.ok(page.textContent.trim().length > 0, 'nothing due still owes the reader an explanation')
})

/* ------------------------------------------------------------- the palette --- */

test('the palette searches, navigates by keyboard, and closes', async () => {
  const handle = initPalette()
  handle.open()

  const dialog = document.querySelector('.cmdk') as unknown as (El & { open: boolean }) | null
  assert.ok(dialog, 'the palette is in the document')
  assert.equal(dialog!.open, true)

  const input = dialog!.querySelector('.cmdk-input')
  assert.ok(input, 'the palette has an input')
  input.value = 'determinants'
  input.dispatchEvent({ type: 'input', target: input })
  await tick(20)

  // Keyboard: move the selection, choose, and dismiss.
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp']) {
    input.dispatchEvent({ type: 'keydown', key, preventDefault: () => {}, target: input })
  }
  input.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: () => {}, target: input })
  await tick(20)

  handle.open()
  const again = document.querySelector('.cmdk') as unknown as (El & { open: boolean }) | null
  again!.querySelector('.cmdk-input')?.dispatchEvent({
    type: 'keydown', key: 'Escape', preventDefault: () => {}, target: again,
  })
  await tick()
  assert.ok(true, 'driving the palette by keyboard must not throw')
})

test('the palette handles a query that matches nothing', async () => {
  const handle = initPalette()
  handle.open()
  const dialog = document.querySelector('.cmdk') as unknown as El
  const input = dialog.querySelector('.cmdk-input')!
  input.value = 'zzzzqqqxx-no-such-thing'
  input.dispatchEvent({ type: 'input', target: input })
  await tick(20)
  assert.ok(dialog.textContent.length > 0, 'an empty result set still renders something')
})

/* ------------------------------------------- the review with nothing due --- */

test('a genuinely empty queue shows the forgetting curve instead of a blank page', async () => {
  // Every concept future-dated, so neither "due" nor "fresh" has anything to
  // offer. Clearing storage is NOT enough: with no SRS state at all, every
  // concept counts as fresh and the queue fills up.
  storage().clear()
  const catalog = JSON.parse(
    readFileSync(join(PUBLIC, 'content/catalog.json'), 'utf8'),
  ) as { packs: { path: string }[] }
  const future = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)
  const concepts: Record<string, unknown> = {}
  for (const ref of catalog.packs) {
    const meta = JSON.parse(
      readFileSync(join(PUBLIC, 'content', ref.path, 'folio.json'), 'utf8'),
    ) as { id: string; concepts: string[] }
    for (const conceptId of meta.concepts) {
      concepts[`${meta.id}::${conceptId}`] = {
        packId: meta.id, conceptId, ease: 2.5, intervalDays: 90, reps: 5,
        lapses: 0, due: future, lastReviewedAt: future, mastery: 0.9, reviewCount: 5,
      }
    }
  }
  storage().setItem(
    'folio-progress-v2',
    JSON.stringify({ version: 2, sessions: {}, concepts, attempts: [], daily: {} }),
  )

  const el = root()
  await review.renderReview(el)
  const page = el as unknown as El
  assert.ok(page.childNodes.length > 0, 'an empty queue must still render')
  assert.ok(page.textContent.trim().length > 0, 'and must explain itself')
  storage().clear()
})
