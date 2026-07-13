import { el } from '../dom'
import type { DetectiveSession } from '../types'

export function mountDetective(
  root: HTMLElement,
  session: DetectiveSession,
  onComplete: (score: number, max: number) => void,
): void {
  let revealed = 0

  const render = () => {
    root.replaceChildren()
    if (session.intro) {
      root.append(el('p', { class: 'lead' }, [session.intro]))
    }

    const dossier = el('div', { class: 'dossier' }, [
      el('h2', {}, ['Dossier']),
    ])
    session.facts.slice(0, revealed).forEach((fact) => {
      dossier.append(
        el('div', { class: 'fact' }, [
          el('span', { class: 'fact-label' }, [fact.label]),
          el('span', { class: 'fact-value' }, [fact.value]),
        ]),
      )
    })
    root.append(dossier)

    if (revealed < session.facts.length) {
      const btn = el('button', { class: 'primary', type: 'button' }, [
        revealed === 0 ? 'Reveal first clue' : 'Reveal next clue',
      ])
      btn.addEventListener('click', () => {
        revealed += 1
        render()
      })
      root.append(btn)
      if (revealed > 0) {
        root.append(
          el('p', { class: 'muted' }, [
            `${revealed} of ${session.facts.length} clues revealed. You can diagnose early when ready.`,
          ]),
        )
        const diagnoseEarly = el('button', { class: 'ghost', type: 'button' }, [
          'Diagnose now',
        ])
        diagnoseEarly.addEventListener('click', () => showDiagnosis())
        root.append(diagnoseEarly)
      }
      return
    }

    showDiagnosis()
  }

  const showDiagnosis = () => {
    root.replaceChildren()
    const dossier = el('div', { class: 'dossier' }, [el('h2', {}, ['Full dossier'])])
    session.facts.forEach((fact) => {
      dossier.append(
        el('div', { class: 'fact' }, [
          el('span', { class: 'fact-label' }, [fact.label]),
          el('span', { class: 'fact-value' }, [fact.value]),
        ]),
      )
    })
    root.append(dossier, el('h2', {}, [session.question]))

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
          el('div', { class: 'feedback' }, [
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
