import type { Session } from '../types'
import { mountAudit } from './audit'
import { mountCalculator } from './calculator'
import { mountClassify } from './classify'
import { mountDecision } from './decision'
import { mountDetective } from './detective'
import { mountQuiz } from './quiz'

export function mountSession(
  root: HTMLElement,
  session: Session,
  onComplete: (score: number, max: number) => void,
): void {
  switch (session.kind) {
    case 'quiz':
      mountQuiz(root, session, onComplete)
      break
    case 'classify':
      mountClassify(root, session, onComplete)
      break
    case 'detective':
      mountDetective(root, session, onComplete)
      break
    case 'calculator':
      mountCalculator(root, session, onComplete)
      break
    case 'audit':
      mountAudit(root, session, onComplete)
      break
    case 'decision':
      mountDecision(root, session, onComplete)
      break
    default: {
      const _exhaustive: never = session
      void _exhaustive
      root.textContent = 'Unknown session kind'
    }
  }
}
