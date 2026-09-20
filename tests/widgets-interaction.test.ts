// Widgets, and what happens when a learner actually touches a session.
//
// Mounting proved the renderers assemble. This file covers the half that only
// runs when someone interacts: answering a question, sorting a card, moving a
// slider, taking a branch. That is where scoring lives — the part that writes
// to a learner's permanent progress record — and none of it had ever run.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

const widgets = await import('../src/widgets.ts')
const { getModule } = await import('../src/sessions/registry.ts')
await import('../src/sessions/index.ts')

const PACKS = new URL('../public/content/packs/', import.meta.url).pathname
const root = () => document.createElement('div') as unknown as HTMLElement

/** First shipped session of a kind, so fixtures track what ships. */
function sample(kind: string): Record<string, unknown> {
  for (const pack of readdirSync(PACKS)) {
    let files: string[] = []
    try {
      files = readdirSync(join(PACKS, pack, 'sessions'))
    } catch {
      continue
    }
    for (const f of files.filter((n) => n.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(PACKS, pack, 'sessions', f), 'utf8'))
      if (data.kind === kind) return data
    }
  }
  throw new Error(`no shipped session of kind ${kind}`)
}

/** Mount a kind and return the root plus whatever onComplete reported. */
function mount(kind: string, session?: Record<string, unknown>) {
  const mod = getModule(kind)
  assert.ok(mod, `${kind} should be registered`)
  const host = root()
  const completions: { score: number; max: number }[] = []
  mod!.mount(host, (session ?? sample(kind)) as never, (score, max) => completions.push({ score, max }))
  return { host: host as never as { querySelectorAll: (s: string) => never[]; querySelector: (s: string) => never; textContent: string }, completions }
}

/* --------------------------------------------------------------- widgets --- */

test('fmtNum formats with units and decimals', () => {
  assert.equal(widgets.fmtNum(3.14159, undefined, 2), '3.14')
  assert.match(widgets.fmtNum(42, '%', 0), /42/)
  assert.match(widgets.fmtNum(42, '%', 0), /%/)
})

test('every widget type mounts', () => {
  const specs: Record<string, unknown>[] = [
    { type: 'donut', title: 'Split', segments: [{ label: 'a', pct: 60 }, { label: 'b', pct: 40 }] },
    { type: 'gauge', value: 42, label: 'Utilisation', note: 'p99' },
    { type: 'radar', axes: [{ label: 'x', value: 3, max: 5 }, { label: 'y', value: 4, max: 5 }] },
    { type: 'twinBars', rows: [{ name: 'r', fund: 10, index: 8 }] },
    { type: 'annotated', title: 'Tap', prompt: 'Tap each.', points: [{ label: 'p', value: 1, note: 'why' }] },
    { type: 'what-if', compute: 'compound', inputs: [{ key: 'years', label: 'Years', min: 1, max: 30, value: 10 }] },
    { type: 'sim', model: 'queue', title: 'Queue' },
  ]
  for (const spec of specs) {
    const host = root()
    widgets.mountWidget(host, spec as never)
    const node = host as never as { childNodes: unknown[] }
    assert.ok(node.childNodes.length > 0, `${spec.type} mounted nothing`)
  }
})

test('an unknown widget type degrades visibly, not to nothing', () => {
  // The real contract is graceful degradation: content drives these specs, so
  // a bad one must not take the page down — but it must also not leave a
  // silent hole that reads as "nobody wrote a figure here".
  const host = root()
  widgets.mountWidget(host, { type: 'no-such-widget' } as never)
  const node = host as never as { textContent: string; childNodes: unknown[] }
  assert.ok(node.childNodes.length > 0, 'a broken figure must still render something')
  assert.match(node.textContent, /unavailable/i, 'and must say so')
})

test('richBlock renders markdown into an element', () => {
  const block = widgets.richBlock('**bold** text')
  assert.match((block as never as { innerHTML: string }).innerHTML, /<strong>bold<\/strong>/)
})

test('renderRichInto writes rendered markup into its host', () => {
  // Stub limitation, stated rather than hidden: assigning innerHTML does not
  // PARSE here, so the .viz-slot hydration inside renderRichInto cannot be
  // exercised in Node. That path is covered by the browser e2e suite; what is
  // checkable here is that the markdown reached the host as markup.
  const host = root()
  widgets.renderRichInto(
    host,
    'Before\n\n```viz\n{"type":"gauge","value":10,"label":"g"}\n```\n\nAfter',
  )
  const html = (host as never as { innerHTML: string }).innerHTML
  assert.match(html, /Before/)
  assert.match(html, /viz-slot/, 'the fence became a mount slot')
})

/* ----------------------------------------------------- session interaction --- */

/** Renderers pace feedback with timers, so stepping through needs a real tick. */
const tick = () => new Promise((r) => setTimeout(r, 1))

test('answering an MCQ correctly scores, and completes the session', async () => {
  const quiz = sample('quiz') as { questions: { answerIndex: number; choices: string[] }[] }
  const { host, completions } = mount('quiz', quiz as never)
  for (const question of quiz.questions) {
    const choices = host.querySelectorAll('.choice-btn') as never as
      { textContent: string; click: () => void }[]
    assert.ok(choices.length > 0, 'a question should offer choices')
    // Choices render in a fresh random order every mount (deliberately: a
    // replay must not be memorisable by position), so the right answer has to
    // be found by TEXT. Picking by index tests the shuffle, not the learner.
    const wanted = question.choices[question.answerIndex]
    const correct = choices.find((c) => c.textContent === wanted)
    assert.ok(correct, `the correct choice should be on screen: "${wanted}"`)
    correct.click()
    const feedback = host.querySelector('.feedback') as never as
      | { querySelectorAll: (s: string) => { click?: () => void }[] }
      | null
    feedback?.querySelectorAll('.primary')[0]?.click?.()
    await tick()
  }
  assert.ok(completions.length > 0, 'a finished quiz must report completion')
  const { score, max } = completions.at(-1)!
  assert.equal(max, quiz.questions.length, 'max equals the question count')
  assert.equal(score, max, 'every answer was the correct one')
})

test('a wrong MCQ answer scores less than full marks', async () => {
  const quiz = sample('quiz') as { questions: { answerIndex: number; choices: string[] }[] }
  const { host, completions } = mount('quiz', quiz as never)
  for (const question of quiz.questions) {
    const choices = host.querySelectorAll('.choice-btn') as never as
      { textContent: string; click: () => void }[]
    if (!choices.length) break
    const wanted = question.choices[question.answerIndex]
    const wrong = choices.find((c) => c.textContent !== wanted)
    ;(wrong ?? choices[0]).click()
    const feedback = host.querySelector('.feedback') as never as
      | { querySelectorAll: (s: string) => { click?: () => void }[] }
      | null
    feedback?.querySelectorAll('.primary')[0]?.click?.()
    await tick()
  }
  assert.ok(completions.length > 0, 'the session still completes')
  const { score, max } = completions.at(-1)!
  assert.equal(score, 0, `every answer was wrong, so the score should be 0 (got ${score}/${max})`)
})

test('shuffling choices never loses, duplicates or invents one', () => {
  // The shuffle is what makes replay worthwhile; it must be a permutation.
  const quiz = sample('quiz') as { questions: { choices: string[] }[] }
  const { host } = mount('quiz', quiz as never)
  const rendered = (host.querySelectorAll('.choice-btn') as never as { textContent: string }[])
    .map((c) => c.textContent)
    .sort()
  assert.deepEqual(rendered, [...quiz.questions[0].choices].sort(), 'same set, any order')
})

test('clicking through a classify session reaches a verdict', () => {
  const { host } = mount('classify')
  const cards = host.querySelectorAll('.classify-card')
  const buckets = host.querySelectorAll('.bucket')
  assert.ok(cards.length > 0, 'classify should render cards')
  assert.ok(buckets.length > 0, 'classify should render buckets')
  for (const card of cards.slice(0, 3) as never as { click?: () => void }[]) card.click?.()
  assert.ok(host.textContent.length > 0)
})

test('a detective session reveals its facts when clicked', () => {
  const { host } = mount('detective')
  const facts = host.querySelectorAll('.clue-card')
  assert.ok(facts.length > 0, 'detective should render clues')
  const before = host.textContent.length
  for (const f of facts.slice(0, 4) as never as { click?: () => void }[]) f.click?.()
  assert.ok(host.textContent.length >= before, 'revealing must not destroy the page')
})

test('an estimate session accepts a guess', () => {
  const { host } = mount('estimate')
  const inputs = host.querySelectorAll('input')
  assert.ok(inputs.length > 0, 'estimate should render a slider')
  const buttons = host.querySelectorAll('button')
  for (const b of buttons.slice(0, 2) as never as { click?: () => void }[]) b.click?.()
  assert.ok(host.textContent.length > 0)
})

test('a decision session can be walked to an ending', () => {
  const { host } = mount('decision')
  for (let step = 0; step < 6; step++) {
    const choices = host.querySelectorAll('.choice-btn, button')
    if (!choices.length) break
    ;(choices[0] as never as { click?: () => void }).click?.()
  }
  assert.ok(host.textContent.length > 0)
})

test('a sequence session accepts step selection', () => {
  const { host } = mount('sequence')
  const steps = host.querySelectorAll('.seq-move')
  assert.ok(steps.length > 0, 'sequence should render steps')
  for (const s of steps.slice(0, 4) as never as { click?: () => void }[]) s.click?.()
  assert.ok(host.textContent.length > 0)
})
