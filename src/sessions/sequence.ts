import { el } from '../dom'
import { burst, shake, stage } from '../fx'
import type { SequenceSession } from '../types'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const SEQUENCE_SVG = `<svg viewBox="0 0 40 40" fill="none"><path d="M10 12h20M10 20h20M10 28h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="6" cy="20" r="1.6" fill="currentColor"/><circle cx="6" cy="28" r="1.6" fill="currentColor"/></svg>`

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function mountSequence(
  root: HTMLElement,
  session: SequenceSession,
  onComplete: (score: number, max: number) => void,
): void {
  const correct = session.steps.map((s) => s.id)
  const byId = new Map(session.steps.map((s) => [s.id, s]))
  const max = correct.length

  // Shuffle until at least somewhat scrambled.
  let order = shuffle(correct)
  if (order.join() === correct.join() && max > 1) order = [...order.slice(1), order[0]]

  let dragId: string | null = null

  const move = (id: string, delta: number) => {
    const i = order.indexOf(id)
    const j = i + delta
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    render()
  }

  const render = () => {
    const list = el('ol', { class: 'sequence-list' })
    order.forEach((id, idx) => {
      const step = byId.get(id)!
      const item = el('li', {
        class: 'sequence-item grab',
        draggable: 'true',
        'data-id': id,
      }, [
        el('span', { class: 'seq-index' }, [String(idx + 1)]),
        el('span', { class: 'seq-text' }, [step.text]),
      ])
      const moves = el('div', { class: 'seq-move' })
      const up = el('button', { class: 'seq-arrow', type: 'button', 'aria-label': 'Move up' }, ['↑'])
      const down = el('button', { class: 'seq-arrow', type: 'button', 'aria-label': 'Move down' }, ['↓'])
      up.addEventListener('click', () => move(id, -1))
      down.addEventListener('click', () => move(id, 1))
      moves.append(up, down)
      item.append(moves)

      item.addEventListener('dragstart', () => {
        dragId = id
        item.classList.add('dragging')
      })
      item.addEventListener('dragend', () => {
        dragId = null
        item.classList.remove('dragging')
      })
      item.addEventListener('dragover', (e) => e.preventDefault())
      item.addEventListener('drop', (e) => {
        e.preventDefault()
        if (!dragId || dragId === id) return
        const from = order.indexOf(dragId)
        const to = order.indexOf(id)
        order.splice(from, 1)
        order.splice(to, 0, dragId)
        render()
      })
      list.append(item)
    })

    const check = el('button', { class: 'primary pulse', type: 'button' }, ['Lock the order'])
    check.addEventListener('click', () => {
      const score = order.filter((id, i) => id === correct[i]).length
      const review = el('ol', { class: 'sequence-list reviewed' })
      order.forEach((id, i) => {
        const ok = id === correct[i]
        review.append(
          el('li', { class: `sequence-item ${ok ? 'ok' : 'bad'}` }, [
            el('span', { class: 'seq-index' }, [String(i + 1)]),
            el('span', { class: 'seq-text' }, [byId.get(id)!.text]),
            el('span', { class: 'seq-mark' }, [ok ? '✓' : '✗']),
          ]),
        )
      })
      if (score === max) burst(check)
      else shake(check)
      root.replaceChildren(
        stage('sequence', 'Put it in order', 'Order locked', [
          el('p', { class: 'score-hero' }, [`${score} / ${max}`]),
          review,
          el('p', {}, [session.debrief]),
        ]),
      )
      onComplete(score, max)
    })

    const body: (Node | string)[] = []
    if (session.intro) body.push(el('p', { class: 'stage-lead' }, [session.intro]))
    body.push(el('h3', {}, [session.prompt]), list, check)
    root.replaceChildren(stage('sequence', 'Put it in order', session.title, body))
  }

  render()
}

export const sequenceModule: SessionModule<SequenceSession> = {
  kind: 'sequence',
  label: 'Sequence',
  blurb: 'Put it in order',
  icon: () => iconSpan('sequence', SEQUENCE_SVG),
  mount: mountSequence,
  validate: (s) => {
    const errs: string[] = []
    if (s.steps.length < 2) errs.push('sequence needs ≥2 steps')
    const ids = new Set<string>()
    s.steps.forEach((st, i) => {
      if (ids.has(st.id)) errs.push(`steps[${i}].id "${st.id}" duplicated`)
      ids.add(st.id)
    })
    return errs
  },
}
register(sequenceModule)
