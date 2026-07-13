import { el } from '../dom'
import { burst } from '../fx'
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
    const stage = el('div', { class: 'stage stage-decision' }, [
      el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
    ])
    const inner = el('div', { class: 'stage-inner' })
    inner.append(
      el('div', { class: 'stage-kicker' }, [`Fork ${depth + 1}`]),
      el('h2', { class: 'stage-title' }, [session.title]),
    )
    if (session.intro && current === session.startId) {
      inner.append(el('p', { class: 'stage-lead' }, [session.intro]))
    }

    const layout = el('div', { class: 'decision-immersive' })
    layout.append(pathTrail(notes))

    const scene = el('div', { class: 'decision-scene pop-in' }, [
      el('div', { class: 'decision-prompt' }, [node.text]),
    ])

    if (node.ending) {
      scene.append(
        el('div', { class: 'result-card ending-card pop-in' }, [
          el('p', { class: 'eyebrow' }, ['Principle']),
          el('h2', {}, [node.ending.principle]),
          el('p', {}, [node.ending.debrief]),
        ]),
      )
      layout.append(scene)
      inner.append(layout)
      stage.append(inner)
      root.append(stage)
      if (node.ending.score > 0) burst(scene)
      onComplete(node.ending.score, 1)
      return
    }

    const doors = el('div', { class: 'fork-doors' })
    ;(node.choices ?? []).forEach((choice, i) => {
      const door = el('button', {
        class: `fork-door door-${i % 2 === 0 ? 'a' : 'b'}`,
        type: 'button',
      }, [
        el('span', { class: 'door-label' }, [i % 2 === 0 ? 'Path A' : 'Path B']),
        el('span', { class: 'door-text' }, [choice.label]),
      ])
      door.addEventListener('click', () => {
        burst(door, i % 2 === 0 ? ['#f59e0b', '#fbbf24'] : ['#6366f1', '#a5b4fc'])
        if (choice.note) notes.push(choice.note)
        current = choice.next
        depth += 1
        window.setTimeout(render, 180)
      })
      doors.append(door)
    })
    scene.append(doors)
    layout.append(scene)
    inner.append(layout)
    stage.append(inner)
    root.append(stage)
  }

  render()
}
