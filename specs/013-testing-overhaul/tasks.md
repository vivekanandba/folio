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
- [ ] 12. Play all 12 session kinds in the real browser (the unit suite plays
      them against the DOM stub today)
- [ ] 14. Browser V8 coverage merged with the unit run — the remaining route to
      95% for shader.ts (WebGL), sim/engine.ts (frame loop), tilt.ts (pointer)

## Phase 3 — delivery path + contracts (next)

- [ ] 16. tools/ scripts incl. their failure paths — a harness that cannot fail
      is not a harness
- [ ] 17. Build artifacts: base path, **no external URLs**, sw precache list
      matching what was built
- [ ] 18. Content contract fetched as the app fetches it, validated from both
      sides (CON-COV-003)
- [ ] 19. Post-deploy verification: the live site serves the build just made
      (CON-VER-003)

## Phase 4 — deferred, tracked elsewhere

- [ ] 20. Maths packs B and C — specs/011 (ch 6–9) and specs/012 (ch 10–13 +
      capstone), lessons already extracted
