import { describe, expect, it } from 'vitest'
import { scoreDecisionPath } from '../../src/scoring/decision'

describe('decision win — specs/KIND_decision.md', () => {
  it('scenario-path-score', () => {
    expect(scoreDecisionPath([1, 1, -1], 3)).toBe(1)
    expect(scoreDecisionPath([1, 1, 1], 3)).toBe(3)
    expect(scoreDecisionPath([-1, -1], 2)).toBe(0)
  })
})
