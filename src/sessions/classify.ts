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

    const progress = el('div', { class: 'classify-progress' }, [
      el('div', { class: 'classify-progress-track' }, [
        el('div', {
          class: 'classify-progress-fill',
          style: `width:${(assignment.size / max) * 100}%`,
        }),
      ]),
      el('span', { class: 'muted small' }, [
        `${assignment.size}/${max} placed`,
      ]),
    ])
    root.append(progress)

    const board = el('div', { class: 'classify-board' })
    for (const bucket of session.buckets) {
      const tone = bucket.tone ?? 'neutral'
      const col = el('div', {
        class: `bucket tone-${tone}`,
        'data-bucket': bucket.id,
      }, [
        el('div', { class: 'bucket-head' }, [
          el('span', { class: `bucket-dot tone-${tone}` }),
          el('h3', {}, [bucket.label]),
        ]),
      ])
      if (bucket.hint) col.append(el('p', { class: 'muted small' }, [bucket.hint]))
      col.append(el('div', { class: 'bucket-drop' }))
      board.append(col)
    }

    const pool = el('div', { class: 'card-pool' }, [
      el('h3', {}, ['Cards to sort']),
    ])
    const poolInner = el('div', { class: 'card-pool-inner' })

    for (const card of session.cards) {
      if (assignment.has(card.id)) continue
      const chip = el('button', {
        class: 'classify-card',
        type: 'button',
        'data-card': card.id,
      }, [card.text])
      chip.addEventListener('click', () => {
        const picker = el('div', { class: 'bucket-picker pop-in' }, [
          el('p', { class: 'small' }, ['Place in:']),
        ])
        for (const bucket of session.buckets) {
          const tone = bucket.tone ?? 'neutral'
          const b = el('button', {
            class: `choice-btn tone-${tone}`,
            type: 'button',
          }, [bucket.label])
          b.addEventListener('click', () => {
            assignment.set(card.id, bucket.id)
            render()
          })
          picker.append(b)
        }
        chip.replaceWith(picker)
      })
      poolInner.append(chip)
    }
    pool.append(poolInner)

    for (const card of session.cards) {
      const bid = assignment.get(card.id)
      if (!bid) continue
      const drop = board.querySelector(`[data-bucket="${bid}"] .bucket-drop`)
      if (!drop) continue
      const chip = el('button', {
        class: 'classify-card placed pop-in',
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
      const review = el('div', { class: 'classify-review' })
      for (const card of session.cards) {
        const got = assignment.get(card.id)
        const ok = got === card.bucketId
        if (ok) score += 1
        const bucket = session.buckets.find((b) => b.id === card.bucketId)
        review.append(
          el('div', { class: `review-row ${ok ? 'ok' : 'bad'}` }, [
            el('span', {}, [card.text]),
            el('span', { class: 'muted small' }, [
              ok ? 'Correct' : `Belongs in: ${bucket?.label ?? card.bucketId}`,
            ]),
          ]),
        )
      }
      root.replaceChildren(
        el('div', { class: 'result-card pop-in' }, [
          el('h2', {}, ['Placement checked']),
          el('p', { class: 'score-hero' }, [`${score} / ${max}`]),
          el('p', {}, [session.debrief]),
          review,
        ]),
      )
      onComplete(score, max)
    })
    root.append(check)
  }

  render()
}
