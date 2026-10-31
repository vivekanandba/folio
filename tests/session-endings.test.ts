// How sessions END, and the machine room's controls.
//
// Every session kind has a terminal state — the screen that tells a learner
// what they scored and writes it to their permanent record — and several of
// those screens had never been rendered by any test. `decision`'s ending node
// is the clearest case: the entire result card, the debrief, the burst and
// the onComplete call sat behind a walk through an authored graph that
// nothing ever walked.
//
// The machine room is the other half: its transport buttons and its teardown
// are the parts a learner touches and a page relies on, and neither ran.

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

const { getModule } = await import('../src/sessions/registry.ts')
await import('../src/sessions/index.ts')
const { mountSim, simModelExists } = await import('../src/sim/engine.ts')

// REAL shipped sessions, not hand-written fixtures. A fixture drifts from the
// schema the authors actually produce — this file's first draft invented
// `to`/`items`/`gte` where the content says `next`/`steps`/`>=`, and tested a
// shape the app has never been given. tests/shell.test.ts already makes this
// argument for generated drills; it holds for authored content too.
const PACKS = new URL('../public/content/packs/', import.meta.url).pathname
function sessionsOfKind(kind: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  // .sort() on both, because readdirSync is not ordered on Linux: which pack
  // and which file come "first" can differ between this box and the CI
  // runner, so a different session would be driven, different lines hit, and
  // the per-file coverage would shift — in a change whose whole argument is a
  // floor measured to 0.03pp (CON-VER-008).
  for (const pack of readdirSync(PACKS).sort()) {
    const dir = join(PACKS, pack, 'sessions')
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).sort()) {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Record<string, unknown>
      if (data.kind === kind) out.push(data)
    }
  }
  return out
}
const firstOfKind = (kind: string): Record<string, unknown> => {
  const all = sessionsOfKind(kind)
  assert.ok(all.length > 0, `no shipped ${kind} session to drive`)
  return all[0]
}

const root = (): HTMLElement => {
  const node = document.createElement('div')
  document.body.append(node)
  return node as unknown as HTMLElement
}
type El = {
  textContent: string
  click: () => void
  getAttribute: (a: string) => string | null
  querySelector: (s: string) => El | null
  querySelectorAll: (s: string) => El[]
  value?: string
  dispatchEvent: (e: Record<string, unknown>) => boolean
}
const node = (host: HTMLElement): El => host as unknown as El
/** decision defers its re-render by 180ms through window.setTimeout, and the
 *  stub's timers are real — so a walk has to actually wait for them. */
const tick = (ms = 220) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------- decision --- */

test('a decision walked to an ending renders the result and reports the score', async () => {
  const mod = getModule('decision')!
  const session = firstOfKind('decision') as { nodes: { id: string; ending?: unknown }[]; startId?: string }
  const host = root()
  const scores: [number, number][] = []
  mod.mount(host, session as never, (s, m) => scores.push([s, m]))

  // Walk the AUTHORED graph, always taking the first door, until an ending
  // renders. Clicking blindly can loop forever on a tree with cycles — which
  // is exactly why this whole terminal screen had never been covered.
  for (let step = 0; step < 24 && !scores.length; step++) {
    const door = node(host).querySelector('.fork-door')
    if (!door) break
    door.click()
    await tick()
  }

  assert.equal(scores.length, 1, 'walking to an ending completes the session exactly once')
  assert.equal(scores[0][1], 1, 'a decision is scored out of one')
  assert.ok(node(host).querySelector('.ending-card'), 'the ending card is on screen')
  // ANY authored ending, not the first in the array: which one a walk reaches
  // depends on the choices it took, and asserting a particular one tests the
  // tree's shape rather than the renderer.
  const principles = session.nodes
    .filter((n) => n.ending)
    .map((n) => (n as { ending: { principle: string } }).ending.principle)
  assert.ok(principles.length > 0, 'the tree has at least one ending to reach')
  const shown = node(host).textContent
  assert.ok(
    principles.some((p) => shown.includes(p)),
    'the ending card carries an authored principle',
  )
})

test('a decision tree pointing nowhere says so rather than rendering blank', async () => {
  const mod = getModule('decision')!
  const base = firstOfKind('decision') as Record<string, unknown>
  const host = root()
  mod.mount(
    host,
    { ...base, nodes: [{ id: 'start', text: 'Only one way out.', choices: [{ label: 'Go', next: 'nowhere' }] }], startId: 'start' } as never,
    () => {},
  )
  node(host).querySelector('.fork-door')!.click()
  await tick()
  assert.match(node(host).textContent, /Broken decision tree/, 'a dead link is reported, not swallowed')
})

/* ------------------------------------------------------------------ lab --- */

test('giving up on a lab still ends it, with partial credit for what was held', () => {
  const mod = getModule('lab')!
  const session = firstOfKind('lab') as { goals: unknown[]; debrief: string }
  const host = root()
  const scores: [number, number][] = []
  mod.mount(host, session as never, (s, m) => scores.push([s, m]))

  const giveUp = node(host).querySelectorAll('button').find((b) => /give up/i.test(b.textContent))
  assert.ok(giveUp, 'the lab offers a way out')
  giveUp!.click()

  assert.equal(scores.length, 1, 'ending the lab reports exactly once')
  assert.equal(scores[0][1], session.goals.length, 'out of the number of goals')
  assert.ok(scores[0][0] >= 0 && scores[0][0] <= session.goals.length, 'with a score inside that range')
  assert.ok(node(host).querySelector('.score-hero'), 'and a result screen with the tally')
})

test('a lab that has ended cannot end again', () => {
  const mod = getModule('lab')!
  const host = root()
  let endings = 0
  mod.mount(host, firstOfKind('lab') as never, () => { endings += 1 })
  const giveUp = node(host).querySelectorAll('button').find((b) => /give up/i.test(b.textContent))!
  giveUp.click()
  giveUp.click() // the detached button, as a queued event would deliver it
  assert.equal(endings, 1, 'one ending, one record')
})

/* --------------------------------------------------------- machine room --- */

test('the transport runs, steps and resets the machine', () => {
  const host = root()
  const handle = mountSim(host, { model: 'retention', title: 'Curve' })
  assert.ok(handle, 'a known model mounts')

  const btn = (label: RegExp): El =>
    node(host).querySelectorAll('.sim-btn').find((b) => label.test(b.textContent))!

  const playBtn = btn(/Run|Pause/)
  const wasRunning = handle!.running()
  playBtn.click()
  assert.notEqual(handle!.running(), wasRunning, 'play/pause toggles the loop')

  assert.doesNotThrow(() => btn(/Step/).click(), 'stepping must work whether or not it runs')
  assert.doesNotThrow(() => btn(/Reset/).click(), 'and so must resetting')
  handle!.destroy()
})

test('a machine can be torn down, twice, without complaint', () => {
  const host = root()
  const handle = mountSim(host, { model: 'retention' })!
  handle.play()
  assert.equal(handle.running(), true)
  handle.destroy()
  assert.equal(handle.running(), false, 'teardown stops the loop')
  assert.doesNotThrow(() => handle.destroy(), 'and is idempotent')
})

test('an unknown model is reported, not rendered as an empty box', () => {
  const host = root()
  assert.equal(mountSim(host, { model: 'no-such-model' } as never), null)
  assert.match(node(host).textContent, /unknown simulation/i)
  assert.equal(simModelExists('retention'), true)
  assert.equal(simModelExists('no-such-model'), false)
})

/* ------------------------------------------------------------- sequence --- */

test('a sequence can be reordered from the keyboard, and scored', () => {
  const mod = getModule('sequence')!
  const session = firstOfKind('sequence') as { steps: { id: string }[] }
  const host = root()
  const scores: [number, number][] = []
  mod.mount(host, session as never, (s, m) => scores.push([s, m]))

  const order = (): string[] => node(host).querySelectorAll('.seq-text').map((i) => i.textContent)
  const before = order()
  assert.equal(before.length, session.steps.length, 'every authored step is listed')

  // The ↑/↓ buttons are the keyboard path. Drag-and-drop is the mouse one and
  // needs a real dataTransfer, so it stays the browser suite's job.
  const arrows = node(host).querySelectorAll('.seq-arrow')
  assert.ok(arrows.length >= 2, 'each step can be moved')
  // arrows[1] is the FIRST step's ↓. The last arrow in the list is the last
  // step's ↓, which has nowhere to go — clicking it changes nothing and the
  // assertion below would fail for the wrong reason.
  arrows[1].click()
  assert.notDeepEqual(order(), before, 'moving a step reorders the list')

  node(host).querySelectorAll('.primary').find((b) => /lock the order/i.test(b.textContent))!.click()
  assert.equal(scores.length, 1, 'locking the order reports a score')
  assert.equal(scores[0][1], session.steps.length, 'out of the number of steps')
})

/* ------------------------------------------------------------ blueprint --- */

test('a blueprint wired to its spec inspects to a pass, and completes', async () => {
  // The whole wiring interaction — arming a node, joining two, drawing the
  // wires, listing them, cutting one, and the all-rules-pass branch that ends
  // the session — had never run. Two things kept it out of reach: nothing
  // ever created an edge, and the stub could not match the `[data-uid="…"]`
  // selector drawWires uses to find a node's endpoints.
  const mod = getModule('blueprint')!
  const session = firstOfKind('blueprint') as {
    parts: { id: string; label: string; fixed?: boolean }[]
    rules: { rule: string; a: string; b: string }[]
  }
  const host = root()
  const scores: [number, number][] = []
  mod.mount(host, session as never, (s, m) => scores.push([s, m]))

  const labels = (): El[] => node(host).querySelectorAll('.bp-node-label')
  const byName = (name: string): El | undefined =>
    labels().find((b) => b.textContent.trim().startsWith(name))

  // Place every part the board offers, so each rule has endpoints to join.
  for (const chip of node(host).querySelectorAll('.bp-part')) chip.click()

  // Wire what the rules ASK FOR, and nothing they forbid.
  //
  // An earlier version looped over every rule, which wired the `noDirect`
  // pairs too — so the board was deliberately built wrong, never passed, and
  // `onComplete` was never called. The test passed anyway, because it only
  // checked that each rule had been JUDGED. It claimed to cover the
  // all-rules-pass branch while never reaching it, and the task file repeated
  // the claim.
  //
  // And the lookup failed OPEN: a rule with no `a`/`b` (pathExists,
  // survivesKill, minCount, maxCount) resolved through `byName('')`, and
  // `startsWith('')` matches the FIRST label unconditionally — so those rules
  // silently wired an arbitrary node to itself.
  const wireUp = (): void => {
    for (const rule of session.rules) {
      if (rule.rule !== 'connected') continue
      if (rule.a == null || rule.b == null) continue
      const a = byName(session.parts.find((p) => p.id === rule.a)!.label)
      const b = byName(session.parts.find((p) => p.id === rule.b)!.label)
      if (!a || !b) continue
      a.click()
      b.click()
    }
  }
  wireUp()
  // drawWires runs on an animation frame, and renderAll() requests one on
  // every click — so by now the stub's three-frame budget is long spent and
  // the wire layer has never been drawn. Give it a frame back and let it run.
  ;(globalThis as unknown as { __resetFrames: () => void }).__resetFrames()
  node(host).querySelectorAll('.bp-node-label')[0].click() // re-render → rAF
  node(host).querySelectorAll('.bp-node-label')[0].click() // and disarm again
  await new Promise((r) => setTimeout(r, 30))

  const wires = node(host).querySelectorAll('.bp-wire-chip')
  assert.ok(wires.length > 0, 'wiring two components lists a wire that can be cut')
  // The svg's CHILDREN, not a descendant selector and not the svg itself.
  // `.bp-wires line` needs a combinator this stub refuses, so it is always 0;
  // `.bp-wires` is created once at mount and never removed, so it is always
  // ≥1. An OR of those two can never be false — it read as proof that the
  // board draws its wires while proving nothing at all.
  const svg = node(host).querySelector('.bp-wires')
  assert.ok(svg, 'the board has a wire layer')
  assert.ok(
    (svg as unknown as { childNodes: unknown[] }).childNodes.length > 0,
    'and drawWires put lines into it',
  )

  const inspect = () => node(host).querySelectorAll('button').find((b) => /inspect/i.test(b.textContent))
  assert.ok(inspect(), 'the board can be inspected')
  inspect()!.click()

  // Every rule the session asked for is satisfied, so inspecting FINISHES it.
  assert.equal(scores.length, 1, 'a board that meets every rule completes the session')
  assert.equal(scores[0][0], session.rules.length, 'scoring every rule')
  assert.equal(scores[0][1], session.rules.length, 'out of every rule')
  assert.ok(node(host).querySelector('.score-hero'), 'and the result screen carries the tally')
})

test('a wire can be cut, and a component armed and let go', () => {
  // Separate from the pass test on purpose: wiring is a TOGGLE, so a loop
  // that re-wires every required pair would REMOVE the ones already there.
  // Cutting inside that test therefore left the board unfixable, and an
  // earlier version inspected it in that state, never passed, and still
  // called itself "inspected to a pass".
  const mod = getModule('blueprint')!
  const session = firstOfKind('blueprint') as {
    parts: { id: string; label: string }[]
    rules: { rule: string; a?: string; b?: string }[]
  }
  const host = root()
  mod.mount(host, session as never, () => {})
  for (const chip of node(host).querySelectorAll('.bp-part')) chip.click()

  const labels = () => node(host).querySelectorAll('.bp-node-label')
  const byName = (n: string) => labels().find((b) => b.textContent.trim().startsWith(n))
  const joined = session.rules.find((r) => r.rule === 'connected' && r.a && r.b)!
  byName(session.parts.find((p) => p.id === joined.a)!.label)!.click()
  byName(session.parts.find((p) => p.id === joined.b)!.label)!.click()

  const wires = () => node(host).querySelectorAll('.bp-wire-chip')
  assert.equal(wires().length, 1, 'wiring two components lists one wire')
  wires()[0].click()
  assert.equal(wires().length, 0, 'cutting it removes exactly that one')

  // Arming a node and tapping it again lets go, rather than wiring it to
  // itself. Re-queried after every click: renderAll() rebuilds the board, so
  // the element clicked a moment ago is detached and its attributes are a
  // snapshot of a DOM nobody is looking at.
  labels()[0].click()
  assert.equal(labels()[0].getAttribute('aria-pressed'), 'true', 'tapping a component arms it')
  labels()[0].click()
  assert.equal(labels()[0].getAttribute('aria-pressed'), 'false', 'tapping it again lets go')
})

test('inspecting a board that breaks a rule reports it, and does NOT finish', () => {
  // Inspect is formative: it is pressed repeatedly WHILE wiring. A board that
  // breaks a rule must come back judged and still editable, not completed.
  const mod = getModule('blueprint')!
  const session = firstOfKind('blueprint') as {
    parts: { id: string; label: string }[]
    rules: { rule: string; a?: string; b?: string; label: string }[]
  }
  const forbidden = session.rules.find((r) => r.rule === 'noDirect' && r.a && r.b)
  assert.ok(forbidden, 'this board forbids at least one direct connection')

  const host = root()
  const scores: unknown[] = []
  mod.mount(host, session as never, () => scores.push(1))
  for (const chip of node(host).querySelectorAll('.bp-part')) chip.click()

  // Wire exactly the pair the rules say must not be wired.
  const labels = () => node(host).querySelectorAll('.bp-node-label')
  const byName = (n: string) => labels().find((b) => b.textContent.trim().startsWith(n))
  byName(session.parts.find((p) => p.id === forbidden!.a)!.label)!.click()
  byName(session.parts.find((p) => p.id === forbidden!.b)!.label)!.click()

  node(host).querySelectorAll('button').find((b) => /inspect/i.test(b.textContent))!.click()

  const verdicts = node(host).querySelectorAll('.lab-goal-val')
  assert.equal(verdicts.length, session.rules.length, 'every rule is judged')
  assert.ok(verdicts.some((v) => /broken/.test(v.textContent)), 'and the broken one says so')
  assert.deepEqual(scores, [], 'a board that breaks a rule is not completed')
})

test('a blueprint part can be removed again, taking its wires with it', () => {
  const mod = getModule('blueprint')!
  const host = root()
  mod.mount(host, firstOfKind('blueprint') as never, () => {})

  for (const chip of node(host).querySelectorAll('.bp-part')) chip.click()
  const placed = node(host).querySelectorAll('.bp-node').length
  assert.ok(placed > 0, 'parts can be placed on the board')

  const remove = node(host).querySelectorAll('.bp-remove')
  assert.ok(remove.length > 0, 'a placed part can be taken off again')
  remove[0].click()
  assert.equal(
    node(host).querySelectorAll('.bp-node').length,
    placed - 1,
    'removing a part takes it off the board',
  )
})

/* ------------------------------------------- weighing up a fork ---------- */

test('hovering a door previews its consequence, and leaving puts it back', () => {
  const mod = getModule('decision')!
  // A session whose FIRST node has an authored preview — 22 choices across
  // the shipped decisions carry one, but not the first door of every tree,
  // and hovering a door without one legitimately changes nothing.
  // Resolved through startId, which is what decision.ts renders first. Taking
  // the first node in the ARRAY that has choices happens to agree today, and
  // would quietly disagree the moment a pack authors a node above its start —
  // and the failure would read as "hovering says nothing" rather than as a
  // test indexing the wrong door.
  const startNode = (d: Record<string, unknown>) => {
    const { nodes, startId } = d as { nodes: { id: string; choices?: { preview?: string }[] }[]; startId?: string }
    return nodes.find((n) => n.id === startId) ?? nodes[0]
  }
  const session = sessionsOfKind('decision').find((d) =>
    startNode(d)?.choices?.some((c) => c.preview),
  ) as { nodes: { id: string; choices?: { preview?: string }[] }[]; startId?: string; meter?: unknown }
  assert.ok(session, 'no shipped decision opens on a door with a preview')

  const host = root()
  mod.mount(host, session as never, () => {})
  const resting = node(host).querySelector('.fork-preview')!.textContent

  // mouseenter/leave are the real listeners; a stub can dispatch them even
  // though it cannot hover. This is the half of the decision page a learner
  // spends the most time in — weighing, before committing.
  const doors = node(host).querySelectorAll('.fork-door')
  const withPreview = startNode(session as never)!.choices!.findIndex((c) => c.preview)
  assert.ok(withPreview >= 0 && withPreview < doors.length, 'the previewing door is on screen')
  doors[withPreview].dispatchEvent({ type: 'mouseenter' })
  const weighing = node(host).querySelector('.fork-preview')!.textContent
  doors[withPreview].dispatchEvent({ type: 'mouseleave' })
  const after = node(host).querySelector('.fork-preview')!.textContent

  assert.notEqual(weighing, resting, 'hovering a door says what it would cost')
  assert.equal(after, resting, 'and leaving it puts the panel back')
  if (session.meter) {
    assert.ok(
      node(host).querySelector('.decision-meter-ghost'),
      'a metered fork shows the shift as a ghost on the bar',
    )
  }
})
