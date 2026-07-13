import { el } from '../dom'
import type { DecisionSession } from '../types'

export function mountDecision(
  root: HTMLElement,
  session: DecisionSession,
  onComplete: (score: number, max: number) => void,
): void {
  const byId = new Map(session.nodes.map((n) => [n.id, n]))
  let current = session.startId
  const notes: string[] = []

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

    root.append(el('div', { class: 'decision-text' }, [
      el('p', {}, [node.text]),
    ]))

    if (node.ending) {
      root.append(
        el('div', { class: 'result-card' }, [
          el('h2', {}, ['Principle']),
          el('p', {}, [node.ending.principle]),
          el('p', {}, [node.ending.debrief]),
          ...(notes.length
            ? [
                el('h3', {}, ['Path notes']),
                el(
                  'ul',
                  {},
                  notes.map((n) => el('li', {}, [n])),
                ),
              ]
            : []),
        ]),
      )
      onComplete(node.ending.score, 1)
      return
    }

    const choices = el('div', { class: 'choice-list' })
    for (const choice of node.choices ?? []) {
      const btn = el('button', { class: 'choice-btn', type: 'button' }, [
        choice.label,
      ])
      btn.addEventListener('click', () => {
        if (choice.note) notes.push(choice.note)
        current = choice.next
        render()
      })
      choices.append(btn)
    }
    root.append(choices)
  }

  render()
}
