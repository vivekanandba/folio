import { el } from '../dom'
import { burst, shake, stage } from '../fx'
import type { EstimateSession } from '../types'
import { gauge } from '../visuals'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const ESTIMATE_SVG = `<svg viewBox="0 0 40 40" fill="none"><path d="M8 26a12 12 0 0 1 24 0" stroke="currentColor" stroke-width="2"/><path d="M20 26l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="26" r="2" fill="currentColor"/></svg>`

function fmt(n: number, unit?: string): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2)
  return unit ? `${s} ${unit}` : s
}

function mountEstimate(
  root: HTMLElement,
  session: EstimateSession,
  onComplete: (score: number, max: number) => void,
): void {
  const step = session.step ?? (session.max - session.min) / 100
  const tolerance = session.tolerance ?? 0.1
  let guess = Math.round(((session.min + session.max) / 2) / step) * step
  let done = false

  const render = () => {
    const readout = el('span', { class: 'estimate-value' }, [fmt(guess, session.unit)])
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(session.min)
    input.max = String(session.max)
    input.step = String(step)
    input.value = String(guess)
    input.className = 'estimate-slider'
    input.setAttribute('aria-label', session.prompt)
    input.addEventListener('input', () => {
      guess = Number(input.value)
      readout.textContent = fmt(guess, session.unit)
    })

    const scale = el('div', { class: 'estimate-scale' }, [
      el('span', {}, [fmt(session.min, session.unit)]),
      el('span', {}, [fmt(session.max, session.unit)]),
    ])

    const reveal = el('button', { class: 'primary pulse', type: 'button' }, ['Reveal the answer'])
    const result = el('div', { class: 'estimate-result' })
    reveal.addEventListener('click', () => {
      if (done) return
      done = true
      input.disabled = true
      reveal.setAttribute('disabled', 'true')
      const range = session.max - session.min
      const err = Math.abs(guess - session.answer)
      const accuracy = Math.max(0, 1 - err / range)
      const correct = err <= tolerance * range
      result.append(
        gauge(accuracy, 'Accuracy', correct ? 'Within range — nice.' : 'Outside the tolerance band.'),
        el('p', { class: correct ? 'ok' : 'bad' }, [
          `Your estimate: ${fmt(guess, session.unit)} · True value: ${fmt(session.answer, session.unit)}`,
        ]),
        el('p', {}, [session.debrief]),
      )
      if (correct) burst(reveal)
      else shake(reveal)
      onComplete(correct ? 1 : 0, 1)
    })

    const body: (Node | string)[] = []
    if (session.intro) body.push(el('p', { class: 'stage-lead' }, [session.intro]))
    body.push(
      el('h3', {}, [session.prompt]),
      el('div', { class: 'estimate-readout' }, [readout]),
      input,
      scale,
      reveal,
      result,
    )
    root.replaceChildren(stage('estimate', 'Make the call', session.title, body))
  }

  render()
}

export const estimateModule: SessionModule<EstimateSession> = {
  kind: 'estimate',
  label: 'Estimate',
  blurb: 'Guess, then reveal',
  icon: () => iconSpan('estimate', ESTIMATE_SVG),
  mount: mountEstimate,
  validate: (s) => {
    const errs: string[] = []
    if (s.min >= s.max) errs.push('min must be < max')
    if (s.answer < s.min || s.answer > s.max) errs.push('answer must be within [min, max]')
    if (s.tolerance != null && (s.tolerance <= 0 || s.tolerance > 1)) errs.push('tolerance must be in (0, 1]')
    return errs
  },
}
register(estimateModule)
