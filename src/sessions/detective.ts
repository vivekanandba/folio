import { el } from '../dom'
import { burst, donut, shake } from '../fx'
import type { KindMount, RuntimeApi } from '../runtime/phases'
import type { DetectiveSession, Session } from '../types'
import { stepPills } from '../visuals'

export function createDetectiveMount(): KindMount {
  let host: HTMLElement | undefined

  return {
    mount(nextHost: HTMLElement, rawSession: Session, api: RuntimeApi): void {
      const session = rawSession as DetectiveSession
      host = nextHost
      let revealed = 0
      let diagnosing = false
      const diagnoses = session.diagnoses ?? (session.choices ?? []).map((label, i) => ({
        id: `legacy-${i}`, label, correct: i === session.answerIndex,
      }))
      const segsAt = (n: number) => (session.composition ?? [])
        .filter((segment) => segment.revealAfter <= n)
        .map((segment) => ({ label: segment.label, pct: segment.pct, color: segment.color ?? '#0f766e' }))

      const render = () => {
        host?.replaceChildren()
        diagnosing = false

        const stage = el('div', { class: 'stage stage-detective' })
        const inner = el('div', { class: 'stage-inner' }, [
          el('div', { class: 'stage-kicker' }, ['Detective case']),
        ])
        if (session.intro) inner.append(el('p', { class: 'stage-lead' }, [session.intro]))
        inner.append(stepPills(Math.max(revealed, 1), session.facts.length))

        const layout = el('div', { class: 'detective-layout' })
        const board = el('div', { class: 'detective-board' })
        const segs = segsAt(revealed)
        board.append(segs.length
          ? donut(segs, { title: 'What the book looks like', size: 240 })
          : el('div', { class: 'sealed-case' }, [el('p', {}, ['Open clues to unlock the portfolio picture.'])]))
        layout.append(board)

        const deck = el('div', { class: 'clue-deck' }, [el('h3', {}, ['Clue deck'])])
        session.facts.forEach((fact, i) => {
          const open = i < revealed
          const card = el('button', {
            class: `clue-card${open ? ' open' : ' sealed'}`, type: 'button',
            ...(open || i !== revealed ? { disabled: 'true' } : {}),
          }, [el('span', { class: 'clue-num' }, [`Clue ${i + 1}`]), el('strong', {}, [open ? fact.label : i === revealed ? 'Tap to peel open' : 'Locked']), el('span', { class: 'muted' }, [open ? fact.value : ''])])
          if (!open && i === revealed) card.addEventListener('click', () => {
            if (!api.reducedMotion) burst(card)
            revealed += 1
            render()
          })
          deck.append(card)
        })
        layout.append(deck)
        inner.append(layout)

        const actions = el('div', { class: 'session-actions' })
        if (revealed > 0) {
          const diagnose = el('button', { class: 'primary pulse', type: 'button' }, ['Make your diagnosis'])
          diagnose.addEventListener('click', () => showDiagnosis(board))
          actions.append(diagnose)
        }
        inner.append(actions)
        stage.append(inner)
        host?.append(stage)
      }

      const showDiagnosis = (board: HTMLElement) => {
        if (diagnosing) return
        diagnosing = true
        const panel = el('div', { class: 'diagnose-panel pop-in' }, [
          el('h3', {}, [session.question ?? 'Which behaviour best fits the evidence?']),
        ])
        const choices = el('div', { class: 'choice-grid' })
        diagnoses.forEach((diagnosis) => {
          const button = el('button', { class: 'choice-tile', type: 'button' }, [diagnosis.label])
          button.addEventListener('click', () => {
            const correct = diagnosis.correct === true
            api.requestCheck()
            choices.querySelectorAll('button').forEach((candidate, i) => {
              candidate.setAttribute('disabled', 'true')
              if (diagnoses[i].correct) candidate.classList.add('correct')
            })
            if (!correct) button.classList.add('wrong')
            if (correct && !api.reducedMotion) burst(button)
            else if (!correct && !api.reducedMotion) shake(button)
            panel.append(el('div', { class: 'feedback pop-in' }, [
              el('p', { class: correct ? 'ok' : 'bad' }, [correct ? 'Case closed — diagnosis matches.' : 'Not the strongest read.']),
            ]))
            if (correct) {
              api.complete({ score: 1, maxScore: 1 })
            } else {
              const retry = el('button', { class: 'ghost', type: 'button' }, ['Review clues and try again'])
              retry.addEventListener('click', render)
              panel.append(retry)
            }
          })
          choices.append(button)
        })
        panel.append(choices)
        board.append(panel)
      }

      render()
    },
    destroy(): void {
      host?.replaceChildren()
      host = undefined
    },
  }
}
