import { el } from '../dom'
import type { QuizSession } from '../types'

export function mountQuiz(
  root: HTMLElement,
  session: QuizSession,
  onComplete: (score: number, max: number) => void,
): void {
  let index = 0
  let score = 0
  const max = session.questions.length

  const render = () => {
    root.replaceChildren()
    if (session.intro && index === 0) {
      root.append(el('p', { class: 'lead' }, [session.intro]))
    }

    if (index >= max) {
      root.append(
        el('div', { class: 'result-card' }, [
          el('h2', {}, ['Session complete']),
          el('p', {}, [`Score: ${score} / ${max}`]),
          el('p', { class: 'muted' }, [
            'Refresh anytime — progress is saved on this device.',
          ]),
        ]),
      )
      onComplete(score, max)
      return
    }

    const q = session.questions[index]
    const card = el('div', { class: 'session-card' }, [
      el('p', { class: 'step-meta' }, [`Question ${index + 1} of ${max}`]),
      el('h2', {}, [q.prompt]),
    ])

    const choices = el('div', { class: 'choice-list' })
    q.choices.forEach((choice, i) => {
      const btn = el('button', { class: 'choice-btn', type: 'button' }, [choice])
      btn.addEventListener('click', () => {
        const correct = i === q.answerIndex
        if (correct) score += 1
        choices.querySelectorAll('button').forEach((b, j) => {
          b.setAttribute('disabled', 'true')
          if (j === q.answerIndex) b.classList.add('correct')
          if (j === i && !correct) b.classList.add('wrong')
        })
        feedback.replaceChildren(
          el('p', { class: correct ? 'ok' : 'bad' }, [
            correct ? 'Correct.' : 'Not quite.',
          ]),
          el('p', {}, [q.explanation]),
          el('button', { class: 'primary', type: 'button' }, [
            index + 1 >= max ? 'Finish' : 'Next',
          ]),
        )
        feedback.querySelector('button')!.addEventListener('click', () => {
          index += 1
          render()
        })
      })
      choices.append(btn)
    })

    const feedback = el('div', { class: 'feedback' })
    card.append(choices, feedback)
    root.append(card)
  }

  render()
}
