import assert from 'node:assert/strict'
import { test } from 'node:test'
import { COMPUTES } from '../src/computes.ts'

/** Golden values for every whitelisted compute, checked against closed forms
 *  computed independently here — not against the implementation itself. */

const close = (actual: number, expected: number, rel = 1e-9): void => {
  assert.ok(
    Math.abs(actual - expected) <= Math.abs(expected) * rel + 1e-9,
    `expected ${expected}, got ${actual}`,
  )
}

test('compound: lump sum growth', () => {
  close(COMPUTES.compound({ principal: 1000, rate: 10, years: 2 }), 1210)
  close(COMPUTES.compound({ principal: 46, rate: 25, years: 20 }), 46 * Math.pow(1.25, 20))
})

test('sipFuture: end-of-month SIP future value', () => {
  // rate 0 → simple sum of contributions
  close(COMPUTES.sipFuture({ monthly: 1000, rate: 0, years: 1 }), 12000)
  // closed form: P * ((1+i)^n - 1)/i * (1+i)
  const i = 12 / 1200
  const n = 120
  close(COMPUTES.sipFuture({ monthly: 10000, rate: 12, years: 10 }), 10000 * ((Math.pow(1 + i, n) - 1) / i) * (1 + i))
})

test('realReturn: inflation-adjusted', () => {
  close(COMPUTES.realReturn({ nominal: 12, inflation: 6 }), (1.12 / 1.06 - 1) * 100)
})

test('weightedYield: strips return of capital', () => {
  close(COMPUTES.weightedYield({ yield: 10, returnOfCapital: 40 }), 6)
})

test('downtime ↔ availabilityPct are inverses', () => {
  close(COMPUTES.downtime({ availability: 99.9 }), 525.6)
  close(COMPUTES.availabilityPct({ downtime: 525.6 }), 99.9)
  for (const a of [99, 99.5, 99.95, 99.99]) {
    close(COMPUTES.availabilityPct({ downtime: COMPUTES.downtime({ availability: a }) }), a)
  }
})

test('feeImpact: gross minus net future value', () => {
  const gross = 1000000 * Math.pow(1.12, 20)
  const net = 1000000 * Math.pow(1.105, 20)
  close(COMPUTES.feeImpact({ principal: 1000000, grossReturn: 12, expenseRatio: 1.5, years: 20 }), gross - net)
})

test('impliedCagr: multiple over years', () => {
  close(COMPUTES.impliedCagr({ start: 100, end: 800, years: 15 }), (Math.pow(8, 1 / 15) - 1) * 100)
})

test('simpleIncome', () => {
  close(COMPUTES.simpleIncome({ principal: 1000000, yield: 7.5 }), 75000)
})

test('LLM sizing computes', () => {
  close(COMPUTES.kvCacheGB({ tokensK: 32 }), 10.24)
  close(COMPUTES.modelMemory({ paramsB: 70, bits: 8 }), 70)
  close(COMPUTES.modelMemory({ paramsB: 7, bits: 16 }), 14)
  assert.equal(COMPUTES.gpusNeeded({ gb: 70, gpuGB: 80 }), 1)
  assert.equal(COMPUTES.gpusNeeded({ gb: 90, gpuGB: 80 }), 2)
  assert.equal(COMPUTES.usersFit({ poolGB: 180, gb: 5.12 }), Math.floor(180 / 5.12))
})
