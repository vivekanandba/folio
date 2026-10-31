/**
 * The museum's voice — synthesised, never downloaded.
 *
 * folio ships no audio files on purpose. A pocket museum that works on a plane
 * should not carry a sound pack, and Article I rules out an audio library, so
 * every cue is a few oscillators scheduled through Web Audio. The whole voice
 * costs zero bytes of payload.
 *
 * Two rules this module exists to keep:
 *  - The AudioContext is created on the FIRST CUE, never at import. Browsers
 *    refuse to start one outside a user gesture, and a suspended context left
 *    lying around is a resource the app never asked for.
 *  - Nothing here may ever throw into a caller. A missing API, a refused
 *    context or a hostile autoplay policy means silence, not a broken session.
 */

/** One scheduled note. `at` and `dur` are seconds, relative to the cue. */
export interface Note {
  freq: number
  at: number
  dur: number
  type?: OscillatorType
  /** Peak level before the master trim, 0..1. */
  gain?: number
}

/**
 * Master trim. Deliberately low: this is punctuation under someone's reading,
 * not a soundtrack. Loud feedback is the fastest route to a muted app.
 */
const MASTER = 0.14

/** Web Audio ramps to zero are illegal on the exponential curve; ramp to this. */
const SILENCE = 0.0001

type Ctor = new () => AudioContext

let ctx: AudioContext | null = null

/** Resolve the constructor at CALL time — the stub installs it after import. */
function contextCtor(): Ctor | null {
  const g = globalThis as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = contextCtor()
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null // no device, or the page is not allowed one
  }
  return ctx
}

/**
 * Neither `resume()` nor `close()` may escape. They are promises, so a bare
 * `try/catch` is not enough: Chrome REJECTS `resume()` with NotAllowedError
 * when the page has no user activation, and `close()` with InvalidStateError
 * on a context that is already closed. An unhandled rejection is a console
 * error the learner did nothing to earn, and it reaches any page that treats
 * `unhandledrejection` as a failure. Both call sites already sit inside a
 * try/catch, so this only has to deal with the asynchronous half.
 */
function settle(result: unknown): void {
  void Promise.resolve(result).catch(() => {})
}

/**
 * Release the audio device. Called when the learner mutes — holding an open
 * context for a feature someone has switched off is rude to the rest of the
 * system, and it means the next unmute re-checks the platform from scratch.
 */
export function closeAudio(): void {
  const open = ctx
  ctx = null
  try {
    settle(open?.close())
  } catch {
    /* already closed, or closing is unsupported — nothing to recover */
  }
}

/** Schedule a cue. Silent and side-effect-free when audio is unavailable. */
export function play(notes: Note[]): void {
  const audio = context()
  if (!audio) return
  try {
    // A context that autoplay policy parked in 'suspended' resumes on the
    // gesture that produced this cue. Unawaited on purpose — but never
    // unhandled: without activation this rejects rather than throwing.
    if (audio.state === 'suspended') settle(audio.resume())
    const now = audio.currentTime
    for (const note of notes) {
      const osc = audio.createOscillator()
      const amp = audio.createGain()
      osc.type = note.type ?? 'sine'
      osc.frequency.setValueAtTime(note.freq, now + note.at)

      // A tiny attack and a long decay: struck, not switched on. A square
      // edge on either end is what makes synthesised feedback sound cheap.
      const peak = (note.gain ?? 1) * MASTER
      const start = now + note.at
      const attack = Math.min(0.012, note.dur / 4)
      amp.gain.setValueAtTime(SILENCE, start)
      amp.gain.linearRampToValueAtTime(peak, start + attack)
      amp.gain.exponentialRampToValueAtTime(SILENCE, start + note.dur)

      osc.connect(amp)
      amp.connect(audio.destination)
      osc.start(start)
      osc.stop(start + note.dur)
    }
  } catch {
    /* a cue is never worth failing a session over */
  }
}
