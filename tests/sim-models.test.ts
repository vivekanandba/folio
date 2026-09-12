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

test('glidepath: equity share interpolates exactly; crash damage scales with equity', () => {
  const m = SIM_MODELS.glidepath
  const p = { targetYears: 20, equityStart: 90, equityEnd: 20, monthly: 15000 }

  // equity% is deterministic linear interpolation regardless of return noise
  const s = m.init(p)
  for (let t = 0; t < 10; t += 0.1) m.step(s, p, 0.1) // 10 years = halfway
  assert.ok(Math.abs(s.scalars.equityPct - 55) < 1, `halfway equity ≈ 55% (got ${s.scalars.equityPct})`)
  assert.ok(s.scalars.corpusL > 0, 'corpus accumulates')

  const late = m.init(p)
  for (let t = 0; t < 20; t += 0.1) m.step(late, p, 0.1)
  assert.ok(Math.abs(late.scalars.equityPct - 20) < 1, 'at target the glide holds equityEnd')
  for (let t = 0; t < 5; t += 0.1) m.step(late, p, 0.1)
  assert.ok(Math.abs(late.scalars.equityPct - 20) < 1, 'past target it stays de-risked')

  // crash cost = 30% × current equity share, exactly
  const crash = m.actions?.find((a) => a.id === 'crash')
  assert.ok(crash, 'crash action exists')
  const early = m.init(p)
  for (let t = 0; t < 2; t += 0.1) m.step(early, p, 0.1) // equity ≈ 83%
  crash!.apply(early, p)
  m.step(early, p, 0.1)
  const lateHit = m.init(p)
  for (let t = 0; t < 19; t += 0.1) m.step(lateHit, p, 0.1) // equity ≈ 23.5%
  crash!.apply(lateHit, p)
  m.step(lateHit, p, 0.1)
  assert.ok(early.scalars.crashHit > 20 && early.scalars.crashHit < 28, `early crash costs ~25% (got ${early.scalars.crashHit})`)
  assert.ok(lateHit.scalars.crashHit < 9, `late crash costs <9% (got ${lateHit.scalars.crashHit})`)
  assert.ok(early.scalars.crashHit > 2 * lateHit.scalars.crashHit, 'the glide is the protection')
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
