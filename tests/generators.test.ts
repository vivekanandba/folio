import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dailyDrill, drillableConcepts } from '../src/gauntlet/generators.ts'

const concepts = drillableConcepts()

test('at least one drillable concept per pack', () => {
  const packs = new Set(concepts.map((k) => k.split('::')[0]))
  for (const p of ['sysarch-lss-2026', 'ai-vllm-inf-2026', 'finance-mfi-2026-07', 'equity-wi-2026-07']) {
    assert.ok(packs.has(p), `${p} has drills`)
  }
})

test('deterministic: same (concept, date) mints the identical drill', () => {
  for (const key of concepts) {
    const [p, c] = key.split('::')
    assert.deepEqual(dailyDrill(p, c, '2026-08-04'), dailyDrill(p, c, '2026-08-04'), key)
  }
})

test('variety: ≥4 distinct prompts per concept over 30 days', () => {
  for (const key of concepts) {
    const [p, c] = key.split('::')
    const prompts = new Set<string>()
    for (let d = 1; d <= 30; d++) prompts.add(dailyDrill(p, c, `2026-08-${String(d).padStart(2, '0')}`)!.prompt)
    assert.ok(prompts.size >= 4, `${key}: ${prompts.size} distinct prompts`)
  }
})

test('every sampled drill is sane: bounded, off-edge, tolerant, substantial', () => {
  let sampled = 0
  for (const key of concepts) {
    const [p, c] = key.split('::')
    for (let d = 1; d <= 28; d++) {
      const dr = dailyDrill(p, c, `2026-07-${String(d).padStart(2, '0')}`)!
      sampled++
      assert.ok(Number.isFinite(dr.answer), `${key} d${d}: finite answer`)
      assert.ok(dr.answer > dr.min && dr.answer < dr.max, `${key} d${d}: answer inside slider`)
      const pos = (dr.answer - dr.min) / (dr.max - dr.min)
      assert.ok(pos < 0.995, `${key} d${d}: not pinned at max (pos ${pos.toFixed(3)})`)
      assert.ok(dr.tolerance > 0 && dr.tolerance <= 1, `${key} d${d}: tolerance`)
      assert.ok(dr.step > 0, `${key} d${d}: step`)
      assert.ok(dr.prompt.length > 20 && dr.debrief.length > 40, `${key} d${d}: text present`)
    }
  }
  assert.ok(sampled >= 200, `broad sample (${sampled})`)
})

test('unknown concepts mint nothing (gauntlet falls back to flashcards)', () => {
  assert.equal(dailyDrill('sysarch-lss-2026', 'api-design', '2026-08-04'), null)
})
