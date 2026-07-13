import { el } from '../dom'
import { burst } from '../fx'
import type { AuditSession } from '../types'
import { radarChart } from '../visuals'

const PILLAR_COLORS = ['#0f766e', '#c2410c', '#1d4ed8', '#7c3aed']

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
    const stage = el('div', { class: 'stage stage-audit' }, [
      el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
    ])
    const inner = el('div', { class: 'stage-inner' })
    inner.append(
      el('div', { class: 'stage-kicker' }, ['Self audit']),
      el('h2', { class: 'stage-title' }, [session.title]),
    )
    if (session.intro) {
      inner.append(el('p', { class: 'stage-lead' }, [session.intro]))
    }

    const axes = session.pillars.map((p) => ({
      label: p.label,
      value: scores.get(p.id) ?? 0,
      max: maxPer,
    }))
    const radarHost = el('div', { class: 'audit-radar-stage viz-panel' }, [
      el('p', { class: 'viz-title' }, ['Balance map — fills as you rate']),
      radarChart(axes),
    ])
    inner.append(radarHost)

    const grid = el('div', { class: 'pillar-grid' })
    session.pillars.forEach((pillar, idx) => {
      const selected = scores.get(pillar.id)
      const color = PILLAR_COLORS[idx % PILLAR_COLORS.length]
      const fill = selected ? (selected / maxPer) * 100 : 0
      const tile = el('div', {
        class: `pillar-tile${selected ? ' rated' : ''}`,
        style: `--pillar:${color};--fill:${fill}%`,
      })
      tile.append(
        el('div', { class: 'pillar-fill', 'aria-hidden': 'true' }),
        el('div', { class: 'pillar-content' }, [
          el('div', { class: 'audit-pillar-head' }, [
            el('h3', {}, [pillar.label]),
            selected
              ? el('span', { class: 'score-chip' }, [`${selected}/4`])
              : el('span', { class: 'muted small' }, ['tap a score']),
          ]),
          el('p', {}, [pillar.prompt]),
        ]),
      )
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
          burst(btn, [color, '#f8fafc'])
          render()
        })
        row.append(btn)
      }
      tile.append(row)
      grid.append(tile)
    })
    inner.append(grid)

    const ready = scores.size === session.pillars.length
    const finish = el('button', {
      class: 'primary pulse',
      type: 'button',
      ...(ready ? {} : { disabled: 'true' }),
    }, ['Reveal gap report'])
    finish.addEventListener('click', () => {
      let total = 0
      const finalAxes = session.pillars.map((p) => {
        const s = scores.get(p.id) ?? 0
        total += s
        return { label: p.label, value: s, max: maxPer }
      })
      const report = el('div', { class: 'stage stage-audit' }, [
        el('div', { class: 'stage-inner gap-report pop-in' }, [
          el('h2', {}, ['Your gap report']),
          el('div', { class: 'viz-panel' }, [radarChart(finalAxes)]),
        ]),
      ])
      const body = report.querySelector('.stage-inner')!
      for (const pillar of session.pillars) {
        const s = scores.get(pillar.id) ?? 0
        if (s <= 2) {
          body.append(
            el('div', { class: 'gap-item pop-in' }, [
              el('h3', {}, [`Strengthen: ${pillar.label}`]),
              el('ul', {}, pillar.actions.map((a) => el('li', {}, [a]))),
            ]),
          )
        }
      }
      body.append(el('p', {}, [session.debrief]))
      burst(finish)
      root.replaceChildren(report)
      onComplete(total, max)
    })
    inner.append(finish)
    stage.append(inner)
    root.append(stage)
  }

  render()
}
