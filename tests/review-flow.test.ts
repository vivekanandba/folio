// The daily round, actually worked through.
//
// The review page is the one screen a returning learner sees every day, and
// most of it had never run: the summary with a real tally on it, the plaques
// it awards, the announcement it composes, and the "Review interrupted"
// recovery that exists so a mid-queue failure is a sentence rather than an
// unhandled rejection.
//
// Its own file because src/content.ts memoises every fetch for the life of a
// process, so a suite that has already rendered a page cannot make one fail.

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

const review = await import('../src/pages/review.ts')
const a11y = await import('../src/a11y.ts')

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms))
const storage = () => globalThis.localStorage as unknown as Storage
type El = {
  textContent: string
  click: () => void
  getAttribute: (a: string) => string | null
  querySelector: (s: string) => El | null
  querySelectorAll: (s: string) => El[]
}
const root = (): HTMLElement => {
  const node = document.createElement('div')
  document.body.append(node)
  return node as unknown as HTMLElement
}
const node = (host: HTMLElement): El => host as unknown as El

/** Seed enough overdue concepts that a queue exists to work through. */
function seedDue(): void {
  const past = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
  const concepts: Record<string, unknown> = {}
  for (const [packId, conceptId] of [
    ['math-xii-2026', 'relations-functions'],
    ['math-xii-2026', 'determinants'],
    ['math-xii-2026', 'matrices'],
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

test('a round worked to the end tallies what was reviewed, and says so once', async () => {
  storage().clear()
  seedDue()
  const region = document.createElement('div')
  a11y.setLiveRegion(region as unknown as HTMLElement)

  const el = root()
  await review.renderReview(el)
  const page = node(el)

  // Work whatever the queue offers until the summary appears. Reveal, then
  // grade — the flashcard's two steps — and the drill's lock after that.
  for (let i = 0; i < 120; i++) {
    if (page.querySelector('.review-summary')) break
    const control =
      page.querySelectorAll('.grade-btn')[0] ??
      page.querySelectorAll('.primary')[0] ??
      page.querySelectorAll('.choice-btn')[0]
    if (!control) break
    control.click()
    await tick(5)
  }

  const summary = page.querySelector('.review-summary')
  assert.ok(summary, 'working the queue reaches the summary')
  assert.match(summary!.textContent, /Review complete/)

  assert.ok(page.querySelector('.score-hero'), 'the summary carries a tally')
  // Not asserting the tally's TEXT: countUp animates it, and the stub's
  // three-frame budget stops the count part-way, so the rendered digits are
  // mid-animation rather than wrong. What the round actually did is in the
  // store, which is also the thing that matters.
  const { loadProgress } = await import('../src/progress.ts')
  const store = loadProgress()
  const today = new Date().toISOString().slice(0, 10)
  assert.ok((store.daily[today] ?? 0) > 0, 'the round recorded reviews against today')
  assert.ok(store.attempts.length > 0, 'and wrote them to the attempt log')

  // A round that reviewed something IS stamped — the inverse of the empty
  // case covered in review-empty.test.ts.
  assert.ok(page.querySelector('.exhibit-stamp'), 'a cleared round is stamped')

  await tick(60)
  const said = (region as unknown as { textContent: string }).textContent
  assert.match(said, /Review complete/, 'and the whole screen is announced')
  assert.match(said, /Gauntlet cleared/, 'including the stamp, in the one message')
  storage().clear()
})

// NOT tested here: the "Review interrupted" panel in advance()'s catch.
//
// It cannot be reached. runNext()'s only awaited call is deriveFlashcards,
// and that swallows BOTH failure modes itself — a try/catch around the
// concept note, and `.catch(() => null)` on every session load — so a broken
// archive produces a concept with no cards, which the queue skips. Verified
// by breaking fetch entirely mid-round, and again for session URLs only: the
// round carried on and finished, and the panel never rendered.
//
// Left in place as insurance should deriveFlashcards ever stop catching, and
// written down here so the next person measuring coverage knows those lines
// are unreachable by construction rather than merely untested (CON-REP-002).
