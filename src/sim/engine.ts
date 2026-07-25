import { prefersReducedMotion } from '../a11y'
import { el } from '../dom'
import { SIM_MODELS, type SimModel, type SimState } from './models'

/**
 * The exhibit engine: mounts a whitelisted model as a live, touchable machine
 * — strip chart, real range-input knobs, action buttons, readout tiles, and
 * a play/pause/step/reset transport.
 *
 * Fixed-timestep accumulator under rAF (stable when frames stutter). Under
 * reduced motion the machine starts PAUSED with a prominent "Step" button —
 * the information is identical, only the free-running motion is opt-in.
 * Pauses off-screen/hidden; self-destroys when detached (after first attach).
 */

export interface SimSpec {
  model: string
  params?: Record<string, number>
  title?: string
  caption?: string
}

export interface SimHandle {
  state: SimState
  params: Record<string, number>
  running: () => boolean
  play: () => void
  pause: () => void
  reset: () => void
  destroy: () => void
}

const SIM_DT = 0.1 // seconds of sim time per fixed step
const MAX_POINTS = 300

export function mountSim(
  host: HTMLElement,
  spec: SimSpec,
  onTick?: (state: SimState, params: Record<string, number>) => void,
): SimHandle | null {
  const model = SIM_MODELS[spec.model]
  if (!model) {
    host.replaceChildren(el('p', { class: 'muted small' }, ['(unknown simulation)']))
    return null
  }

  const params: Record<string, number> = {}
  for (const p of model.params) params[p.key] = spec.params?.[p.key] ?? p.value

  let state = model.init(params)
  const reduced = prefersReducedMotion()
  let running = !reduced
  let destroyed = false
  let everConnected = false
  let raf = 0
  let acc = 0
  let lastNow = 0

  // ---------------------------------------------------------------- layout
  const canvas = document.createElement('canvas')
  canvas.className = 'sim-chart'
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', `${model.title} — live chart`)
  const ctx = canvas.getContext('2d')

  const legend = el('div', { class: 'sim-legend' }, model.series.map((s) =>
    el('span', { class: 'viz-legend-item' }, [
      el('i', { class: 'viz-swatch', style: `background:${s.color}` }),
      s.label,
    ]),
  ))

  const readoutTiles = new Map<string, HTMLElement>()
  const readouts = el('div', { class: 'sim-readouts' }, model.readouts.map((r) => {
    const value = el('span', { class: 'sim-readout-value' }, ['—'])
    readoutTiles.set(r.key, value)
    return el('div', { class: 'sim-readout' }, [
      value,
      el('span', { class: 'sim-readout-label' }, [r.label + (r.unit ? ` (${r.unit})` : '')]),
    ])
  }))

  const knobs = el('div', { class: 'sim-knobs' }, model.params.map((p) => {
    const valTag = el('span', { class: 'holding-val' }, [fmtKnob(params[p.key], p.unit)])
    const range = document.createElement('input')
    range.type = 'range'
    range.min = String(p.min)
    range.max = String(p.max)
    range.step = String(p.step)
    range.value = String(params[p.key])
    range.setAttribute('aria-label', p.label)
    range.addEventListener('input', () => {
      params[p.key] = Number(range.value)
      valTag.textContent = fmtKnob(params[p.key], p.unit)
      if (!running) { tick(SIM_DT); draw(); updateReadouts() } // knobs respond while paused
    })
    return el('div', { class: 'knob-row' }, [
      el('div', { class: 'knob-label' }, [el('strong', {}, [p.label])]),
      range,
      valTag,
    ])
  }))

  const transport = el('div', { class: 'sim-transport' })
  const playBtn = el('button', { class: 'ghost sim-btn', type: 'button' }, [running ? '❚❚ Pause' : '▶ Run'])
  const stepBtn = el('button', { class: `${reduced ? 'primary' : 'ghost'} sim-btn`, type: 'button' }, ['⏯ Step'])
  const resetBtn = el('button', { class: 'ghost sim-btn', type: 'button' }, ['↺ Reset'])
  playBtn.addEventListener('click', () => {
    running = !running
    playBtn.textContent = running ? '❚❚ Pause' : '▶ Run'
    if (running) start()
  })
  stepBtn.addEventListener('click', () => {
    for (let i = 0; i < 5; i++) tick(SIM_DT)
    draw()
    updateReadouts()
  })
  resetBtn.addEventListener('click', () => {
    state = model.init(params)
    draw()
    updateReadouts()
  })
  transport.append(playBtn, stepBtn, resetBtn)
  for (const action of model.actions ?? []) {
    const btn = el('button', { class: 'primary sim-btn sim-action', type: 'button' }, [action.label])
    btn.addEventListener('click', () => {
      action.apply(state, params)
      if (!running) { tick(SIM_DT); draw(); updateReadouts() }
    })
    transport.append(btn)
  }

  const wrap = el('div', { class: 'sim-machine' })
  if (spec.title || model.title) wrap.append(el('p', { class: 'widget-title' }, [spec.title ?? model.title]))
  wrap.append(canvas, legend, readouts, knobs, transport)
  if (spec.caption) wrap.append(el('p', { class: 'muted small sim-caption' }, [spec.caption]))
  host.append(wrap)

  // ----------------------------------------------------------------- logic
  function fmtKnob(n: number, unit?: string): string {
    const s = Math.abs(n) >= 1000 ? n.toLocaleString() : String(n)
    return unit ? `${s} ${unit}` : s
  }

  function tick(dt: number): void {
    model.step(state, params, dt)
    for (const s of model.series) {
      const arr = state.series[s.key]
      if (arr && arr.length > MAX_POINTS) arr.splice(0, arr.length - MAX_POINTS)
    }
    onTick?.(state, params)
  }

  function updateReadouts(): void {
    for (const r of model.readouts) {
      const v = state.scalars[r.key]
      const tag = readoutTiles.get(r.key)
      if (tag) tag.textContent = v == null || !Number.isFinite(v) ? '—' : v.toFixed(r.decimals ?? 1)
    }
  }

  function resizeCanvas(): void {
    const w = wrap.clientWidth || 320
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(150 * dpr)
    canvas.style.height = '150px'
    canvas.style.width = '100%'
  }

  function draw(): void {
    if (!ctx) return
    const { width: W, height: H } = canvas
    ctx.clearRect(0, 0, W, H)
    // faint horizon lines
    ctx.strokeStyle = 'rgba(197, 189, 177, 0.12)'
    ctx.lineWidth = 1
    for (let i = 1; i < 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (H / 4) * i)
      ctx.lineTo(W, (H / 4) * i)
      ctx.stroke()
    }
    // shared max across series so relationships stay honest
    let max = 1
    for (const s of model.series) {
      for (const v of state.series[s.key] ?? []) if (v > max) max = v
    }
    for (const s of model.series) {
      const arr = state.series[s.key] ?? []
      if (arr.length < 2) continue
      ctx.strokeStyle = s.color
      ctx.lineWidth = 2 * Math.min(window.devicePixelRatio || 1, 2)
      ctx.beginPath()
      const n = arr.length
      for (let i = 0; i < n; i++) {
        const x = (i / (MAX_POINTS - 1)) * W + (1 - n / MAX_POINTS) * 0 // left-anchored while filling
        const y = H - (arr[i] / max) * (H * 0.92) - H * 0.04
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  function frame(now: number): void {
    raf = 0
    if (destroyed) return
    if (!canvas.isConnected) {
      if (everConnected) { destroy(); return }
      raf = requestAnimationFrame(frame)
      return
    }
    if (!everConnected) {
      everConnected = true
      resizeCanvas()
      // seed a little history so the chart isn't empty on arrival
      for (let i = 0; i < 30; i++) tick(SIM_DT)
      draw()
      updateReadouts()
      if (!running) return
    }
    if (!running || document.hidden) return
    if (lastNow) {
      acc += Math.min(0.25, (now - lastNow) / 1000)
      while (acc >= SIM_DT) {
        tick(SIM_DT)
        acc -= SIM_DT
      }
      draw()
      updateReadouts()
    }
    lastNow = now
    raf = requestAnimationFrame(frame)
  }

  function start(): void {
    lastNow = 0
    if (!destroyed && !raf) raf = requestAnimationFrame(frame)
  }

  const onVisibility = (): void => { if (!document.hidden) start() }
  document.addEventListener('visibilitychange', onVisibility)
  const io = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) start()
  })
  io.observe(host)
  const ro = new ResizeObserver(() => { resizeCanvas(); draw() })
  ro.observe(wrap)

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    running = false
    if (raf) cancelAnimationFrame(raf)
    io.disconnect()
    ro.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
  }

  start()

  return {
    get state() { return state },
    params,
    running: () => running,
    play: () => { running = true; start() },
    pause: () => { running = false },
    reset: () => { state = model.init(params); draw(); updateReadouts() },
    destroy,
  }
}

export function simModelExists(id: string): boolean {
  return id in SIM_MODELS
}

export type { SimModel, SimState }
