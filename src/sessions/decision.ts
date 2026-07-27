import { liveAnnounce } from '../a11y'
import { el } from '../dom'
import { burst, stage } from '../fx'
import type { DecisionChoice, DecisionSession } from '../types'
import { pathTrail } from '../visuals'
import { richBlock } from '../widgets'
import { iconSpan } from './icon'
import { register, type SessionModule } from './registry'

const DECISION_SVG = `<svg viewBox="0 0 40 40" fill="none"><path d="M20 6v10M20 16l-8 8M20 16l8 8M12 24v8M28 24v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`

function mountDecision(
  root: HTMLElement,
  session: DecisionSession,
  onComplete: (score: number, max: number) => void,
): void {
  const byId = new Map(session.nodes.map((n) => [n.id, n]))
  let current = session.startId
  const notes: string[] = []
  let depth = 0

  const meter = session.meter
  let meterVal = meter?.start ?? 0
  const clamp = (v: number) => (meter ? Math.max(meter.min, Math.min(meter.max, v)) : v)
  const pct = (v: number) => (meter ? ((v - meter.min) / (meter.max - meter.min)) * 100 : 0)
  const fmtVal = (v: number) => {
    const s = Number.isInteger(v) ? String(v) : v.toFixed(1)
    return meter?.unit ? `${s} ${meter.unit}` : s
  }

  const render = () => {
    const node = byId.get(current)
    if (!node) {
      root.replaceChildren(el('p', {}, ['Broken decision tree.']))
      return
    }

    const layout = el('div', { class: 'decision-immersive' })
    layout.append(pathTrail(notes))

    // The consequence meter: hover a door to preview the shift, commit to apply it.
    let meterFill: HTMLElement | null = null
    let meterGhost: HTMLElement | null = null
    let meterTag: HTMLElement | null = null
    if (meter) {
      meterFill = el('div', { class: 'decision-meter-fill', style: `width:${pct(meterVal)}%` })
      meterGhost = el('div', { class: 'decision-meter-ghost', style: `width:${pct(meterVal)}%` })
      meterTag = el('span', { class: 'decision-meter-value' }, [fmtVal(meterVal)])
      layout.append(
        el('div', { class: 'decision-meter' }, [
          el('div', { class: 'decision-meter-head' }, [
            el('span', { class: 'decision-meter-label' }, [meter.label]),
            meterTag,
          ]),
          el('div', { class: 'decision-meter-track' }, [meterGhost, meterFill]),
        ]),
      )
    }

    const scene = el('div', { class: 'decision-scene pop-in' })
    if (node.text) {
      scene.append(el('div', { class: 'decision-prompt' }, [node.text]))
    }

    if (node.ending) {
      scene.append(
        el('div', { class: 'result-card ending-card pop-in' }, [
          el('p', { class: 'eyebrow' }, ['Principle']),
          el('h2', {}, [node.ending.principle]),
          ...(meter
            ? [el('p', { class: 'muted' }, [`${meter.label} ended at ${fmtVal(meterVal)}.`])]
            : []),
          richBlock(node.ending.debrief),
        ]),
      )
      layout.append(scene)
      root.replaceChildren(
        stage('decision', `Fork ${depth + 1}`, session.title, [layout]),
      )
      if (node.ending.score > 0) burst(scene)
      onComplete(node.ending.score, 1)
      return
    }

    // Preview panel: fed by whichever door the learner is weighing up.
    const previewPanel = el('div', { class: 'fork-preview' }, [
      el('p', { class: 'muted small' }, ['Hover a door to feel its consequence before you commit.']),
    ])
    const hasPreviews = (node.choices ?? []).some((c) => c.preview || c.effect != null)

    const showPreview = (choice: DecisionChoice) => {
      const projected = clamp(meterVal + (choice.effect ?? 0))
      if (meter && meterGhost && meterTag && choice.effect != null) {
        meterGhost.style.width = `${pct(projected)}%`
        meterGhost.classList.toggle('worse', projected < meterVal)
        meterTag.textContent = `${fmtVal(meterVal)} → ${fmtVal(projected)}`
      }
      if (choice.preview) {
        previewPanel.replaceChildren(el('p', {}, [choice.preview]))
        liveAnnounce(choice.preview)
      }
    }
    const clearPreview = () => {
      if (meter && meterGhost && meterTag) {
        meterGhost.style.width = `${pct(meterVal)}%`
        meterGhost.classList.remove('worse')
        meterTag.textContent = fmtVal(meterVal)
      }
      if (hasPreviews) {
        previewPanel.replaceChildren(
          el('p', { class: 'muted small' }, ['Hover a door to feel its consequence before you commit.']),
        )
      }
    }

    const doors = el('div', { class: 'fork-doors' })
    ;(node.choices ?? []).forEach((choice, i) => {
      const door = el('button', {
        class: `fork-door door-${i % 2 === 0 ? 'a' : 'b'}`,
        type: 'button',
      }, [
        el('span', { class: 'door-label' }, [i % 2 === 0 ? 'Path A' : 'Path B']),
        el('span', { class: 'door-text' }, [choice.label]),
      ])
      door.addEventListener('mouseenter', () => showPreview(choice))
      door.addEventListener('focus', () => showPreview(choice))
      door.addEventListener('mouseleave', clearPreview)
      door.addEventListener('blur', clearPreview)
      door.addEventListener('click', () => {
        burst(door, i % 2 === 0 ? ['#f59e0b', '#fbbf24'] : ['#6366f1', '#a5b4fc'])
        if (choice.note) notes.push(choice.note)
        if (choice.effect != null) meterVal = clamp(meterVal + choice.effect)
        current = choice.next
        depth += 1
        window.setTimeout(render, 180)
      })
      doors.append(door)
    })
    scene.append(doors)
    if (hasPreviews) scene.append(previewPanel)
    layout.append(scene)

    const body: (Node | string)[] = []
    if (session.intro && current === session.startId) {
      body.push(richBlock(session.intro, 'stage-lead rich-block'))
    }
    body.push(layout)
    root.replaceChildren(stage('decision', `Fork ${depth + 1}`, session.title, body))
  }

  render()
}

export const decisionModule: SessionModule<DecisionSession> = {
  kind: 'decision',
  label: 'Decision',
  blurb: 'Forking judgment',
  icon: () => iconSpan('decision', DECISION_SVG),
  mount: mountDecision,
  validate: (s) => {
    const errs: string[] = []
    const ids = new Set(s.nodes.map((n) => n.id))
    if (!ids.has(s.startId)) errs.push(`startId "${s.startId}" has no node`)
    if (s.meter) {
      if (s.meter.min >= s.meter.max) errs.push('meter.min must be < meter.max')
      if (s.meter.start < s.meter.min || s.meter.start > s.meter.max) errs.push('meter.start out of range')
    }
    let endings = 0
    s.nodes.forEach((n) => {
      const hasChoices = !!n.choices?.length
      const hasEnding = !!n.ending
      if (hasChoices === hasEnding) errs.push(`node "${n.id}" must have choices XOR ending`)
      if (hasEnding) endings += 1
      n.choices?.forEach((c) => {
        if (!ids.has(c.next)) errs.push(`node "${n.id}" choice → unknown node "${c.next}"`)
        if (c.effect != null && !s.meter) errs.push(`node "${n.id}" choice has effect but session has no meter`)
      })
    })
    if (endings === 0) errs.push('decision has no ending node')
    return errs
  },
}
register(decisionModule)
