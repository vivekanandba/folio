import { el } from '../dom'
import { donut, stage } from '../fx'
import type { CalculatorSession } from '../types'
import { PALETTE, gauge, twinBars } from '../visuals'
import { iconSpan } from './icon'
import { mountMCQ } from './mcq'
import { register, type SessionModule } from './registry'

const CALCULATOR_SVG = `<svg viewBox="0 0 40 40" fill="none"><rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" stroke-width="2"/><path d="M12 14h16M12 20h10M12 26h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`

function activeShare(holdings: { fundWeight: number; indexWeight: number }[]): number {
  return holdings.reduce((acc, h) => acc + Math.abs(h.fundWeight - h.indexWeight), 0) / 2
}

function caption(as: number): string {
  if (as < 0.2) return 'Closet indexer territory'
  if (as < 0.6) return 'Moderately active'
  return 'Highly different from the index'
}

function mountCalculator(
  root: HTMLElement,
  session: CalculatorSession,
  onComplete: (score: number, max: number) => void,
): void {
  const weights = session.holdings.map((h) => ({ ...h }))

  const renderLab = () => {
    const body: (Node | string)[] = []
    if (session.intro) body.push(el('p', { class: 'stage-lead' }, [session.intro]))

    const gaugeHost = el('div', { class: 'lab-left' })
    const chartHost = el('div', { class: 'lab-right' })
    body.push(el('div', { class: 'lab-immersive' }, [gaugeHost, chartHost]))

    const refreshViz = () => {
      const as = activeShare(weights)
      gaugeHost.replaceChildren(
        gauge(as, 'Active share', caption(as)),
        el('div', { class: 'as-scale' }, [
          el('span', {}, ['Index-like']),
          el('span', {}, ['Active']),
          el('span', {}, ['Very active']),
        ]),
      )
      const segs = weights.map((w, j) => ({
        label: w.name,
        pct: Math.max(0, Math.round(w.fundWeight * 100)),
        color: PALETTE[j % PALETTE.length],
      }))
      chartHost.replaceChildren(
        donut(segs.filter((s) => s.pct > 0), { title: 'Your fund mix', size: 200 }),
        el('div', { class: 'viz-panel tight' }, [
          twinBars(
            weights.map((w) => ({ name: w.name, fund: w.fundWeight, index: w.indexWeight })),
          ),
        ]),
      )
    }
    refreshViz()

    const sliders = el('div', { class: 'slider-deck' }, [
      el('h3', {}, ['Twist the knobs']),
      el('p', { class: 'muted small' }, [
        'Index weights stay fixed. Drag fund weights — gauge and donut move live.',
      ]),
    ])
    weights.forEach((h, i) => {
      const row = el('div', { class: 'knob-row' })
      row.append(
        el('div', { class: 'knob-label' }, [
          el('strong', {}, [h.name]),
          el('span', { class: 'muted small' }, [`Index ${(h.indexWeight * 100).toFixed(0)}%`]),
        ]),
      )
      const input = document.createElement('input')
      input.type = 'range'
      input.min = '0'
      input.max = '100'
      input.value = String(Math.round(h.fundWeight * 100))
      const val = el('span', { class: 'holding-val' }, [`${Math.round(h.fundWeight * 100)}%`])
      input.addEventListener('input', () => {
        weights[i].fundWeight = Number(input.value) / 100
        val.textContent = `${input.value}%`
        refreshViz()
      })
      row.append(input, val)
      sliders.append(row)
    })
    body.push(sliders)

    const next = el('button', { class: 'primary pulse', type: 'button' }, ['Lock lab → judgment'])
    next.addEventListener('click', () => renderJudgment())
    body.push(next)

    root.replaceChildren(stage('calculator', 'Live lab', session.title, body))
  }

  const renderJudgment = () => {
    root.replaceChildren(
      stage('calculator', 'Judgment call', session.judgmentPrompt, [
        mountMCQ({
          choices: session.judgmentChoices,
          answerIndex: session.judgmentAnswerIndex,
          explanation: session.debrief,
          layout: 'grid',
          onResolve: (correct) => onComplete(correct ? 1 : 0, 1),
        }),
      ]),
    )
  }

  renderLab()
}

export const calculatorModule: SessionModule<CalculatorSession> = {
  kind: 'calculator',
  label: 'Lab',
  blurb: 'Hands-on numbers',
  icon: () => iconSpan('calculator', CALCULATOR_SVG),
  mount: mountCalculator,
  validate: (s) => {
    const errs: string[] = []
    if (s.judgmentAnswerIndex < 0 || s.judgmentAnswerIndex >= s.judgmentChoices.length) {
      errs.push('judgmentAnswerIndex out of range')
    }
    return errs
  },
}
register(calculatorModule)
