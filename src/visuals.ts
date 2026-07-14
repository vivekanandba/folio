import { el } from './dom'

const PALETTE = ['#0f766e', '#c2410c', '#1d4ed8', '#a16207', '#7c3aed', '#be123c']

export function kindIcon(kind: string): HTMLElement {
  const wrap = el('span', { class: `kind-icon kind-${kind}`, 'aria-hidden': 'true' })
  const svg: Record<string, string> = {
    detective: `<svg viewBox="0 0 40 40" fill="none"><circle cx="18" cy="18" r="8" stroke="currentColor" stroke-width="2"/><path d="M24 24l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14 16h8M16 20h4" stroke="currentColor" stroke-width="1.5"/></svg>`,
    decision: `<svg viewBox="0 0 40 40" fill="none"><path d="M20 6v10M20 16l-8 8M20 16l8 8M12 24v8M28 24v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    audit: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="2"/><path d="M20 10v10l7 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    lab: `<svg viewBox="0 0 40 40" fill="none"><rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" stroke-width="2"/><path d="M12 14h16M12 20h10M12 26h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    calculator: `<svg viewBox="0 0 40 40" fill="none"><rect x="8" y="6" width="24" height="28" rx="3" stroke="currentColor" stroke-width="2"/><path d="M12 14h16M12 20h10M12 26h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    classify: `<svg viewBox="0 0 40 40" fill="none"><rect x="6" y="8" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2"/><rect x="22" y="8" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2"/><rect x="6" y="22" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2"/><rect x="22" y="22" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2"/></svg>`,
    quiz: `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="2"/><path d="M16 17c0-2.5 1.8-4 4-4s4 1.5 4 3.5c0 2-2 3-4 3.5v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="28" r="1.5" fill="currentColor"/></svg>`,
  }
  wrap.innerHTML = svg[kind] ?? svg.quiz
  return wrap
}

/** Segmented horizontal stacked bar (allocation). */
export function stackedBar(
  segments: { label: string; pct: number; color?: string }[],
  opts: { title?: string; height?: number } = {},
): HTMLElement {
  const wrap = el('div', { class: 'viz-stack' })
  if (opts.title) wrap.append(el('p', { class: 'viz-title' }, [opts.title]))
  const track = el('div', {
    class: 'viz-stack-track',
    style: `height:${opts.height ?? 28}px`,
  })
  const total = segments.reduce((a, s) => a + s.pct, 0) || 1
  segments.forEach((s, i) => {
    const w = (s.pct / total) * 100
    if (w <= 0) return
    const seg = el('div', {
      class: 'viz-stack-seg',
      style: `width:${w}%;background:${s.color ?? PALETTE[i % PALETTE.length]}`,
      title: `${s.label}: ${s.pct}%`,
    }, [w >= 12 ? `${Math.round(s.pct)}%` : ''])
    track.append(seg)
  })
  wrap.append(track)
  const legend = el('div', { class: 'viz-legend' })
  segments.forEach((s, i) => {
    legend.append(
      el('span', { class: 'viz-legend-item' }, [
        el('i', {
          class: 'viz-swatch',
          style: `background:${s.color ?? PALETTE[i % PALETTE.length]}`,
        }),
        `${s.label} ${s.pct}%`,
      ]),
    )
  })
  wrap.append(legend)
  return wrap
}

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
