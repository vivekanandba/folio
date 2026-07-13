import { el } from '../dom'
import { burst, shake } from '../fx'
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
    const stage = el('div', { class: 'stage stage-classify' }, [
      el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
    ])
    const inner = el('div', { class: 'stage-inner' })
    inner.append(
      el('div', { class: 'stage-kicker' }, ['Sort bench']),
      el('h2', { class: 'stage-title' }, [session.title]),
    )
    if (session.intro) {
      inner.append(el('p', { class: 'stage-lead' }, [session.intro]))
    }

    inner.append(
      el('div', { class: 'classify-progress' }, [
        el('div', { class: 'classify-progress-track' }, [
          el('div', {
            class: 'classify-progress-fill',
            style: `width:${(assignment.size / max) * 100}%`,
          }),
        ]),
        el('span', {}, [`${assignment.size} / ${max} sorted — drag cards into bins`]),
      ]),
    )

    const board = el('div', { class: 'classify-board drag-board' })
    for (const bucket of session.buckets) {
      const tone = bucket.tone ?? 'neutral'
      const col = el('div', {
        class: `bucket drop-zone tone-${tone}`,
        'data-bucket': bucket.id,
      })
      col.append(
        el('div', { class: 'bucket-head' }, [
          el('span', { class: `bucket-dot tone-${tone}` }),
          el('h3', {}, [bucket.label]),
        ]),
      )
      if (bucket.hint) col.append(el('p', { class: 'muted small' }, [bucket.hint]))
      const drop = el('div', { class: 'bucket-drop' })
      col.append(drop)

      col.addEventListener('dragover', (e) => {
        e.preventDefault()
        col.classList.add('drag-over')
      })
      col.addEventListener('dragleave', () => col.classList.remove('drag-over'))
      col.addEventListener('drop', (e) => {
        e.preventDefault()
        col.classList.remove('drag-over')
        const id = e.dataTransfer?.getData('text/card-id')
        if (!id) return
        assignment.set(id, bucket.id)
        burst(col, tone === 'warm' ? ['#f59e0b', '#c2410c'] : ['#3b82f6', '#0ea5e9'])
        render()
      })
      board.append(col)
    }

    // Place assigned cards
    for (const card of session.cards) {
      const bid = assignment.get(card.id)
      if (!bid) continue
      const drop = board.querySelector(`[data-bucket="${bid}"] .bucket-drop`)
      if (!drop) continue
      drop.append(makeChip(card.id, card.text, true))
    }

    const pool = el('div', { class: 'card-pool drag-pool' }, [
      el('h3', {}, ['Drag these']),
    ])
    const poolInner = el('div', { class: 'card-pool-inner' })
    for (const card of session.cards) {
      if (assignment.has(card.id)) continue
      poolInner.append(makeChip(card.id, card.text, false))
    }
    if (!poolInner.childNodes.length) {
      poolInner.append(el('p', { class: 'muted' }, ['All cards placed. Check when ready.']))
    }
    pool.append(poolInner)

    inner.append(board, pool)

    const check = el('button', {
      class: 'primary pulse',
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
      if (score === max) burst(check)
      else shake(check)
      root.replaceChildren(
        el('div', { class: 'stage stage-classify' }, [
          el('div', { class: 'stage-inner result-card pop-in' }, [
            el('h2', {}, ['Bench cleared']),
            el('p', { class: 'score-hero' }, [`${score} / ${max}`]),
            el('p', {}, [session.debrief]),
            review,
          ]),
        ]),
      )
      onComplete(score, max)
    })
    inner.append(check)
    stage.append(inner)
    root.append(stage)
  }

  function makeChip(id: string, text: string, placed: boolean): HTMLElement {
    const chip = el('button', {
      class: `classify-card${placed ? ' placed' : ''} grab`,
      type: 'button',
      draggable: 'true',
    }, [text])
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/card-id', id)
      chip.classList.add('dragging')
    })
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'))
    if (placed) {
      chip.addEventListener('click', () => {
        assignment.delete(id)
        render()
      })
    } else {
      // tap-to-pick fallback for mobile
      chip.addEventListener('click', () => {
        const picker = el('div', { class: 'bucket-picker pop-in' }, [
          el('p', { class: 'small' }, ['Send to:']),
        ])
        for (const bucket of session.buckets) {
          const b = el('button', {
            class: `choice-btn tone-${bucket.tone ?? 'neutral'}`,
            type: 'button',
          }, [bucket.label])
          b.addEventListener('click', () => {
            assignment.set(id, bucket.id)
            render()
          })
          picker.append(b)
        }
        chip.replaceWith(picker)
      })
    }
    return chip
  }

  render()
}
