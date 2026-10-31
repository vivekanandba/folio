// The museum's voice.
//
// Copy is not usually worth a test, but these two functions are: one has to
// cover every route the shell can wait on (a missing entry is "undefined" on
// screen), and the other varies with the clock, which is exactly the kind of
// thing that drifts a screenshot gate by the hour if nobody is watching.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()

const { arrivalLine, loadingLine } = await import('../src/curator.ts')

const ROUTES = ['hub', 'today', 'floor', 'report', 'pack', 'concept', 'session', 'notfound'] as const

test('every route the shell can wait on has a line, and none of them says "Loading"', () => {
  for (const route of ROUTES) {
    const line = loadingLine(route)
    assert.ok(line && line.trim().length > 0, `${route} has no waiting line`)
    assert.ok(
      !/^loading/i.test(line),
      `${route} still says "${line}" — the point was to replace that`,
    )
  }
  // Distinct, because a shared line would make two routes indistinguishable
  // while they load, which is the state a reader is most likely to be in.
  const lines = ROUTES.map(loadingLine)
  assert.equal(new Set(lines).size, lines.length, 'two routes share a waiting line')
})

test('the two lines the museum already had keep their words', () => {
  // These were in floor.ts and report.ts before curator.ts existed. Moving
  // copy should not quietly rewrite it.
  assert.equal(loadingLine('floor'), 'Lighting the halls…')
  assert.equal(loadingLine('report'), 'The curator is tallying…')
  assert.equal(loadingLine('today'), 'Building your review…')
})

test('the greeting changes with the hour, and covers the whole clock', () => {
  const at = (hour: number): string => arrivalLine(new Date(2026, 5, 6, hour, 30))
  const seen = new Set<string>()
  for (let hour = 0; hour < 24; hour++) {
    const line = at(hour)
    assert.ok(line.trim().length > 0, `${hour}:30 has no greeting`)
    seen.add(line)
  }
  assert.equal(seen.size, 4, `expected four buckets across the day, got ${seen.size}`)

  // The boundaries, named rather than left to a reader to infer.
  assert.match(at(5), /morning/i)
  assert.match(at(11), /morning/i)
  assert.match(at(12), /afternoon/i)
  assert.match(at(16), /afternoon/i)
  assert.match(at(17), /evening/i)
  assert.match(at(21), /evening/i)
})

test('the small hours are welcomed, not scolded', () => {
  // folio's own copy calls this museum "open all night". A 3am greeting that
  // tutted at the learner would contradict the building.
  for (const hour of [22, 23, 0, 2, 4]) {
    const line = arrivalLine(new Date(2026, 5, 6, hour, 30))
    assert.ok(
      !/late|should|bed|sleep/i.test(line),
      `${hour}:30 greets with "${line}" — the museum does not hector`,
    )
  }
})

test('the greeting is a pure function of the date it is given', () => {
  // It must not read the clock itself: the screenshot gate pins time, and a
  // function that ignores its argument would drift the capture by the hour.
  const fixed = new Date(2026, 5, 6, 9, 0)
  assert.equal(arrivalLine(fixed), arrivalLine(fixed))
  assert.notEqual(arrivalLine(fixed), arrivalLine(new Date(2026, 5, 6, 23, 0)))
})

/* ------------------------------------------------------- counting up ----- */

// countUp lives in fx.ts, but it belongs to the same idea: the museum saying
// a number rather than printing it. It needs the DOM stub, which the tests
// above do not, so it is installed here rather than at the top of the file.
const { document } = (await import('./support/dom-stub.ts')).installDomStub()
const { countUp } = await import('../src/fx.ts')

const el = (): HTMLElement => {
  const node = document.createElement('span')
  document.body.append(node)
  return node as unknown as HTMLElement
}
const text = (node: HTMLElement): string => (node as unknown as { textContent: string }).textContent
const frames = (ms = 20) => new Promise((r) => setTimeout(r, ms))

test('a score counts up to its value and lands exactly on it', async () => {
  const node = el()
  // A duration short enough that the stub's three-frame budget finishes it:
  // the point under test is where it ENDS, not how long it takes.
  countUp(node, 7, 1)
  await frames()
  assert.equal(text(node), '7', 'it must land on the number, not near it')
})

test('under reduced motion the number is simply there', async () => {
  const g = globalThis as unknown as { __setMedia: (q: string, m: boolean) => void; __resetMedia: () => void }
  g.__setMedia('(prefers-reduced-motion: reduce)', true)
  try {
    const node = el()
    countUp(node, 12)
    // No frames awaited: a learner who asked for less motion gets the value
    // immediately, because the figure IS the information.
    assert.equal(text(node), '12')
  } finally {
    g.__resetMedia()
  }
})

test('zero and nonsense are printed, not animated', async () => {
  const zero = el()
  countUp(zero, 0)
  assert.equal(text(zero), '0', 'counting up to zero has nothing to count')

  const nan = el()
  countUp(nan, Number.NaN)
  assert.equal(text(nan), 'NaN', 'and a non-number is shown rather than looped over')
})

test('a counter whose node has left the page gives up', async () => {
  const node = document.createElement('span') // never appended
  node.append(document.createTextNode('5'))
  assert.doesNotThrow(() => countUp(node as unknown as HTMLElement, 5, 1))
  await frames()
  // It bails on the first frame rather than ticking into a node nobody can
  // see — and leaves the value it found, which is the one that was right.
  assert.equal((node as unknown as { textContent: string }).textContent, '5')
})

test('a counter never erases the number it was given', async () => {
  // requestAnimationFrame does not run in a hidden tab. An earlier draft set
  // the node to '0' before the first frame, so finishing a round and
  // switching away left "0 concepts reviewed today" on screen permanently.
  const node = el()
  node.append(document.createTextNode('9'))
  countUp(node, 9, 50_000) // long enough that no frame can complete
  assert.notEqual(text(node), '0', 'the real value must survive until a frame replaces it')
})
