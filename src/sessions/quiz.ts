import { el } from '../dom'
import { stage } from '../fx'
import type { QuizSession } from '../types'
import { iconSpan } from './icon'
import { mountMCQ } from './mcq'
import { register, type SessionModule } from './registry'

const QUIZ_SVG = `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="2"/><path d="M16 17c0-2.5 1.8-4 4-4s4 1.5 4 3.5c0 2-2 3-4 3.5v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="28" r="1.5" fill="currentColor"/></svg>`

function mountQuiz(
  root: HTMLElement,
  session: QuizSession,
  onComplete: (score: number, max: number) => void,
): void {
  let index = 0
  let score = 0
  const max = session.questions.length

  const render = () => {
    if (index >= max) {
      root.replaceChildren(
        stage('quiz', 'Quick check', session.title, [
          el('div', { class: 'result-card' }, [
            el('h2', {}, ['Session complete']),
            el('p', { class: 'score-hero' }, [`${score} / ${max}`]),
            el('p', { class: 'muted' }, [
              'Refresh anytime — progress is saved on this device.',
            ]),
          ]),
        ]),
      )
      onComplete(score, max)
      return
    }

    const q = session.questions[index]
    const body: (Node | string)[] = []
    if (session.intro && index === 0) {
      body.push(el('p', { class: 'stage-lead' }, [session.intro]))
    }
    body.push(el('p', { class: 'step-meta' }, [`Question ${index + 1} of ${max}`]))
    body.push(
      mountMCQ({
        prompt: q.prompt,
        choices: q.choices,
        answerIndex: q.answerIndex,
        explanation: q.explanation,
        layout: 'list',
        onResolve: (correct, feedback) => {
          if (correct) score += 1
          const next = el('button', { class: 'primary', type: 'button' }, [
            index + 1 >= max ? 'Finish' : 'Next',
          ])
          next.addEventListener('click', () => {
            index += 1
            render()
          })
          feedback.append(next)
        },
      }),
    )
    root.replaceChildren(stage('quiz', 'Quick check', session.title, body))
  }

  render()
}

export const quizModule: SessionModule<QuizSession> = {
  kind: 'quiz',
  label: 'Quiz',
  blurb: 'Check what stuck',
  icon: () => iconSpan('quiz', QUIZ_SVG),
  mount: mountQuiz,
  validate: (s) => {
    const errs: string[] = []
    s.questions.forEach((q, i) => {
      if (q.answerIndex < 0 || q.answerIndex >= q.choices.length) {
        errs.push(`questions[${i}].answerIndex out of range`)
      }
    })
    return errs
  },
}
register(quizModule)
