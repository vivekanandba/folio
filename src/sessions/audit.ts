import { el } from '../dom'
import type { AuditSession } from '../types'
import { radarChart } from '../visuals'

export function mountAudit(
  root: HTMLElement,
  session: AuditSession,
  onComplete: (score: number, max: number) => void,
): void {
  const scores = new Map<string, number>()
  const maxPer = 4
  const max = session.pillars.length * maxPer

  const liveRadar = () => {
    const axes = session.pillars.map((p) => ({
      label: p.label,
      value: scores.get(p.id) ?? 0,
      max: maxPer,
    }))
    const host = el('div', { class: 'viz-panel audit-radar' })
    host.append(
      el('p', { class: 'viz-title' }, ['Balance map']),
      radarChart(axes),
      el('p', { class: 'muted small' }, [
        scores.size
          ? `${scores.size}/${session.pillars.length} pillars rated — shape fills as you score.`
          : 'Rate pillars below; the map fills in live.',
      ]),
    )
    return host
  }

  const render = () => {
    root.replaceChildren()
    if (session.intro) {
      root.append(el('p', { class: 'lead' }, [session.intro]))
    }
    root.append(liveRadar())
    root.append(
      el('p', { class: 'muted' }, [
        'Rate each pillar from 1 (weak) to 4 (solid). Be honest — this is for you.',
      ]),
    )

    for (const pillar of session.pillars) {
      const selected = scores.get(pillar.id)
      const block = el('div', {
        class: `audit-pillar${selected ? ' rated' : ''}`,
      }, [
        el('div', { class: 'audit-pillar-head' }, [
          el('h3', {}, [pillar.label]),
          selected
            ? el('span', { class: 'score-chip' }, [`${selected}/4`])
            : el('span', { class: 'muted small' }, ['—']),
        ]),
        el('p', {}, [pillar.prompt]),
      ])
      const row = el('div', { class: 'score-row' })
      for (let n = 1; n <= maxPer; n++) {
        const btn = el(
          'button',
          {
            class: `score-btn${selected === n ? ' selected' : ''}`,
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
      const axes = session.pillars.map((p) => {
        const s = scores.get(p.id) ?? 0
        total += s
        return { label: p.label, value: s, max: maxPer }
      })

      const gaps = el('div', { class: 'gap-report' }, [
        el('h2', {}, ['Your gap report']),
        el('div', { class: 'viz-panel' }, [radarChart(axes)]),
      ])

      for (const pillar of session.pillars) {
        const s = scores.get(pillar.id) ?? 0
        if (s <= 2) {
          gaps.append(
            el('div', { class: 'gap-item pop-in' }, [
              el('h3', {}, [`Strengthen: ${pillar.label}`]),
              el('ul', {}, pillar.actions.map((a) => el('li', {}, [a]))),
            ]),
          )
        }
      }
      gaps.append(el('p', {}, [session.debrief]))
      root.replaceChildren(gaps)
      onComplete(total, max)
    })
    root.append(finish)
  }

  render()
}
