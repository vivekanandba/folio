import { el } from '../dom'
import { burst, shake } from '../fx'
import { richBlock } from '../widgets'

export interface MCQOptions {
  prompt?: string
  choices: string[]
  answerIndex: number
  /** Markdown; may embed ```viz interactive figures (src/widgets.ts). */
  explanation?: string
  /** 'list' = stacked .choice-btn (quiz); 'grid' = lettered .choice-tile (detective/lab). */
  layout?: 'list' | 'grid'
  okText?: string
  badText?: string
  /** Called once, after feedback renders. `feedback` is the block callers can extend (e.g. a Next button). */
  onResolve?: (correct: boolean, feedback: HTMLElement) => void
}

/**
 * Single-question multiple choice with correct/wrong highlight + burst/shake feedback.
 * Extracted from quiz / detective(showDiagnosis) / calculator(renderJudgment).
 *
 * Choices render in a fresh random order every mount: replaying a session must
 * test the knowledge, not the remembered position of last time's answer.
 */
export function mountMCQ(opts: MCQOptions): HTMLElement {
  const wrap = el('div', { class: 'mcq' })
  if (opts.prompt) wrap.append(el('h3', {}, [opts.prompt]))

  const grid = opts.layout === 'grid'
  const list = el('div', { class: grid ? 'choice-grid' : 'choice-list' })
  const feedback = el('div', { class: 'feedback' })

  // Display order: a shuffled view over the authored choices.
  const order = opts.choices.map((_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  order.forEach((origIndex, displayIndex) => {
    const choice = opts.choices[origIndex]
    const btn = grid
      ? el('button', { class: 'choice-tile', type: 'button' }, [
          el('span', { class: 'choice-letter' }, [String.fromCharCode(65 + displayIndex)]),
          el('span', {}, [choice]),
        ])
      : el('button', { class: 'choice-btn', type: 'button' }, [choice])
    btn.addEventListener('click', () => {
      const correct = origIndex === opts.answerIndex
      list.querySelectorAll('button').forEach((b, j) => {
        b.setAttribute('disabled', 'true')
        if (order[j] === opts.answerIndex) b.classList.add('correct')
        if (j === displayIndex && !correct) b.classList.add('wrong')
      })
      if (correct) burst(btn)
      else shake(btn)
      feedback.replaceChildren(
        el('p', { class: correct ? 'ok' : 'bad' }, [
          correct ? (opts.okText ?? 'Correct.') : (opts.badText ?? 'Not quite.'),
        ]),
        ...(opts.explanation ? [richBlock(opts.explanation)] : []),
      )
      opts.onResolve?.(correct, feedback)
    })
    list.append(btn)
  })

  wrap.append(list, feedback)
  return wrap
}
