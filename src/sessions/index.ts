import type { Session } from '../types'
import { getModule } from './registry'

// Import every module in this directory for its side effects. Each kind file calls
// register() at load, so dropping a new kind file in src/sessions/ is all it takes.
import.meta.glob('./*.ts', { eager: true })

export * from './registry'

export function mountSession(
  root: HTMLElement,
  session: Session,
  onComplete: (score: number, max: number) => void,
): void {
  const mod = getModule(session.kind)
  if (!mod) {
    root.textContent = 'Unknown session kind'
    return
  }
  mod.mount(root, session, onComplete)
}
