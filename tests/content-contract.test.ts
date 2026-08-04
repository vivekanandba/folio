import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { COMPUTES } from '../src/computes.ts'
import { SIM_MODELS } from '../src/sim/models.ts'
import { COMPUTES as LINT_COMPUTES, SIM_MODELS as LINT_SIM_MODELS } from '../tools/lint/referential.ts'

/**
 * Cross-cutting authoring contracts the referential linter can't see:
 * whitelist parity with the real engine registries, and lab goals that
 * actually exist on the machine they reference.
 */

const ROOT = new URL('../public/content/packs/', import.meta.url)

function allSessions(): { pack: string; file: string; data: Record<string, unknown> }[] {
  const out: { pack: string; file: string; data: Record<string, unknown> }[] = []
  for (const pack of readdirSync(ROOT)) {
    const dir = new URL(`${pack}/sessions/`, ROOT)
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      out.push({ pack, file, data: JSON.parse(readFileSync(new URL(file, dir), 'utf8')) })
    }
  }
  return out
}

test('linter whitelists match the engine registries exactly', () => {
  assert.deepEqual(new Set(Object.keys(SIM_MODELS)), LINT_SIM_MODELS, 'SIM_MODELS drifted')
  assert.deepEqual(new Set(Object.keys(COMPUTES)), LINT_COMPUTES, 'COMPUTES drifted')
})

test('every lab goal metric exists on its machine (params or scalars)', () => {
  const labs = allSessions().filter((s) => s.data.kind === 'lab')
  assert.ok(labs.length >= 5, `found the shipped labs (${labs.length})`)
  for (const { pack, file, data } of labs) {
    const model = SIM_MODELS[data.model as string]
    assert.ok(model, `${pack}/${file}: model exists`)
    const params: Record<string, number> = {}
    for (const p of model.params) params[p.key] = (data.params as Record<string, number>)?.[p.key] ?? p.value
    const state = model.init(params)
    for (let t = 0; t < 10; t += 0.1) model.step(state, params, 0.1)
    const known = new Set([...Object.keys(params), ...Object.keys(state.scalars)])
    for (const g of data.goals as { metric: string }[]) {
      assert.ok(known.has(g.metric), `${pack}/${file}: goal metric "${g.metric}" not produced by model "${data.model as string}"`)
    }
  }
})

test('lab starting params are declared knobs within their ranges', () => {
  for (const { pack, file, data } of allSessions().filter((s) => s.data.kind === 'lab')) {
    const model = SIM_MODELS[data.model as string]
    for (const [key, value] of Object.entries((data.params ?? {}) as Record<string, number>)) {
      const knob = model.params.find((p) => p.key === key)
      assert.ok(knob, `${pack}/${file}: param "${key}" is a knob on ${data.model as string}`)
      assert.ok(value >= knob!.min && value <= knob!.max, `${pack}/${file}: param "${key}"=${value} within [${knob!.min}, ${knob!.max}]`)
    }
  }
})

test('estimate answers sit strictly inside their sliders', () => {
  for (const { pack, file, data } of allSessions().filter((s) => s.data.kind === 'estimate')) {
    const { min, max, answer } = data as { min: number; max: number; answer: number }
    assert.ok(answer > min && answer < max, `${pack}/${file}: answer ${answer} inside (${min}, ${max})`)
  }
})
