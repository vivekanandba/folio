import { el } from './dom'

/** Burst of colored dots from a point (correct answer / reveal). */
export function burst(at: HTMLElement, colors = ['#14b8a6', '#f59e0b', '#3b82f6', '#f43f5e']): void {
  const rect = at.getBoundingClientRect()
  const ox = rect.left + rect.width / 2
  const oy = rect.top + rect.height / 2
  const layer = el('div', { class: 'fx-burst-layer' })
  document.body.append(layer)
  for (let i = 0; i < 18; i++) {
    const p = el('span', { class: 'fx-particle' })
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4
    const dist = 40 + Math.random() * 70
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`)
    p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`)
    p.style.left = `${ox}px`
    p.style.top = `${oy}px`
    p.style.background = colors[i % colors.length]
    layer.append(p)
  }
  window.setTimeout(() => layer.remove(), 700)
}

export function shake(node: HTMLElement): void {
  node.classList.remove('fx-shake')
  void node.offsetWidth
  node.classList.add('fx-shake')
}

/** Animated SVG donut from segments (pct 0–100). */
export function donut(
  segments: { label: string; pct: number; color: string }[],
  opts: { size?: number; title?: string; hole?: number } = {},
): HTMLElement {
  const size = opts.size ?? 220
  const hole = opts.hole ?? 0.58
  const r = size / 2 - 8
  const cx = size / 2
  const cy = size / 2
  const total = segments.reduce((a, s) => a + s.pct, 0) || 1
  let angle = -Math.PI / 2

  const paths: string[] = []
  segments.forEach((s) => {
    const sweep = (s.pct / total) * Math.PI * 2
    if (sweep <= 0) return
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(angle + sweep)
    const y2 = cy + r * Math.sin(angle + sweep)
    const large = sweep > Math.PI ? 1 : 0
    const ri = r * hole
    const xi1 = cx + ri * Math.cos(angle + sweep)
    const yi1 = cy + ri * Math.sin(angle + sweep)
    const xi2 = cx + ri * Math.cos(angle)
    const yi2 = cy + ri * Math.sin(angle)
    paths.push(
      `<path class="donut-seg" d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${ri} ${ri} 0 ${large} 0 ${xi2} ${yi2} Z" fill="${s.color}"><title>${s.label}: ${s.pct}%</title></path>`,
    )
    angle += sweep
  })

  const wrap = el('div', { class: 'donut-wrap' })
  if (opts.title) wrap.append(el('p', { class: 'viz-title' }, [opts.title]))
  const svg = el('div', { class: 'donut-svg-host' })
  svg.innerHTML = `<svg viewBox="0 0 ${size} ${size}" class="donut-svg">${paths.join('')}</svg>`
  wrap.append(svg)

  const legend = el('div', { class: 'donut-legend' })
  segments.forEach((s) => {
    legend.append(
      el('div', { class: 'donut-legend-row' }, [
        el('i', { class: 'viz-swatch', style: `background:${s.color}` }),
        el('span', {}, [s.label]),
        el('strong', {}, [`${Math.round(s.pct)}%`]),
      ]),
    )
  })
  wrap.append(legend)
  return wrap
}

export function stage(kind: string, title: string, children: (Node | string)[]): HTMLElement {
  return el('div', { class: `stage stage-${kind}` }, [
    el('div', { class: 'stage-glow', 'aria-hidden': 'true' }),
    el('div', { class: 'stage-inner' }, [
      el('div', { class: 'stage-kicker' }, [kind]),
      el('h2', { class: 'stage-title' }, [title]),
      el('div', { class: 'stage-body' }, children as Node[]),
    ]),
  ])
}
