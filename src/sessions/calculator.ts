import { el } from '../dom'
import type { CalculatorSession } from '../types'

function activeShare(
  holdings: { fundWeight: number; indexWeight: number }[],
): number {
  const sum = holdings.reduce(
    (acc, h) => acc + Math.abs(h.fundWeight - h.indexWeight),
    0,
  )
  return sum / 2
}

export function mountCalculator(
  root: HTMLElement,
  session: CalculatorSession,
  onComplete: (score: number, max: number) => void,
): void {
  const weights = session.holdings.map((h) => ({ ...h }))

  const renderLab = () => {
    root.replaceChildren()
    if (session.intro) {
      root.append(el('p', { class: 'lead' }, [session.intro]))
    }

    root.append(
      el('p', { class: 'muted' }, [
        'Active share = ½ × Σ |fund weight − index weight|. Drag fund weights; index stays fixed.',
      ]),
    )

    const as = activeShare(weights)
    const meter = el('div', { class: 'meter' }, [
      el('div', { class: 'meter-label' }, [
        `Active share: ${(as * 100).toFixed(1)}%`,
      ]),
      el('div', { class: 'meter-bar' }, [
        el('div', {
          class: 'meter-fill',
          style: `width:${Math.min(100, as * 100)}%`,
        }),
      ]),
      el('p', { class: 'muted small' }, [
        as < 0.2
          ? 'Looks close to an index fund.'
          : as < 0.6
            ? 'Moderately active.'
            : 'Highly different from the index.',
      ]),
    ])

    const table = el('div', { class: 'holdings' })
    weights.forEach((h, i) => {
      const row = el('div', { class: 'holding-row' }, [
        el('span', { class: 'holding-name' }, [h.name]),
        el('span', { class: 'muted small' }, [
          `Index ${(h.indexWeight * 100).toFixed(0)}%`,
        ]),
      ])
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
        // re-render meter only cheaply
        const next = activeShare(weights)
        meter.querySelector('.meter-label')!.textContent =
          `Active share: ${(next * 100).toFixed(1)}%`
        ;(meter.querySelector('.meter-fill') as HTMLElement).style.width =
          `${Math.min(100, next * 100)}%`
      })
      row.append(input, val)
      table.append(row)
    })

    const next = el('button', { class: 'primary', type: 'button' }, [
      'Continue to judgment',
    ])
    next.addEventListener('click', () => renderJudgment())
    root.append(meter, table, next)
  }

  const renderJudgment = () => {
    root.replaceChildren(
      el('h2', {}, [session.judgmentPrompt]),
    )
    const choices = el('div', { class: 'choice-list' })
    session.judgmentChoices.forEach((choice, i) => {
      const btn = el('button', { class: 'choice-btn', type: 'button' }, [choice])
      btn.addEventListener('click', () => {
        const correct = i === session.judgmentAnswerIndex
        choices.querySelectorAll('button').forEach((b, j) => {
          b.setAttribute('disabled', 'true')
          if (j === session.judgmentAnswerIndex) b.classList.add('correct')
          if (j === i && !correct) b.classList.add('wrong')
        })
        root.append(
          el('div', { class: 'feedback' }, [
            el('p', {}, [session.debrief]),
          ]),
        )
        onComplete(correct ? 1 : 0, 1)
      })
      choices.append(btn)
    })
    root.append(choices)
  }

  renderLab()
}
