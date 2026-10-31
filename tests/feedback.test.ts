// The museum's voice, asserted the only way a headless box honestly can.
//
// There is no sound card here and nothing to listen to, so these tests do not
// claim folio "sounds right". They claim something narrower and checkable:
// that the app ASKS for the right thing — which tone, at which pitch, in which
// order, and never at all when the learner has muted it. The DOM stub records
// every scheduled oscillator and every vibration request; the judgement about
// whether a bell is pleasant stays with the human (CON-VER-007, and tasks M1/M2
// in specs/015-delight/tasks.md).

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
installDomStub()

const {
  cue,
  currentRun,
  feedbackEnabled,
  noteForRun,
  resetRun,
  setFeedbackEnabled,
  RUN_LADDER,
} = await import('../src/feedback.ts')

type G = {
  __audioLog: { type: string; freq: number; startAt: number; stopAt: number }[]
  __resetAudio: () => void
  __vibrateLog: (number | number[])[]
  __resetVibrate: () => void
  AudioContext?: unknown
}
const g = globalThis as unknown as G

/** Clean slate: no recorded sound, no recorded buzz, run counter at the bottom. */
function fresh(): void {
  g.__resetAudio()
  g.__resetVibrate()
  localStorage.removeItem('folio-feedback')
  setFeedbackEnabled(true)
  g.__resetAudio()
  g.__resetVibrate()
  resetRun()
}

const freqs = (): number[] => g.__audioLog.map((n) => n.freq)

test('the ladder climbs, then holds at the top', () => {
  assert.ok(RUN_LADDER.length >= 5, 'a ladder of four notes is not a run')
  for (let i = 1; i < RUN_LADDER.length; i++) {
    assert.ok(
      noteForRun(i) > noteForRun(i - 1),
      `degree ${i} (${noteForRun(i)}Hz) must sit above degree ${i - 1} (${noteForRun(i - 1)}Hz)`,
    )
  }
  // Past the top it holds rather than climbing into a shriek.
  const top = noteForRun(RUN_LADDER.length - 1)
  assert.equal(noteForRun(RUN_LADDER.length + 50), top)
  // And a nonsense run index is the bottom, not a crash or a NaN.
  assert.equal(noteForRun(-3), noteForRun(0))
})

test('a run of correct answers sounds like a run', () => {
  fresh()
  cue('correct')
  cue('correct')
  cue('correct')
  const heard = freqs()
  assert.equal(heard.length, 3, 'three answers, three tones')
  assert.ok(heard[1] > heard[0] && heard[2] > heard[1], `pitches did not climb: ${heard.join(', ')}`)
  assert.equal(currentRun(), 3)
})

test('a miss drops the run back to the bottom', () => {
  fresh()
  cue('correct')
  cue('correct')
  const climbed = freqs().at(-1)!
  g.__resetAudio()

  cue('wrong')
  assert.equal(currentRun(), 0, 'a miss resets the run')
  const wrongNote = freqs().at(-1)!
  assert.ok(wrongNote < noteForRun(0), 'a miss is lower than the bottom of the ladder, not a buzzer above it')

  g.__resetAudio()
  cue('correct')
  const afterMiss = freqs().at(-1)!
  assert.equal(afterMiss, noteForRun(0), 'the next correct answer starts again at the bottom')
  assert.ok(afterMiss < climbed, 'and is below where the run had reached')
})

test('a flawless finish is voiced differently from an ordinary one', () => {
  fresh()
  cue('complete', { perfect: false })
  const ordinary = freqs()
  g.__resetAudio()
  cue('complete', { perfect: true })
  const flawless = freqs()

  assert.ok(ordinary.length >= 2, 'a finish is a chord, not a beep')
  assert.notDeepEqual(flawless, ordinary, 'perfect and ordinary must not sound identical')
  assert.ok(
    Math.max(...flawless) > Math.max(...ordinary),
    'the flawless voicing reaches higher',
  )
})

test('muting silences every channel at once', () => {
  fresh()
  cue('correct')
  assert.ok(g.__audioLog.length > 0 && g.__vibrateLog.length > 0, 'precondition: unmuted, both channels spoke')

  setFeedbackEnabled(false)
  g.__resetAudio()
  g.__resetVibrate()
  for (const name of ['correct', 'wrong', 'complete', 'milestone', 'reveal'] as const) cue(name)

  assert.deepEqual(g.__audioLog, [], 'muted: no tone was requested')
  assert.deepEqual(g.__vibrateLog, [], 'muted: no vibration was requested')
  setFeedbackEnabled(true)
})

test('the mute preference outlives the page', () => {
  fresh()
  // Default, with nothing stored at all — not "whatever fresh() just wrote".
  localStorage.removeItem('folio-feedback')
  assert.equal(feedbackEnabled(), true, 'on by default — a fresh visitor hears the museum')

  setFeedbackEnabled(false)
  assert.equal(localStorage.getItem('folio-feedback'), 'off', 'the choice reached storage')

  // What a reload really tests is that the answer comes from storage and is
  // not cached in a module variable that a new page would start empty. Writing
  // storage behind the module's back and asking again proves exactly that —
  // and unlike re-importing the module, it does not create a second instance.
  // (Re-importing does: `?reload=` loads the same path twice and node's
  // coverage merge lets the barely-used copy clobber the real one, which
  // reported this file at 52% when it was actually at 96%.)
  localStorage.setItem('folio-feedback', 'on')
  assert.equal(feedbackEnabled(), true, 'the preference is read back, not remembered')
  localStorage.setItem('folio-feedback', 'off')
  assert.equal(feedbackEnabled(), false, 'a stored mute is honoured by a fresh page')

  setFeedbackEnabled(true)
  assert.equal(localStorage.getItem('folio-feedback'), 'on')
})

test('a hostile platform is silent, not broken', () => {
  fresh()
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const realNavigator = globalThis.navigator
  // Safari in private mode throws from setItem; some browsers throw from
  // vibrate rather than returning false. Neither may reach a learner.
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'hostile', vibrate: () => { throw new Error('blocked') } },
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: () => { throw new Error('storage disabled') },
      setItem: () => { throw new Error('storage disabled') },
      removeItem: () => {},
    },
    configurable: true,
    writable: true,
  })
  try {
    assert.equal(feedbackEnabled(), true, 'unreadable storage falls back to the richer app')
    assert.doesNotThrow(() => setFeedbackEnabled(false), 'an unwritable preference is not an error')

    // The point of the mute is the mute, not the persistence. Someone in a
    // quiet room on a profile that blocks site data must still be able to
    // silence the museum for this visit — storage only decides whether the
    // choice outlives the tab.
    assert.equal(feedbackEnabled(), false, 'the mute must hold even when it cannot be stored')
    g.__resetAudio()
    g.__resetVibrate()
    cue('correct')
    assert.deepEqual(g.__audioLog, [], 'muted without storage: no tone was requested')
    assert.deepEqual(g.__vibrateLog, [], 'muted without storage: no vibration was requested')

    setFeedbackEnabled(true)
    assert.doesNotThrow(() => cue('correct'), 'a throwing vibrate() must not reach the session')
  } finally {
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage)
    Object.defineProperty(globalThis, 'navigator', {
      value: realNavigator,
      configurable: true,
      writable: true,
    })
    fresh()
  }
})

test('haptics ride the same cues, and differ by meaning', () => {
  fresh()
  cue('correct')
  cue('wrong')
  cue('milestone')
  const [correct, wrong, milestone] = g.__vibrateLog
  assert.equal(typeof correct, 'number', 'a correct answer is a single short tap')
  assert.ok(Array.isArray(wrong), 'a miss is a pattern, not a tap')
  assert.ok(Array.isArray(milestone), 'a milestone is a pattern')
  assert.notDeepEqual(milestone, wrong, 'a reward must not feel like a mistake')
})

test('a platform with no audio and no vibration is silent, not broken', () => {
  fresh()
  const realAudio = g.AudioContext
  const realNavigator = globalThis.navigator
  // setFeedbackEnabled(false) releases the cached context, so the next cue has
  // to go looking for AudioContext again — and will not find one.
  setFeedbackEnabled(false)
  delete g.AudioContext
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'bare', maxTouchPoints: 0 },
    configurable: true,
    writable: true,
  })
  setFeedbackEnabled(true)

  try {
    for (const name of ['correct', 'wrong', 'complete', 'milestone', 'reveal'] as const) {
      assert.doesNotThrow(() => cue(name), `cue('${name}') threw on a platform without the API`)
    }
    assert.deepEqual(g.__audioLog, [], 'nothing could have been scheduled')
  } finally {
    g.AudioContext = realAudio
    Object.defineProperty(globalThis, 'navigator', {
      value: realNavigator,
      configurable: true,
      writable: true,
    })
    setFeedbackEnabled(false)
    setFeedbackEnabled(true)
  }
})

test('a mute that cannot be saved is still a mute', () => {
  fresh() // leaves 'on' in storage, which is the whole trap
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  // The nastier half of a broken store: reads work, writes do not. A quota
  // -exceeded profile looks exactly like this — and folio writes progress to
  // the same store, so it is reachable. Naively trusting storage here means
  // the stale 'on' keeps winning and the mute button does nothing at all.
  const frozen = new Map<string, string>([['folio-feedback', 'on']])
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => frozen.get(k) ?? null,
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => {},
    },
    configurable: true,
    writable: true,
  })
  try {
    assert.equal(feedbackEnabled(), true, 'precondition: storage says the museum is audible')
    setFeedbackEnabled(false)
    assert.equal(feedbackEnabled(), false, 'the mute must win over a stale value it could not overwrite')
    g.__resetAudio()
    g.__resetVibrate()
    cue('correct')
    assert.deepEqual(g.__audioLog, [], 'no tone after an unsaveable mute')
    assert.deepEqual(g.__vibrateLog, [], 'no vibration after an unsaveable mute')
  } finally {
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage)
    fresh()
  }
})

test('a storage that accepts writes and drops them is not believed', () => {
  fresh()
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  // setItem that neither throws nor stores. Reading the value back is the
  // only way to tell this apart from a working store (CON-VER-003).
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => (k === 'folio-feedback' ? 'on' : null),
      setItem: () => {},
      removeItem: () => {},
    },
    configurable: true,
    writable: true,
  })
  try {
    setFeedbackEnabled(false)
    assert.equal(feedbackEnabled(), false, 'a write that silently vanished must not re-enable sound')
  } finally {
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage)
    fresh()
  }
})

test('a closed audio context is replaced, not kept forever', () => {
  fresh()
  const realAudio = g.AudioContext
  let built = 0
  try {
    g.AudioContext = class {
      state = 'running'
      currentTime = 0
      destination = {}
      constructor() { built += 1 }
      resume(): void {}
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown {
        // The platform tears the audio session down underneath the page —
        // iOS does this on an interruption — without telling anyone.
        this.state = 'closed'
        return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }
      }
      close(): void {}
    }
    cue('correct')
    assert.equal(built, 1, 'precondition: one context built')

    g.__resetAudio()
    cue('correct')
    assert.equal(built, 2, 'a context that died must be rebuilt, not cached as a silent no-op')
    assert.equal(g.__audioLog.length, 0, 'the fake schedules nothing — the point is that it TRIED again')
  } finally {
    g.AudioContext = realAudio
    fresh()
  }
})

test('an audio device that misbehaves is still only silence', () => {
  fresh()
  const realAudio = g.AudioContext
  const install = (impl: unknown): void => {
    setFeedbackEnabled(false) // releases whatever context is cached
    g.AudioContext = impl
    setFeedbackEnabled(true)
  }
  try {
    // 1. The constructor itself refuses — no device, or no permission.
    install(class { constructor() { throw new Error('no audio device') } })
    assert.doesNotThrow(() => cue('correct'), 'a refused AudioContext must not reach the session')

    // 2. The context exists but scheduling blows up part-way through a chord.
    install(class {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume(): void {}
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown { throw new Error('too many nodes') }
      close(): void { throw new Error('cannot close') }
    })
    assert.doesNotThrow(() => cue('complete', { perfect: true }), 'a failed schedule must not reach the session')

    // 3. A context that works but refuses to CLOSE must not break muting.
    //    It has to schedule successfully first, or there would be no live
    //    context left for the mute to try to close.
    install(class {
      state = 'running'
      currentTime = 0
      destination = {}
      resume(): void {}
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown { return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} } }
      close(): void { throw new Error('InvalidStateError') }
    })
    cue('correct')
    assert.doesNotThrow(() => setFeedbackEnabled(false), 'a context that will not close must not break the mute')

    // 4. A context that REJECTS rather than throws. Chrome does exactly this:
    //    resume() rejects with NotAllowedError without user activation, and
    //    close() rejects on an already-closed context. node:test fails the
    //    whole file on an unhandled rejection, so this assertion is the
    //    absence of one — a bare `void promise` turns this file red.
    install(class {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume(): Promise<void> { return Promise.reject(new Error('NotAllowedError')) }
      close(): Promise<void> { return Promise.reject(new Error('InvalidStateError')) }
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown {
        return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }
      }
    })
    cue('correct')
    setFeedbackEnabled(false)
  } finally {
    g.AudioContext = realAudio
    fresh()
  }
})

test('cues are requested at a civil volume', () => {
  fresh()
  cue('correct')
  const note = g.__audioLog[0]
  assert.ok(note.stopAt > note.startAt, 'a note must have a duration')
  assert.ok(note.stopAt - note.startAt < 1.5, 'a feedback cue is short — this is not a soundtrack')
})
