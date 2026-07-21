import { el } from '../dom'
import { burst, donut, stage } from '../fx'
import type { DetectiveSession } from '../types'
import { stepPills } from '../visuals'
import { iconSpan } from './icon'
import { mountMCQ } from './mcq'
import { register, type SessionModule } from './registry'

const DETECTIVE_SVG = `<svg viewBox="0 0 40 40" fill="none"><circle cx="18" cy="18" r="8" stroke="currentColor" stroke-width="2"/><path d="M24 24l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 16h8M16 20h4" stroke="currentColor" stroke-width="1.5"/></svg>`

function mountDetective(
  root: HTMLElement,
  session: DetectiveSession,
  onComplete: (score: number, max: number) => void,
): void {
  let revealed = 0
  let diagnosing = false

  const segsAt = (n: number) => {
    if (!session.composition?.length) return []
    return session.composition
      .filter((s) => s.revealAfter <= n)
      .map((s) => ({ label: s.label, pct: s.pct, color: s.color ?? '#0f766e' }))
  }

  const render = () => {
    diagnosing = false
    const body: (Node | string)[] = []
    if (session.intro) body.push(el('p', { class: 'stage-lead' }, [session.intro]))
    body.push(stepPills(Math.max(revealed, 1), session.facts.length))

    const layout = el('div', { class: 'detective-layout' })

    const board = el('div', { class: 'detective-board' })
    const segs = segsAt(revealed)
    if (segs.length) {
      board.append(donut(segs, { title: 'What the book looks like', size: 240 }))
    } else {
      board.append(
        el('div', { class: 'sealed-case' }, [
          el('div', { class: 'sealed-stamp' }, ['SEALED']),
          el('p', {}, ['The portfolio picture is locked. Open clues to unlock it.']),
        ]),
      )
    }
    layout.append(board)

    const deck = el('div', { class: 'clue-deck' }, [el('h3', {}, ['Clue deck'])])
    session.facts.forEach((fact, i) => {
      const open = i < revealed
      const card = el('button', {
        class: `clue-card${open ? ' open' : ' sealed'}`,
        type: 'button',
        ...(open || i !== revealed ? { disabled: 'true' } : {}),
      })
      if (open) {
        card.append(
          el('span', { class: 'clue-num' }, [`Clue ${i + 1}`]),
          el('strong', {}, [fact.label]),
          el('span', {}, [fact.value]),
        )
      } else if (i === revealed) {
        card.append(
          el('span', { class: 'clue-num' }, [`Clue ${i + 1}`]),
          el('strong', {}, ['Tap to peel open']),
          el('span', { class: 'muted' }, ['Face down']),
        )
        card.addEventListener('click', () => {
          burst(card)
          revealed += 1
          render()
        })
      } else {
        card.append(
          el('span', { class: 'clue-num' }, [`Clue ${i + 1}`]),
          el('strong', {}, ['Locked']),
          el('span', { class: 'muted' }, ['Open previous first']),
        )
      }
      deck.append(card)
    })
    layout.append(deck)
    body.push(layout)

    const actions = el('div', { class: 'session-actions' })
    if (revealed > 0 && revealed < session.facts.length) {
      const early = el('button', { class: 'ghost', type: 'button' }, [
        'Diagnose with current clues',
      ])
      early.addEventListener('click', () => showDiagnosis(bodyEl))
      actions.append(early)
    }
    if (revealed >= session.facts.length) {
      const go = el('button', { class: 'primary pulse', type: 'button' }, [
        'Make your diagnosis',
      ])
      go.addEventListener('click', () => showDiagnosis(bodyEl))
      actions.append(go)
    }
    if (actions.childNodes.length) body.push(actions)

    const stageEl = stage('detective', 'Detective case', session.title, body)
    const bodyEl = stageEl.querySelector<HTMLElement>('.stage-body')!
    root.replaceChildren(stageEl)
  }

  const showDiagnosis = (host: HTMLElement) => {
    if (diagnosing) return
    diagnosing = true
    const panel = el('div', { class: 'diagnose-panel pop-in' })
    panel.append(
      mountMCQ({
        prompt: session.question,
        choices: session.choices,
        answerIndex: session.answerIndex,
        explanation: session.debrief,
        layout: 'grid',
        okText: 'Case closed — diagnosis matches.',
        badText: 'Not the strongest read.',
        onResolve: (correct) => onComplete(correct ? 1 : 0, 1),
      }),
    )
    host.append(panel)
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  render()
}

export const detectiveModule: SessionModule<DetectiveSession> = {
  kind: 'detective',
  label: 'Detective',
  blurb: 'Clues → diagnosis',
  icon: () => iconSpan('detective', DETECTIVE_SVG),
  mount: mountDetective,
  validate: (s) => {
    const errs: string[] = []
    if (s.answerIndex < 0 || s.answerIndex >= s.choices.length) {
      errs.push('answerIndex out of range')
    }
    s.composition?.forEach((c, i) => {
      if (c.revealAfter < 1 || c.revealAfter > s.facts.length) {
        errs.push(`composition[${i}].revealAfter out of range`)
      }
    })
    return errs
  },
}
register(detectiveModule)
