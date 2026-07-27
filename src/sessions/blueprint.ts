import { el } from '../dom'
import { burst, shake, stage } from '../fx'
import {
  connectivityAvailability, edgeKey, evalRule, nodesOf, shortestHops,
  type BpNode, type Edge, type RuleResult,
} from './blueprint-rules'
import type { BlueprintRule, BlueprintSession } from '../types'
import { richBlock } from '../widgets'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const PER_NODE_AVAIL = 0.99 // each middle component is assumed 99% available

const BLUEPRINT_SVG = `<svg viewBox="0 0 40 40" fill="none"><rect x="8" y="8" width="10" height="8" rx="2" stroke="currentColor" stroke-width="2"/><rect x="24" y="12" width="8" height="8" rx="2" stroke="currentColor" stroke-width="2"/><rect x="14" y="26" width="9" height="7" rx="2" stroke="currentColor" stroke-width="2"/><path d="M18 13h6M28 20v4l-5 4M14 16l3 10" stroke="currentColor" stroke-width="1.6"/></svg>`

/* ------------------------------------------------------------------ mount */

function mountBlueprint(
  root: HTMLElement,
  session: BlueprintSession,
  onComplete: (score: number, max: number) => void,
): void {
  let uidSeq = 1
  const nodes: BpNode[] = []
  let edges: Edge[] = []
  let wireFrom: number | null = null
  let done = false

  for (const p of session.parts) {
    if (p.fixed) nodes.push({ uid: uidSeq++, part: p.id, label: p.label, fixed: true })
  }

  // --- board -------------------------------------------------------------
  const wires = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  wires.setAttribute('class', 'bp-wires')
  wires.setAttribute('aria-hidden', 'true')
  const nodesHost = el('div', { class: 'bp-nodes' })
  const board = el('div', { class: 'bp-board' }, [wires, nodesHost])
  const wireHint = el('p', { class: 'muted small bp-hint' }, [
    'Wire: tap one component, then another. Tap a wire in the list to cut it.',
  ])

  const wireList = el('div', { class: 'bp-wire-list' })
  const tray = el('div', { class: 'bp-tray' })
  const rulesHost = el('div', { class: 'bp-rules result-card' })

  // Live physics: derive endpoints from the first path-shaped rule, so the
  // board doubles as a machine — every part placed moves the readouts.
  const pathRule = session.rules.find(
    (r): r is Extract<BlueprintRule, { from: string; to: string }> =>
      r.rule === 'pathExists' || r.rule === 'survivesKill',
  )
  const physicsTiles = new Map<string, HTMLElement>()
  let physics: HTMLElement | null = null
  if (pathRule) {
    const tile = (key: string, label: string) => {
      const value = el('span', { class: 'sim-readout-value' }, ['—'])
      physicsTiles.set(key, value)
      return el('div', { class: 'sim-readout' }, [value, el('span', { class: 'sim-readout-label' }, [label])])
    }
    physics = el('div', { class: 'bp-physics' }, [
      el('div', { class: 'sim-readouts' }, [
        tile('avail', 'Path availability (%)'),
        tile('down', 'Downtime (min/yr)'),
        tile('hops', 'Request hops'),
        tile('parts', 'Parts placed'),
      ]),
      el('p', { class: 'muted small' }, [
        `Live: every middle part is assumed ${PER_NODE_AVAIL * 100}% available — watch redundancy move the nines.`,
      ]),
    ])
  }

  function renderPhysics(): void {
    if (!pathRule) return
    const set = (key: string, text: string) => {
      const tag = physicsTiles.get(key)
      if (tag) tag.textContent = text
    }
    const avail = connectivityAvailability(nodes, edges, pathRule.from, pathRule.to, PER_NODE_AVAIL)
    const hops = shortestHops(nodes, edges, pathRule.from, pathRule.to)
    set('avail', avail == null || hops == null ? '—' : (avail * 100).toFixed(3))
    set('down', avail == null || hops == null ? '—' : String(Math.round((1 - avail) * 525600)))
    set('hops', hops == null ? 'no path' : String(hops))
    set('parts', String(nodes.length))
  }
  const inspect = el('button', { class: 'primary pulse', type: 'button' }, ['🔍 Inspect blueprint'])
  const giveUp = el('button', { class: 'ghost', type: 'button' }, ['Show me the debrief'])

  const nodeName = (n: BpNode): string => {
    const siblings = nodesOf(nodes, n.part)
    return siblings.length > 1 ? `${n.label} ${siblings.findIndex((s) => s.uid === n.uid) + 1}` : n.label
  }

  function drawWires(): void {
    const br = board.getBoundingClientRect()
    wires.setAttribute('viewBox', `0 0 ${br.width} ${br.height}`)
    wires.replaceChildren()
    for (const [a, b] of edges) {
      const ea = nodesHost.querySelector<HTMLElement>(`[data-uid="${a}"]`)
      const eb = nodesHost.querySelector<HTMLElement>(`[data-uid="${b}"]`)
      if (!ea || !eb) continue
      const ra = ea.getBoundingClientRect()
      const rb = eb.getBoundingClientRect()
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      line.setAttribute('x1', String(ra.left + ra.width / 2 - br.left))
      line.setAttribute('y1', String(ra.top + ra.height / 2 - br.top))
      line.setAttribute('x2', String(rb.left + rb.width / 2 - br.left))
      line.setAttribute('y2', String(rb.top + rb.height / 2 - br.top))
      wires.append(line)
    }
  }

  function renderTray(): void {
    tray.replaceChildren(el('h3', {}, ['Parts tray']))
    for (const p of session.parts) {
      if (p.fixed) continue
      const placed = nodesOf(nodes, p.id).length
      const left = (p.max ?? 1) - placed
      const btn = el('button', {
        class: 'ghost bp-part',
        type: 'button',
        ...(left <= 0 || done ? { disabled: 'true' } : {}),
      }, [`+ ${p.label}`, el('span', { class: 'muted small' }, [` ×${left}`])])
      btn.addEventListener('click', () => {
        nodes.push({ uid: uidSeq++, part: p.id, label: p.label, fixed: false })
        renderAll()
      })
      tray.append(btn)
    }
  }

  function renderNodes(): void {
    nodesHost.replaceChildren()
    for (const n of nodes) {
      const isArmed = wireFrom === n.uid
      const chip = el('div', {
        class: `bp-node${n.fixed ? ' fixed' : ''}${isArmed ? ' armed' : ''}`,
        'data-uid': String(n.uid),
      })
      const wireBtn = el('button', {
        class: 'bp-node-label',
        type: 'button',
        'aria-pressed': isArmed ? 'true' : 'false',
        title: isArmed ? 'Tap another component to wire' : 'Tap to start a wire',
      }, [nodeName(n)])
      wireBtn.addEventListener('click', () => {
        if (done) return
        if (wireFrom == null) {
          wireFrom = n.uid
        } else if (wireFrom === n.uid) {
          wireFrom = null
        } else {
          const key = edgeKey(wireFrom, n.uid)
          const existing = edges.findIndex(([a, b]) => edgeKey(a, b) === key)
          if (existing >= 0) edges.splice(existing, 1)
          else edges.push([wireFrom, n.uid])
          wireFrom = null
        }
        renderAll()
      })
      chip.append(wireBtn)
      if (!n.fixed) {
        const rm = el('button', { class: 'bp-remove', type: 'button', 'aria-label': `Remove ${nodeName(n)}` }, ['×'])
        rm.addEventListener('click', () => {
          if (done) return
          const i = nodes.findIndex((x) => x.uid === n.uid)
          if (i >= 0) nodes.splice(i, 1)
          edges = edges.filter(([a, b]) => a !== n.uid && b !== n.uid)
          if (wireFrom === n.uid) wireFrom = null
          renderAll()
        })
        chip.append(rm)
      }
      nodesHost.append(chip)
    }
    requestAnimationFrame(drawWires)
  }

  function renderWireList(): void {
    wireList.replaceChildren()
    for (const [a, b] of edges) {
      const na = nodes.find((n) => n.uid === a)
      const nb = nodes.find((n) => n.uid === b)
      if (!na || !nb) continue
      const cut = el('button', { class: 'ghost bp-wire-chip', type: 'button', title: 'Cut this wire' }, [
        `${nodeName(na)} ⟷ ${nodeName(nb)}  ✂`,
      ])
      cut.addEventListener('click', () => {
        if (done) return
        const key = edgeKey(a, b)
        edges = edges.filter(([x, y]) => edgeKey(x, y) !== key)
        renderAll()
      })
      wireList.append(cut)
    }
  }

  function renderRules(results?: RuleResult[]): void {
    rulesHost.replaceChildren(el('h3', {}, ['The spec']))
    session.rules.forEach((r, i) => {
      const res = results?.[i]
      const cls = res ? (res.ok ? ' met' : ' broken') : ''
      rulesHost.append(
        el('div', { class: `lab-goal${cls}` }, [
          el('span', { class: 'lab-goal-dot', 'aria-hidden': 'true' }),
          el('span', {}, [r.label]),
          el('span', { class: 'lab-goal-val muted small' }, [res ? (res.ok ? 'holds' : 'broken') : 'uninspected']),
        ]),
      )
    })
  }

  function renderAll(): void {
    renderTray()
    renderNodes()
    renderWireList()
    renderPhysics()
    // The spec judges live — every placement or wire lights rules up or breaks them.
    renderRules(session.rules.map((r) => evalRule(r, nodes, edges)))
  }

  inspect.addEventListener('click', () => {
    if (done) return
    const results = session.rules.map((r) => evalRule(r, nodes, edges))
    renderRules(results)
    nodesHost.querySelectorAll('.bp-node').forEach((c) => c.classList.remove('offender'))
    const offenders = new Set(results.flatMap((r) => (r.ok ? [] : r.offenders)))
    for (const uid of offenders) {
      nodesHost.querySelector(`[data-uid="${uid}"]`)?.classList.add('offender')
    }
    const passed = results.filter((r) => r.ok).length
    if (passed === session.rules.length) {
      done = true
      burst(inspect)
      finish(passed)
    } else {
      shake(inspect)
    }
  })

  giveUp.addEventListener('click', () => {
    if (done) return
    done = true
    const passed = session.rules.map((r) => evalRule(r, nodes, edges)).filter((r) => r.ok).length
    finish(passed)
  })

  function finish(passed: number): void {
    root.replaceChildren(
      stage('blueprint', 'Drafting table', passed === session.rules.length ? 'Blueprint approved' : 'Back to the drawing board', [
        el('div', { class: 'result-card pop-in' }, [
          el('p', { class: 'score-hero' }, [`${passed} / ${session.rules.length}`]),
          richBlock(session.debrief),
        ]),
      ]),
    )
    onComplete(passed, session.rules.length)
  }

  renderAll()
  new ResizeObserver(() => drawWires()).observe(board)

  root.replaceChildren(
    stage('blueprint', 'Drafting table', session.title, [
      richBlock(session.briefing, 'stage-lead rich-block'),
      tray,
      board,
      wireHint,
      wireList,
      ...(physics ? [physics] : []),
      rulesHost,
      el('div', { class: 'session-actions' }, [inspect, giveUp]),
    ]),
  )
  requestAnimationFrame(drawWires)
}

const module: SessionModule<BlueprintSession> = {
  kind: 'blueprint',
  label: 'Drafting table',
  blurb: 'Build the system yourself — place components, wire them, survive the inspection.',
  icon: () => iconSpan('blueprint', BLUEPRINT_SVG),
  mount: mountBlueprint,
  validate: (session) => {
    const issues: string[] = []
    const ids = new Set(session.parts?.map((p) => p.id))
    const refs = (r: BlueprintRule): string[] => {
      switch (r.rule) {
        case 'minCount': case 'maxCount': return [r.part]
        case 'connected': case 'noDirect': return [r.a, r.b]
        case 'pathExists': case 'survivesKill': return [r.from, r.to]
      }
    }
    for (const r of session.rules ?? []) {
      for (const ref of refs(r)) if (!ids.has(ref)) issues.push(`rule references unknown part "${ref}"`)
    }
    if (!session.rules?.length) issues.push('blueprint needs rules[]')
    if (!session.parts?.length) issues.push('blueprint needs parts[]')
    return issues
  },
}

register(module)
