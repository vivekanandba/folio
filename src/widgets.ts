import { prefersReducedMotion } from './a11y'
import { COMPUTES } from './computes'
import { el } from './dom'
import { burst, donut } from './fx'
import { renderMarkdown } from './markdown'
import { mountSim } from './sim/engine'
import { PALETTE, gauge, radarChart, twinBars } from './visuals'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Spec = any

export function fmtNum(n: number, unit?: string, decimals = 2): string {
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.abs(n) >= 1000 ? Math.round(n).toLocaleString() : n.toFixed(decimals)
  return unit === '%' ? `${rounded}%` : unit ? `${rounded} ${unit}` : rounded
}

function figure(caption: string | undefined, body: HTMLElement): HTMLElement {
  const fig = el('figure', { class: 'widget-figure' }, [body])
  if (caption) fig.append(el('figcaption', {}, [caption]))
  return fig
}

/** Widget types the learner manipulates directly (they earn the "please touch" cue). */
const TOUCHABLE = new Set(['what-if', 'annotated', 'sim'])

/** Render markdown into `host` and mount any inline ```viz interactive figures. */
export function renderRichInto(host: HTMLElement, md: string): void {
  host.innerHTML = renderMarkdown(md)
  host.querySelectorAll<HTMLElement>('.viz-slot').forEach((slot) => {
    const raw = slot.getAttribute('data-viz')
    if (!raw) return
    try {
      const spec = JSON.parse(raw)
      mountWidget(slot, spec)
      if (TOUCHABLE.has(spec?.type)) {
        slot.prepend(el('div', { class: 'touch-chip', 'aria-hidden': 'true' }, ['Interactive — please touch']))
      }
    } catch {
      slot.replaceChildren(el('p', { class: 'muted small' }, ['(interactive figure unavailable)']))
    }
  })
}

/**
 * A block of narrative markdown as an element — the standard way every session
 * kind renders intros / debriefs / briefings, so any of them can carry inline
 * ```viz interactive figures. Plain sentences stay plain paragraphs.
 */
export function richBlock(md: string, className = 'rich-block'): HTMLElement {
  const host = el('div', { class: className })
  renderRichInto(host, md)
  return host
}

/** Mount an interactive figure into `host` from a JSON spec. Defensive: bad specs degrade gracefully. */
export function mountWidget(host: HTMLElement, spec: Spec): void {
  try {
    host.replaceChildren(build(spec))
    host.classList.add('widget-mounted')
  } catch {
    host.replaceChildren(el('p', { class: 'muted small' }, ['(interactive figure unavailable)']))
  }
}

function build(spec: Spec): HTMLElement {
  switch (spec?.type) {
    case 'donut': {
      const segs = (spec.segments ?? []).map((s: any, i: number) => ({
        label: String(s.label),
        pct: Number(s.pct),
        color: s.color ?? PALETTE[i % PALETTE.length],
      }))
      return figure(spec.caption, donut(segs, { size: spec.size ?? 200, title: spec.title }))
    }
    case 'gauge':
      return figure(spec.caption, gauge(Number(spec.value) || 0, String(spec.label ?? ''), String(spec.note ?? '')))
    case 'radar':
      return figure(spec.caption, radarChart((spec.axes ?? []).map((a: any) => ({
        label: String(a.label), value: Number(a.value), max: Number(a.max) || 1,
      }))))
    case 'twinBars':
      return figure(spec.caption, twinBars((spec.rows ?? []).map((r: any) => ({
        name: String(r.name), fund: Number(r.fund), index: Number(r.index),
      }))))
    case 'what-if':
      return buildWhatIf(spec)
    case 'annotated':
      return buildAnnotated(spec)
    case 'sim': {
      // Full simulation exhibit inline on a concept page.
      const host = el('div', { class: 'sim-embed' })
      const handle = mountSim(host, { model: spec.model, params: spec.params, title: spec.title, caption: spec.caption })
      if (!handle) throw new Error('unknown sim model')
      return host
    }
    default:
      throw new Error('unknown widget type')
  }
}

function buildWhatIf(spec: Spec): HTMLElement {
  const inputs: any[] = spec.inputs ?? []
  const compute = COMPUTES[spec.compute]
  if (!compute) throw new Error('unknown compute')
  const out = spec.output ?? {}

  const wrap = el('div', { class: 'widget what-if' })
  if (spec.title) wrap.append(el('p', { class: 'widget-title' }, [spec.title]))

  const readout = el('div', { class: 'widget-readout' })
  const gaugeHost = out.outMax ? el('div', { class: 'widget-gauge' }) : null

  const vals: Record<string, number> = {}
  inputs.forEach((inp) => (vals[inp.key] = Number(inp.value ?? inp.min ?? 0)))

  const recompute = () => {
    const n = compute(vals)
    readout.textContent = `${out.label ? out.label + ': ' : ''}${fmtNum(n, out.unit, out.decimals ?? 2)}`
    if (gaugeHost) {
      gaugeHost.replaceChildren(gauge(Math.max(0, Math.min(1, n / Number(out.outMax))), out.gaugeLabel ?? '', ''))
    }
  }

  for (const inp of inputs) {
    const row = el('div', { class: 'knob-row' })
    const valTag = el('span', { class: 'holding-val' }, [fmtNum(vals[inp.key], inp.unit, inp.decimals ?? 0)])
    row.append(el('div', { class: 'knob-label' }, [
      el('strong', {}, [String(inp.label ?? inp.key)]),
    ]))
    const range = document.createElement('input')
    range.type = 'range'
    range.min = String(inp.min ?? 0)
    range.max = String(inp.max ?? 100)
    range.step = String(inp.step ?? 1)
    range.value = String(vals[inp.key])
    range.setAttribute('aria-label', String(inp.label ?? inp.key))
    range.addEventListener('input', () => {
      vals[inp.key] = Number(range.value)
      valTag.textContent = fmtNum(vals[inp.key], inp.unit, inp.decimals ?? 0)
      recompute()
    })
    row.append(range, valTag)
    wrap.append(row)
  }

  if (gaugeHost) wrap.append(gaugeHost)
  wrap.append(readout)
  recompute()
  return spec.caption ? figure(spec.caption, wrap) : wrap
}

function buildAnnotated(spec: Spec): HTMLElement {
  const points: any[] = spec.points ?? []
  const wrap = el('div', { class: 'widget annotated' })
  if (spec.title) wrap.append(el('p', { class: 'widget-title' }, [spec.title]))
  if (spec.prompt) wrap.append(el('p', { class: 'muted small' }, [spec.prompt]))

  const note = el('div', { class: 'annotated-note' }, [
    el('p', { class: 'muted small' }, ['Tap a point to see why it matters.']),
  ])
  const peak = Math.max(...points.map((p) => Number(p.value) || 0), 1)

  const row = el('div', { class: 'annotated-row' })
  points.forEach((p) => {
    const hasVal = Number.isFinite(Number(p.value))
    const h = hasVal ? Math.max(8, Math.round((Number(p.value) / peak) * 100)) : 100
    const btn = el('button', {
      class: 'annotated-point',
      type: 'button',
      'aria-label': `${p.label}${hasVal ? ': ' + p.value : ''}`,
    }, [
      el('span', { class: 'annotated-fill', style: `height:${h}%` }),
      el('span', { class: 'annotated-label' }, [String(p.label)]),
    ])
    btn.addEventListener('click', () => {
      row.querySelectorAll('.annotated-point').forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      if (!prefersReducedMotion()) burst(btn, ['#2dd4bf', '#38bdf8'])
      note.replaceChildren(
        el('p', {}, [el('strong', {}, [String(p.label)]), ' — ', String(p.note ?? '')]),
      )
    })
    row.append(btn)
  })

  wrap.append(row, note)
  return spec.caption ? figure(spec.caption, wrap) : wrap
}
