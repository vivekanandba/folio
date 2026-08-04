import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SIM_MODELS } from '../src/sim/models.ts'

/** Run a model for `seconds` of sim time at the engine's fixed step. */
function run(id: string, params: Record<string, number>, seconds: number) {
  const m = SIM_MODELS[id]
  assert.ok(m, `model ${id} exists`)
  const p: Record<string, number> = {}
  for (const d of m.params) p[d.key] = params[d.key] ?? d.value
  const s = m.init(p)
  for (let t = 0; t < seconds; t += 0.1) m.step(s, p, 0.1)
  return s
}

test('every model survives a long run with finite readouts', () => {
  for (const [id, m] of Object.entries(SIM_MODELS)) {
    const s = run(id, {}, 60)
    for (const r of m.readouts) {
      const v = s.scalars[r.key]
      assert.ok(v == null || Number.isFinite(v), `${id}.${r.key} finite (got ${v})`)
    }
    for (const series of m.series) {
      assert.ok((s.series[series.key]?.length ?? 0) > 0, `${id} series ${series.key} populated`)
    }
  }
})

test('queue: stable below capacity, divergent past the knee', () => {
  const stable = run('queue', { rps: 400, servers: 5, serviceMs: 10 }, 30)
  assert.ok(stable.scalars.p99 < 60, `stable p99 ≈ service time (got ${stable.scalars.p99})`)
  assert.ok(Math.abs(stable.scalars.util - 80) < 3, `util ≈ 80% (got ${stable.scalars.util})`)

  const overload = run('queue', { rps: 900, servers: 5, serviceMs: 10 }, 30)
  assert.ok(overload.scalars.p99 > 1000, `overloaded p99 runs away (got ${overload.scalars.p99})`)
  assert.ok(overload.scalars.queueLen > 1000, 'queue grows without bound past capacity')
})

test('failover: observed availability ≈ MTBF/(MTBF+MTTR); design nines exact', () => {
  // stochastic, generous tolerance: analytic 60/(60.5) = 99.17%
  const one = run('failover', { replicas: 1, mtbfH: 60, mttrM: 30 }, 600)
  assert.ok(Math.abs(one.scalars.avail - 99.17) < 1.2, `observed ≈ analytic (got ${one.scalars.avail})`)

  // design (analytic) values are deterministic: u = 1.5/21.5, nines = -log10(u^n)
  const u = 1.5 / 21.5
  for (const n of [1, 2, 3]) {
    const s = run('failover', { replicas: n, mtbfH: 20, mttrM: 90 }, 1)
    const predicted = (1 - Math.pow(u, n)) * 100
    assert.ok(Math.abs(s.scalars.predAvail - predicted) < 1e-6, `design avail r=${n}`)
  }
})

test('compound: matches closed-form SIP future value within integration error', () => {
  const s = run('compound', { monthly: 10000, rate: 12, fee: 1 }, 20)
  const i = 12 / 1200
  const n = 240
  const closed = 10000 * ((Math.pow(1 + i, n) - 1) / i) * (1 + i)
  const rel = Math.abs(s.scalars.grossL * 100000 - closed) / closed
  assert.ok(rel < 0.03, `gross within 3% of closed form (rel ${rel})`)
  assert.ok(s.scalars.netL < s.scalars.grossL, 'fee drag strictly reduces the corpus')
})

test('retention: exponential decay, review multiplies stability', () => {
  const m = SIM_MODELS.retention
  const p = { stability: 3 }
  const s = m.init(p)
  for (let t = 0; t < 3; t += 0.1) m.step(s, p, 0.1) // 6 simulated days
  assert.ok(Math.abs(s.scalars.recall - 100 * Math.exp(-6 / 3)) < 1.5, 'decay ≈ exp(-t/S)')
  const before = s.scalars.stabilityNow
  m.actions?.find((a) => a.id === 'review')?.apply(s, p)
  m.step(s, p, 0.1)
  assert.ok(s.scalars.stabilityNow > before, 'reviewing grows stability')
})
