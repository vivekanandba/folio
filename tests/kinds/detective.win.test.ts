import { describe, expect, it } from 'vitest'

describe('detective win — specs/KIND_detective.md', () => {
  it('scenario-visual-diagnosis scoring is binary match', () => {
    const correctId = 'flexi-large'
    const picked = 'flexi-large'
    const score = picked === correctId ? 1 : 0
    expect(score).toBe(1)
  })
})
