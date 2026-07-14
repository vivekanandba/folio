import type { KindMount, RuntimeApi } from '../runtime/phases'
import type { CompleteResult, Session } from '../types'
import { createAuditMount } from './audit'
import { createCalculatorMount } from './calculator'
import { createClassifyMount } from './classify'
import { createDecisionMount } from './decision'
import { createDetectiveMount } from './detective'
import { createLabMount } from './lab'
import { createQuizMount } from './quiz'

export function getKindMount(session: Session): KindMount {
  switch (session.kind) {
    case 'quiz': return createQuizMount()
    case 'classify': return createClassifyMount()
    case 'detective': return createDetectiveMount()
    case 'lab': return createLabMount()
    case 'calculator': return createCalculatorMount()
    case 'audit': return createAuditMount()
    case 'decision': return createDecisionMount()
  }
}

export function mountSession(
  root: HTMLElement,
  session: Session,
  onComplete: (score: number, max: number) => void,
): void {
  const mount = getKindMount(session)
  let phase: RuntimeApi['getPhase'] extends () => infer P ? P : never = 'interact'
  const api: RuntimeApi = {
    reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    getPhase: () => phase,
    setPhase: (next) => { phase = next },
    requestCheck: () => { phase = 'check' },
    complete: (result: CompleteResult) => onComplete(result.score, result.maxScore),
  }
  mount.mount(root, session, api)
}
