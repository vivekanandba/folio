import { el } from '../dom'
import { burst, shake, stage } from '../fx'
import { richBlock } from '../widgets'
import type { Drill } from './generators'

/**
 * Mounts one generated drill as an estimate-style challenge: slide to your
 * answer, lock it in, get graded against the computed ground truth.
 * Scores: 1 (within tolerance), 0.4 (close — within 2.5× tolerance), 0.
 */
export function mountDrill(
  root: HTMLElement,
  conceptTitle: string,
  drill: Drill,
  onDone: (score: number) => void,
): void {
  const mid = Math.round((drill.min + drill.max) / 2 / drill.step) * drill.step
  let guess = mid
  let done = false

  const fmt = (n: number): string => {
    const s = Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : n % 1 ? n.toFixed(2) : String(n)
    return drill.unit ? `${s} ${drill.unit}` : s
  }

  const readout = el('span', { class: 'estimate-value' }, [fmt(guess)])
  const input = document.createElement('input')
  input.type = 'range'
  input.min = String(drill.min)
  input.max = String(drill.max)
  input.step = String(drill.step)
  input.value = String(guess)
  input.className = 'estimate-slider'
  input.setAttribute('aria-label', drill.prompt)
  input.addEventListener('input', () => {
    guess = Number(input.value)
    readout.textContent = fmt(guess)
  })

  const result = el('div', { class: 'estimate-result' })
  const lock = el('button', { class: 'primary pulse', type: 'button' }, ['Lock it in'])
  lock.addEventListener('click', () => {
    if (done) return
    done = true
    input.setAttribute('disabled', 'true')
    lock.setAttribute('disabled', 'true')

    const relErr = Math.abs(guess - drill.answer) / Math.max(Math.abs(drill.answer), 1e-9)
    const score = relErr <= drill.tolerance ? 1 : relErr <= drill.tolerance * 2.5 ? 0.4 : 0
    if (score === 1) burst(lock)
    else if (score === 0) shake(lock)

    const verdict =
      score === 1 ? 'Dead on.' : score > 0 ? 'Close — right order of magnitude.' : 'Off the mark.'
    const next = el('button', { class: 'primary', type: 'button' }, ['Continue →'])
    next.addEventListener('click', () => onDone(score))
    result.replaceChildren(
      el('p', { class: score > 0 ? 'ok' : 'bad' }, [
        `${verdict} Answer: ${fmt(drill.answer)} (you said ${fmt(guess)}).`,
      ]),
      richBlock(drill.debrief),
      next,
    )
  })

  root.replaceChildren(
    stage('estimate', 'Daily drill — fresh numbers', conceptTitle, [
      el('p', { class: 'stage-lead' }, [drill.prompt]),
      el('div', { class: 'estimate-readout' }, [readout]),
      input,
      el('div', { class: 'estimate-scale' }, [
        el('span', {}, [fmt(drill.min)]),
        el('span', {}, [fmt(drill.max)]),
      ]),
      el('div', { class: 'session-actions' }, [lock]),
      result,
    ]),
  )
}
