import type { CompleteResult, Session } from '../types'

export type Phase = 'intro' | 'interact' | 'check' | 'debrief' | 'done'

export interface RuntimeApi {
  requestCheck(): void
  complete(result: CompleteResult): void
  setPhase(phase: Phase): void
  reducedMotion: boolean
  getPhase(): Phase
}

export interface KindMount {
  mount(host: HTMLElement, session: Session, api: RuntimeApi): void
  destroy(): void
}

export function createPhaseMachine(opts?: {
  onPhase?: (phase: Phase) => void
  reducedMotion?: boolean
}): RuntimeApi & { assertCanComplete(): void } {
  let phase: Phase = 'intro'
  let completed = false
  const reducedMotion =
    opts?.reducedMotion ??
    (typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches)

  const setPhase = (next: Phase) => {
    phase = next
    opts?.onPhase?.(phase)
  }

  const api: RuntimeApi & { assertCanComplete(): void } = {
    reducedMotion,
    getPhase: () => phase,
    setPhase,
    requestCheck: () => {
      if (phase === 'interact' || phase === 'intro') setPhase('check')
    },
    complete: () => {
      api.assertCanComplete()
      completed = true
      setPhase('done')
    },
    assertCanComplete: () => {
      if (completed) return
      if (phase !== 'check' && phase !== 'debrief' && phase !== 'done') {
        throw new Error('Cannot complete before check phase')
      }
    },
  }
  return api
}
