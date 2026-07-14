import { el } from '../dom'
import { burst, shake } from '../fx'
import type { KindMount, RuntimeApi } from '../runtime/phases'
import { scoreClassify } from '../scoring/classify'
import type { ClassifyCard, ClassifySession, Session } from '../types'

export function createClassifyMount(): KindMount {
  let host: HTMLElement | undefined

  return {
    mount(nextHost: HTMLElement, rawSession: Session, api: RuntimeApi): void {
      const session = rawSession as ClassifySession
      host = nextHost
      let round = 0
      let totalScore = 0
      let totalMax = 0
      let assignment = new Map<string, string>()

      const cardsForRound = (): ClassifyCard[] =>
        round === 0 ? session.cards : session.round2 ?? []

      const render = () => {
        const cards = cardsForRound()
        const max = cards.length
        host?.replaceChildren()
        const stage = el('div', { class: 'stage stage-classify' }, [
          el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
        ])
        const inner = el('div', { class: 'stage-inner' }, [
          el('div', { class: 'stage-kicker' }, [
            round === 0 ? 'Sort bench' : 'Round two — harder evidence',
          ]),
        ])
        if (session.intro && round === 0) inner.append(el('p', { class: 'stage-lead' }, [session.intro]))
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
          const col = el('div', { class: `bucket drop-zone tone-${tone}`, 'data-bucket': bucket.id })
          col.append(el('div', { class: 'bucket-head' }, [
            el('span', { class: `bucket-dot tone-${tone}` }),
            el('h3', {}, [bucket.label]),
          ]))
          if (bucket.hint) col.append(el('p', { class: 'muted small' }, [bucket.hint]))
          const drop = el('div', { class: 'bucket-drop' })
          col.append(drop)
          col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drag-over') })
          col.addEventListener('dragleave', () => col.classList.remove('drag-over'))
          col.addEventListener('drop', (e) => {
            e.preventDefault()
            col.classList.remove('drag-over')
            const id = e.dataTransfer?.getData('text/card-id')
            if (!id) return
            assignment.set(id, bucket.id)
            if (!api.reducedMotion) burst(col)
            render()
          })
          board.append(col)
        }

        for (const card of cards) {
          const bid = assignment.get(card.id)
          if (!bid) continue
          board.querySelector(`[data-bucket="${bid}"] .bucket-drop`)?.append(makeChip(card.id, card.text, true))
        }

        const pool = el('div', { class: 'card-pool drag-pool' }, [el('h3', {}, ['Drag these'])])
        const poolInner = el('div', { class: 'card-pool-inner' })
        for (const card of cards) if (!assignment.has(card.id)) poolInner.append(makeChip(card.id, card.text, false))
        if (!poolInner.childNodes.length) poolInner.append(el('p', { class: 'muted' }, ['All cards placed. Check when ready.']))
        pool.append(poolInner)
        inner.append(board, pool)

        const check = el('button', {
          class: 'primary pulse', type: 'button', ...(assignment.size < max ? { disabled: 'true' } : {}),
        }, ['Check placement'])
        check.addEventListener('click', () => {
          api.requestCheck()
          const result = scoreClassify(cards, assignment)
          totalScore += result.score
          totalMax += result.maxScore
          if (result.score === result.maxScore && !api.reducedMotion) burst(check)
          else if (!api.reducedMotion) shake(check)
          const review = el('div', { class: 'classify-review' })
          for (const card of cards) {
            const miss = result.misses.find((item) => item.id === card.id)
            review.append(el('div', { class: `review-row ${miss ? 'bad' : 'ok'}` }, [
              el('span', {}, [card.text]),
              el('span', { class: 'muted small' }, [miss
                ? `Belongs in: ${session.buckets.find((bucket) => bucket.id === miss.expected)?.label ?? miss.expected}`
                : 'Correct']),
            ]))
          }
          const continueRound = round === 0 && session.round2?.length
          const resultCard = el('div', { class: 'result-card pop-in' }, [
            el('p', { class: 'score-hero' }, [`${result.score} / ${result.maxScore}`]),
            review,
          ])
          const next = el('button', { class: 'primary', type: 'button' }, [
            continueRound ? 'Try the harder round' : 'Finish',
          ])
          next.addEventListener('click', () => {
            if (continueRound) {
              round = 1
              assignment = new Map()
              api.setPhase('interact')
              render()
            } else {
              api.complete({ score: totalScore, maxScore: totalMax })
            }
          })
          resultCard.append(next)
          host?.replaceChildren(resultCard)
        })
        inner.append(check)
        stage.append(inner)
        host?.append(stage)
      }

      function makeChip(id: string, text: string, placed: boolean): HTMLElement {
        const chip = el('button', { class: `classify-card${placed ? ' placed' : ''} grab`, type: 'button', draggable: 'true' }, [text])
        chip.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/card-id', id); chip.classList.add('dragging') })
        chip.addEventListener('dragend', () => chip.classList.remove('dragging'))
        chip.addEventListener('click', () => {
          if (placed) { assignment.delete(id); render(); return }
          const picker = el('div', { class: 'bucket-picker pop-in' }, [el('p', { class: 'small' }, ['Send to:'])])
          for (const bucket of session.buckets) {
            const button = el('button', { class: `choice-btn tone-${bucket.tone ?? 'neutral'}`, type: 'button' }, [bucket.label])
            button.addEventListener('click', () => { assignment.set(id, bucket.id); render() })
            picker.append(button)
          }
          chip.replaceWith(picker)
        })
        return chip
      }

      render()
    },
    destroy(): void {
      host?.replaceChildren()
      host = undefined
    },
  }
}
