import { el } from '../dom'
import { stage } from '../fx'
import { mountSim } from '../sim/engine'
import { SIM_MODELS, type SimState } from '../sim/models'
import type { LabGoal, LabSession } from '../types'
import { richBlock } from '../widgets'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const LAB_SVG = `<svg viewBox="0 0 40 40" fill="none"><path d="M16 8h8M18 8v9l-7 12a2 2 0 0 0 1.7 3h14.6a2 2 0 0 0 1.7-3l-7-12V8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="26" r="1.6" fill="currentColor"/><circle cx="22" cy="29" r="1.2" fill="currentColor"/></svg>`

const OPS: Record<LabGoal['op'], (a: number, b: number) => boolean> = {
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
}

function metricValue(goal: LabGoal, state: SimState, params: Record<string, number>): number | undefined {
  return state.scalars[goal.metric] ?? params[goal.metric]
}

function mountLab(
  root: HTMLElement,
  session: LabSession,
  onComplete: (score: number, max: number) => void,
): void {
  const holdNeeded = session.holdSeconds ?? 4
  let heldFor = 0
  let lastCheck = 0
  let done = false

  // Goal checklist that lights up live.
  const goalRows = session.goals.map((g) =>
    el('div', { class: 'lab-goal' }, [
      el('span', { class: 'lab-goal-dot', 'aria-hidden': 'true' }),
      el('span', {}, [g.label]),
      el('span', { class: 'lab-goal-val muted small' }, ['—']),
    ]),
  )
  const holdBar = el('div', { class: 'lab-hold-fill' })
  const holdTrack = el('div', { class: 'lab-hold-track', 'aria-hidden': 'true' }, [holdBar])
  const holdNote = el('p', { class: 'muted small lab-hold-note' }, [
    `Hold all goals for ${holdNeeded}s to master the machine.`,
  ])

  const simHost = el('div', { class: 'lab-sim' })
  const giveUp = el('button', { class: 'ghost', type: 'button' }, ['I give up — show the debrief'])

  const body = el('div', { class: 'lab-machine-room' }, [
    richBlock(session.briefing, 'stage-lead rich-block'),
    simHost,
    el('div', { class: 'lab-goals result-card' }, [
      el('h3', {}, ['Targets']),
      ...goalRows,
      holdTrack,
      holdNote,
    ]),
    el('div', { class: 'session-actions' }, [giveUp]),
  ])

  const finish = (score: number): void => {
    if (done) return
    done = true
    handle?.pause()
    root.replaceChildren(
      stage('lab', 'Machine room', score === session.goals.length ? 'Machine mastered' : 'Machine survives you — for now', [
        el('div', { class: 'result-card pop-in' }, [
          el('p', { class: 'score-hero' }, [`${score} / ${session.goals.length}`]),
          richBlock(session.debrief),
        ]),
      ]),
    )
    onComplete(score, session.goals.length)
  }

  const handle = mountSim(
    simHost,
    { model: session.model, params: session.params },
    (state, params) => {
      if (done) return
      let met = 0
      session.goals.forEach((g, i) => {
        const v = metricValue(g, state, params)
        const ok = v != null && Number.isFinite(v) && OPS[g.op](v, g.value)
        if (ok) met += 1
        const row = goalRows[i]
        row.classList.toggle('met', ok)
        const val = row.querySelector('.lab-goal-val')
        if (val) val.textContent = v == null || !Number.isFinite(v) ? '—' : `now ${v.toFixed(1)}`
      })

      // Wall-clock hold window (sim ticks arrive in bursts).
      const now = performance.now()
      const dt = lastCheck ? Math.min(0.5, (now - lastCheck) / 1000) : 0
      lastCheck = now
      heldFor = met === session.goals.length ? heldFor + dt : 0
      holdBar.style.width = `${Math.min(100, (heldFor / holdNeeded) * 100)}%`
      if (heldFor >= holdNeeded) finish(session.goals.length)
    },
  )

  giveUp.addEventListener('click', () => {
    // Count goals currently met — partial credit for partial control.
    let met = 0
    if (handle) {
      for (const g of session.goals) {
        const v = metricValue(g, handle.state, handle.params)
        if (v != null && Number.isFinite(v) && OPS[g.op](v, g.value)) met += 1
      }
    }
    finish(met)
  })

  root.replaceChildren(stage('lab', 'Machine room', session.title, [body]))
}

const module: SessionModule<LabSession> = {
  kind: 'lab',
  label: 'Machine room',
  blurb: 'A live system with real levers — reach the target state and hold it.',
  icon: () => iconSpan('lab', LAB_SVG),
  mount: mountLab,
  validate: (session) => {
    const issues: string[] = []
    if (!(session.model in SIM_MODELS)) issues.push(`unknown sim model "${session.model}"`)
    if (!session.goals?.length) issues.push('lab needs goals[]')
    for (const g of session.goals ?? []) {
      if (!(g.op in OPS)) issues.push(`bad goal op "${g.op}"`)
    }
    return issues
  },
}

register(module)
