import { el } from '../dom'
import type { ClassifySession } from '../types'

export function mountClassify(
  root: HTMLElement,
  session: ClassifySession,
  onComplete: (score: number, max: number) => void,
): void {
  const assignment = new Map<string, string>()
  const max = session.cards.length

  const render = () => {
    root.replaceChildren()
    if (session.intro) {
      root.append(el('p', { class: 'lead' }, [session.intro]))
    }

    const board = el('div', { class: 'classify-board' })
    for (const bucket of session.buckets) {
      const col = el('div', { class: 'bucket', 'data-bucket': bucket.id }, [
        el('h3', {}, [bucket.label]),
      ])
      if (bucket.hint) col.append(el('p', { class: 'muted small' }, [bucket.hint]))
      const drop = el('div', { class: 'bucket-drop' })
      col.append(drop)
      board.append(col)
    }

    const pool = el('div', { class: 'card-pool' }, [
      el('h3', {}, ['Cards']),
    ])

    for (const card of session.cards) {
      if (assignment.has(card.id)) continue
      const chip = el('button', {
        class: 'classify-card',
        type: 'button',
        'data-card': card.id,
      }, [card.text])
      chip.addEventListener('click', () => {
        const picker = el('div', { class: 'bucket-picker' }, [
          el('p', {}, ['Place in:']),
        ])
        for (const bucket of session.buckets) {
          const b = el('button', { class: 'choice-btn', type: 'button' }, [
            bucket.label,
          ])
          b.addEventListener('click', () => {
            assignment.set(card.id, bucket.id)
            render()
          })
          picker.append(b)
        }
        chip.replaceWith(picker)
      })
      pool.append(chip)
    }

    // Render assigned into buckets
    for (const card of session.cards) {
      const bid = assignment.get(card.id)
      if (!bid) continue
      const drop = board.querySelector(`[data-bucket="${bid}"] .bucket-drop`)
      if (!drop) continue
      const chip = el('button', {
        class: 'classify-card placed',
        type: 'button',
      }, [card.text])
      chip.addEventListener('click', () => {
        assignment.delete(card.id)
        render()
      })
      drop.append(chip)
    }

    root.append(board, pool)

    const check = el('button', {
      class: 'primary',
      type: 'button',
      ...(assignment.size < max ? { disabled: 'true' } : {}),
    }, ['Check placement'])
    check.addEventListener('click', () => {
      let score = 0
      for (const card of session.cards) {
        if (assignment.get(card.id) === card.bucketId) score += 1
      }
      root.replaceChildren(
        el('div', { class: 'result-card' }, [
          el('h2', {}, ['Placement checked']),
          el('p', {}, [`${score} / ${max} in the right bucket.`]),
          el('p', {}, [session.debrief]),
        ]),
      )
      onComplete(score, max)
    })
    root.append(check)
  }

  render()
}
