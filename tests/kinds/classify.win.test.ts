import { describe, expect, it } from 'vitest'
import { scoreClassify } from '../../src/scoring/classify'

describe('classify win — specs/KIND_classify.md', () => {
  const cards = [
    { id: 'a', text: 'A', bucketId: 'x' },
    { id: 'b', text: 'B', bucketId: 'y' },
  ]

  it('scenario-perfect-placement', () => {
    const r = scoreClassify(cards, { a: 'x', b: 'y' })
    expect(r.score).toBe(2)
    expect(r.maxScore).toBe(2)
    expect(r.misses).toHaveLength(0)
  })

  it('scenario-partial-placement', () => {
    const r = scoreClassify(cards, { a: 'x', b: 'x' })
    expect(r.score).toBe(1)
    expect(r.misses[0]?.id).toBe('b')
  })
})
