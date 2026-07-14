import { describe, expect, it } from 'vitest'
import { createPhaseMachine } from '../../src/runtime/phases'

describe('runtime phases — specs/RUNTIME.md', () => {
  it('cannot complete before check', () => {
    const api = createPhaseMachine({ reducedMotion: true })
    api.setPhase('interact')
    expect(() => api.assertCanComplete()).toThrow(/check/i)
    api.requestCheck()
    expect(api.getPhase()).toBe('check')
    expect(() => api.assertCanComplete()).not.toThrow()
  })
})
