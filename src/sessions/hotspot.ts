import { el } from '../dom'
import { burst, shake, stage } from '../fx'
import type { HotspotSession } from '../types'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const HOTSPOT_SVG = `<svg viewBox="0 0 40 40" fill="none"><path d="M8 30V20M16 30V14M24 30V24M32 30V10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="6" r="3" stroke="currentColor" stroke-width="2"/></svg>`

function mountHotspot(
  root: HTMLElement,
  session: HotspotSession,
  onComplete: (score: number, max: number) => void,
): void {
  const peak = Math.max(...session.series.map((p) => p.value), 1)
  let done = false

  const render = () => {
    const chart = el('div', { class: 'hotspot-chart' })
    const bars: HTMLButtonElement[] = []
    session.series.forEach((point, i) => {
      const h = Math.max(6, Math.round((point.value / peak) * 100))
      const bar = el('button', {
        class: 'hotspot-bar',
        type: 'button',
        'aria-label': `${point.label}: ${point.value}`,
      }, [
        el('span', { class: 'hotspot-fill', style: `height:${h}%` }),
        el('span', { class: 'hotspot-label' }, [point.label]),
      ]) as HTMLButtonElement
      bar.addEventListener('click', () => {
        if (done) return
        done = true
        const correct = point.anomaly === true
        bars.forEach((b, j) => {
          b.setAttribute('disabled', 'true')
          if (session.series[j].anomaly) b.classList.add('is-anomaly')
        })
        if (!correct) bar.classList.add('missed')
        if (correct) burst(bar)
        else shake(bar)
        feedback.replaceChildren(
          el('p', { class: correct ? 'ok' : 'bad' }, [
            correct ? 'Spotted it — that point is out of line.' : 'Not the anomaly. Highlighted the real ones.',
          ]),
          el('p', {}, [session.debrief]),
        )
        onComplete(correct ? 1 : 0, 1)
      })
      bars.push(bar)
      chart.append(bar)
    })

    const feedback = el('div', { class: 'feedback' })
    const body: (Node | string)[] = []
    if (session.intro) body.push(el('p', { class: 'stage-lead' }, [session.intro]))
    body.push(el('h3', {}, [session.prompt]), chart, feedback)
    root.replaceChildren(stage('hotspot', 'Spot the anomaly', session.title, body))
  }

  render()
}

export const hotspotModule: SessionModule<HotspotSession> = {
  kind: 'hotspot',
  label: 'Hotspot',
  blurb: 'Spot the anomaly',
  icon: () => iconSpan('hotspot', HOTSPOT_SVG),
  mount: mountHotspot,
  validate: (s) => {
    const errs: string[] = []
    if (!s.series.length) errs.push('hotspot needs series[]')
    if (!s.series.some((p) => p.anomaly === true)) errs.push('hotspot needs ≥1 anomaly')
    return errs
  },
}
register(hotspotModule)
