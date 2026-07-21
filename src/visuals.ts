import { el } from './dom'

/** Single source of truth for categorical chart colors. */
export const PALETTE = ['#0f766e', '#c2410c', '#1d4ed8', '#a16207', '#7c3aed', '#be123c']

/** Paired horizontal bars: fund vs index for each holding. */
export function twinBars(
  rows: { name: string; fund: number; index: number }[],
): HTMLElement {
  const wrap = el('div', { class: 'viz-twin' })
  wrap.append(
    el('div', { class: 'viz-twin-key' }, [
      el('span', { class: 'viz-legend-item' }, [
        el('i', { class: 'viz-swatch', style: 'background:#0f766e' }),
        'Fund',
      ]),
      el('span', { class: 'viz-legend-item' }, [
        el('i', { class: 'viz-swatch', style: 'background:#a8a29e' }),
        'Index',
      ]),
    ]),
  )
  for (const row of rows) {
    const block = el('div', { class: 'viz-twin-row' }, [
      el('div', { class: 'viz-twin-name' }, [row.name]),
    ])
    const fundTrack = el('div', { class: 'viz-twin-track' })
    fundTrack.append(
      el('div', {
        class: 'viz-twin-fill fund',
        style: `width:${Math.min(100, row.fund * 100)}%`,
      }),
    )
    const indexTrack = el('div', { class: 'viz-twin-track' })
    indexTrack.append(
      el('div', {
        class: 'viz-twin-fill index',
        style: `width:${Math.min(100, row.index * 100)}%`,
      }),
    )
    block.append(fundTrack, indexTrack)
    wrap.append(block)
  }
  return wrap
}

/** Circular gauge 0–100. */
export function gauge(
  value01: number,
  label: string,
  caption: string,
): HTMLElement {
  const pct = Math.max(0, Math.min(1, value01)) * 100
  const r = 54
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)
  const wrap = el('div', { class: 'viz-gauge' })
  wrap.innerHTML = `
    <svg viewBox="0 0 140 140" class="viz-gauge-svg">
      <circle cx="70" cy="70" r="${r}" class="viz-gauge-bg"/>
      <circle cx="70" cy="70" r="${r}" class="viz-gauge-fg"
        stroke-dasharray="${c.toFixed(1)}"
        stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 70 70)"/>
      <text x="70" y="66" text-anchor="middle" class="viz-gauge-num">${pct.toFixed(0)}%</text>
      <text x="70" y="84" text-anchor="middle" class="viz-gauge-label">${escapeXml(label)}</text>
    </svg>
    <p class="muted small">${escapeXml(caption)}</p>
  `
  return wrap
}

/** Polygon radar for audit scores. */
export function radarChart(
  axes: { label: string; value: number; max: number }[],
): HTMLElement {
  const n = axes.length
  const size = 220
  const cx = size / 2
  const cy = size / 2
  const R = 78
  const points = (scale: number) =>
    axes
      .map((a, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
        const r = R * scale * (a.value / a.max)
        return `${cx + r * Math.cos(ang)},${cy + r * Math.sin(ang)}`
      })
      .join(' ')

  const rings = [0.25, 0.5, 0.75, 1]
    .map((s) => {
      const ringPts = axes
        .map((_, i) => {
          const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
          return `${cx + R * s * Math.cos(ang)},${cy + R * s * Math.sin(ang)}`
        })
        .join(' ')
      return `<polygon points="${ringPts}" class="viz-radar-ring"/>`
    })
    .join('')

  const spokes = axes
    .map((a, i) => {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n
      const x = cx + R * Math.cos(ang)
      const y = cy + R * Math.sin(ang)
      const lx = cx + (R + 22) * Math.cos(ang)
      const ly = cy + (R + 22) * Math.sin(ang)
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="viz-radar-spoke"/>
        <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" class="viz-radar-label">${escapeXml(a.label)}</text>`
    })
    .join('')

  const wrap = el('div', { class: 'viz-radar' })
  wrap.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" class="viz-radar-svg">
      ${rings}
      ${spokes}
      <polygon points="${points(1)}" class="viz-radar-area"/>
    </svg>
  `
  return wrap
}

/** Step progress pills. */
export function stepPills(current: number, total: number): HTMLElement {
  const row = el('div', { class: 'viz-steps', 'aria-label': `Step ${current} of ${total}` })
  for (let i = 1; i <= total; i++) {
    row.append(
      el('span', {
        class: `viz-step${i < current ? ' done' : ''}${i === current ? ' active' : ''}`,
      }),
    )
  }
  return row
}

/** Decision path breadcrumbs. */
export function pathTrail(notes: string[]): HTMLElement {
  const wrap = el('div', { class: 'viz-path' }, [
    el('p', { class: 'viz-title' }, ['Your path']),
  ])
  if (!notes.length) {
    wrap.append(el('p', { class: 'muted small' }, ['No forks taken yet.']))
    return wrap
  }
  const list = el('ol', { class: 'viz-path-list' })
  notes.forEach((n) => list.append(el('li', {}, [n])))
  wrap.append(list)
  return wrap
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
