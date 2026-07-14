import { describe, expect, it } from 'vitest'
import { labInPassBand } from '../../src/scoring/lab'
import { activeShareFormula } from '../../src/labs/registry'

describe('lab win — specs/KIND_lab.md', () => {
  it('scenario-pass-band', () => {
    const metrics = activeShareFormula.compute(
      { a: 0.5, b: 0.5 },
      { indexValues: { a: 0.25, b: 0.25 } },
    )
    expect(metrics.activeShare).toBeCloseTo(0.25)
    expect(
      labInPassBand(metrics, { metric: 'activeShare', min: 0.2, max: 0.4 }),
    ).toBe(true)
    expect(
      labInPassBand(metrics, { metric: 'activeShare', min: 0.5, max: 0.9 }),
    ).toBe(false)
  })
})
