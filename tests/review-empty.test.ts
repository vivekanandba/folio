// A review round where every concept was skipped.
//
// This lives in its own file on purpose. src/content.ts memoises every fetch
// for the life of the process, so a suite that has already rendered a page has
// the concept markdown cached and a 404 stub installed later never gets asked.
// The first attempt at this test did exactly that, reached a working queue
// instead of the summary, and passed against the bug it was written to catch.
// A fresh process is the only way the stub is the first thing to answer.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

const PUBLIC = new URL('../public/', import.meta.url).pathname

// Catalog and pack metadata load normally; a concept's own material does not.
// Both sources have to go — deriveFlashcards builds cards from the markdown
// AND from the quiz questions in the pack's sessions.
globalThis.fetch = (async (input: string | URL) => {
  const url = String(input)
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]
  if (path.includes('/concepts/') || path.includes('/sessions/')) {
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as Response
  }
  try {
    const body = readFileSync(join(PUBLIC, path), 'utf8')
    return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body } as Response
  } catch {
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as Response
  }
}) as typeof fetch

const review = await import('../src/pages/review.ts')
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms))
const storage = () => globalThis.localStorage as unknown as Storage

test('a round where every concept was skipped is not celebrated', async () => {
  // runNext() skips any queued concept with no flashcards and no drill, then
  // falls through to the summary. "0 concepts reviewed" is not an achievement:
  // sounding the completion chord and a five-beat haptic over it would reward
  // a round that never happened (CON-DATA-001 — praise tracks what was done).
  storage().clear()

  const past = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
  const concepts: Record<string, unknown> = {}
  for (const [packId, conceptId] of [
    ['math-xii-2026', 'relations-functions'],
    ['math-xii-2026', 'determinants'],
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

  const g = globalThis as unknown as { __audioLog: unknown[]; __resetAudio: () => void }
  g.__resetAudio()

  const root = document.createElement('div') as unknown as HTMLElement
  await review.renderReview(root)
  await tick()
  const node = root as unknown as {
    textContent: string
    querySelector: (s: string) => { textContent: string } | null
  }

  // Prove we reached the summary before concluding anything from the silence.
  assert.match(node.textContent, /Review complete/, 'the summary should have been reached')
  assert.equal(
    node.querySelector('.score-hero')?.textContent,
    '0',
    'and should report that nothing was reviewed',
  )
  assert.deepEqual(g.__audioLog, [], 'a round that reviewed nothing must not play the completion chord')
  // The stamp is the loudest claim on the card. Suppressing only the chord
  // would leave the page saying "Gauntlet cleared" over "0 concepts reviewed".
  assert.equal(
    node.querySelector('.exhibit-stamp'),
    null,
    'a round that cleared nothing must not be stamped "Gauntlet cleared"',
  )

  // And it is SPOKEN, once. a11y.ts holds one message at a time and refills
  // it on a timer, so two announcements in the same synchronous pass leave
  // only the second — an empty round that also earned a plaque used to lose
  // this sentence to the plaque's.
  const a11y = await import('../src/a11y.ts')
  const region = document.createElement('div')
  a11y.setLiveRegion(region as unknown as HTMLElement)
  const again = document.createElement('div') as unknown as HTMLElement
  await review.renderReview(again)
  await tick()
  const said = (region as unknown as { textContent: string }).textContent
  assert.match(said, /Review complete/, 'the round announces itself')
  assert.match(said, /Nothing was due/, 'and says why it was empty, in the same message')

  storage().clear()
})
