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

- [ ] 14. Pin the clock for the four e2e captures **before** any time-varying
       copy lands, so the gate cannot erode unnoticed
- [ ] 15. `src/curator.ts` — per-route loading lines, time-of-day arrival line
- [ ] 16. `ceremony()` called from `pages/review.ts` instead of its hand-copied
       stamp; `countUp()` on `.score-hero`; streak tile alive at ≥3 days;
       focus-visible choreography; the saved-note becomes a real plaque
- [ ] 17. Recapture the four baselines in the pinned container; report drift
- [ ] 18. Mutation-check; gates; ship

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
