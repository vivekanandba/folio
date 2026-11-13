// The parts of widgets.ts that only run when a figure is hydrated or touched:
// renderRichInto's slot loop, the what-if slider and the annotated chart.
// Split out of specs/015-delight task 20 as task 24, which it closes.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

const widgets = await import('../src/widgets.ts')
const { COMPUTES } = await import('../src/computes.ts')

type Node = {
  classList: { contains: (c: string) => boolean }
  textContent: string
  childNodes: Node[]
  querySelector: (s: string) => Node | null
  querySelectorAll: (s: string) => Node[]
  setAttribute: (k: string, v: string) => void
  getAttribute: (k: string) => string | null
  click: () => void
  dispatchEvent: (ev: { type: string }) => boolean
  value: string
}
const make = (tag = 'div') => document.createElement(tag) as unknown as Node

/**
 * renderRichInto finds its slots by querying the markup it just assigned. The
 * stub stores innerHTML without parsing it (tests/support/dom-stub.ts), so the
 * host hands back slots built here instead. What runs is the real loop: every
 * branch that decides between mounted, failed and "please touch".
 */
function hydrate(specs: (string | null)[]): Node[] {
  const slots = specs.map((raw) => {
    const slot = make()
    slot.setAttribute('class', 'viz-slot')
    if (raw !== null) slot.setAttribute('data-viz', raw)
    return slot
  })
  const host = make()
  host.querySelectorAll = (sel: string) => (sel === '.viz-slot' ? slots : [])
  widgets.renderRichInto(host as never, 'prose')
  return slots
}

const chip = (slot: Node) => slot.querySelector('.touch-chip')

test('a slot with no spec is marked failed and left alone', () => {
  const [slot] = hydrate([null])
  assert.ok(slot.classList.contains('widget-failed'))
  assert.ok(!slot.classList.contains('widget-mounted'))
})

test('a fence that is not JSON degrades visibly and is marked failed', () => {
  const [slot] = hydrate(['{"type": "gauge",'])
  assert.ok(slot.classList.contains('widget-failed'))
  assert.match(slot.textContent, /unavailable/)
  assert.equal(chip(slot), null)
})

test('a touchable figure that mounts invites a touch; one that does not, does not', () => {
  const [annotated, brokenSim, gauge] = hydrate([
    JSON.stringify({ type: 'annotated', points: [{ label: 'a', value: 1 }] }),
    JSON.stringify({ type: 'sim', model: 'no-such-model' }),
    JSON.stringify({ type: 'gauge', value: 0.3, label: 'g' }),
  ])
  assert.ok(annotated.classList.contains('widget-mounted'))
  assert.match(chip(annotated)?.textContent ?? '', /please touch/)
  assert.ok(brokenSim.classList.contains('widget-failed'))
  assert.equal(chip(brokenSim), null, 'no invitation above "(interactive figure unavailable)"')
  assert.ok(gauge.classList.contains('widget-mounted'))
  assert.equal(chip(gauge), null, 'a gauge is not touchable, so it is not invited')
})

/* ----------------------------------------------------------- what-if --- */

const whatIf = {
  type: 'what-if',
  title: 'Grow it',
  compute: 'compound',
  output: { label: 'Future value', unit: '₹', decimals: 0, outMax: 1000, gaugeLabel: 'of target' },
  inputs: [
    { key: 'principal', label: 'Principal', min: 0, max: 1000, value: 100 },
    { key: 'rate', label: 'Rate', min: 0, max: 20, value: 10, unit: '%' },
    { key: 'years', min: 0, max: 30, value: 1 },
  ],
}

test('moving a what-if slider updates its tag and the readout, from the real compute', () => {
  const host = make()
  assert.equal(widgets.mountWidget(host as never, whatIf), true)
  const readout = host.querySelector('.widget-readout')!
  assert.equal(readout.textContent, `Future value: ${widgets.fmtNum(110, '₹', 0)}`)

  const ranges = host.querySelectorAll('input')
  assert.equal(ranges.length, 3)
  const years = ranges[2]
  assert.equal(years.getAttribute('aria-label'), 'years', 'an unlabelled input falls back to its key')
  years.value = '2'
  years.dispatchEvent({ type: 'input' })
  const expected = COMPUTES.compound({ principal: 100, rate: 10, years: 2 })
  assert.equal(readout.textContent, `Future value: ${widgets.fmtNum(expected, '₹', 0)}`)
  const tags = host.querySelectorAll('.holding-val')
  assert.equal(tags[2].textContent, '2', 'the value beside the slider follows it')
})

test('a what-if with outMax redraws its gauge on every change', () => {
  const host = make()
  widgets.mountWidget(host as never, whatIf)
  const gaugeHost = host.querySelector('.widget-gauge')!
  assert.ok(gaugeHost, 'outMax asks for a gauge')
  const first = gaugeHost.childNodes[0]
  assert.ok(first, 'and draws one before anyone touches it')
  const rate = host.querySelectorAll('input')[1]
  rate.value = '15'
  rate.dispatchEvent({ type: 'input' })
  assert.notEqual(gaugeHost.childNodes[0], first, 'a new gauge replaces the old one')
  assert.equal(gaugeHost.childNodes.length, 1)
})

test('a what-if without outMax draws no gauge, and a caption wraps it in a figure', () => {
  const host = make()
  widgets.mountWidget(host as never, { ...whatIf, output: { label: 'x' }, caption: 'Why it grows' })
  assert.equal(host.querySelector('.widget-gauge'), null)
  assert.ok(host.querySelector('figcaption'), 'the caption is rendered')
  assert.match(host.querySelector('figcaption')!.textContent, /Why it grows/)
})

test('a what-if naming an unknown compute degrades rather than computing nothing', () => {
  const host = make()
  assert.equal(widgets.mountWidget(host as never, { ...whatIf, compute: 'no-such-compute' }), false)
  assert.match(host.textContent, /unavailable/)
})

/* --------------------------------------------------------- annotated --- */

test('tapping an annotated point explains it, and only one point is active', () => {
  const host = make()
  widgets.mountWidget(host as never, {
    type: 'annotated',
    title: 'Drawdowns',
    prompt: 'Tap each year.',
    caption: 'Source: the issue',
    points: [
      { label: '2008', value: 40, note: 'the crash' },
      { label: '2020', value: 'n/a', note: 'no figure' },
    ],
  })
  const [a, b] = host.querySelectorAll('.annotated-point')
  const note = host.querySelector('.annotated-note')!
  assert.match(note.textContent, /Tap a point/)
  assert.equal(a.getAttribute('aria-label'), '2008: 40')
  assert.equal(b.getAttribute('aria-label'), '2020', 'a point without a number names only its label')

  a.click()
  assert.ok(a.classList.contains('active'))
  assert.equal(note.textContent, '2008 — the crash')
  b.click()
  assert.ok(b.classList.contains('active'))
  assert.ok(!a.classList.contains('active'), 'the previous point lets go')
  assert.equal(note.textContent, '2020 — no figure')
})

test('an annotated point with no note still explains which point it is', () => {
  const host = make()
  widgets.mountWidget(host as never, { type: 'annotated', points: [{ label: 'only' }] })
  const [p] = host.querySelectorAll('.annotated-point')
  p.click()
  assert.equal(host.querySelector('.annotated-note')!.textContent, 'only — ')
})
