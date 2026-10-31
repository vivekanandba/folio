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
- [x] 17. Recapture the four baselines in the pinned container; report drift.
       ALL FOUR were re-recorded over this PR: `floor.png` for the greeting
       (16.43%), and `halls`/`pack-math`/`concept-matrices` when the capture
       scroll was pinned — which is itself the evidence that those three had
       been photographed 68px down. (An earlier version of this line claimed
       only `floor.png` changed. It was true of the first commit and is struck
       here rather than only rebutted at 18h: a reader who stops at task 17
       should not carry away a finding the same file later retracts.)
- [x] 18. Mutation-check; gates; ship

### Found while shipping PR 3 — the capture was racing the page

- [x] 18b. The screenshot step's intermittent drift (halls 8.55%,
       concept-matrices 9.54%) was **the camera, not the page**.

       `page.screenshot()` captures the VIEWPORT, and `main.ts` focuses
       `#main` on every route change, which scrolls it into view by 68px.
       Whether that had happened by shutter time varied with load order and
       with whether the service worker served the route from cache — so the
       same page was photographed from two different offsets. 68px of a 900px
       viewport is the 8.55% that kept appearing. Pinned with
       `window.scrollTo(0, 0)` before the shutter, and `scrollY` is now one of
       the conditions asserted there.

       How it was finally found, after two wrong answers: the DOM was captured
       ten times and was byte-identical every time, which ruled out everything
       structural at once and pointed at rendering rather than content.

       Ruled out by measurement along the way: leftover localStorage, a resume
       card, a live aurora canvas, reduced-motion failing to apply, unhydrated
       `.viz-slot` figures (zero pending on the FIRST poll — the wait added
       for them was vacuous and has been removed), webfont loading, pending
       images, and layout height.

       Evidence for the fix: 2 failures in 6 runs before it; 11 consecutive
       clean runs after, three of them at load average 10.5 — the condition
       the fleet notes name as where Playwright jobs break. `halls.png` and
       `pack-math.png` moved on recapture and the other two did not, which is
       the independent confirmation that those were the two being shot 68px
       down.

       Corrections to the record, both mine. PR 1 said the earlier 8.55% was
       the resume card: inferred, never observed. PR 3 then said it was
       unhydrated figures and called it fixed: also inferred, and measurably
       wrong — the wait it added could not fail. Twice I wrote a guess into a
       commit message as a finding, while citing CON-DATA-001 elsewhere in the
       same change.

- [x] 18g. The focus ring SILENCED the page. `:focus-visible` is specificity
       (0,1,0), the same as `.pulse` and `.fx-shake`, and written later — so
       an `animation` shorthand on it wins over both. Measured by forcing the
       pseudo-state: animation-name went `pulse-glow` → the ring's keyframe,
       and adding `fx-shake` to the focused element did not change it back. A
       keyboard user answering wrongly would have got NO shake — the exact
       cohort the hunk was written for. The flourish is gone; the brass ring,
       which was the valuable half, stays.

- [x] 18h. Baseline record corrected. The PR body claimed only `floor.png`
       changed and the other three were byte-identical. True of the first
       commit; false of the PR — pinning the scroll re-recorded `halls`,
       `pack-math` and `concept-matrices` too, which is itself the evidence
       that those were being photographed 68px down.

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

- [x] 18f. A figure that cannot mount now marks itself `widget-failed` on all
       three degradation paths. The wait that motivated it has since been
       removed as vacuous, but the mark is right on its own terms: "has not
       mounted yet" and "will never mount" should not look identical from
       outside, and a test pins it.

### Carried forward — e2e load sensitivity (wider than first recorded)

- [ ] 18c. Several e2e checks assume the page has finished loading and time
       out under heavy load: `explainer`, `blueprint`, the manifest link, and
       the screenshot furniture waits. Reproduced deliberately at load ~6 with
       three container runs beside four unit suites. CI runs the e2e alone in
       its own job, so this is not reached there — but by the fleet's own rule
       a check that fails under load is a suite defect, and the fix belongs to
       the harness rather than to any one feature PR.

## PR 4 — spend the headroom (extends specs/013 task 14c)

- [x] 19. Measured, and the hypothesis was WRONG — which is the point of
       measuring. `--enable-unsafe-swiftshader` was never needed: a probe
       granted a WebGL context 9 times out of 9 with the flags already in
       use. The swinging band was `destroy()` and the `webglcontextlost`
       handler racing page teardown, not context acquisition. See
       specs/013-testing-overhaul/tasks.md 14c.
- [x] 20. Cover the stub-reachable clusters: `review.ts` summary + interrupt,
       `lab.ts` endings, `decision.ts` ending node, `sim/engine.ts` controls and
       `destroy()`, `sequence.ts` reorder, `widgets.ts`, and the tail
- [x] 21. Cover the browser-only clusters via the e2e driver: `report.ts`
       export/import, `floor.ts` zoom + narrow layout, `shader.ts` teardown via
       `WEBGL_lose_context`
- [x] 22. Ratchet the floor ONCE, from the measured minimum across runs —
       never from a lucky run. Six measurements (five local, one CI) spanned
       97.87–97.92%; the floor is 97.5, up from 94.8.
- [x] 23. Close or re-scope task 14c in specs/013-testing-overhaul/tasks.md

## Manual verification (cannot be gated headlessly — CON-VER-007)

- [ ] M1. Sound in a real browser: the scale climbs across a run and resets on
       a miss; the mute control silences it and survives a reload
- [ ] M2. Haptics on the installed Android PWA
