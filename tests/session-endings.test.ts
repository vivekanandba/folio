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
/**
 * Wait for a CONDITION, not for a duration.
 *
 * decision.ts re-renders through `window.setTimeout(render, 180)`, and the
 * walk below used a flat `tick(220)` — a 40ms margin against the event loop.
 * Lose that race on a loaded box (the fleet notes describe this one reaching
 * load 10 under three Playwright jobs) and the OLD `.fork-door` is still
 * attached, so the walk clicks it again and queues a second deferred render.
 * `render()` calls `onComplete` unconditionally on every ending render —
 * decision has no "already ended" guard, unlike lab — so the second one
 * pushes a second score and `scores.length === 1` fails, blaming the
 * renderer for a timing loss. That is a suite defect, not a flaky renderer
 * (CON-VER-008).
 */
async function until(ok: () => boolean, what: string, timeoutMs = 4000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (ok()) return
    await new Promise((r) => setTimeout(r, 10))
  }
  assert.fail(`timed out after ${timeoutMs}ms waiting for ${what}`)
}

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
    // The click is answered by a deferred re-render, so wait for the screen
    // to actually turn over: either this door is gone (a new fork drawn) or
    // the walk has ended.
    await until(
      () => scores.length > 0 || node(host).querySelector('.fork-door') !== door,
      'the decision to re-render after a door was taken',
    )
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
  // The same deferred re-render, so the same condition-not-duration wait.
  await until(
    () => /Broken decision tree/.test(node(host).textContent),
    'the broken-link message to render',
  )
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

interface BlueprintSpec {
  parts: { id: string; label: string; fixed?: boolean; max?: number }[]
  rules: { rule: string; a?: string; b?: string; from?: string; to?: string; label: string }[]
}

/**
 * The edge set `wireUp()` below produces: one wire per DISTINCT `connected`
 * pair.
 *
 * Deduplicated, because wiring is a TOGGLE. A board that authors the same
 * pair in two rules (two different labels for one required link is a
 * reasonable thing to write) would be clicked twice and end up with the wire
 * OFF — and satisfiableBlueprint, which models the result as a Set, would
 * have vouched for a board the test then fails on. The helper's model and
 * what the walk actually does have to be the same thing.
 */
function connectedEdges(spec: BlueprintSpec): [string, string][] {
  const seen = new Set<string>()
  const edges: [string, string][] = []
  for (const r of spec.rules) {
    if (r.rule !== 'connected' || r.a == null || r.b == null) continue
    const key = [r.a, r.b].sort().join('\u0000')
    if (seen.has(key)) continue
    seen.add(key)
    edges.push([r.a, r.b])
  }
  return edges
}

/**
 * The first shipped blueprint whose every rule is actually satisfied by
 * "place each part once, wire what `connected` asks for" — evaluated, not
 * assumed.
 *
 * An earlier version accepted any board whose rules were all drawn from
 * {connected, noDirect, pathExists}, on the stated premise that the latter
 * two "hold automatically for such a board". noDirect does. pathExists does
 * not: `pathExists(from, to)` only holds if the `connected` pairs happen to
 * chain from→to, which is a property of the content and not of the rule set.
 * It is true of every shipped board today, so the premise was invisible —
 * and a content-only change adding a qualifying board with an unchained
 * pathExists would have failed "a board that meets every rule completes the
 * session", pointing at the renderer rather than at the fixture. Which is
 * the exact failure this helper exists to prevent.
 */
function satisfiableBlueprint(
  also: (s: BlueprintSpec) => boolean = () => true,
  alsoDescription = '',
): BlueprintSpec {
  const found = sessionsOfKind('blueprint').find((d) => {
    const spec = d as unknown as BlueprintSpec
    if (spec.parts.some((p) => (p.max ?? 1) > 1)) return false
    // Any EXTRA property the calling test needs of its fixture, applied while
    // choosing rather than asserted afterwards. A test that needs a noDirect
    // rule and merely asserts one is present fails for a fixture reason the
    // moment content changes — which is the failure this finder exists to
    // prevent, reintroduced one level up.
    if (!also(spec)) return false
    if (!spec.rules.every((r) => ['connected', 'noDirect', 'pathExists'].includes(r.rule))) return false

    const edges = connectedEdges(spec)
    const key = (a: string, b: string) => [a, b].sort().join('\u0000')
    const wired = new Set(edges.map(([a, b]) => key(a, b)))

    // Nothing the board forbids may be something the board also asks for.
    if (spec.rules.some((r) => r.rule === 'noDirect' && r.a && r.b && wired.has(key(r.a, r.b)))) return false

    // And every demanded path must actually be walkable over those wires.
    const neighbours = new Map<string, string[]>()
    for (const [a, b] of edges) {
      neighbours.set(a, [...(neighbours.get(a) ?? []), b])
      neighbours.set(b, [...(neighbours.get(b) ?? []), a])
    }
    const reaches = (from: string, to: string): boolean => {
      const seen = new Set([from])
      const queue = [from]
      while (queue.length) {
        const at = queue.shift()!
        if (at === to) return true
        for (const next of neighbours.get(at) ?? []) if (!seen.has(next)) { seen.add(next); queue.push(next) }
      }
      return false
    }
    return spec.rules.every((r) => r.rule !== 'pathExists' || (!!r.from && !!r.to && reaches(r.from, r.to)))
  })
  // Name the WHOLE requirement. The message used to say only "satisfiable
  // by one of each part" while callers could add further demands, so a
  // failure caused by the extra predicate pointed at satisfiability, which
  // was not the cause (CON-VER-005).
  assert.ok(
    found,
    `no shipped blueprint is satisfiable by one of each part${alsoDescription ? ` and ${alsoDescription}` : ''}`,
  )
  return found as unknown as BlueprintSpec
}

test('a blueprint wired to its spec inspects to a pass, and completes', async () => {
  // The whole wiring interaction — arming a node, joining two, drawing the
  // wires, listing them, cutting one, and the all-rules-pass branch that ends
  // the session — had never run. Two things kept it out of reach: nothing
  // ever created an edge, and the stub could not match the `[data-uid="…"]`
  // selector drawWires uses to find a node's endpoints.
  const mod = getModule('blueprint')!
  // A board this walk can actually satisfy: place each part once, wire the
  // `connected` rules, wire nothing forbidden. `firstOfKind` would take
  // whichever pack sorts first, and sysarch's fault-tolerant blueprint needs
  // minCount 2/4/3 — so a content-only change that added a pack sorting
  // earlier would fail this on "a board that meets every rule completes",
  // pointing at the renderer instead of at the fixture.
  const session = satisfiableBlueprint()
  const host = root()
  const scores: [number, number][] = []
  mod.mount(host, session as never, (s, m) => scores.push([s, m]))

  const labels = (): El[] => node(host).querySelectorAll('.bp-node-label')
  const byName = (name: string): El | undefined =>
    labels().find((b) => b.textContent.trim() === name)

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
  //
  // Driven by connectedEdges(), the SAME deduplicated model
  // satisfiableBlueprint() uses to decide the board is satisfiable. Walking
  // session.rules directly here meant the helper vouched for one edge set
  // while the walk built another: wiring is a toggle, so a pair authored in
  // two rules was clicked twice and ended up disconnected, failing a board
  // the helper had just approved.
  const wireUp = (): void => {
    for (const [aId, bId] of connectedEdges(session)) {
      const a = byName(session.parts.find((p) => p.id === aId)!.label)
      const b = byName(session.parts.find((p) => p.id === bId)!.label)
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
  // Selected, not taken on faith. This used to be firstOfKind('blueprint')
  // followed by `rules.find(r => r.rule === 'connected' && r.a && r.b)!` —
  // so a first-sorted board with no `connected` rule would crash on
  // "Cannot read properties of undefined", reporting a fixture problem as a
  // renderer crash. That is the failure satisfiableBlueprint() was built for
  // two tests up; there is no reason for this one to opt out of it.
  const session = satisfiableBlueprint(
    (sp) => sp.rules.some((r) => r.rule === 'connected' && !!r.a && !!r.b),
    'has a connected rule to cut',
  )
  const host = root()
  mod.mount(host, session as never, () => {})
  for (const chip of node(host).querySelectorAll('.bp-part')) chip.click()

  const labels = () => node(host).querySelectorAll('.bp-node-label')
  // EXACT label, not startsWith: two parts where one label prefixes another
  // ("Cache" / "Cache replica") would resolve to the SAME node, wiring the
  // wrong pair and failing on "a board that meets every rule completes" —
  // blaming blueprint.ts for a fixture collision. No shipped board collides
  // today, which is the only reason a prefix match has worked.
  const byName = (n: string) => labels().find((b) => b.textContent.trim() === n)
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
  // A board this walk can otherwise SATISFY, and the one forbidden wire on
  // top of it. The earlier version placed every part, wired only the
  // forbidden pair, and asserted `verdicts.some(/broken/)` — which proved
  // nothing: with nothing else wired, every `connected` rule and the
  // `pathExists` rule came back broken too, so deleting `noDirect` from
  // evalRule entirely would have left this test green. Both of its
  // assertions were satisfied by the rules it was not testing.
  const session = satisfiableBlueprint(
    (s) => s.rules.some((r) => r.rule === 'noDirect' && !!r.a && !!r.b),
    'forbids at least one direct connection',
  )
  const forbiddenIndex = session.rules.findIndex((r) => r.rule === 'noDirect' && r.a && r.b)
  assert.ok(forbiddenIndex >= 0, 'this board forbids at least one direct connection')
  const forbidden = session.rules[forbiddenIndex]

  const host = root()
  const scores: unknown[] = []
  mod.mount(host, session as never, () => scores.push(1))
  for (const chip of node(host).querySelectorAll('.bp-part')) chip.click()

  const labels = () => node(host).querySelectorAll('.bp-node-label')
  // EXACT label, not startsWith: two parts where one label prefixes another
  // ("Cache" / "Cache replica") would resolve to the SAME node, wiring the
  // wrong pair and failing on "a board that meets every rule completes" —
  // blaming blueprint.ts for a fixture collision. No shipped board collides
  // today, which is the only reason a prefix match has worked.
  const byName = (n: string) => labels().find((b) => b.textContent.trim() === n)
  const labelOf = (id: string) => session.parts.find((p) => p.id === id)!.label
  const wire = (aId: string, bId: string): void => {
    byName(labelOf(aId))!.click()
    byName(labelOf(bId))!.click()
  }

  // Everything the rules ask for — so the board would pass …
  for (const [a, b] of connectedEdges(session)) wire(a, b)
  // … and then exactly the one wire they forbid.
  wire(forbidden.a!, forbidden.b!)

  node(host).querySelectorAll('button').find((b) => /inspect/i.test(b.textContent))!.click()

  const verdicts = node(host).querySelectorAll('.lab-goal-val')
  assert.equal(verdicts.length, session.rules.length, 'every rule is judged')
  // At the forbidden rule's OWN index, not "somewhere in the list".
  assert.match(
    verdicts[forbiddenIndex].textContent,
    /broken/,
    `the noDirect rule "${forbidden.label}" is the one reported broken`,
  )
  // And it is the ONLY one, which is what makes the assertion above mean
  // "noDirect was evaluated" rather than "the board is a mess".
  const broken = verdicts.filter((v) => /broken/.test(v.textContent))
  assert.equal(broken.length, 1, 'and it is the only rule the board breaks')
  assert.deepEqual(scores, [], 'a board that breaks a rule is not completed')
})

test('a blueprint part can be removed again, taking its wires with it', () => {
  const mod = getModule('blueprint')!
  const host = root()
  // Same reasoning as above: a board this walk can actually place and wire,
  // rather than whichever one sorts first.
  mod.mount(host, satisfiableBlueprint() as never, () => {})

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
    const { nodes, startId } = d as {
      nodes: { id: string; choices?: { preview?: string; effect?: number | null }[] }[]
      startId?: string
    }
    return nodes.find((n) => n.id === startId) ?? nodes[0]
  }
  // Chosen for EVERY property this test needs, not just the first one, and
  // chosen rather than asserted afterwards — the rule satisfiableBlueprint()
  // was written to enforce for the blueprint tests.
  //
  // The meter assertions below sit behind `if (session.meter)` and
  // `if (moving >= 0)`. Selecting only on "the start node has a preview"
  // left both of those conditions to luck: all seven shipped decisions
  // happen to carry a meter and a moving first choice today, so the block
  // runs — but a content change that put a preview-bearing, meter-less
  // decision first would drop the whole showPreview() meter branch with
  // this test still green and SILENT about it. A guarded assertion that
  // nothing selects for is a coverage claim with no guarantee behind it.
  const wanted = (d: Record<string, unknown>) => {
    const start = startNode(d)
    if (!start?.choices?.some((c) => c.preview)) return false
    const meter = (d as { meter?: { min: number; max: number; start: number } }).meter
    if (!meter) return false
    // "Moves the CLAMPED value", not "has a non-zero effect". showPreview
    // clamps the projection to [min, max], so a decision authored with its
    // meter already at a bound — or within |effect| of one — projects to the
    // same percentage it rests at, and `notEqual(whileWeighing, atRest)`
    // would fail against a perfectly correct renderer. Select for the thing
    // the assertion actually requires.
    const clamp = (v: number) => Math.max(meter.min, Math.min(meter.max, v))
    return start.choices.some(
      (c) => c.effect != null && clamp(meter.start + c.effect) !== clamp(meter.start),
    )
  }
  const session = sessionsOfKind('decision').find(wanted) as {
    nodes: { id: string; choices?: { preview?: string; effect?: number | null }[] }[]
    startId?: string
    meter?: unknown
  }
  assert.ok(
    session,
    'no shipped decision opens on a metered fork with both a preview and a cost',
  )

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
  // The METER, if this fork has one — and what it does, not that it exists.
  //
  // An earlier version asserted only that `.decision-meter-ghost` was in the
  // DOM, AFTER the mouseleave above. render() creates that element whenever
  // session.meter is set and never adds or removes it on hover — only its
  // width and `worse` class change — so the assertion was true before the
  // test touched anything, could not observe the hover state it was placed
  // after, and would have stayed green with the whole `if (meter && ...)`
  // block deleted from showPreview().
  // No `if` here any more. The fixture is SELECTED for a meter and for a
  // door that moves it, so both are now guarantees — and a guard that can
  // silently skip the only assertions covering showPreview()'s meter branch
  // is the thing this test was failing at two rounds ago.
  const ghost = () => node(host).querySelector('.decision-meter-ghost') as unknown as
    { style: { width: string }; className: string }
  assert.ok(ghost(), 'a metered fork draws a ghost on the bar')

  // A door that MOVES the meter — `effect`, not `preview`. They need not be
  // the same door, and a door with no effect leaves the ghost where it is.
  const choices = startNode(session as never)!.choices as { effect?: number | null }[]
  const meter = session.meter as { min: number; max: number; start: number }
  const clampTo = (v: number) => Math.max(meter.min, Math.min(meter.max, v))
  const moving = choices.findIndex(
    (c) => c.effect != null && clampTo(meter.start + c.effect) !== clampTo(meter.start),
  )
  assert.ok(moving >= 0, 'the chosen fork has a door that moves the meter off its resting value')

  const atRest = ghost().style.width
  doors[moving].dispatchEvent({ type: 'mouseenter' })
  const whileWeighing = ghost().style.width
  doors[moving].dispatchEvent({ type: 'mouseleave' })
  const restored = ghost().style.width

  assert.notEqual(whileWeighing, atRest, 'hovering a door that costs something shifts the ghost')
  assert.equal(restored, atRest, 'and leaving it puts the bar back')
})
