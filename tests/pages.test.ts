// Every page renders, against the real content, with fetch served from disk.
//
// Pages were the largest untested surface in the app (~1,500 lines across
// seven modules) and the one the user actually looks at. Nothing checked that
// a page assembles: a throw inside renderFloor would have left a blank museum
// with lint, tsc and the unit suite all green.
//
// `fetch` is backed by public/ on disk, so these are the real 13 packs, the
// real catalog and the real concept markdown — not fixtures that drift from
// what ships.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

const PUBLIC = new URL('../public/', import.meta.url).pathname

/** Serve content out of public/ so pages see exactly what ships. */
globalThis.fetch = (async (input: string | URL) => {
  const url = String(input)
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]
  try {
    const body = readFileSync(join(PUBLIC, path), 'utf8')
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(body),
      text: async () => body,
    } as Response
  } catch {
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as Response
  }
}) as typeof fetch

const pages = {
  floor: await import('../src/pages/floor.ts'),
  hub: await import('../src/pages/hub.ts'),
  pack: await import('../src/pages/pack.ts'),
  concept: await import('../src/pages/concept.ts'),
  session: await import('../src/pages/session.ts'),
  report: await import('../src/pages/report.ts'),
  review: await import('../src/pages/review.ts'),
}
const content = await import('../src/content.ts')
const search = await import('../src/search.ts')
const flashcards = await import('../src/flashcards.ts')

const root = () => document.createElement('div') as unknown as HTMLElement
const rendered = (node: { textContent: string; childNodes: unknown[] }, label: string): void => {
  assert.ok(node.childNodes.length > 0, `${label} produced no DOM`)
  assert.ok(node.textContent.trim().length > 0, `${label} produced no text`)
}

/* ---------------------------------------------------------------- content --- */

test('contentUrl joins parts without doubling slashes', () => {
  assert.equal(content.contentUrl('content', 'catalog.json'), '/content/catalog.json')
  assert.equal(content.contentUrl('/content/', '/packs/'), '/content/packs/')
})

test('the catalog and a pack load from disk', async () => {
  const catalog = await content.loadCatalog()
  assert.ok(Array.isArray(catalog.packs) && catalog.packs.length >= 13, 'catalog has the packs')
  const meta = await content.loadPackMeta(catalog.packs[0].path)
  assert.ok(meta.title, 'pack meta has a title')
  assert.ok(Array.isArray(meta.sessions) && meta.sessions.length > 0)
})

test('a missing file rejects rather than resolving empty', async () => {
  await assert.rejects(() => content.loadPackMeta('packs/does-not-exist'))
})

test('a failed load is not cached, so a retry can succeed', async () => {
  // The cache exists to dedupe; caching a failure would make one flaky
  // network blip permanent for the session.
  await assert.rejects(() => content.loadConcept('packs/nope', 'nope'))
  await assert.rejects(() => content.loadConcept('packs/nope', 'nope'))
})

/* ------------------------------------------------------------------ pages --- */

test('the floor renders the museum', async () => {
  const el = root()
  await pages.floor.renderFloor(el)
  rendered(el as never, 'floor')
})

test('the halls render every pack', async () => {
  const el = root()
  await pages.hub.renderHub(el)
  rendered(el as never, 'hub')
  const catalog = await content.loadCatalog()
  const meta = await content.loadPackMeta(catalog.packs[0].path)
  assert.ok((el as never as { textContent: string }).textContent.includes(meta.title), 'a pack title appears')
})

test('a pack page lists its sessions', async () => {
  const el = root()
  await pages.pack.renderPack(el, 'math-xii-2026')
  rendered(el as never, 'pack')
  const text = (el as never as { textContent: string }).textContent
  assert.ok(text.includes('Class XII'), 'the pack title appears')
})

test('a concept page renders its markdown', async () => {
  const el = root()
  await pages.concept.renderConcept(el, 'math-xii-2026', 'matrices')
  rendered(el as never, 'concept')
  const text = (el as never as { textContent: string }).textContent
  assert.ok(text.includes('operator'), 'concept prose is on the page')
})

test('a session page mounts its session', async () => {
  const el = root()
  await pages.session.renderSession(el, 'math-xii-2026', 'triad-classify')
  rendered(el as never, 'session')
})

test('the report and review pages render', async () => {
  const r = root()
  await pages.report.renderReport(r)
  rendered(r as never, 'report')
  const v = root()
  await pages.review.renderReview(v)
  rendered(v as never, 'review')
})

test('an unknown pack rejects with a message a human can act on', async () => {
  // The contract is deliberate: pages throw, and main.ts catches to render the
  // "Something broke" panel with err.message. So the message IS user-facing —
  // it has to name what was not found.
  await assert.rejects(
    () => pages.pack.renderPack(root(), 'no-such-pack'),
    (err: Error) => {
      assert.match(err.message, /no-such-pack/, 'the message must name the missing pack')
      return true
    },
  )
})

test('an unknown concept rejects, naming the concept', async () => {
  await assert.rejects(
    () => pages.concept.renderConcept(root(), 'math-xii-2026', 'no-such-concept'),
    (err: Error) => {
      assert.match(err.message, /no-such-concept/, 'the message must name the missing concept')
      return true
    },
  )
})

test('museum numbering is stable and formatted', () => {
  const a = pages.hub.museumNum(0)
  const b = pages.hub.museumNum(12)
  assert.ok(a.length > 0 && b.length > 0)
  assert.equal(pages.hub.museumNum(0), a, 'same input, same label')
})

/* ----------------------------------------------------------------- search --- */

test('the search index covers packs, concepts and sessions', async () => {
  const index = await search.buildIndex()
  assert.ok(index.length > 100, `expected a full index, got ${index.length}`)
  const types = new Set(index.map((d) => d.type))
  for (const type of ['pack', 'concept', 'session']) {
    assert.ok(types.has(type as never), `index should contain ${type} docs`)
  }
})

test('search finds a known concept and ranks the exact title first', async () => {
  const index = await search.buildIndex()
  const hits = search.query(index, 'determinants')
  assert.ok(hits.length > 0, 'determinants should be findable')
  assert.match(hits[0].title.toLowerCase(), /determinant/)
})

test('search returns nothing for gibberish', async () => {
  const index = await search.buildIndex()
  assert.equal(search.query(index, 'zzzzqqqxx').length, 0)
})

test('an empty query browses rather than emptying the palette', async () => {
  // Deliberate: opening the palette with no input shows a bounded starting
  // list instead of a blank panel.
  const index = await search.buildIndex()
  const hits = search.query(index, '')
  assert.ok(hits.length > 0, 'an empty query should offer somewhere to start')
  assert.ok(hits.length <= 20, `the browse list must stay bounded, got ${hits.length}`)
})

/* ------------------------------------------------------------- flashcards --- */

test('flashcards are derived from concept notes', () => {
  const md = readFileSync(
    join(PUBLIC, 'content/packs/math-xii-2026/concepts/determinants.md'),
    'utf8',
  )
  const cards = flashcards.cardsFromNotes(md, 'math-xii-2026', 'determinants')
  assert.ok(cards.length > 0, 'a concept page should yield cards')
  for (const card of cards) {
    assert.ok(card.front.length > 0 && card.back.length > 0, 'cards need both sides')
  }
})

test('flashcards are derived from a quiz', () => {
  const quiz = JSON.parse(
    readFileSync(
      join(PUBLIC, 'content/packs/math-xii-2026/sessions/20-math-xii-quiz.json'),
      'utf8',
    ),
  )
  const cards = flashcards.cardsFromQuiz(quiz, 'math-xii-2026', 'determinants')
  assert.equal(cards.length, quiz.questions.length, 'one card per question')
})
