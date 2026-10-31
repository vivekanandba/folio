import { closeAudio, play, type Note } from './audio'

/**
 * Feedback channels — the one place that decides what the museum says back.
 *
 * Everything that wants to acknowledge a learner calls `cue()`. This module
 * owns three things the call sites should not have to think about: whether the
 * learner wants feedback at all, which tone a moment deserves, and where a run
 * of right answers has reached. The platform work (oscillators, vibration)
 * lives behind `audio.ts` and one `navigator.vibrate` call, so an offline box
 * with no sound card can still assert what was ASKED for.
 *
 * The run ladder is the point of the whole feature. Four right answers in a
 * row should not sound like one right answer four times: the bell climbs a
 * pentatonic scale as the run grows and drops back the moment one is missed,
 * so progress is audible before it is visible.
 */

export type CueName = 'correct' | 'wrong' | 'complete' | 'milestone' | 'reveal'

export interface CueOptions {
  /** A flawless session is voiced higher and wider than an ordinary one. */
  perfect?: boolean
}

/** Exported so the shell can listen for it: a second copy of this string in
 *  main.ts would silently stop matching the day the key is renamed, and the
 *  cross-tab repaint it guards would fail exactly as it did before. */
export const FEEDBACK_KEY = 'folio-feedback'
const KEY = FEEDBACK_KEY

/**
 * C major pentatonic, C5 → E6. Pentatonic because every degree agrees with
 * every other one: a learner on a run of seven never hits a sour note, which
 * a diatonic ladder cannot promise.
 */
export const RUN_LADDER: readonly number[] = [
  523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51,
]

/** Where a run of `run` consecutive right answers sits on the ladder. */
export function noteForRun(run: number): number {
  const i = Math.min(RUN_LADDER.length - 1, Math.max(0, Math.floor(run)))
  return RUN_LADDER[i]
}

let run = 0

/** Consecutive right answers in the current session. */
export function currentRun(): number {
  return run
}

/** Start a fresh run — called when a session mounts, and after every miss. */
export function resetRun(): void {
  run = 0
}

/**
 * The choice this session has made, used only when storage cannot answer.
 * Without it, a profile with site data blocked (Safari private browsing) reads
 * the preference back as the default and the mute control does nothing at all
 * — which strands exactly the person who is in a quiet room.
 */
let sessionChoice: boolean | null = null

/**
 * Whether storage may be believed over this session's own choice. It may not,
 * once a write has failed to land: a localStorage that READS fine but refuses
 * to WRITE — a quota-exceeded profile, and folio writes progress to the same
 * store — would otherwise keep handing back the stale 'on' while the learner
 * presses Mute, and the button would repaint itself to "Sound on" each time.
 */
let storageAuthoritative = true

/** `null` when storage holds no answer, or cannot be read at all. */
function storedChoice(): boolean | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === null ? null : raw !== 'off'
  } catch {
    return null
  }
}

/**
 * Is the learner listening? Storage wins when it has an answer and has proved
 * writable — so a change made in another tab is honoured — and this session's
 * own choice is the fallback. On unless someone has said otherwise.
 */
export function feedbackEnabled(): boolean {
  if (storageAuthoritative) {
    const stored = storedChoice()
    if (stored !== null) return stored
  }
  return sessionChoice ?? storedChoice() ?? true
}

export function setFeedbackEnabled(on: boolean): void {
  sessionChoice = on
  const want = on ? 'on' : 'off'
  try {
    localStorage.setItem(KEY, want)
    // Read it back rather than trusting that setItem not throwing means it
    // stored anything (CON-VER-003). Some profiles accept the call and drop
    // the value; a mute that silently un-mutes itself is worse than one that
    // simply does not persist.
    storageAuthoritative = localStorage.getItem(KEY) === want
  } catch {
    storageAuthoritative = false
  }
  // Muting releases the audio device rather than leaving it open and idle.
  if (!on) closeAudio()
}

/**
 * Adopt a preference another tab wrote. Deliberately NOT setFeedbackEnabled:
 * that writes storage, which would fire a storage event in the first tab,
 * which would write back — two tabs echoing at each other forever. This only
 * does the part that has a side effect worth doing, releasing the audio
 * device, so closeAudio()'s own rule (never hold a device for a feature
 * somebody has switched off) holds for a cross-tab mute as well as a local one.
 */
export function adoptStoredPreference(): void {
  if (!feedbackEnabled()) closeAudio()
}

/** Short taps, never a long buzz. A phone in a pocket is not a drum. */
const HAPTICS: Record<CueName, number | number[]> = {
  correct: 8,
  wrong: [18, 40, 18],
  complete: [14, 60, 14, 60, 28],
  milestone: [10, 50, 10, 50, 10, 50, 36],
  reveal: 5,
}

function vibrate(pattern: number | number[]): void {
  try {
    const nav = globalThis.navigator as Navigator | undefined
    if (typeof nav?.vibrate === 'function') nav.vibrate(pattern)
  } catch {
    /* some browsers throw rather than no-op when vibration is blocked */
  }
}

/**
 * The notes a cue is made of. `correct` is the only one that moves, and it is
 * given its ladder position explicitly rather than reading the module's run
 * counter — so the mapping from run to pitch stays a pure function.
 */
function notesFor(name: CueName, degree: number, opts: CueOptions): Note[] {
  switch (name) {
    case 'correct':
      // One struck bell at the run's height. The first right answer is the
      // bottom of the ladder, so a run has somewhere to climb from.
      return [{ freq: noteForRun(degree), at: 0, dur: 0.42, type: 'triangle', gain: 0.9 }]
    case 'wrong':
      // Low, short, soft. The learner already knows; this is not a reprimand.
      return [{ freq: 196.0, at: 0, dur: 0.28, type: 'sine', gain: 0.7 }]
    case 'complete':
      return opts.perfect
        ? [
            { freq: 523.25, at: 0, dur: 0.9, type: 'triangle', gain: 0.8 },
            { freq: 659.25, at: 0.07, dur: 0.85, type: 'triangle', gain: 0.75 },
            { freq: 783.99, at: 0.14, dur: 0.8, type: 'triangle', gain: 0.7 },
            { freq: 1046.5, at: 0.21, dur: 0.95, type: 'sine', gain: 0.6 },
          ]
        : [
            { freq: 261.63, at: 0, dur: 0.7, type: 'sine', gain: 0.8 },
            { freq: 329.63, at: 0.06, dur: 0.65, type: 'sine', gain: 0.7 },
            { freq: 392.0, at: 0.12, dur: 0.75, type: 'sine', gain: 0.65 },
          ]
    case 'milestone':
      // A brass shimmer: the plaque going up on the wall. No caller yet — the
      // thing that earns a plaque is PR 2 of specs/015-delight. It is defined
      // here rather than later so the cue table stays exhaustive over CueName
      // in one place; if milestones are abandoned, this goes with them.
      //
      return [
        { freq: 392.0, at: 0, dur: 0.5, type: 'triangle', gain: 0.7 },
        { freq: 523.25, at: 0.09, dur: 0.5, type: 'triangle', gain: 0.7 },
        { freq: 659.25, at: 0.18, dur: 0.55, type: 'triangle', gain: 0.65 },
        { freq: 880.0, at: 0.27, dur: 0.8, type: 'sine', gain: 0.6 },
      ]
    case 'reveal':
      return [{ freq: 1174.66, at: 0, dur: 0.12, type: 'sine', gain: 0.45 }]
  }
}

/**
 * Acknowledge a moment. Safe to call from anywhere: muted, unsupported and
 * broken platforms are all silent, and none of them throws.
 */
export function cue(name: CueName, opts: CueOptions = {}): void {
  // The run moves whether or not anyone is listening — muting the museum must
  // not change where a learner is in a run, only whether they hear it. The
  // first right answer sounds the bottom of the ladder, so `degree` is read
  // before the counter advances.
  const degree = run
  if (name === 'correct') run += 1
  else if (name === 'wrong') run = 0

  if (!feedbackEnabled()) return
  play(notesFor(name, degree, opts))
  vibrate(HAPTICS[name])
}
