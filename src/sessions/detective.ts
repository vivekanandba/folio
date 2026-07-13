import { el } from '../dom'
import type { DetectiveSession } from '../types'
import { stackedBar, stepPills } from '../visuals'

export function mountDetective(
  root: HTMLElement,
  session: DetectiveSession,
  onComplete: (score: number, max: number) => void,
): void {
  let revealed = 0

  const compositionFor = (n: number) => {
    if (!session.composition?.length) return null
    const segs = session.composition
      .filter((s) => s.revealAfter <= n)
      .map((s) => ({ label: s.label, pct: s.pct, color: s.color }))
    if (!segs.length) return null
    return stackedBar(segs, {
      title: n < session.facts.length ? 'Portfolio emerging…' : 'Portfolio picture',
      height: 36,
    })
  }

  const render = () => {
    root.replaceChildren()
    if (session.intro) {
      root.append(el('p', { class: 'lead' }, [session.intro]))
    }
    root.append(stepPills(Math.max(1, revealed), session.facts.length))

    const viz = compositionFor(revealed)
    if (viz) {
      viz.classList.add('viz-panel', 'pop-in')
      root.append(viz)
    } else if (session.composition) {
      root.append(
        el('div', { class: 'viz-placeholder' }, [
          el('p', { class: 'muted' }, [
            'Reveal clues to assemble the portfolio picture.',
          ]),
        ]),
      )
    }

    const dossier = el('div', { class: 'dossier' }, [
      el('div', { class: 'dossier-head' }, [
        el('h2', {}, ['Case dossier']),
        el('span', { class: 'muted small' }, [
          `${revealed}/${session.facts.length} clues`,
        ]),
      ]),
    ])

    if (revealed === 0) {
      dossier.append(
        el('div', { class: 'dossier-empty' }, [
          'No clues yet — peel the case open one layer at a time.',
        ]),
      )
    }

    session.facts.slice(0, revealed).forEach((fact, i) => {
      dossier.append(
        el('div', { class: 'fact pop-in', style: `--i:${i}` }, [
          el('span', { class: 'fact-index' }, [String(i + 1)]),
          el('div', { class: 'fact-body' }, [
            el('span', { class: 'fact-label' }, [fact.label]),
            el('span', { class: 'fact-value' }, [fact.value]),
          ]),
        ]),
      )
    })
    root.append(dossier)

    if (revealed < session.facts.length) {
      const actions = el('div', { class: 'session-actions' })
      const btn = el('button', { class: 'primary', type: 'button' }, [
        revealed === 0 ? 'Reveal first clue' : 'Reveal next clue',
      ])
      btn.addEventListener('click', () => {
        revealed += 1
        render()
      })
      actions.append(btn)
      if (revealed > 0) {
        const diagnoseEarly = el('button', { class: 'ghost', type: 'button' }, [
          'Diagnose now',
        ])
        diagnoseEarly.addEventListener('click', () => showDiagnosis())
        actions.append(diagnoseEarly)
      }
      root.append(actions)
      return
    }

    showDiagnosis()
  }

  const showDiagnosis = () => {
    root.replaceChildren()
    root.append(stepPills(session.facts.length, session.facts.length))
    const viz = compositionFor(session.facts.length)
    if (viz) {
      viz.classList.add('viz-panel')
      root.append(viz)
    }

    const dossier = el('div', { class: 'dossier' }, [
      el('h2', {}, ['Full dossier']),
    ])
    session.facts.forEach((fact, i) => {
      dossier.append(
        el('div', { class: 'fact' }, [
          el('span', { class: 'fact-index' }, [String(i + 1)]),
          el('div', { class: 'fact-body' }, [
            el('span', { class: 'fact-label' }, [fact.label]),
            el('span', { class: 'fact-value' }, [fact.value]),
          ]),
        ]),
      )
    })
    root.append(
      dossier,
      el('h2', { class: 'diagnose-q' }, [session.question]),
    )

    const choices = el('div', { class: 'choice-list' })
    session.choices.forEach((choice, i) => {
      const btn = el('button', { class: 'choice-btn', type: 'button' }, [choice])
      btn.addEventListener('click', () => {
        const correct = i === session.answerIndex
        choices.querySelectorAll('button').forEach((b, j) => {
          b.setAttribute('disabled', 'true')
          if (j === session.answerIndex) b.classList.add('correct')
          if (j === i && !correct) b.classList.add('wrong')
        })
        root.append(
          el('div', { class: 'feedback pop-in' }, [
            el('p', { class: correct ? 'ok' : 'bad' }, [
              correct ? 'Diagnosis matches the case.' : 'Close — see the debrief.',
            ]),
            el('p', {}, [session.debrief]),
          ]),
        )
        onComplete(correct ? 1 : 0, 1)
      })
      choices.append(btn)
    })
    root.append(choices)
  }

  render()
}
