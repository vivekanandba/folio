import { el } from '../dom'
import { burst, stage } from '../fx'
import type { DecisionSession } from '../types'
import { pathTrail } from '../visuals'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const DECISION_SVG = `<svg viewBox="0 0 40 40" fill="none"><path d="M20 6v10M20 16l-8 8M20 16l8 8M12 24v8M28 24v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`

function mountDecision(
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

    const layout = el('div', { class: 'decision-immersive' })
    layout.append(pathTrail(notes))

    const scene = el('div', { class: 'decision-scene pop-in' })
    if (node.text) {
      scene.append(el('div', { class: 'decision-prompt' }, [node.text]))
    }

    if (node.ending) {
      scene.append(
        el('div', { class: 'result-card ending-card pop-in' }, [
          el('p', { class: 'eyebrow' }, ['Principle']),
          el('h2', {}, [node.ending.principle]),
          el('p', {}, [node.ending.debrief]),
        ]),
      )
      layout.append(scene)
      root.replaceChildren(
        stage('decision', `Fork ${depth + 1}`, session.title, [layout]),
      )
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

    const body: (Node | string)[] = []
    if (session.intro && current === session.startId) {
      body.push(el('p', { class: 'stage-lead' }, [session.intro]))
    }
    body.push(layout)
    root.replaceChildren(stage('decision', `Fork ${depth + 1}`, session.title, body))
  }

  render()
}

export const decisionModule: SessionModule<DecisionSession> = {
  kind: 'decision',
  label: 'Decision',
  blurb: 'Forking judgment',
  icon: () => iconSpan('decision', DECISION_SVG),
  mount: mountDecision,
  validate: (s) => {
    const errs: string[] = []
    const ids = new Set(s.nodes.map((n) => n.id))
    if (!ids.has(s.startId)) errs.push(`startId "${s.startId}" has no node`)
    let endings = 0
    s.nodes.forEach((n) => {
      const hasChoices = !!n.choices?.length
      const hasEnding = !!n.ending
      if (hasChoices === hasEnding) errs.push(`node "${n.id}" must have choices XOR ending`)
      if (hasEnding) endings += 1
      n.choices?.forEach((c) => {
        if (!ids.has(c.next)) errs.push(`node "${n.id}" choice → unknown node "${c.next}"`)
      })
    })
    if (endings === 0) errs.push('decision has no ending node')
    return errs
  },
}
register(decisionModule)
