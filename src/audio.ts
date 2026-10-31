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
  // A closed context never works again. iOS tears one down when an audio
  // session is interrupted, so caching it blindly would make every later cue
  // a silent no-op for the life of the page, with no way back but a reload.
  if (ctx && ctx.state !== 'closed') return ctx
  ctx = null
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

/**
 * Retire a context that has stopped working. Chrome caps live AudioContexts
 * per document (~6), so a broken one must be CLOSED rather than merely
 * dropped — leaking one per failed cue would exhaust the cap and kill audio
 * for the page outright, with no way back but a reload.
 */
function dropContext(): void {
  const dead = ctx
  ctx = null
  settle(dead?.close())
}

/** Schedule a cue. Silent and side-effect-free when audio is unavailable. */
export function play(notes: Note[]): void {
  const audio = context()
  if (!audio) return
  try {
    // A suspended context has a FROZEN currentTime. Scheduling onto it would
    // queue every cue at the same instant in the past, and the moment audio
    // became permitted the whole backlog would fire at once — one loud garble
    // well above the master trim, which is the opposite of the point. So:
    // resume first, lay the notes down only once the clock is running. If the
    // resume is refused — no user activation, an interrupted iOS session —
    // nothing is scheduled and nothing accumulates.
    if (audio.state === 'suspended') {
      audio.resume().then(() => schedule(audio, notes)).catch(dropContext)
      return
    }
    schedule(audio, notes)
  } catch {
    // A cue is never worth failing a session over, and a context that has
    // started refusing nodes is not going to recover.
    dropContext()
  }
}

/** Lay the notes down on a context whose clock is actually running. */
function schedule(audio: AudioContext, notes: Note[]): void {
  const now = audio.currentTime
  for (const note of notes) {
    const osc = audio.createOscillator()
    const amp = audio.createGain()
    osc.type = note.type ?? 'sine'
    osc.frequency.setValueAtTime(note.freq, now + note.at)

    // A tiny attack and a long decay: struck, not switched on. A square edge
    // on either end is what makes synthesised feedback sound cheap.
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
}
