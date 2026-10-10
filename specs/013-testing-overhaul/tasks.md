# Tasks 013 — Testing overhaul

**Plan:** ./plan.md

*Restored 2026-09-26: this file was truncated to zero bytes on 2026-09-20 by a
checkbox one-liner that opened it for writing before reading it
(`open(p,'w').write(open(p).read()…)`), so every later edit no-opped against an
empty string. Reconstructed from the three merged PRs (#52, #53, #54).*

## Phase 0 — honest baseline + gate (#52, merged)

- [x] 1. Module hooks: resolve vite-style imports, share the vite-ism transform
- [x] 2. Hand-written DOM stub (zero deps)
- [x] 3. import-all sweep with reasoned exclusions
- [x] 4. Measure the honest baseline (38.91 / 74.52 / 39.41)
- [x] 5. Prove the floor fails below threshold, then wire it into CI
- [x] 5b. Fix the smoke flake at its root: CDP client + condition-based waits
      (unplanned — the flake had been dismissed as transient twice)
- [x] 6. Ship via /ship

## Phase 1 — unit coverage (#53, merged: 38.91 → 86.05 lines, 39.41 → 75.42 funcs)

- [x] 7. Every session kind mounts with real shipped content, and is played
      through with scoring asserted end to end
- [x] 8. Direct tests: markdown, router, progress, content, search, pages,
      flashcards, widgets, a11y, palette, drill
- [x] 9. Ratchet the floor to what Phase 1 earned (85 / 71 / 75)

## Phase 2 — real-browser e2e + PWA installability (#54, merged)

- [x] 11. CDP driver over the built-in WebSocket
- [x] 13. Screenshot baselines + comparator (mutation-checked). Baselines are
      256px fingerprints, not full captures: house-gates blocks >512KB binaries
      and the downscale is the better test. Gates locally; informational in CI.
- [x] 15. Service worker registers, claims the page, and the museum opens
      offline after one visit (CDP network emulation)
- [x] 15b. **Installability**: manifest fields, PNG 192/512 + maskable, every
      icon verified against its real IHDR dimensions, apple-touch-icon.
      Unplanned: folio was NOT installable on Android (SVG-only icon set).
- [x] 12. All 12 session kinds played in the real browser — each route loads,
      renders a stage, takes interaction, and must not blank or throw
- [x] 14. Browser V8 coverage merged with the unit run (`npm run coverage:all`,
      floor in CI). Combined **89.68%**, up from 86.05% unit-only. The three
      stub-impossible modules moved most: shader.ts 55→90%, sim/engine.ts
      61→84%, fx.ts 87→98%. Driven deliberately — the aurora needs real WebGL
      AND no reduced-motion emulation, tilt needs a fine pointer, the engine
      needs dwell time.
- [x] 14b. **Combined coverage reached 95.05%** (2026-10-03), up from 89.68%,
      by playing every session kind to its END (check buttons, review rows,
      result screens), driving the floor's pan/pinch/tap layer, the review
      queue with seeded SRS state, the palette's keyboard, classify's
      drag-and-drop, and progress-import's per-field refusals. The CI floor is
      **94**, not 95: measured 94.95–95.05 across runs because the browser half
      varies by a few lines, and a floor at the peak would fail on rendering
      timing rather than on a regression.
- [~] 14c. Browser determinism — **narrowed to a single cause, floor ratcheted
      94 → 94.8**. Nine runs measured 94.86–95.07%. A per-file diff across runs
      shows every module is now deterministic to the line EXCEPT `src/shader.ts`,
      which swings 192–205 covered roughly one run in three: headless Chrome
      intermittently fails to hand the aurora a WebGL context, so the shader
      compile/link/draw path does not run. sim/engine.ts and floor.ts turned out
      to be stable after all — the earlier suspicion was wrong.
      Remaining: make that context acquisition reliable (or cover those lines
      without a GPU), then the floor can go to 95. Do not raise it on a lucky
      run.
      Superseded note — the original gap was: tilt.ts (31% — attaches under emulated
      pointer but its rAF handler still isn't captured) and the deep branches
      of the session renderers. Needs either full session play-through in the
      browser or targeted unit tests for the remaining paths.

## Phase 3 — delivery path + contracts (this PR)

- [x] 16. tools/ scripts incl. their failure paths — the linter now takes
      `--content` so its REFUSAL is testable; the preview builder's output is
      inspected (all three vite-isms patched, specifiers respelled, every
      emitted module parses)
- [x] 17. Build artifacts: `tools/verify-build.mjs` — base path, every
      reference emitted, the PWA surface present, manifest icons real,
      content shipped. **Corrected from the plan**: "no external URLs" was
      false — style.css imports Google Fonts at runtime. The gate is now an
      accepted-origin set that fails when it GROWS. And sw.js has no precache
      list to assert against: it caches lazily (network-first + SWR), so the
      assertion is that it handles fetch and declines cross-origin.
- [x] 18. Content contract fetched over HTTP exactly as the app asks for it,
      asserting from the reader's side (CON-COV-003)
- [x] 19. Post-deploy verification: `tools/verify-deploy.mjs` in pages.yml —
      the live page must reference the assets this run built, and the PWA
      surface must serve. Empty input exits 2 rather than passing vacuously.
- [x] 19b. Spec hygiene in folio's own suite: no spec file empty or untitled,
      no half-furnished feature directory. This is the gate that was missing
      when two tasks.md files sat at zero bytes. (The vendored `spec-check`
      CI job is still outstanding — version numbering is being resolved in
      the constitution repo.)

## Phase 4 — deferred, tracked elsewhere

- [x] 20. Maths packs B and C — specs/011 (#61) and specs/012 (#62), shipped
      2026-10-03. The Class XII track is fully converted.
