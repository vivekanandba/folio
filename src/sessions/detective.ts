import { el } from '../dom'
import { burst, donut, shake } from '../fx'
import type { DetectiveSession } from '../types'
import { stepPills } from '../visuals'

export function mountDetective(
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
      .map((s) => ({
        label: s.label,
        pct: s.pct,
        color: s.color ?? '#0f766e',
      }))
  }

  const render = () => {
    root.replaceChildren()
    diagnosing = false

    const stage = el('div', { class: 'stage stage-detective' }, [
      el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
    ])
    const inner = el('div', { class: 'stage-inner' })
    inner.append(
      el('div', { class: 'stage-kicker' }, ['Detective case']),
      el('h2', { class: 'stage-title' }, [session.title]),
    )
    if (session.intro) {
      inner.append(el('p', { class: 'stage-lead' }, [session.intro]))
    }
    inner.append(stepPills(Math.max(revealed, 1), session.facts.length))

    const layout = el('div', { class: 'detective-layout' })

    // Visual board
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

    // Clue deck
    const deck = el('div', { class: 'clue-deck' }, [
      el('h3', {}, ['Clue deck']),
    ])
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
    inner.append(layout)

    const actions = el('div', { class: 'session-actions' })
    if (revealed > 0 && revealed < session.facts.length) {
      const early = el('button', { class: 'ghost', type: 'button' }, [
        'Diagnose with current clues',
      ])
      early.addEventListener('click', () => showDiagnosis(inner))
      actions.append(early)
    }
    if (revealed >= session.facts.length) {
      const go = el('button', { class: 'primary pulse', type: 'button' }, [
        'Make your diagnosis',
      ])
      go.addEventListener('click', () => showDiagnosis(inner))
      actions.append(go)
    }
    if (actions.childNodes.length) inner.append(actions)

    stage.append(inner)
    root.append(stage)
  }

  const showDiagnosis = (host: HTMLElement) => {
    if (diagnosing) return
    diagnosing = true
    const panel = el('div', { class: 'diagnose-panel pop-in' }, [
      el('h3', {}, [session.question]),
    ])
    const choices = el('div', { class: 'choice-grid' })
    session.choices.forEach((choice, i) => {
      const btn = el('button', { class: 'choice-tile', type: 'button' }, [
        el('span', { class: 'choice-letter' }, [String.fromCharCode(65 + i)]),
        el('span', {}, [choice]),
      ])
      btn.addEventListener('click', () => {
        const correct = i === session.answerIndex
        choices.querySelectorAll('button').forEach((b, j) => {
          b.setAttribute('disabled', 'true')
          if (j === session.answerIndex) b.classList.add('correct')
          if (j === i && !correct) b.classList.add('wrong')
        })
        if (correct) burst(btn)
        else shake(btn)
        panel.append(
          el('div', { class: 'feedback pop-in' }, [
            el('p', { class: correct ? 'ok' : 'bad' }, [
              correct ? 'Case closed — diagnosis matches.' : 'Not the strongest read.',
            ]),
            el('p', {}, [session.debrief]),
          ]),
        )
        onComplete(correct ? 1 : 0, 1)
      })
      choices.append(btn)
    })
    panel.append(choices)
    host.append(panel)
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  render()
}
