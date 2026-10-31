# Plan 015 — The museum notices you

**Spec:** ./spec.md  **Status:** agreed

## Approach

Three shipping PRs, each independently useful and independently revertible,
plus a fourth that spends the coverage headroom the first three create.

The shape that makes this testable on an offline box with no browser: **one
module owns the decision, a thin adapter owns the platform.** `src/feedback.ts`
decides *which cue, at which scale degree, and whether the learner wants it*;
`src/audio.ts` and the haptics call are the only places that touch
`AudioContext` or `navigator.vibrate`. The decision layer is pure and reaches
~100% under the DOM stub; the adapter is small enough to assert against a
recording stub.

**Rejected:** shipping audio files (breaks the zero-dependency, offline-first
posture and adds weight to a PWA whose whole point is a pocket museum).
**Rejected:** a generic event bus — there are five cues, a table is clearer.
**Rejected:** bumping the progress store to v3 for milestones; an *optional*
field keeps every existing backup importable with no migration code.

## Touched surface

- **Create:** `src/audio.ts`, `src/feedback.ts`, `src/milestones.ts`,
  `src/curator.ts`, `tests/feedback.test.ts`, `tests/milestones.test.ts`
- **Modify:** `src/main.ts` (topbar control), `src/sessions/mcq.ts`,
  `src/fx.ts` (`ceremony` fires the completion cue; new `countUp`),
  `src/pages/session.ts`, `src/pages/review.ts` (call `ceremony` instead of
  re-implementing it), `src/pages/report.ts` (Acquisitions), `src/pages/hub.ts`,
  `src/pages/pack.ts`, `src/pages/concept.ts`, `src/progress.ts`,
  `src/types.ts`, `src/style.css`, `tests/support/dom-stub.ts`,
  `tools/e2e/run.mjs` (pin the clock for captures), `tools/contrast.py` (only
  if a new text token appears)
- **Reuse:** `ceremony()`/`burst()`/`shake()` (`src/fx.ts`), `prefersReducedMotion()`
  and `liveAnnounce()` (`src/a11y.ts`), `computeStreak()`/`masteryBand()`
  (`src/srs.ts`), `packCompletion()` (`src/progress.ts`), `el()` (`src/dom.ts`)

## Engine/data changes

- `ProgressStoreV2` gains **optional** `milestones?: Record<string, string>`
  (id → ISO earned-at). `version` stays `2`, so `importProgress`'s version
  check keeps accepting pre-feature backups and no migration is written.
- A new exhaustive `Record<CueName, CueRecipe>` in `src/feedback.ts` and
  `Record<MilestoneId, MilestoneRule>` in `src/milestones.ts`. Both are typed
  exhaustively so adding a member without a recipe is a type error, the same
  discipline as `KIND_WEIGHT` in `src/srs.ts` (whose missing `lab` entry broke
  main once).
- No new session kind, no linter whitelist change, no content contract change.

## Verification plan

New tests, and what each pins:

- `tests/feedback.test.ts` — the scale ladder and its reset; the mute
  preference round-trip; that muting requests **no** tone and **no** vibration;
  that a platform with neither API is a silent no-op rather than a throw.
- `tests/milestones.test.ts` — each rule fires exactly once, on the save that
  crosses it, and never again; a rule that cannot be crossed never fires;
  persistence survives a reload.
- `tests/pages.test.ts` — Acquisitions lists what was earned; each route's
  loading line is the curator's.
- `tests/progress-router.test.ts` — a pre-feature backup still imports.

The DOM stub grows two recorders (`AudioContext`, `navigator.vibrate`). They
record requests; they synthesise nothing. The point is to assert *what the app
asked for*, which is the only part a headless box can judge.

**Every new assertion is mutation-checked** (CON-PROC-005, CON-PROC-009):
break the code it guards, watch it go red, restore. This session has already
produced one test that could not fail, which is why this line is here.

Offline gates per PR: `npm run test:gate`, `npm run coverage:gate`,
`npm run smoke`, `npm run e2e`, `npm run lint:content`, `python3
tools/contrast.py`, `npm run pages:build && node tools/verify-build.mjs dist
--base /folio/`, `python3 tools/check_specs.py`.

Manual, and reported as manual (CON-VER-007): sound in a real browser; haptics
on the installed Android PWA.

## Risks

1. **An unwanted noise is worse than no noise.** Mitigation: quiet by design,
   one visible control that mutes every channel at once, state persisted; the
   kill-switch is a one-line default flip.
2. **Time-varying copy would silently erode the screenshot gate** that PR #69
   just earned (0.00% drift). Mitigation: pin the clock for the four captures
   before any time-dependent copy lands, recapture once in the pinned
   container, and report the drift rather than widening the threshold.
3. **New modules dilute coverage** and could push the combined figure under the
   94.8 floor. Mitigation: the decision layers are pure by construction and
   land with their tests in the same PR; `coverage:gate` runs on every PR, so
   the failure is loud and pre-merge.
