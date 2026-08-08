import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { connectivityAvailability, evalRule, shortestHops, type BpNode, type Edge } from '../src/sessions/blueprint-rules.ts'

const N = (uid: number, part: string): BpNode => ({ uid, part, label: part, fixed: false })

function loadRules(rel: string) {
  return JSON.parse(readFileSync(new URL(`../public/content/packs/${rel}`, import.meta.url), 'utf8'))
}

function passCount(session: { rules: Parameters<typeof evalRule>[0][] }, nodes: BpNode[], edges: Edge[]) {
  return session.rules.map((r) => evalRule(r, nodes, edges)).filter((r) => r.ok).length
}

/* Every shipped blueprint must be winnable, and its designed traps must fail. */

test('sysarch fault-tolerant blueprint: solution passes, traps fail', () => {
  const s = loadRules('sysarch-lss-2026/sessions/15-fault-tolerant-blueprint.json')
  const nodes = [N(1, 'client'), N(2, 'lb'), N(7, 'lb'), N(3, 'app'), N(4, 'app'), N(5, 'db'), N(6, 'db')]
  const solution: Edge[] = [[1, 2], [1, 7], [2, 3], [2, 4], [7, 3], [7, 4], [3, 5], [3, 6], [4, 5], [4, 6]]
  assert.equal(passCount(s, nodes, solution), s.rules.length, 'intended solution wins')

  // single LB is a SPOF the inspector must flag
  const oneLb = [N(1, 'client'), N(2, 'lb'), N(3, 'app'), N(4, 'app'), N(5, 'db'), N(6, 'db')]
  const oneLbEdges: Edge[] = [[1, 2], [2, 3], [2, 4], [3, 5], [3, 6], [4, 5], [4, 6]]
  const kill = s.rules.findIndex((r: { rule: string }) => r.rule === 'survivesKill')
  const res = evalRule(s.rules[kill], oneLb, oneLbEdges)
  assert.equal(res.ok, false, 'one LB fails the kill test')
  assert.deepEqual(res.offenders, [2], 'the LB is named as the SPOF')

  // wiring client straight to db is caught
  const cheat: Edge[] = [...solution, [1, 5]]
  assert.ok(passCount(s, nodes, cheat) < s.rules.length, 'client→db shortcut is rejected')
})

test('api-edge blueprint: REST at the boundary, gRPC inside', () => {
  const s = loadRules('sysarch-lss-2026/sessions/16-api-edge-blueprint.json')
  const nodes = [N(1, 'public-client'), N(2, 'rest-gateway'), N(3, 'orders-svc'), N(4, 'payments-svc')]
  assert.equal(passCount(s, nodes, [[1, 2], [2, 3], [3, 4]]), s.rules.length)
  // exposing an internal service to the public fails
  assert.ok(passCount(s, nodes, [[1, 2], [1, 3], [2, 3], [3, 4]]) < s.rules.length)
})

test('four-pillar blueprint: plan structure holds, emergency≠goal money', () => {
  const s = loadRules('finance-mfi-2026-07/sessions/18-four-pillar-blueprint.json')
  const nodes = [N(1, 'income'), N(2, 'protection'), N(3, 'emergency'), N(4, 'sip'), N(5, 'goal')]
  assert.equal(passCount(s, nodes, [[1, 2], [1, 3], [1, 4], [4, 5]]), s.rules.length)
  assert.ok(passCount(s, nodes, [[1, 2], [1, 3], [1, 4], [4, 5], [3, 5]]) < s.rules.length, 'emergency→goal wire refused')
})

test('compounder blueprint: the loop wins, trap parts lose', () => {
  const s = loadRules('equity-wi-2026-07/sessions/07-compounder-blueprint.json')
  const nodes = [N(1, 'profits'), N(2, 'reinvest'), N(3, 'moat'), N(4, 'earnings')]
  const loop: Edge[] = [[1, 2], [2, 3], [3, 4], [4, 1]]
  assert.equal(passCount(s, nodes, loop), s.rules.length)
  assert.ok(passCount(s, [...nodes, N(5, 'unrelated')], loop) < s.rules.length, 'placing a trap part fails inspection')
})

test('SDD workflow blueprint: the pipeline wins, the vibe-coding wire fails', () => {
  const s = loadRules('ai-sdd-2026/sessions/05-sdd-blueprint.json')
  const nodes = [N(1, 'intent'), N(2, 'constitution'), N(3, 'spec'), N(4, 'implement'), N(5, 'validate'), N(6, 'merge')]
  const chain: Edge[] = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
  assert.equal(passCount(s, nodes, chain), s.rules.length, 'the disciplined pipeline passes')
  // intent wired straight to implementation IS vibe coding — must fail
  const vibe: Edge[] = [...chain, [1, 4]]
  const noDirect = s.rules.findIndex((r: { rule: string }) => r.rule === 'noDirect')
  assert.equal(evalRule(s.rules[noDirect], nodes, vibe).ok, false, 'vibe-coding wire refused')
  // skipping the spec entirely also fails (constitution wired to implement)
  const skipSpec: Edge[] = [[1, 2], [2, 4], [4, 5], [5, 6]]
  assert.ok(passCount(s, nodes, skipSpec) < s.rules.length, 'skipping the feature spec fails')
})

test('media-agent blueprint: pipeline wins, ungrounded/unevaluated wires fail', () => {
  const s = loadRules('ai-media-agents-2026/sessions/08-media-agent-blueprint.json')
  const nodes = [N(1, 'request'), N(2, 'brand'), N(3, 'concepts'), N(4, 'generate'), N(5, 'evaluate'), N(6, 'deliver')]
  const chain: Edge[] = [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
  assert.equal(passCount(s, nodes, chain), s.rules.length, 'the disciplined pipeline passes')
  // request wired straight to the renderer = ungrounded generation
  assert.ok(passCount(s, nodes, [...chain, [1, 4]]) < s.rules.length, 'ungrounded generation refused')
  // generate wired straight to the deliverable = shipping unevaluated
  assert.ok(passCount(s, nodes, [...chain, [4, 6]]) < s.rules.length, 'unevaluated delivery refused')
})

/* Pure graph helpers */

test('shortestHops + connectivityAvailability behave analytically', () => {
  const nodes = [N(1, 'a'), N(2, 'm'), N(3, 'm'), N(4, 'b')]
  const parallel: Edge[] = [[1, 2], [2, 4], [1, 3], [3, 4]]
  assert.equal(shortestHops(nodes, parallel, 'a', 'b'), 2)
  // two independent middles at 0.99 each: P(path) = 1 - (1-0.99)^2 = 0.9999
  const avail = connectivityAvailability(nodes, parallel, 'a', 'b', 0.99)
  assert.ok(avail != null && Math.abs(avail - 0.9999) < 1e-9)
  // a single middle in series: P = 0.99
  const series: Edge[] = [[1, 2], [2, 4]]
  const availSeries = connectivityAvailability([N(1, 'a'), N(2, 'm'), N(4, 'b')], series, 'a', 'b', 0.99)
  assert.ok(availSeries != null && Math.abs(availSeries - 0.99) < 1e-9)
})
