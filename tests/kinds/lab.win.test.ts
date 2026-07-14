import { describe, expect, it } from 'vitest'
import { labInPassBand } from '../../src/scoring/lab'

describe('lab kind smoke', () => {
  it('exports pass-band helper', () => {
    expect(labInPassBand({ activeShare: 0.5 }, { metric: 'activeShare', min: 0.4, max: 0.6 })).toBe(true)
  })
})
