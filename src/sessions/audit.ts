import { el } from '../dom'
import type { AuditSession } from '../types'

export function mountAudit(
  root: HTMLElement,
  session: AuditSession,
  onComplete: (score: number, max: number) => void,
): void {
  const scores = new Map<string, number>()
  const maxPer = 4
  const max = session.pillars.length * maxPer

  const render = () => {
    root.replaceChildren()
    if (session.intro) {
      root.append(el('p', { class: 'lead' }, [session.intro]))
    }
    root.append(
      el('p', { class: 'muted' }, [
        'Rate each pillar from 1 (weak) to 4 (solid). Be honest — this is for you.',
      ]),
    )

    for (const pillar of session.pillars) {
      const block = el('div', { class: 'audit-pillar' }, [
        el('h3', {}, [pillar.label]),
        el('p', {}, [pillar.prompt]),
      ])
      const row = el('div', { class: 'score-row' })
      for (let n = 1; n <= maxPer; n++) {
        const btn = el(
          'button',
          {
            class: `score-btn${scores.get(pillar.id) === n ? ' selected' : ''}`,
            type: 'button',
          },
          [String(n)],
        )
        btn.addEventListener('click', () => {
          scores.set(pillar.id, n)
          render()
        })
        row.append(btn)
      }
      block.append(row)
      root.append(block)
    }

    const ready = scores.size === session.pillars.length
    const finish = el('button', {
      class: 'primary',
      type: 'button',
      ...(ready ? {} : { disabled: 'true' }),
    }, ['See gap report'])
    finish.addEventListener('click', () => {
      let total = 0
      const gaps = el('div', { class: 'gap-report' }, [
        el('h2', {}, ['Your gap report']),
      ])
      const bars = el('div', { class: 'radar-bars' })
      for (const pillar of session.pillars) {
        const s = scores.get(pillar.id) ?? 0
        total += s
        bars.append(
          el('div', { class: 'radar-row' }, [
            el('span', {}, [pillar.label]),
            el('div', { class: 'radar-track' }, [
              el('div', {
                class: 'radar-fill',
                style: `width:${(s / maxPer) * 100}%`,
              }),
            ]),
            el('span', { class: 'muted' }, [`${s}/${maxPer}`]),
          ]),
        )
        if (s <= 2) {
          gaps.append(
            el('div', { class: 'gap-item' }, [
              el('h3', {}, [`Strengthen: ${pillar.label}`]),
              el('ul', {}, pillar.actions.map((a) => el('li', {}, [a]))),
            ]),
          )
        }
      }
      gaps.prepend(bars)
      gaps.append(el('p', {}, [session.debrief]))
      root.replaceChildren(gaps)
      onComplete(total, max)
    })
    root.append(finish)
  }

  render()
}
