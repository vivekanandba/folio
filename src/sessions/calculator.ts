import { el } from '../dom'
import { burst, donut, shake } from '../fx'
import type { CalculatorSession } from '../types'
import { gauge, twinBars } from '../visuals'

function activeShare(
  holdings: { fundWeight: number; indexWeight: number }[],
): number {
  return (
    holdings.reduce(
      (acc, h) => acc + Math.abs(h.fundWeight - h.indexWeight),
      0,
    ) / 2
  )
}

function caption(as: number): string {
  if (as < 0.2) return 'Closet indexer territory'
  if (as < 0.6) return 'Moderately active'
  return 'Highly different from the index'
}

const COLORS = ['#0f766e', '#c2410c', '#1d4ed8', '#a16207', '#7c3aed']

export function mountCalculator(
  root: HTMLElement,
  session: CalculatorSession,
  onComplete: (score: number, max: number) => void,
): void {
  const weights = session.holdings.map((h) => ({ ...h }))

  const renderLab = () => {
    root.replaceChildren()
    const stage = el('div', { class: 'stage stage-calculator' }, [
      el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
    ])
    const inner = el('div', { class: 'stage-inner' })
    inner.append(
      el('div', { class: 'stage-kicker' }, ['Live lab']),
      el('h2', { class: 'stage-title' }, [session.title]),
    )
    if (session.intro) {
      inner.append(el('p', { class: 'stage-lead' }, [session.intro]))
    }

    const gaugeHost = el('div', { class: 'lab-left' })
    const chartHost = el('div', { class: 'lab-right' })
    const board = el('div', { class: 'lab-immersive' }, [gaugeHost, chartHost])

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
        color: COLORS[j % COLORS.length],
      }))
      chartHost.replaceChildren(
        donut(segs.filter((s) => s.pct > 0), {
          title: 'Your fund mix',
          size: 200,
        }),
        el('div', { class: 'viz-panel tight' }, [
          twinBars(
            weights.map((w) => ({
              name: w.name,
              fund: w.fundWeight,
              index: w.indexWeight,
            })),
          ),
        ]),
      )
    }
    refreshViz()
    inner.append(board)

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
          el('span', { class: 'muted small' }, [
            `Index ${(h.indexWeight * 100).toFixed(0)}%`,
          ]),
        ]),
      )
      const input = document.createElement('input')
      input.type = 'range'
      input.min = '0'
      input.max = '100'
      input.value = String(Math.round(h.fundWeight * 100))
      const val = el('span', { class: 'holding-val' }, [
        `${Math.round(h.fundWeight * 100)}%`,
      ])
      input.addEventListener('input', () => {
        weights[i].fundWeight = Number(input.value) / 100
        val.textContent = `${input.value}%`
        refreshViz()
      })
      row.append(input, val)
      sliders.append(row)
    })

    const next = el('button', { class: 'primary pulse', type: 'button' }, [
      'Lock lab → judgment',
    ])
    next.addEventListener('click', () => renderJudgment())
    inner.append(sliders, next)
    stage.append(inner)
    root.append(stage)
  }

  const renderJudgment = () => {
    root.replaceChildren()
    const stage = el('div', { class: 'stage stage-calculator' }, [
      el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
    ])
    const inner = el('div', { class: 'stage-inner' }, [
      el('div', { class: 'stage-kicker' }, ['Judgment call']),
      el('h2', { class: 'stage-title' }, [session.judgmentPrompt]),
    ])
    const choices = el('div', { class: 'choice-grid' })
    session.judgmentChoices.forEach((choice, i) => {
      const btn = el('button', { class: 'choice-tile', type: 'button' }, [
        el('span', { class: 'choice-letter' }, [String.fromCharCode(65 + i)]),
        el('span', {}, [choice]),
      ])
      btn.addEventListener('click', () => {
        const correct = i === session.judgmentAnswerIndex
        choices.querySelectorAll('button').forEach((b, j) => {
          b.setAttribute('disabled', 'true')
          if (j === session.judgmentAnswerIndex) b.classList.add('correct')
          if (j === i && !correct) b.classList.add('wrong')
        })
        if (correct) burst(btn)
        else shake(btn)
        inner.append(
          el('div', { class: 'feedback pop-in' }, [
            el('p', {}, [session.debrief]),
          ]),
        )
        onComplete(correct ? 1 : 0, 1)
      })
      choices.append(btn)
    })
    inner.append(choices)
    stage.append(inner)
    root.append(stage)
  }

  renderLab()
}
