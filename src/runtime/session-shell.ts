import { el } from '../dom'
import type { CompleteResult, Session } from '../types'
import { createPhaseMachine, type KindMount, type Phase, type RuntimeApi } from './phases'

export interface ShellOptions {
  mount: KindMount
  onComplete: (result: CompleteResult) => void
  conceptTitles?: Record<string, string>
  reducedMotion?: boolean
}

function debriefText(session: Session): { summary: string; principle?: string } {
  const d = session.debrief
  if (!d) return { summary: '' }
  if (typeof d === 'string') return { summary: d }
  return { summary: d.summary, principle: d.principle }
}

export function mountSessionShell(
  root: HTMLElement,
  session: Session,
  options: ShellOptions,
): { destroy: () => void } {
  const chrome = el('div', { class: 'session-chrome' })
  const chips = el('div', { class: 'concept-chips' })
  for (const cid of session.conceptIds) {
    const title = options.conceptTitles?.[cid] ?? cid
    chips.append(el('span', { class: 'concept-chip' }, [title]))
  }
  const phaseLabel = el('p', { class: 'phase-label muted small' }, ['Intro'])
  chrome.append(
    el('div', { class: 'session-chrome-top' }, [
      el('span', { class: 'tag kind' }, [session.kind === 'calculator' ? 'lab' : session.kind]),
      phaseLabel,
    ]),
    chips,
  )

  const host = el('div', { class: 'session-interact', id: 'session-interact' })
  const debriefHost = el('div', { class: 'session-debrief', hidden: 'true' })
  root.replaceChildren(chrome, host, debriefHost)

  let finished = false
  const machine = createPhaseMachine({
    reducedMotion: options.reducedMotion,
    onPhase: (phase) => {
      phaseLabel.textContent = phaseLabelText(phase)
      if (phase === 'debrief' || phase === 'done') {
        debriefHost.hidden = false
        const { summary, principle } = debriefText(session)
        debriefHost.replaceChildren()
        if (principle) {
          debriefHost.append(el('p', { class: 'principle' }, [principle]))
        }
        if (summary) {
          debriefHost.append(el('p', { class: 'debrief' }, [summary]))
        }
        debriefHost.focus?.()
      }
    },
  })

  const api: RuntimeApi = {
    reducedMotion: machine.reducedMotion,
    getPhase: () => machine.getPhase(),
    setPhase: (p) => machine.setPhase(p),
    requestCheck: () => machine.requestCheck(),
    complete: (result) => {
      if (finished) return
      machine.assertCanComplete()
      machine.setPhase('debrief')
      finished = true
      options.onComplete(result)
      machine.setPhase('done')
    },
  }

  machine.setPhase('interact')
  options.mount.mount(host, session, api)

  return {
    destroy: () => {
      options.mount.destroy()
      root.replaceChildren()
    },
  }
}

function phaseLabelText(phase: Phase): string {
  const map: Record<Phase, string> = {
    intro: 'Intro',
    interact: 'Practice',
    check: 'Check',
    debrief: 'Debrief',
    done: 'Done',
  }
  return map[phase]
}
