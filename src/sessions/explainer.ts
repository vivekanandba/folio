import { el } from '../dom'
import { stage } from '../fx'
import type { ExplainerSession } from '../types'
import { stepPills } from '../visuals'
import { mountWidget, renderRichInto } from '../widgets'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const EXPLAINER_SVG = `<svg viewBox="0 0 40 40" fill="none"><path d="M20 6l3.5 7.5L31 15l-5.5 5 1.5 8-7-4-7 4 1.5-8L9 15l7.5-1.5L20 6z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`

function mountExplainer(
  root: HTMLElement,
  session: ExplainerSession,
  onComplete: (score: number, max: number) => void,
): void {
  let idx = 0
  const total = session.steps.length

  const render = () => {
    // Recap screen (after the last step).
    if (idx >= total) {
      const recap = el('div', { class: 'explainer-body' })
      renderRichInto(recap, session.recap)
      root.replaceChildren(
        stage('explainer', 'You learned it', session.title, [
          el('div', { class: 'result-card pop-in' }, [
            el('h2', {}, ['Recap']),
            recap,
            el('p', { class: 'muted small' }, ['Now practise it — the linked sessions are on the concept page.']),
          ]),
        ]),
      )
      onComplete(1, 1)
      return
    }

    const step = session.steps[idx]
    const body: (Node | string)[] = []
    if (session.intro && idx === 0) body.push(el('p', { class: 'stage-lead' }, [session.intro]))
    body.push(stepPills(idx + 1, total))
    body.push(el('h3', {}, [step.title]))

    const content = el('div', { class: 'explainer-body' })
    renderRichInto(content, step.body)
    body.push(content)

    if (step.viz) {
      const vizHost = el('div', { class: 'viz-slot explainer-viz' })
      mountWidget(vizHost, step.viz)
      body.push(vizHost)
    }

    const nav = el('div', { class: 'session-actions' })
    if (idx > 0) {
      const back = el('button', { class: 'ghost', type: 'button' }, ['Back'])
      back.addEventListener('click', () => {
        idx -= 1
        render()
      })
      nav.append(back)
    }
    const next = el('button', { class: 'primary pulse', type: 'button' }, [
      idx + 1 >= total ? 'Finish' : 'Next',
    ])
    next.addEventListener('click', () => {
      idx += 1
      render()
    })
    nav.append(next)
    body.push(nav)

    root.replaceChildren(stage('explainer', 'Explainer', session.title, body))
  }

  render()
}

export const explainerModule: SessionModule<ExplainerSession> = {
  kind: 'explainer',
  label: 'Explainer',
  blurb: 'Learn it step by step',
  icon: () => iconSpan('explainer', EXPLAINER_SVG),
  mount: mountExplainer,
  validate: (s) => {
    const errs: string[] = []
    if (!s.steps?.length) errs.push('explainer needs at least one step')
    s.steps?.forEach((st, i) => {
      if (!st.title || !st.body) errs.push(`steps[${i}] needs title and body`)
    })
    if (!s.recap) errs.push('explainer needs a recap')
    return errs
  },
}
register(explainerModule)
