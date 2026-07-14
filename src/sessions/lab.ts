import { el } from '../dom'
import { burst, shake } from '../fx'
import { getLabFormula } from '../labs/registry'
import type { KindMount, RuntimeApi } from '../runtime/phases'
import { labInPassBand } from '../scoring/lab'
import type { LabInput, LabSession, Session } from '../types'
import { gauge, twinBars } from '../visuals'

export function createLabMount(): KindMount {
  let host: HTMLElement | undefined

  return {
    mount(nextHost: HTMLElement, rawSession: Session, api: RuntimeApi): void {
      const session = rawSession as LabSession
      host = nextHost
      const inputs: LabInput[] = session.inputs ?? (session.holdings ?? []).map((holding, i) => ({
        id: `h${i}`, label: holding.name, value: holding.fundWeight, indexValue: holding.indexWeight,
      }))
      const formula = getLabFormula(session.formulaId ?? 'active-share')
      if (!formula || !inputs.length) {
        host.replaceChildren(el('p', { class: 'muted' }, ['This lab is not configured.']))
        return
      }
      const values = Object.fromEntries(inputs.map((input) => [input.id, input.value]))
      const indexValues = Object.fromEntries(inputs.map((input) => [input.id, input.indexValue ?? 0]))
      const metrics = () => formula.compute(values, { indexValues })
      const normalize = () => {
        const target = session.constraints?.sumTo
        if (target === undefined) return false
        const total = Object.values(values).reduce((sum, value) => sum + value, 0)
        if (total === 0 || Math.abs(total - target) <= (session.constraints?.epsilon ?? 0.001)) return false
        for (const id of Object.keys(values)) values[id] = (values[id] / total) * target
        return true
      }

      const renderLab = (toast?: string) => {
        host?.replaceChildren()
        const stage = el('div', { class: 'stage stage-calculator' })
        const inner = el('div', { class: 'stage-inner' }, [el('div', { class: 'stage-kicker' }, ['Live lab'])])
        if (session.intro) inner.append(el('p', { class: 'stage-lead' }, [session.intro]))
        const metric = metrics().activeShare ?? 0
        const board = el('div', { class: 'lab-immersive' }, [
          el('div', { class: 'lab-left' }, [gauge(metric, 'Active share', `${(metric * 100).toFixed(0)}% different from the index`)]),
          el('div', { class: 'lab-right' }, [twinBars(inputs.map((input) => ({
            name: input.label, fund: values[input.id] ?? 0, index: input.indexValue ?? 0,
          })))]),
        ])
        inner.append(board)
        const sliders = el('div', { class: 'slider-deck' }, [el('h3', {}, ['Twist the knobs'])])
        for (const input of inputs) {
          const row = el('div', { class: 'knob-row' }, [el('strong', {}, [input.label])])
          const control = document.createElement('input')
          control.type = 'range'
          control.min = String((input.min ?? 0) * 100)
          control.max = String((input.max ?? 1) * 100)
          control.step = String((input.step ?? 0.01) * 100)
          control.value = String(Math.round((values[input.id] ?? 0) * 100))
          control.addEventListener('input', () => {
            values[input.id] = Number(control.value) / 100
            renderLab(normalize() ? 'Weights renormalized to keep the portfolio total at 100%.' : undefined)
          })
          row.append(control, el('span', { class: 'holding-val' }, [`${control.value}%`]))
          sliders.append(row)
        }
        if (toast) inner.append(el('p', { class: 'feedback' }, [toast]))
        const check = el('button', { class: 'primary pulse', type: 'button' }, ['Check pass band'])
        check.addEventListener('click', () => {
          api.requestCheck()
          if (session.passBand && !labInPassBand(metrics(), session.passBand)) {
            if (!api.reducedMotion) shake(check)
            inner.append(el('p', { class: 'bad feedback' }, ['Adjust the inputs until the metric enters the pass band.']))
            return
          }
          if (!api.reducedMotion) burst(check)
          if (session.transferCheck) renderTransfer()
          else api.complete({ score: 1, maxScore: 1 })
        })
        inner.append(sliders, check)
        stage.append(inner)
        host?.append(stage)
      }

      const renderTransfer = () => {
        const transfer = session.transferCheck
        if (!transfer) return
        host?.replaceChildren()
        const inner = el('div', { class: 'stage-inner' }, [
          el('div', { class: 'stage-kicker' }, ['Transfer check']),
          el('h2', {}, [transfer.prompt]),
        ])
        const choices = el('div', { class: 'choice-grid' })
        transfer.choices.forEach((choice, i) => {
          const button = el('button', { class: 'choice-tile', type: 'button' }, [choice])
          button.addEventListener('click', () => {
            const correct = i === transfer.answerIndex
            choices.querySelectorAll('button').forEach((candidate, index) => {
              candidate.setAttribute('disabled', 'true')
              if (index === transfer.answerIndex) candidate.classList.add('correct')
            })
            if (!correct) button.classList.add('wrong')
            if (correct && !api.reducedMotion) burst(button)
            else if (!correct && !api.reducedMotion) shake(button)
            api.complete({ score: correct ? 2 : 1, maxScore: 2 })
          })
          choices.append(button)
        })
        inner.append(choices)
        host?.append(el('div', { class: 'stage stage-calculator' }, [inner]))
      }

      renderLab()
    },
    destroy(): void {
      host?.replaceChildren()
      host = undefined
    },
  }
}
