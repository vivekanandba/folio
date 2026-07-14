import { beforeEach, describe, expect, it } from 'vitest'
import {
  _migrateV1ForTests,
  KEY_V1,
  KEY_V2,
  loadProgress,
  nextIncompleteSession,
  recordAttempt,
  weakConcepts,
} from '../../src/progress'

describe('progress v2 — specs/PROGRESS_v2.md', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates v1 stamps to attempts', () => {
    localStorage.setItem(
      KEY_V1,
      JSON.stringify({
        lastPackId: 'p',
        sessions: {
          'p::s1': {
            packId: 'p',
            sessionId: 's1',
            kind: 'quiz',
            score: 3,
            maxScore: 5,
            completedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      }),
    )
    const store = loadProgress()
    expect(store.version).toBe(2)
    expect(store.sessions['p::s1']?.bestScore).toBe(3)
    expect(store.sessions['p::s1']?.attempts).toHaveLength(1)
    expect(localStorage.getItem(KEY_V2)).toBeTruthy()
  })

  it('Continue selects first incomplete', () => {
    recordAttempt({
      packId: 'p',
      sessionId: 'a',
      score: 1,
      maxScore: 1,
    })
    expect(nextIncompleteSession('p', ['a', 'b', 'c'])).toBe('b')
  })

  it('weak concepts sort by strength', () => {
    recordAttempt({
      packId: 'p',
      sessionId: 's',
      score: 1,
      maxScore: 1,
      conceptIds: ['strong'],
    })
    const weak = weakConcepts([{ id: 'weak' }, { id: 'strong' }], loadProgress(), 2)
    expect(weak[0]?.id).toBe('weak')
  })

  it('migrate helper preserves score', () => {
    const migrated = _migrateV1ForTests(
      JSON.stringify({
        sessions: {
          'p::x': {
            score: 2,
            maxScore: 4,
            completedAt: 't',
            packId: 'p',
            sessionId: 'x',
            kind: 'quiz',
          },
        },
      }),
    )
    expect(migrated.sessions['p::x']?.bestScore).toBe(2)
  })
})
