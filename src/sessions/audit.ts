import { el } from '../dom'
import { burst, stage } from '../fx'
import type { AuditSession } from '../types'
import { PALETTE, radarChart } from '../visuals'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const AUDIT_SVG = `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="2"/><path d="M20 10v10l7 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`

function mountAudit(
  root: HTMLElement,
  session: AuditSession,
  onComplete: (score: number, max: number) => void,
): void {
  const scores = new Map<string, number>()
  const maxPer = 4
  const max = session.pillars.length * maxPer

  const render = () => {
    const body: (Node | string)[] = []
    if (session.intro) body.push(el('p', { class: 'stage-lead' }, [session.intro]))

    const axes = session.pillars.map((p) => ({
      label: p.label,
      value: scores.get(p.id) ?? 0,
      max: maxPer,
    }))
    body.push(
      el('div', { class: 'audit-radar-stage viz-panel' }, [
        el('p', { class: 'viz-title' }, ['Balance map — fills as you rate']),
        radarChart(axes),
      ]),
    )

    const grid = el('div', { class: 'pillar-grid' })
    session.pillars.forEach((pillar, idx) => {
      const selected = scores.get(pillar.id)
      const color = PALETTE[idx % PALETTE.length]
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
        const btn = el('button', {
          class: `score-btn${selected === n ? ' selected' : ''}`,
          type: 'button',
        }, [String(n)])
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
    body.push(grid)

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
      const reportBody: (Node | string)[] = [
        el('div', { class: 'viz-panel' }, [radarChart(finalAxes)]),
      ]
      for (const pillar of session.pillars) {
        const s = scores.get(pillar.id) ?? 0
        if (s <= 2) {
          reportBody.push(
            el('div', { class: 'gap-item pop-in' }, [
              el('h3', {}, [`Strengthen: ${pillar.label}`]),
              el('ul', {}, pillar.actions.map((a) => el('li', {}, [a]))),
            ]),
          )
        }
      }
      reportBody.push(el('p', {}, [session.debrief]))
      burst(finish)
      root.replaceChildren(stage('audit', 'Gap report', 'Your gap report', reportBody))
      onComplete(total, max)
    })
    body.push(finish)

    root.replaceChildren(stage('audit', 'Self audit', session.title, body))
  }

  render()
}

export const auditModule: SessionModule<AuditSession> = {
  kind: 'audit',
  label: 'Audit',
  blurb: 'Map your gaps',
  icon: () => iconSpan('audit', AUDIT_SVG),
  mount: mountAudit,
  validate: (s) => {
    const errs: string[] = []
    const ids = new Set<string>()
    s.pillars.forEach((p, i) => {
      if (ids.has(p.id)) errs.push(`pillars[${i}].id "${p.id}" is duplicated`)
      ids.add(p.id)
      if (!p.actions.length) errs.push(`pillars[${i}].actions is empty`)
    })
    return errs
  },
}
register(auditModule)
