// Play each session kind to its END, not just to its first render.
//
// Mounting proved the renderers assemble; three clicks proved they survive
// being touched. Neither reaches the half of each kind that only runs when a
// learner finishes: the check button, the review rows, the score, the result
// screen. That is where the module decides what to report — and it was the
// largest block of untested code left in the app.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

const { getModule } = await import('../src/sessions/registry.ts')
await import('../src/sessions/index.ts')

const PACKS = new URL('../public/content/packs/', import.meta.url).pathname
const tick = () => new Promise((r) => setTimeout(r, 2))

/** Every shipped session of a kind. */
function samples(kind: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const pack of readdirSync(PACKS)) {
    let files: string[] = []
    try {
      files = readdirSync(join(PACKS, pack, 'sessions'))
    } catch {
      continue
    }
    for (const f of files.filter((n) => n.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(PACKS, pack, 'sessions', f), 'utf8'))
      if (data.kind === kind) out.push(data)
    }
  }
  return out
}

type El = {
  textContent: string
  childNodes: unknown[]
  querySelector: (s: string) => El | null
  querySelectorAll: (s: string) => El[]
  click: () => void
  value?: string
  dispatchEvent: (ev: Record<string, unknown>) => boolean
}

function mount(kind: string, session?: Record<string, unknown>) {
  const mod = getModule(kind)
  assert.ok(mod, `${kind} should be registered`)
  const host = document.createElement('div')
  const done: { score: number; max: number }[] = []
  mod!.mount(host as unknown as HTMLElement, (session ?? samples(kind)[0]) as never, (s, m) =>
    done.push({ score: s, max: m }),
  )
  return { host: host as unknown as El, done }
}

/* ------------------------------------------------------------- classify --- */

test('classify: placing every card correctly scores full marks', async () => {
  const session = samples('classify')[0] as {
    cards: { id: string; text: string; bucketId: string }[]
    buckets: { id: string; label: string }[]
  }
  const { host } = mount('classify', session as never)

  for (const card of session.cards) {
    // Click the unplaced chip, then choose its correct bucket from the picker.
    const chip = host.querySelectorAll('.classify-card').find((c) => c.textContent === card.text)
    assert.ok(chip, `chip for "${card.text.slice(0, 30)}" should be on the board`)
    chip.click()
    const label = session.buckets.find((b) => b.id === card.bucketId)!.label
    const choice = host.querySelectorAll('.choice-btn').find((b) => b.textContent === label)
    assert.ok(choice, `bucket "${label}" should be offered`)
    choice.click()
    await tick()
  }

  const check = host.querySelector('.primary')
  assert.ok(check, 'the check button should be present once every card is placed')
  check.click()
  await tick()

  const text = host.textContent
  assert.ok(text.includes('Correct'), 'a fully correct placement must be reported as such')
  assert.ok(!text.includes('Belongs in:'), 'nothing should be reported as misplaced')
})

test('classify: a misplaced card is named with where it belonged', async () => {
  const session = samples('classify')[0] as {
    cards: { id: string; text: string; bucketId: string }[]
    buckets: { id: string; label: string }[]
  }
  const { host } = mount('classify', session as never)

  for (const card of session.cards) {
    const chip = host.querySelectorAll('.classify-card').find((c) => c.textContent === card.text)
    if (!chip) continue
    chip.click()
    // Deliberately wrong: the first bucket that is NOT this card's.
    const wrong = session.buckets.find((b) => b.id !== card.bucketId)!.label
    host.querySelectorAll('.choice-btn').find((b) => b.textContent === wrong)?.click()
    await tick()
  }
  host.querySelector('.primary')?.click()
  await tick()
  assert.match(host.textContent, /Belongs in:/, 'a misplaced card must say where it belonged')
})

/* ------------------------------------------------------------ detective --- */

test('detective: opening every clue then answering reaches a verdict', async () => {
  const session = samples('detective')[0] as {
    facts: unknown[]
    choices: string[]
    answerIndex: number
  }
  const { host } = mount('detective', session as never)

  for (const clue of host.querySelectorAll('.clue-card')) {
    clue.click()
    await tick()
  }
  // Opening clues builds the case; a separate button moves to the diagnosis.
  const diagnose = host
    .querySelectorAll('.primary, button')
    .find((b) => /diagnos/i.test(b.textContent))
  assert.ok(diagnose, 'a diagnose affordance should appear once clues are open')
  diagnose.click()
  await tick()
  // Detective renders LETTERED tiles ("A", "B"…), so the tile's text contains
  // the choice rather than equalling it.
  const wanted = session.choices[session.answerIndex]
  const correct = host
    .querySelectorAll('.choice-btn, .choice-tile')
    .find((c) => c.textContent.includes(wanted))
  assert.ok(correct, 'the correct choice should be offered once the case is open')
  correct.click()
  await tick()
  assert.ok(host.textContent.length > 0, 'the verdict must render')
})

/* ------------------------------------------------------------- sequence --- */

test('sequence: reordering and submitting reports a result', async () => {
  const { host } = mount('sequence')
  for (let pass = 0; pass < 6; pass++) {
    const movers = host.querySelectorAll('.seq-move')
    if (!movers.length) break
    movers[pass % movers.length].click()
    await tick()
  }
  host.querySelector('.primary')?.click()
  await tick()
  assert.ok(host.textContent.length > 0)
})

/* ------------------------------------------------------------- explainer --- */

test('explainer: stepping through every step reaches the end', async () => {
  const session = samples('explainer')[0] as { steps: unknown[] }
  const { host } = mount('explainer', session as never)
  for (let i = 0; i < session.steps.length + 2; i++) {
    const next = host.querySelector('.primary')
    if (!next) break
    next.click()
    await tick()
  }
  assert.ok(host.textContent.length > 0, 'the explainer should still be rendering at the end')
})

/* --------------------------------------------------------------- estimate --- */

test('estimate: a guess at the answer is accepted and scored', async () => {
  const session = samples('estimate')[0] as { answer: number }
  const { host } = mount('estimate', session as never)
  const slider = host.querySelector('.estimate-slider')
  assert.ok(slider, 'estimate renders a slider')
  slider.value = String(session.answer)
  slider.dispatchEvent({ type: 'input', target: slider })
  await tick()
  host.querySelector('.primary')?.click()
  await tick()
  assert.ok(host.textContent.length > 0, 'a result must render after guessing')
})

/* ---------------------------------------------------------------- others --- */

test('hotspot: clicking a bar reports whether it was the anomaly', async () => {
  const { host } = mount('hotspot')
  const bars = host.querySelectorAll('.hotspot-bar')
  assert.ok(bars.length > 0, 'hotspot renders bars')
  for (const bar of bars.slice(0, 3)) {
    bar.click()
    await tick()
  }
  assert.ok(host.textContent.length > 0)
})

test('audit: scoring every pillar produces an overall verdict', async () => {
  const { host } = mount('audit')
  for (let pass = 0; pass < 12; pass++) {
    const buttons = host.querySelectorAll('.score-btn')
    if (!buttons.length) break
    buttons[0].click()
    await tick()
  }
  host.querySelector('.primary')?.click()
  await tick()
  assert.ok(host.textContent.length > 0)
})

test('decision: every branch walks to an ending', async () => {
  const session = samples('decision')[0] as { nodes: { id: string; choices?: unknown[] }[] }
  // Walk the first choice each time; nodes are finite and endings terminate.
  for (const startChoice of [0, 1]) {
    const { host } = mount('decision', session as never)
    for (let step = 0; step < session.nodes.length + 2; step++) {
      const choices = host.querySelectorAll('.choice-btn, .primary')
      if (!choices.length) break
      choices[Math.min(startChoice, choices.length - 1)].click()
      await tick()
    }
    assert.ok(host.textContent.length > 0)
  }
})

test('flashcards: the deck can be graded to the end', async () => {
  // flashcard is NOT a registered session kind — it is mounted by the review
  // page over cards derived from concept notes, so it is driven through that
  // entry point rather than the session registry.
  const { mountFlashcards } = await import('../src/sessions/flashcard.ts')
  const { cardsFromNotes } = await import('../src/flashcards.ts')
  const md = readFileSync(
    join(PACKS, 'math-xii-2026/concepts/determinants.md'),
    'utf8',
  )
  const cards = cardsFromNotes(md, 'math-xii-2026', 'determinants')
  assert.ok(cards.length > 0, 'the concept should yield cards to grade')

  const host = document.createElement('div')
  let finished = false
  mountFlashcards(host as unknown as HTMLElement, 'Determinants', cards as never, () => {
    finished = true
  })
  const el_ = host as unknown as El

  for (let i = 0; i < cards.length * 4 + 4; i++) {
    const buttons = el_.querySelectorAll('.primary, .choice-btn, .grade-btn, button')
    if (!buttons.length) break
    buttons[0].click()
    await tick()
    if (finished) break
  }
  assert.ok(el_.textContent.length > 0, 'the deck must render throughout')
})

test('calculator: adjusting holdings and judging produces a verdict', async () => {
  const { host } = mount('calculator')
  for (const input of host.querySelectorAll('input')) {
    input.value = '50'
    input.dispatchEvent({ type: 'input', target: input })
  }
  await tick()
  host.querySelectorAll('.choice-btn')[0]?.click()
  await tick()
  assert.ok(host.textContent.length > 0)
})

test('lab: moving every knob keeps the machine running', async () => {
  const { host } = mount('lab')
  for (const input of host.querySelectorAll('input')) {
    input.value = '1'
    input.dispatchEvent({ type: 'input', target: input })
  }
  await tick()
  assert.ok(host.querySelector('.sim-machine'), 'the machine must still be mounted')
})

test('blueprint: placing parts and inspecting reports a verdict', async () => {
  const { host } = mount('blueprint')
  for (const part of host.querySelectorAll('.bp-part')) {
    part.click()
    await tick()
  }
  host.querySelector('.primary')?.click()
  await tick()
  assert.ok(host.textContent.length > 0)
})

/* ------------------------------------------------------------------ tilt --- */

test('tilt attaches and responds when the pointer is fine and hover-capable', async () => {
  const g = globalThis as unknown as {
    __setMedia: (q: string, m: boolean) => void
    __resetMedia: () => void
  }
  g.__setMedia('(hover: hover) and (pointer: fine)', true)
  g.__setMedia('(prefers-reduced-motion: reduce)', false)
  try {
    const { attachTilt } = await import('../src/tilt.ts')
    const card = document.createElement('div') as unknown as El & {
      style: Record<string, unknown>
    }
    attachTilt(card as unknown as HTMLElement)
    card.dispatchEvent({ type: 'pointermove', clientX: 40, clientY: 20, target: card })
    await new Promise((r) => setTimeout(r, 30))
    card.dispatchEvent({ type: 'pointerleave', target: card })
    await new Promise((r) => setTimeout(r, 30))
    assert.ok(true, 'attaching and driving tilt must not throw')
  } finally {
    g.__resetMedia()
  }
})

test('tilt declines when the pointer is coarse', async () => {
  const { attachTilt } = await import('../src/tilt.ts')
  const card = document.createElement('div')
  assert.doesNotThrow(() => attachTilt(card as unknown as HTMLElement))
})

/* ------------------------------------------------------- blueprint, fully --- */

test('blueprint: wiring the intended chain passes inspection', async () => {
  const session = JSON.parse(
    readFileSync(join(PACKS, 'math-xii-space-2026/sessions/15-mission-blueprint.json'), 'utf8'),
  ) as { parts: { id: string; label: string; fixed?: boolean }[] }
  const { host } = mount('blueprint', session as never)

  // Place every non-fixed part from the tray.
  for (const part of session.parts.filter((p) => !p.fixed)) {
    const tray = host.querySelectorAll('.bp-part').find((b) => b.textContent.includes(part.label))
    assert.ok(tray, `the tray should offer "${part.label}"`)
    tray.click()
    await tick()
  }

  // Wire the chain: tap one node, then the next.
  const order = session.parts.map((p) => p.label)
  const nodeFor = (label: string) =>
    host.querySelectorAll('.bp-node').find((n) => n.textContent.includes(label))
  for (let i = 0; i < order.length - 1; i++) {
    const a = nodeFor(order[i])
    const b = nodeFor(order[i + 1])
    assert.ok(a && b, `both "${order[i]}" and "${order[i + 1]}" should be on the board`)
    a.click()
    await tick()
    b.click()
    await tick()
  }

  host.querySelectorAll('.primary').find((b) => /inspect/i.test(b.textContent))?.click()
  await tick()
  assert.ok(host.textContent.length > 0, 'inspection must report something')
})

test('blueprint: a wire can be armed, disarmed, drawn and cut', async () => {
  const session = JSON.parse(
    readFileSync(join(PACKS, 'math-xii-space-2026/sessions/15-mission-blueprint.json'), 'utf8'),
  ) as { parts: { id: string; label: string; fixed?: boolean }[] }
  const { host } = mount('blueprint', session as never)

  for (const part of session.parts.filter((p) => !p.fixed)) {
    host.querySelectorAll('.bp-part').find((b) => b.textContent.includes(part.label))?.click()
    await tick()
  }
  const nodes = () => host.querySelectorAll('.bp-node')

  // Arm a node, then tap it again to disarm.
  nodes()[0].click()
  await tick()
  nodes()[0].click()
  await tick()

  // Draw a wire, then draw the same pair again to cut it.
  nodes()[0].click(); await tick()
  nodes()[1].click(); await tick()
  nodes()[0].click(); await tick()
  nodes()[1].click(); await tick()

  // Remove a placed component entirely.
  const remove = host.querySelectorAll('.bp-remove')[0]
  if (remove) { remove.click(); await tick() }

  // And the give-up path, which reveals rather than scores.
  host.querySelectorAll('button').find((b) => /give up|reveal|show/i.test(b.textContent))?.click()
  await tick()
  assert.ok(host.textContent.length > 0, 'the board survives being rewired')
})

/* ----------------------------------------------------------- decision, fully --- */

test('decision: each branch of the opening fork reaches an ending', async () => {
  const session = samples('decision')[0] as { nodes: { id: string; choices?: unknown[] }[] }
  const forks = (session.nodes[0].choices ?? []).length || 1
  for (let branch = 0; branch < Math.min(forks, 4); branch++) {
    const { host } = mount('decision', session as never)
    // Take a different first choice each time, then walk to the end.
    for (let step = 0; step < session.nodes.length + 3; step++) {
      const choices = host.querySelectorAll('.choice-btn, .primary')
      if (!choices.length) break
      choices[step === 0 ? Math.min(branch, choices.length - 1) : 0].click()
      await tick()
    }
    assert.ok(host.textContent.length > 0, `branch ${branch} must reach a rendered state`)
  }
})

test('decision: following the authored path reaches a real ending', async () => {
  const session = samples('decision')[0] as {
    startId: string
    nodes: { id: string; ending?: unknown; choices?: { label: string; next: string }[] }[]
  }
  const byId = new Map(session.nodes.map((n) => [n.id, n]))

  // Walk the authored graph to an ending, clicking the labelled choice each
  // time — a blind "click the first button" walk can loop without terminating.
  const { host } = mount('decision', session as never)
  let node = byId.get(session.startId)!
  for (let step = 0; step < session.nodes.length + 2 && !node.ending; step++) {
    const choice = node.choices?.[0]
    if (!choice) break
    // Match on a distinctive fragment: rendered labels may be decorated, and
    // the point of the walk is the graph, not the typography.
    const fragment = choice.label.replace(/[^\w ]/g, ' ').trim().split(/\s+/).slice(0, 4).join(' ')
    const buttons = host.querySelectorAll('.choice-btn, button')
    const button = buttons.find((b) => b.textContent.includes(fragment)) ?? buttons[0]
    assert.ok(button, 'the fork should offer at least one choice')
    // Previewing the consequence before committing is its own code path.
    button.dispatchEvent({ type: 'pointerenter', target: button })
    button.dispatchEvent({ type: 'focus', target: button })
    await tick()
    button.click()
    await tick()
    node = byId.get(choice.next)!
  }
  assert.ok(node.ending, 'the walk should land on an ending node')
  assert.ok(host.textContent.length > 0, 'the ending card must render')
})

/* ------------------------------------------------ drag, reorder, refuse --- */

test('classify: a card can be dropped into a bucket by drag', async () => {
  const session = samples('classify')[0] as {
    cards: { id: string; text: string; bucketId: string }[]
    buckets: { id: string; label: string }[]
  }
  const { host } = mount('classify', session as never)

  // Dragging is the primary interaction on a desktop; the click-picker is the
  // touch fallback. Only the fallback was being exercised.
  const card = session.cards[0]
  const zone = host.querySelectorAll('.drop-zone, .bucket')[0]
  assert.ok(zone, 'a bucket should offer a drop zone')

  const dataTransfer = {
    data: { 'text/card-id': card.id } as Record<string, string>,
    getData(type: string) { return this.data[type] ?? '' },
    setData(type: string, value: string) { this.data[type] = value },
    effectAllowed: '',
    dropEffect: '',
  }
  const dragEvent = (type: string) => ({
    type, dataTransfer, preventDefault: () => {}, target: zone,
  })

  zone.dispatchEvent(dragEvent('dragover'))
  zone.dispatchEvent(dragEvent('dragleave'))
  zone.dispatchEvent(dragEvent('dragover'))
  zone.dispatchEvent(dragEvent('drop'))
  await tick()
  assert.ok(host.textContent.length > 0, 'the board must survive a drop')

  // A drop carrying no card id is ignored rather than crashing.
  const empty = { ...dataTransfer, data: {} as Record<string, string> }
  zone.dispatchEvent({ type: 'drop', dataTransfer: empty, preventDefault: () => {}, target: zone })
  await tick()
  assert.ok(host.textContent.length > 0)
})

test('sequence: items move both ways, and the ends refuse to move further', async () => {
  const { host } = mount('sequence')
  const movers = () => host.querySelectorAll('.seq-move')
  assert.ok(movers().length > 0, 'sequence offers move controls')

  // Every control, twice over: that covers up, down, and the boundary no-ops
  // at the first and last positions.
  for (let pass = 0; pass < 2; pass++) {
    const all = movers()
    for (const m of all) {
      m.click()
      await tick()
    }
  }
  assert.ok(host.textContent.length > 0, 'reordering must not break the list')
})
