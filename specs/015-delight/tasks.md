# Tasks 015 — The museum notices you

**Plan:** ./plan.md

## PR 1 — feedback channels (sound + haptics)

- [x] 1. DOM stub grows a recording `AudioContext` and `navigator.vibrate`
- [x] 2. `tests/feedback.test.ts` written FIRST and watched fail (CON-PROC-005)
- [x] 3. `src/audio.ts` — zero-asset Web Audio synth, context created lazily on
       the first gesture, never at import
- [x] 4. `src/feedback.ts` — cue table, the scale ladder, the mute preference
- [x] 5. Wire the cues: `sessions/mcq.ts` (which covers quiz, detective and
       calculator), plus `hotspot`, `estimate`, `classify`, `sequence`,
       `blueprint`, `detective`, `audit` and `flashcard`; `gauntlet/drill.ts`;
       and the completion chord in `pages/session.ts` + `pages/review.ts`.
       NOT in `fx.ts` as planned: `ceremony()` only runs when a `.stage`
       element is found, and finishing an exhibit deserves the chord whether
       or not the kind rendered one — so `fx.ts` stays purely visual
- [x] 6. Topbar mute control in `main.ts` + `style.css`
- [x] 7. Mutation-check each new assertion; gates; ship
- [x] 7b. Five adversarial review rounds (CON-PROC-009), 27 findings fixed;
       the screenshot capture made order-, date- and race-independent after
       the gate caught an intermittent 8.6%/9.5% drift that was not visual

## PR 2 — milestones, celebrated and kept

- [x] 8. `tests/milestones.test.ts` written first and watched fail
- [x] 9. `src/milestones.ts` — pure `detect(store, ctx)`. NOT the before/after
       diff the plan named: a diff loses any milestone crossed during a save
       that lacked hall information, and a learner who was using folio before
       plaques existed has genuinely earned theirs. Satisfied-minus-recorded
       is simpler and cannot lose a moment
- [x] 10. Optional `milestones` field on the store; `progress.ts` returns what
       was newly earned (no version bump, old backups still import)
- [x] 11. The moment: brass plaque in `pages/session.ts` + `pages/review.ts`
- [x] 12. The permanence: Acquisitions shelf in `pages/report.ts`
- [x] 13. Mutation-check; gates; ship
- [x] 13b. Six adversarial review rounds (CON-PROC-009), 25 findings fixed

### Carried forward from round 6 — known, small, not blocking

- [ ] 13c. `session.ts` can render TWO plaque cards for one finish (the
       synchronous ones, then the hall-shaped ones after `loadHalls()`), with
       two `cue('milestone')` calls ~2.3s apart. It fires on the best finish
       there is — the last exhibit of a hall. Merge the second into the first
       card if one is already on screen.
- [ ] 13d. `feedback.ts`'s queue exempts `correct`/`wrong`/`reveal` from
       waiting AND from being waited for, so a `reveal` landing just before a
       queued `milestone` still has its haptic truncated — the failure the
       queue exists to prevent, in the one direction its tests do not cover.
       No page produces that ordering today.

## PR 3 — the curator's voice, and the polish

- [x] 14. Pin the clock for the four e2e captures **before** any time-varying
       copy lands, so the gate cannot erode unnoticed
- [x] 15. `src/curator.ts` — per-route loading lines, time-of-day arrival line
- [x] 16. `ceremony()` called from `pages/review.ts` instead of its hand-copied
       stamp; `countUp()` on `.score-hero`; streak tile alive at ≥3 days;
       focus-visible choreography; the saved-note becomes a real plaque
- [x] 17. Recapture the four baselines in the pinned container; report drift —
       only `floor.png` changed (16.43%, the greeting); the other three came
       back byte-identical, which is the evidence that the greeting is the
       whole of the visual delta
- [x] 18. Mutation-check; gates; ship

### Found while shipping PR 3 — the capture was racing the page

- [x] 18b. The screenshot step waited a fixed 600ms and then fired. Under load
       a concept page's interactive figures had not hydrated, so the capture
       had a figure-sized hole and reported 9.54% drift — a timing failure
       wearing the costume of a design regression, and the same
       duration-instead-of-condition mistake the smoke suite was rebuilt to
       remove. It now waits for every `.viz-slot` to hydrate and for
       `document.fonts.ready`, and the capture asserts FIVE named conditions
       (storage, resume card, live aurora, reduced-motion, font status) so a
       future race says what it was rather than printing a percentage for the
       reader to guess at (CON-VER-005). Five, not six: an earlier draft also
       re-checked hydration, which the wait above already guarantees — an
       unreachable branch dressed as a check.

       Correction to the record: PR 1 attributed an earlier intermittent 8.55%
       to the resume card. That was inferred, never observed — the measured
       cause is this one.

- [x] 18d. Three style rules in this PR rendered ZERO pixels. A bare
       `:focus-visible` and a `.saved-note.plaque-card` already existed LATER
       in style.css at identical specificity, so the new blocks lost the
       cascade entirely — the brass ring, the overshoot and the pressed-in
       plaque were all written, reviewed, described in a PR body, and dead.
       The winning rules are edited in place now. A `border-radius` on the
       bare `:focus-visible` also squared the round topbar button on focus,
       which is the shape jump its own comment promised to avoid; browsers
       follow the element's radius when drawing an outline, so there was
       nothing to set.

- [x] 18e. The pinned capture timestamp said "a Saturday morning" in its
       comment and held a Tuesday EVENING (off by 3d12h), so the baseline
       captured a greeting the record denied. And the clock was pinned while
       the TIMEZONE was not — arrivalLine() reads getHours(), which is local,
       so the same instant produces a different greeting on a box outside UTC
       and the drift this work removed walks back in. Both fixed; the greeting
       in the capture is now verified by probe, not assumed: "Good morning",
       Sat Jun 06 2026 09:00:00 GMT+0000.

- [x] 18f. The hydration wait treated "cannot mount" as "not mounted yet". A
       malformed ```viz fence degrades to "(interactive figure unavailable)"
       and never gains `widget-mounted`, so the gate would have waited out its
       full timeout blaming hydration — the misdiagnosis the wait was added to
       prevent. Failed figures mark themselves `widget-failed` now.

### Carried forward — e2e load sensitivity (wider than first recorded)

- [ ] 18c. Several e2e checks assume the page has finished loading and time
       out under heavy load: `explainer`, `blueprint`, the manifest link, and
       the screenshot furniture waits. Reproduced deliberately at load ~6 with
       three container runs beside four unit suites. CI runs the e2e alone in
       its own job, so this is not reached there — but by the fleet's own rule
       a check that fails under load is a suite defect, and the fix belongs to
       the harness rather than to any one feature PR.

## PR 4 — spend the headroom (extends specs/013 task 14c)

- [ ] 19. Measure `--enable-unsafe-swiftshader` over ≥9 runs before claiming
       anything about task 14c
- [ ] 20. Cover the stub-reachable clusters: `review.ts` summary + interrupt,
       `lab.ts` endings, `decision.ts` ending node, `sim/engine.ts` controls and
       `destroy()`, `sequence.ts` reorder, `widgets.ts`, and the tail
- [ ] 21. Cover the browser-only clusters via the e2e driver: `report.ts`
       export/import, `floor.ts` zoom + narrow layout, `shader.ts` teardown via
       `WEBGL_lose_context`
- [ ] 22. Ratchet the floor ONCE, from the measured minimum across runs — never
       from a lucky run
- [ ] 23. Close or re-scope task 14c in specs/013-testing-overhaul/tasks.md

## Manual verification (cannot be gated headlessly — CON-VER-007)

- [ ] M1. Sound in a real browser: the scale climbs across a run and resets on
       a miss; the mute control silences it and survives a reload
- [ ] M2. Haptics on the installed Android PWA
