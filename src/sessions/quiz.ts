import { el } from '../dom'
import type { KindMount, RuntimeApi } from '../runtime/phases'
import type { QuizSession, Session } from '../types'

export function createQuizMount(): KindMount {
  let host: HTMLElement | undefined

  return {
    mount(nextHost: HTMLElement, rawSession: Session, api: RuntimeApi): void {
      const session = rawSession as QuizSession
      host = nextHost
      let index = 0
      let score = 0
      const max = session.questions.length

      const render = () => {
        host?.replaceChildren()
        if (session.intro && index === 0) {
          host?.append(el('p', { class: 'lead' }, [session.intro]))
        }

        if (index >= max) {
          host?.append(
            el('div', { class: 'result-card' }, [
              el('h2', {}, ['Session complete']),
              el('p', {}, [`Score: ${score} / ${max}`]),
            ]),
          )
          api.requestCheck()
          api.complete({ score, maxScore: max })
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
        host?.append(card)
      }

      render()
    },
    destroy(): void {
      host?.replaceChildren()
      host = undefined
    },
  }
}
