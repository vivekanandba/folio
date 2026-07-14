import { el } from '../dom'
import { burst } from '../fx'
import type { KindMount, RuntimeApi } from '../runtime/phases'
import { scoreDecisionPath } from '../scoring/decision'
import type { DecisionSession, Session } from '../types'
import { pathTrail } from '../visuals'

export function createDecisionMount(): KindMount {
  let host: HTMLElement | undefined

  return {
    mount(nextHost: HTMLElement, rawSession: Session, api: RuntimeApi): void {
      const session = rawSession as DecisionSession
      host = nextHost
      const byId = new Map(session.nodes.map((node) => [node.id, node]))
      let current = session.startId
      const visited: string[] = []
      const deltas: number[] = []
      const maxScore = session.maxScore ?? Math.max(1, session.nodes.filter((node) => node.choices?.length).length)

      const render = () => {
        const node = byId.get(current)
        if (!node) {
          host?.replaceChildren(el('p', {}, ['Broken decision tree.']))
          return
        }
        host?.replaceChildren()
        const stage = el('div', { class: 'stage stage-decision' })
        const inner = el('div', { class: 'stage-inner' }, [
          el('div', { class: 'stage-kicker' }, [`Fork ${visited.length + 1}`]),
        ])
        if (session.intro && current === session.startId) inner.append(el('p', { class: 'stage-lead' }, [session.intro]))

        const layout = el('div', { class: 'decision-immersive' })
        layout.append(pathTrail(visited))
        const scene = el('div', { class: 'decision-scene pop-in' })
        if (node.text) scene.append(el('div', { class: 'decision-prompt' }, [node.text]))

        if (node.ending) {
          scene.append(el('div', { class: 'result-card ending-card pop-in' }, [
            el('p', { class: 'eyebrow' }, ['Principle']),
            el('h2', {}, [node.ending.principle ?? 'Reflect on the path']),
            el('p', {}, [node.ending.debrief ?? 'Use the principle to guide your next decision.']),
          ]))
          layout.append(scene)
          inner.append(layout)
          stage.append(inner)
          host?.append(stage)
          api.requestCheck()
          if (node.ending.score && !api.reducedMotion) burst(scene)
          api.complete({ score: scoreDecisionPath(deltas, maxScore), maxScore, pathNotes: visited })
          return
        }

        const doors = el('div', { class: 'fork-doors' })
        ;(node.choices ?? []).forEach((choice, i) => {
          const door = el('button', { class: `fork-door door-${i % 2 === 0 ? 'a' : 'b'}`, type: 'button' }, [
            el('span', { class: 'door-label' }, [i % 2 === 0 ? 'Path A' : 'Path B']),
            el('span', { class: 'door-text' }, [choice.label]),
          ])
          door.addEventListener('click', () => {
            if (!api.reducedMotion) burst(door)
            deltas.push(choice.scoreDelta ?? 0)
            visited.push(node.text ?? node.id)
            current = choice.next
            window.setTimeout(render, api.reducedMotion ? 0 : 180)
          })
          doors.append(door)
        })
        scene.append(doors)
        layout.append(scene)
        inner.append(layout)
        stage.append(inner)
        host?.append(stage)
      }

      render()
    },
    destroy(): void {
      host?.replaceChildren()
      host = undefined
    },
  }
}
