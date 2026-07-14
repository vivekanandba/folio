import { beforeEach, describe, expect, it } from 'vitest'
import { loadProgress, recordAttempt, weakConcepts } from '../../src/progress'

describe('revisit queue — Phase 4', () => {
  beforeEach(() => localStorage.clear())

  it('lists lowest strength concepts first', () => {
    recordAttempt({
      packId: 'p',
      sessionId: 's1',
      score: 1,
      maxScore: 1,
      conceptIds: ['a'],
    })
    recordAttempt({
      packId: 'p',
      sessionId: 's2',
      score: 0,
      maxScore: 1,
      conceptIds: ['b'],
    })
    const weak = weakConcepts(
      [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      loadProgress(),
      3,
    )
    // untouched + failed ahead of strong; a practiced well stays last
    expect(weak.map((w) => w.id).at(-1)).toBe('a')
    expect(weak[0]?.strength).toBeLessThanOrEqual(weak.at(-1)!.strength)
  })
})
