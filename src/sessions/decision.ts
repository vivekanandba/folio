import { el } from '../dom'
import type { DecisionSession } from '../types'
import { pathTrail } from '../visuals'

export function mountDecision(
  root: HTMLElement,
  session: DecisionSession,
  onComplete: (score: number, max: number) => void,
): void {
  const byId = new Map(session.nodes.map((n) => [n.id, n]))
  let current = session.startId
  const notes: string[] = []
  let depth = 0

  const render = () => {
    const node = byId.get(current)
    if (!node) {
      root.replaceChildren(el('p', {}, ['Broken decision tree.']))
      return
    }

    root.replaceChildren()
    if (session.intro && current === session.startId) {
      root.append(el('p', { class: 'lead' }, [session.intro]))
    }

    root.append(
      el('div', { class: 'decision-layout' }, [
        pathTrail(notes),
        el('div', { class: 'decision-stage' }, [
          el('p', { class: 'muted small' }, [`Fork ${depth + 1}`]),
          el('div', { class: 'decision-text pop-in' }, [
            el('p', {}, [node.text]),
          ]),
        ]),
      ]),
    )

    if (node.ending) {
      const stage = root.querySelector('.decision-stage')!
      stage.append(
        el('div', { class: 'result-card pop-in' }, [
          el('p', { class: 'eyebrow' }, ['Principle']),
          el('h2', {}, [node.ending.principle]),
          el('p', {}, [node.ending.debrief]),
        ]),
      )
      onComplete(node.ending.score, 1)
      return
    }

    const choices = el('div', { class: 'choice-list' })
    for (const choice of node.choices ?? []) {
      const btn = el('button', { class: 'choice-btn fork-btn', type: 'button' }, [
        choice.label,
      ])
      btn.addEventListener('click', () => {
        if (choice.note) notes.push(choice.note)
        current = choice.next
        depth += 1
        render()
      })
      choices.append(btn)
    }
    root.querySelector('.decision-stage')!.append(choices)
  }

  render()
}
