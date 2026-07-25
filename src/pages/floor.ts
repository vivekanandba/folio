import { prefersReducedMotion } from '../a11y'
import { loadCatalog, loadConcept, loadPackMeta } from '../content'
import { el, prettyId } from '../dom'
import { getConceptState } from '../progress'
import { href } from '../router'
import { masteryBand, today } from '../srs'

/**
 * The museum floor — navigation as space. Every concept across every pack is
 * a lamp on a pannable, zoomable canvas: dark = unvisited, warm = shaky,
 * blue = developing, bright teal = solid; a pulsing ring means it's due for
 * review. Halls (packs) are radial clusters; brass wires are the cross-links
 * written inside concept markdown. Click a lamp to walk into the exhibit.
 *
 * A11y: the canvas is aria-hidden; a full list-of-links mirror lives beneath
 * it ("Every exhibit, as a list"), which is also the keyboard path.
 */

interface FloorNode {
  packId: string
  conceptId: string
  label: string
  x: number
  y: number
  band: 'unvisited' | 'shaky' | 'developing' | 'solid'
  due: boolean
}

interface Hall {
  packId: string
  title: string
  num: string
  x: number
  y: number
  r: number
}

const BAND_FILL: Record<FloorNode['band'], string> = {
  unvisited: '#3a352f',
  shaky: '#e5b567',
  developing: '#8ab4f8',
  solid: '#4fd1c5',
}
const BAND_GLOW: Record<FloorNode['band'], number> = {
  unvisited: 0,
  shaky: 10,
  developing: 14,
  solid: 20,
}

const LINK_RE = /#\/pack\/([a-z0-9-]+)\/concept\/([a-z0-9-]+)/g

export async function renderFloor(root: HTMLElement): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Lighting the halls…']))
  const catalog = await loadCatalog()
  const metas = await Promise.all(catalog.packs.map((ref) => loadPackMeta(ref.path)))

  // ---- layout: halls on a ring, concepts on rings around their hall ------
  const halls: Hall[] = []
  const nodes: FloorNode[] = []
  const t = today()
  const hallRingR = metas.length > 1 ? 300 : 0

  metas.forEach((meta, i) => {
    const angle = (i / metas.length) * Math.PI * 2 - Math.PI / 2
    const hx = Math.cos(angle) * hallRingR
    const hy = Math.sin(angle) * hallRingR
    const conceptR = 68 + meta.concepts.length * 9
    halls.push({
      packId: meta.id,
      title: meta.title,
      num: String(i + 1).padStart(2, '0'),
      x: hx,
      y: hy,
      r: conceptR + 34,
    })
    meta.concepts.forEach((cid, j) => {
      const a = (j / meta.concepts.length) * Math.PI * 2 - Math.PI / 2 + i
      const st = getConceptState(meta.id, cid)
      const band = st?.learnedAt || (st?.reviewCount ?? 0) > 0 ? masteryBand(st!.mastery) : 'unvisited'
      nodes.push({
        packId: meta.id,
        conceptId: cid,
        label: prettyId(cid),
        x: hx + Math.cos(a) * conceptR,
        y: hy + Math.sin(a) * conceptR,
        band,
        due: !!st && (st.reviewCount > 0 || !!st.learnedAt) && st.due <= t,
      })
    })
  })

  // ---- edges from concept markdown cross-links ---------------------------
  const edges: [FloorNode, FloorNode][] = []
  const nodeIndex = new Map(nodes.map((n) => [`${n.packId}::${n.conceptId}`, n]))
  await Promise.all(
    metas.map(async (meta, i) => {
      const packPath = catalog.packs[i].path
      await Promise.all(
        meta.concepts.map(async (cid) => {
          try {
            const md = await loadConcept(packPath, cid)
            for (const m of md.matchAll(LINK_RE)) {
              const from = nodeIndex.get(`${meta.id}::${cid}`)
              const to = nodeIndex.get(`${m[1]}::${m[2]}`)
              if (from && to && from !== to) edges.push([from, to])
            }
          } catch {
            /* concept md missing — no wires from it */
          }
        }),
      )
    }),
  )

  // ---- canvas -------------------------------------------------------------
  const canvas = document.createElement('canvas')
  canvas.className = 'floor-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  const ctx = canvas.getContext('2d')
  const reduced = prefersReducedMotion()

  // view transform: screen = world * scale + offset
  let scale = 1
  let ox = 0
  let oy = 0
  let dpr = 1
  let hovered: FloorNode | null = null

  const wrap = el('div', { class: 'floor-wrap' })
  const tip = el('div', { class: 'floor-tip', hidden: 'true' })

  function fitAll(): void {
    const pad = 60
    const xs = [...nodes.map((n) => n.x), ...halls.map((h) => h.x - h.r), ...halls.map((h) => h.x + h.r)]
    const ys = [...nodes.map((n) => n.y), ...halls.map((h) => h.y - h.r), ...halls.map((h) => h.y + h.r)]
    const minX = Math.min(...xs) - pad
    const maxX = Math.max(...xs) + pad
    const minY = Math.min(...ys) - pad
    const maxY = Math.max(...ys) + pad
    const w = canvas.width / dpr
    const h = canvas.height / dpr
    scale = Math.min(w / (maxX - minX), h / (maxY - minY))
    ox = w / 2 - ((minX + maxX) / 2) * scale
    oy = h / 2 - ((minY + maxY) / 2) * scale
  }

  function resize(): void {
    const w = wrap.clientWidth || 600
    const h = Math.min(560, Math.max(380, Math.round(w * 0.72)))
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    canvas.style.height = `${h}px`
    fitAll()
    draw(performance.now())
  }

  function draw(now: number): void {
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr)
    const sx = (x: number): number => x * scale + ox
    const sy = (y: number): number => y * scale + oy

    // hall rings + plaques
    for (const hall of halls) {
      ctx.beginPath()
      ctx.arc(sx(hall.x), sy(hall.y), hall.r * scale, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(201, 168, 106, 0.22)'
      ctx.setLineDash([5, 7])
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(201, 168, 106, 0.85)'
      ctx.font = `500 ${Math.max(10, 11 * scale)}px "IBM Plex Mono", ui-monospace, monospace`
      ctx.textAlign = 'center'
      ctx.fillText(`HALL ${hall.num} — ${hall.title.toUpperCase()}`, sx(hall.x), sy(hall.y - hall.r) - 8)
    }

    // cross-link wires
    ctx.strokeStyle = 'rgba(201, 168, 106, 0.35)'
    ctx.lineWidth = 1.2
    ctx.setLineDash([4, 5])
    for (const [a, b] of edges) {
      ctx.beginPath()
      ctx.moveTo(sx(a.x), sy(a.y))
      ctx.lineTo(sx(b.x), sy(b.y))
      ctx.stroke()
    }
    ctx.setLineDash([])

    // lamps
    for (const n of nodes) {
      const r = (n === hovered ? 13 : 10) * scale
      const x = sx(n.x)
      const y = sy(n.y)
      // due pulse ring
      if (n.due) {
        const pulse = reduced ? 0.5 : (Math.sin(now / 450) + 1) / 2
        ctx.beginPath()
        ctx.arc(x, y, r + 5 + pulse * 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(244, 162, 107, ${0.35 + pulse * 0.4})`
        ctx.lineWidth = 2
        ctx.stroke()
      }
      ctx.save()
      ctx.shadowColor = BAND_FILL[n.band]
      ctx.shadowBlur = BAND_GLOW[n.band] * scale
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = BAND_FILL[n.band]
      ctx.fill()
      ctx.restore()
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.strokeStyle = n.band === 'unvisited' ? '#57534e' : 'rgba(242, 237, 228, 0.5)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      // label
      ctx.fillStyle = n === hovered ? '#f2ede4' : 'rgba(197, 189, 177, 0.85)'
      ctx.font = `600 ${Math.max(9, 11 * scale)}px "DM Sans", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(n.label, x, y + r + 13)
    }
  }

  // gentle pulse loop only when due lamps exist and motion is allowed
  const hasDue = nodes.some((n) => n.due)
  let raf = 0
  let everConnected = false
  function loop(now: number): void {
    raf = 0
    if (!canvas.isConnected) {
      if (everConnected) {
        // navigated away — release the page's listeners
        document.removeEventListener('visibilitychange', onVisibility)
        return
      }
      raf = requestAnimationFrame(loop)
      return
    }
    everConnected = true
    if (document.hidden) return
    draw(now)
    if (hasDue && !reduced) raf = requestAnimationFrame(loop)
  }
  const onVisibility = (): void => {
    if (!document.hidden && !raf && canvas.isConnected) raf = requestAnimationFrame(loop)
  }
  document.addEventListener('visibilitychange', onVisibility)

  // ---- interactions -------------------------------------------------------
  function toWorld(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left - ox) / scale,
      y: (e.clientY - rect.top - oy) / scale,
    }
  }

  function nodeAt(wx: number, wy: number): FloorNode | null {
    let best: FloorNode | null = null
    let bestD = 18 // world-unit hit radius
    for (const n of nodes) {
      const d = Math.hypot(n.x - wx, n.y - wy)
      if (d < bestD) { best = n; bestD = d }
    }
    return best
  }

  let dragging = false
  let moved = false
  let lastX = 0
  let lastY = 0

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true
    moved = false
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  })
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      ox += dx
      oy += dy
      lastX = e.clientX
      lastY = e.clientY
      draw(performance.now())
    } else {
      const w = toWorld(e)
      const hit = nodeAt(w.x, w.y)
      if (hit !== hovered) {
        hovered = hit
        canvas.style.cursor = hit ? 'pointer' : 'grab'
        if (hit) {
          tip.textContent = `${hit.label} — ${hit.due ? 'due for review' : hit.band}`
          tip.removeAttribute('hidden')
          tip.style.left = `${hit.x * scale + ox}px`
          tip.style.top = `${hit.y * scale + oy - 34}px`
        } else {
          tip.setAttribute('hidden', 'true')
        }
        draw(performance.now())
      }
    }
  })
  canvas.addEventListener('pointerup', (e) => {
    dragging = false
    if (!moved) {
      const w = toWorld(e)
      const hit = nodeAt(w.x, w.y)
      if (hit) location.hash = href({ name: 'concept', packId: hit.packId, conceptId: hit.conceptId }).slice(1)
    }
  })
  canvas.addEventListener('pointerleave', () => {
    hovered = null
    tip.setAttribute('hidden', 'true')
    draw(performance.now())
  })
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const w = toWorld(e)
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    scale = Math.max(0.3, Math.min(3.5, scale * factor))
    // keep the point under the cursor fixed
    const rect = canvas.getBoundingClientRect()
    ox = e.clientX - rect.left - w.x * scale
    oy = e.clientY - rect.top - w.y * scale
    draw(performance.now())
  }, { passive: false })

  const zoomBtn = (label: string, factor: number): HTMLElement => {
    const b = el('button', { class: 'ghost floor-zoom', type: 'button', 'aria-label': label === '+' ? 'Zoom in' : label === '−' ? 'Zoom out' : 'Fit all' }, [label])
    b.addEventListener('click', () => {
      if (factor === 0) fitAll()
      else scale = Math.max(0.3, Math.min(3.5, scale * factor))
      draw(performance.now())
    })
    return b
  }

  // ---- a11y/keyboard mirror ----------------------------------------------
  const listSections = metas.map((meta, i) => {
    const items = meta.concepts.map((cid) => {
      const n = nodeIndex.get(`${meta.id}::${cid}`)
      const status = n?.due ? ' — due for review' : n && n.band !== 'unvisited' ? ` — ${n.band}` : ' — unvisited'
      return el('li', {}, [
        el('a', { href: href({ name: 'concept', packId: meta.id, conceptId: cid }) }, [prettyId(cid)]),
        el('span', { class: 'muted small' }, [status]),
      ])
    })
    return el('div', {}, [
      el('h3', {}, [`Hall ${String(i + 1).padStart(2, '0')} — ${meta.title}`]),
      el('ul', { class: 'floor-list' }, items),
    ])
  })

  const legend = el('div', { class: 'floor-legend' }, [
    legendDot('#3a352f', 'unvisited'),
    legendDot('#e5b567', 'shaky'),
    legendDot('#8ab4f8', 'developing'),
    legendDot('#4fd1c5', 'solid'),
    el('span', { class: 'viz-legend-item' }, [
      el('i', { class: 'viz-swatch floor-due-swatch' }),
      'pulsing = due',
    ]),
  ])

  wrap.append(canvas, tip)
  root.replaceChildren(
    el('header', { class: 'page-header' }, [
      el('p', {}, [el('span', { class: 'plaque' }, ['Floor plan — after hours'])]),
      el('h1', {}, ['The museum floor']),
      el('p', { class: 'lead' }, [
        'Every concept is a lamp. Dark rooms are unvisited; pulsing lamps are due for review. Drag to walk, scroll to lean in, tap a lamp to enter.',
      ]),
    ]),
    wrap,
    el('div', { class: 'floor-controls' }, [zoomBtn('+', 1.25), zoomBtn('−', 0.8), zoomBtn('Fit', 0)]),
    legend,
    el('details', { class: 'deeper floor-mirror' }, [
      el('summary', {}, ['Every exhibit, as a list']),
      ...listSections,
    ]),
  )

  new ResizeObserver(() => resize()).observe(wrap)
  resize()
  raf = requestAnimationFrame(loop)
}

function legendDot(color: string, label: string): HTMLElement {
  return el('span', { class: 'viz-legend-item' }, [
    el('i', { class: 'viz-swatch', style: `background:${color};border-radius:999px` }),
    label,
  ])
}
