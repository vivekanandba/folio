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
  adoptStoredPreference,
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

/**
 * Clean slate: no recorded sound, no recorded buzz, run counter at the bottom,
 * and — importantly — no context left cached from the previous test. Swapping
 * `globalThis.AudioContext` back only changes the constructor; a fake INSTANCE
 * built by an earlier case survives and silently answers the next one.
 */
function fresh(): void {
  setFeedbackEnabled(false) // the only thing that releases the cached context
  g.__resetAudio()
  g.__resetVibrate()
  localStorage.removeItem('folio-feedback')
  setFeedbackEnabled(true)
  g.__resetAudio()
  g.__resetVibrate()
  resetRun()
}

const freqs = (): number[] => g.__audioLog.map((n) => n.freq)

/**
 * Wait for a condition, with a deadline. NOT a fixed sleep: the deferred chord
 * is driven by a ~440ms timer, and this suite shares a 4-vCPU box with
 * Playwright jobs that put the load at 10. Sleeping "a bit longer than the
 * timer" is a merge gate that goes red under load and reads as a product
 * regression (CON-VER-008).
 */
async function until(ok: () => boolean, timeoutMs = 8000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (ok()) return true
    await new Promise((r) => setTimeout(r, 20))
  }
  return ok()
}

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
  // cue('complete') arms its timer BEFORE the mute check (which lives in
  // emit), and re-enabling does not cancel one. Disarm it here rather than
  // leaving the next test to inherit a stray chord — this file's own first
  // test does not call fresh(), so the cleanup cannot be assumed.
  resetRun()
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

test('an audio device that misbehaves is still only silence', async () => {
  fresh()
  const realAudio = g.AudioContext
  const install = (impl: unknown): void => {
    setFeedbackEnabled(false) // releases whatever context is cached
    g.AudioContext = impl
    setFeedbackEnabled(true)
    // Fresh device, fresh pacing: without this a `complete` here would be
    // DEFERRED behind the previous case's answer bell and land after the
    // assertion rather than before it.
    resetRun()
  }
  try {
    // 1. The constructor itself refuses — no device, or no permission.
    install(class { constructor() { throw new Error('no audio device') } })
    assert.doesNotThrow(() => cue('correct'), 'a refused AudioContext must not reach the session')

    // 2. The context exists but scheduling blows up part-way through a chord.
    //    Chrome caps live AudioContexts per document (~6), so a context that
    //    has started refusing nodes must be CLOSED, not merely dropped —
    //    leaking one per failed cue kills audio for the page outright.
    let closed = 0
    install(class {
      state = 'running'
      currentTime = 0
      destination = {}
      resume(): Promise<void> { return Promise.resolve() }
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown { throw new Error('too many nodes') }
      close(): Promise<void> { closed += 1; return Promise.resolve() }
    })
    assert.doesNotThrow(() => cue('complete', { perfect: true }), 'a failed schedule must not reach the session')
    assert.equal(closed, 1, 'a context that broke must be closed, not leaked')

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
    let refusedClosed = 0
    install(class {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume(): Promise<void> { return Promise.reject(new Error('NotAllowedError')) }
      close(): Promise<void> { refusedClosed += 1; return Promise.reject(new Error('InvalidStateError')) }
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown {
        return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }
      }
    })
    g.__resetAudio()
    cue('correct')
    await Promise.resolve()
    await Promise.resolve()
    assert.deepEqual(g.__audioLog, [], 'a refused resume must schedule nothing at all')
    assert.equal(refusedClosed, 1, 'a context that refused to resume must be retired, not left open')
    setFeedbackEnabled(false)
  } finally {
    g.AudioContext = realAudio
    fresh()
  }
})

test('a suspended context is resumed BEFORE anything is scheduled', async () => {
  fresh()
  const realAudio = g.AudioContext
  setFeedbackEnabled(false)
  try {
    // A suspended context's clock is FROZEN. Scheduling against it stacks
    // every cue at the same instant in the past; the moment audio is
    // permitted, the whole backlog fires at once as one loud garble. The
    // clock here jumps on resume, so the note's start time says plainly
    // which side of the resume it was read on.
    g.AudioContext = class {
      state = 'suspended'
      currentTime = 0
      destination = {}
      async resume(): Promise<void> {
        this.state = 'running'
        this.currentTime = 10
      }
      close(): Promise<void> { return Promise.resolve() }
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown {
        const self = this as unknown as { currentTime: number }
        void self
        return {
          type: 'sine',
          frequency: { value: 0, setValueAtTime(v: number) { this.value = v } },
          connect() {},
          start(t: number) { (this as { _s: number })._s = t },
          stop(t: number) {
            g.__audioLog.push({ type: 'sine', freq: 0, startAt: (this as { _s: number })._s, stopAt: t })
          },
        }
      }
    }
    setFeedbackEnabled(true)
    g.__resetAudio()
    cue('correct')
    assert.deepEqual(g.__audioLog, [], 'nothing may be scheduled while the clock is still frozen')

    // Let the resume settle.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(g.__audioLog.length, 1, 'the cue should land once the context is running')
    assert.ok(
      g.__audioLog[0].startAt >= 10,
      `the clock was read before the resume (startAt ${g.__audioLog[0].startAt}, expected >= 10)`,
    )
  } finally {
    g.AudioContext = realAudio
    fresh()
  }
})

test('a cue waiting on a resume does not sound after the learner mutes', async () => {
  fresh()
  const realAudio = g.AudioContext
  setFeedbackEnabled(false) // release whatever context is cached
  let release: (() => void) | null = null
  const gate = new Promise<void>((r) => { release = r })
  try {
    g.AudioContext = class {
      state = 'suspended'
      currentTime = 0
      destination = {}
      async resume(): Promise<void> {
        await gate
        this.state = 'running'
        this.currentTime = 5
      }
      close(): Promise<void> { return Promise.resolve() }
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown {
        return {
          type: 'sine',
          frequency: { value: 0, setValueAtTime(v: number) { this.value = v } },
          connect() {},
          start(t: number) { (this as { _s: number })._s = t },
          stop(t: number) { g.__audioLog.push({ type: 'sine', freq: 0, startAt: (this as { _s: number })._s, stopAt: t }) },
        }
      }
    }
    setFeedbackEnabled(true)
    g.__resetAudio()

    cue('correct')            // parked, waiting on the resume
    setFeedbackEnabled(false) // ...and the learner reaches for the mute
    release!()
    for (let i = 0; i < 5; i++) await Promise.resolve()

    assert.deepEqual(
      g.__audioLog,
      [],
      'a cue that was mid-resume when the mute landed must never arrive',
    )
  } finally {
    g.AudioContext = realAudio
    fresh()
  }
})

test('a late rejection retires its own context, not whichever is current', async () => {
  fresh()
  const realAudio = g.AudioContext
  setFeedbackEnabled(false)
  let built = 0
  const closed: number[] = []
  let rejectFirst: ((e: Error) => void) | null = null
  try {
    g.AudioContext = class {
      id: number
      state: string
      currentTime = 0
      destination = {}
      constructor() {
        built += 1
        this.id = built
        // Only the first context is parked; the replacement is live.
        this.state = built === 1 ? 'suspended' : 'running'
      }
      resume(): Promise<void> { return new Promise((_, rej) => { rejectFirst = rej }) }
      close(): Promise<void> { closed.push(this.id); return Promise.resolve() }
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown { return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} } }
    }
    setFeedbackEnabled(true)

    cue('correct')                       // builds ctx1, resume pending
    assert.equal(built, 1)
    setFeedbackEnabled(false)            // mute: ctx1 released
    setFeedbackEnabled(true)
    cue('reveal')                        // builds ctx2 — this is the live one
    assert.equal(built, 2)

    // ctx1's resume finally fails, long after it stopped being current.
    rejectFirst!(new Error('InvalidStateError'))
    for (let i = 0; i < 5; i++) await Promise.resolve()

    assert.ok(
      !closed.includes(2),
      `the stale rejection closed the LIVE context (closed: ${closed.join(', ')})`,
    )
    cue('correct')
    assert.equal(built, 2, 'and the live context is still usable, not rebuilt')
  } finally {
    g.AudioContext = realAudio
    fresh()
  }
})

test('a mute made in another tab releases this tab\'s audio device too', () => {
  fresh()
  const realAudio = g.AudioContext
  let closed = 0
  try {
    g.AudioContext = class {
      state = 'running'
      currentTime = 0
      destination = {}
      resume(): Promise<void> { return Promise.resolve() }
      close(): Promise<void> { closed += 1; return Promise.resolve() }
      createGain(): unknown { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} } }
      createOscillator(): unknown { return { frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} } }
    }
    cue('correct')
    assert.equal(closed, 0, 'precondition: a live context is open')

    // What a `storage` event looks like from in here: the value changed
    // underneath us, and nothing in this tab called setFeedbackEnabled.
    localStorage.setItem('folio-feedback', 'off')
    adoptStoredPreference()
    assert.equal(closed, 1, 'a cross-tab mute must release the device, not just repaint a button')

    // And the reverse is not destructive.
    localStorage.setItem('folio-feedback', 'on')
    assert.doesNotThrow(() => adoptStoredPreference())
    assert.equal(closed, 1, 'an unmute elsewhere must not close anything')
  } finally {
    g.AudioContext = realAudio
    fresh()
  }
})

test('the finishing chord waits for the answer bell to ring out', async () => {
  fresh()
  // Every one-shot kind (hotspot, estimate, detective, classify, sequence,
  // blueprint) marks the answer and completes in the SAME tick. Landing both
  // cues together puts two oscillators on the same pitch at t=0 — roughly
  // double the master trim, worst on a flawless finish — and a second
  // vibrate() cancels the first pattern, so the answer tap is never felt.
  cue('correct')
  cue('complete', { perfect: true })

  assert.equal(g.__audioLog.length, 1, 'only the answer bell should have gone out so far')
  assert.deepEqual(g.__vibrateLog, [8], 'and only the answer tap')

  assert.ok(
    await until(() => g.__audioLog.length > 1),
    'the chord should arrive once the bell has finished',
  )
  const bell = g.__audioLog[0]
  const chordStarts = g.__audioLog.slice(1).map((n) => n.startAt)
  assert.ok(
    Math.min(...chordStarts) >= bell.stopAt - 0.05,
    `the chord overlaps the bell (bell ends ${bell.stopAt}, chord starts ${Math.min(...chordStarts)})`,
  )
  assert.equal(g.__vibrateLog.length, 2, 'the completion pattern follows the tap rather than cancelling it')
})

test('a chord still waiting when the learner mutes never arrives', async () => {
  fresh()
  cue('correct')
  cue('complete', { perfect: false })
  setFeedbackEnabled(false)
  const heardSoFar = g.__audioLog.length
  await new Promise((r) => setTimeout(r, 600))
  assert.equal(g.__audioLog.length, heardSoFar, 'a deferred chord must re-check the mute, not inherit it')
  setFeedbackEnabled(true)
})

test('a storage event clears a tab\'s distrust of its own store', () => {
  fresh()
  const realStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  try {
    // One failed write (quota) makes this tab stop believing storage...
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => 'on',
        setItem: () => { throw new Error('QuotaExceededError') },
        removeItem: () => {},
      },
      configurable: true,
      writable: true,
    })
    setFeedbackEnabled(false)
    assert.equal(feedbackEnabled(), false, 'precondition: the local choice is winning')

    // ...but another tab writing proves the store works again. Without the
    // re-probe this tab stays muted forever, rendering aria-pressed="false"
    // while storage says the museum is audible — round 3's defect, mirrored.
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => 'on',
        setItem: () => {},
        removeItem: () => {},
      },
      configurable: true,
      writable: true,
    })
    adoptStoredPreference()
    assert.equal(feedbackEnabled(), true, 'a storage event is evidence the store is writable again')
  } finally {
    if (realStorage) Object.defineProperty(globalThis, 'localStorage', realStorage)
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
