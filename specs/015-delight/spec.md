# Spec 015 — The museum notices you

**Status:** agreed (user: "I need to see how to add delight to this… this aspect
of delight is definitely missing", 2026-10-31; sound/milestone/haptics defaults
confirmed in the same exchange)
**Constitution check:** Article I (zero runtime dependencies) — Web Audio and
`navigator.vibrate` are platform APIs, nothing is added to package.json.
CON-DATA-001 — every celebrated moment is derived from data folio already
records, never from an inferred or flattering one. CON-COV-002 — the new
modules arrive with their own tests; the floor ratchets only upward.

## Why (the learner's problem)

folio's *entrance* is strong: an aurora behind the hero, tilt on the cards, a
pannable constellation floor, a brass stamp when a session ends. What the
museum never does is **react to the person inside it**.

Measured against the repo as it stands today:

| | today |
|---|---|
| Sound | none — zero audio code anywhere in the repo |
| Haptics | none — `navigator.vibrate` appears nowhere, on a PWA built to install on Android |
| Milestones / rewards | no such concept — `badge`, `milestone`, `achievement` exist nowhere in `src/` |
| Celebration | `ceremony()` is called from exactly **one** line of the app; `pages/review.ts` hand-duplicates its markup rather than calling it |
| Keyboard | 3 `:focus-visible` rules in 2842 lines of CSS |
| The curator's voice | 2 of 5 routes have one; the other 3 say "Loading…" |

So folio records your streak, your mastery and your completions — and then says
nothing about any of them. A number on a stat tile is not a reward. The learner
gets no signal that the museum is *theirs* and has been accumulating.

## What (user-visible behavior)

1. When the learner answers correctly, folio plays a soft bell **and** the bell
   climbs a scale with each consecutive correct answer, resetting on a miss —
   so a run *sounds* like a run.
2. When the learner answers wrongly, folio plays a low, short, non-punishing
   note. Never a buzzer.
3. When a session completes, folio plays a resolved chord; a flawless session
   gets a brighter voicing.
4. On a device that supports it, each of those moments is accompanied by a
   short haptic tap.
5. Sound and haptics are **on by default**, quiet, and are muted together by a
   single control in the topbar whose state survives a reload.
6. When the learner crosses a real threshold — a first flawless session, a
   concept reaching `solid`, a hall completed, a streak reaching 3/7/30/100
   nights, 10/50/100/500 attempts logged, every hall visited — the museum says
   so, once, in the moment it happens.
7. Those earned plaques are **kept**. The Curator's Report shows every one the
   learner has earned, with the date.
8. Each route announces itself in the curator's voice while it loads, instead
   of "Loading…".
9. Nothing above is required for folio to work: with no Web Audio, no vibration
   and no WebGL, the app behaves exactly as it does today.

## Not in scope

- **Points, XP or levels.** Praise must track something real the learner did;
  a score invented by the app is the opposite of CON-DATA-001.
- **Streak pressure** — no "don't lose your streak!" nagging, no notifications.
  The museum is open all night and does not hector.
- **Sound packs, volume sliders or theming.** One voice, one mute.
- **Changing the SRS schedule** to make milestones easier to hit.

## Acceptance criteria — each line names its gate

- [ ] A correct answer raises the cue one scale degree; a wrong answer resets
      the run to the bottom *(gate: tests/feedback.test.ts)*
- [ ] Muting silences every channel — no tone requested, no vibration requested
      *(gate: tests/feedback.test.ts, asserted against a recording stub)*
- [ ] The mute preference survives a reload *(gate: tests/feedback.test.ts)*
- [ ] With no `AudioContext` and no `navigator.vibrate`, every cue is a no-op
      and nothing throws *(gate: tests/feedback.test.ts)*
- [ ] No session kind's behaviour changes when cues are added
      *(gate: tests/session-play.test.ts, unchanged and still green)*
- [ ] Milestone detection is a pure diff of two progress stores; each rule
      fires exactly once, on the save that crosses it *(gate: tests/milestones.test.ts)*
- [ ] An earned milestone is persisted and still present after a reload
      *(gate: tests/milestones.test.ts)*
- [ ] A backup exported before this feature still imports
      *(gate: tests/progress-router.test.ts)*
- [ ] The Curator's Report lists every earned plaque with its date
      *(gate: tests/pages.test.ts)*
- [ ] Every route's loading line is the curator's, not "Loading…"
      *(gate: tests/pages.test.ts)*
- [ ] Any new colour token used for text meets its contrast floor
      *(gate: tools/contrast.py)*
- [ ] The four screenshots still gate at < 2% drift after the clock is pinned
      *(gate: npm run e2e, in the pinned container)*
- [ ] Sound and haptics confirmed by hand in a real browser and on the
      installed Android PWA *(gate: manual — recorded in tasks.md, since a
      headless assertion cannot hear anything; CON-VER-007)*

## Open questions

Resolved before work began, by asking:

- Sound default → **on, quiet, mute in the topbar**.
- Milestones → **celebrated and kept permanently**, not moment-only.
- Haptics → **yes**.

Still open, to be answered by measurement rather than assertion:

- Does `--enable-unsafe-swiftshader` make headless Chrome grant WebGL
  reliably, closing task 14c in specs/013? Measured over ≥9 runs before any
  claim is made or any floor is raised.
