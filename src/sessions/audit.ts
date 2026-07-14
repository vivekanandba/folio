import { el } from '../dom'
import { burst } from '../fx'
import type { KindMount, RuntimeApi } from '../runtime/phases'
import type { AuditSession, Session } from '../types'
import { radarChart } from '../visuals'

const PILLAR_COLORS = ['#0f766e', '#c2410c', '#1d4ed8', '#7c3aed']

export function createAuditMount(): KindMount {
  let host: HTMLElement | undefined

  return {
    mount(nextHost: HTMLElement, rawSession: Session, api: RuntimeApi): void {
      const session = rawSession as AuditSession
      host = nextHost
      const scores = new Map<string, number>()
      const maxPer = 4
      const packId = location.hash.match(/^#\/pack\/([^/]+)/)?.[1]
      const remediationLink = (sessionId?: string, conceptId?: string): string | undefined => {
        if (!packId) return undefined
        if (sessionId) return `#/pack/${packId}/session/${sessionId}`
        if (conceptId) return `#/pack/${packId}/concept/${conceptId}`
        return undefined
      }

      const render = () => {
        host?.replaceChildren()
    const stage = el('div', { class: 'stage stage-audit' }, [
      el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
    ])
    const inner = el('div', { class: 'stage-inner' })
    inner.append(
      el('div', { class: 'stage-kicker' }, ['Self audit']),
      el('h2', { class: 'stage-title' }, [session.title]),
      el('p', { class: 'muted small' }, ['Self-inventory — not a knowledge score.']),
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
          if (!api.reducedMotion) burst(btn, [color, '#f8fafc'])
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
      const finalAxes = session.pillars.map((p) => {
        const s = scores.get(p.id) ?? 0
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
              ...(pillar.remediation ?? []).map((remediation) => {
                const label = remediation.label ??
                  (remediation.sessionId
                    ? `Practice next: ${remediation.sessionId}`
                    : `Review: ${remediation.conceptId ?? 'related concept'}`)
                const href = remediationLink(remediation.sessionId, remediation.conceptId)
                return el('p', { class: 'muted small' }, [
                  href ? el('a', { href }, [label]) : label,
                ])
              }),
            ]),
          )
        }
      }
      if (session.debrief) {
        body.append(el('p', {}, [
          typeof session.debrief === 'string' ? session.debrief : session.debrief.summary,
        ]))
      }
      api.requestCheck()
      if (!api.reducedMotion) burst(finish)
      host?.replaceChildren(report)
      api.complete({
        score: scores.size,
        maxScore: session.pillars.length,
        reflectionOnly: true,
      })
    })
    inner.append(finish)
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
