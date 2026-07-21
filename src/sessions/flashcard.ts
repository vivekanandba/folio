import { el } from '../dom'
import { stage } from '../fx'
import type { Flashcard } from '../types'

// Self-grade buttons map to a 0..1 normalized performance that feeds the SRS scheduler.
const GRADES = [
  { label: 'Again', value: 0.2, cls: 'grade-again' },
  { label: 'Hard', value: 0.5, cls: 'grade-hard' },
  { label: 'Good', value: 0.75, cls: 'grade-good' },
  { label: 'Easy', value: 1.0, cls: 'grade-easy' },
]

/**
 * Flip-and-self-grade review over a concept's derived cards. Not a content SessionModule —
 * driven directly by the review page. Calls onComplete with the average normalized grade.
 */
export function mountFlashcards(
  root: HTMLElement,
  title: string,
  cards: Flashcard[],
  onComplete: (normalized: number) => void,
): void {
  let index = 0
  const grades: number[] = []

  const render = () => {
    if (index >= cards.length) {
      const avg = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : 0
      onComplete(avg)
      return
    }

    const card = cards[index]
    const body: (Node | string)[] = [
      el('p', { class: 'step-meta' }, [`Card ${index + 1} of ${cards.length}`]),
    ]

    const flip = el('div', { class: 'flashcard' })
    flip.append(el('div', { class: 'flashcard-face front' }, [el('p', {}, [card.front])]))
    body.push(flip)

    const controls = el('div', { class: 'flashcard-controls' })
    const reveal = el('button', { class: 'primary', type: 'button' }, ['Reveal answer'])
    reveal.addEventListener('click', () => {
      flip.append(el('div', { class: 'flashcard-face back pop-in' }, [el('p', {}, [card.back])]))
      controls.replaceChildren(
        el('p', { class: 'muted small' }, ['How well did you recall it?']),
        el(
          'div',
          { class: 'grade-row' },
          GRADES.map((g) => {
            const b = el('button', { class: `grade-btn ${g.cls}`, type: 'button' }, [g.label])
            b.addEventListener('click', () => {
              grades.push(g.value)
              index += 1
              render()
            })
            return b
          }),
        ),
      )
    })
    controls.append(reveal)
    body.push(controls)

    root.replaceChildren(stage('flashcard', 'Recall', title, body))
  }

  render()
}
