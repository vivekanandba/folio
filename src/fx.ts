import { el } from './dom'

export function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Burst of colored dots from a point (correct answer / reveal). */
export function burst(
  at: HTMLElement,
  colors = ['#14b8a6', '#f59e0b', '#3b82f6', '#f43f5e'],
): void {
  if (prefersReducedMotion()) return
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
  if (prefersReducedMotion()) return
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
  for (const seg of segments) {
    const sweep = (seg.pct / total) * Math.PI * 2
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    angle += sweep
    const x2 = cx + r * Math.cos(angle)
    const y2 = cy + r * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const ir = r * hole
    const ix1 = cx + ir * Math.cos(angle)
    const iy1 = cy + ir * Math.sin(angle)
    const ix2 = cx + ir * Math.cos(angle - sweep)
    const iy2 = cy + ir * Math.sin(angle - sweep)
    paths.push(
      `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z" fill="${seg.color}" />`,
    )
  }

  const wrap = el('div', { class: 'donut-wrap' })
  if (opts.title) wrap.append(el('h3', { class: 'donut-title' }, [opts.title]))
  const svg = el('div', {
    class: 'donut-svg',
    html: `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">${paths.join('')}</svg>`,
  })
  wrap.append(svg)
  const legend = el('ul', { class: 'donut-legend' })
  for (const seg of segments) {
    legend.append(
      el('li', {}, [
        el('span', { class: 'swatch', style: `background:${seg.color}` }),
        `${seg.label} ${Math.round(seg.pct)}%`,
      ]),
    )
  }
  wrap.append(legend)
  return wrap
}
