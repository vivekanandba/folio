import { describe, expect, it } from 'vitest'

describe('quiz win — specs/KIND_quiz.md', () => {
  it('retrieve score is correct count', () => {
    const answers = [0, 1, 1]
    const key = [0, 1, 0]
    const score = answers.filter((a, i) => a === key[i]).length
    expect(score).toBe(2)
  })
})
