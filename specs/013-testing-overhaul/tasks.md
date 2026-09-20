# Tasks 013 — Testing overhaul

**Plan:** ./plan.md

## Phase 0 — honest baseline + gate (this PR)

- [x] 1. Module hooks: resolve vite-style imports, share the vite-ism transform
- [x] 2. Hand-written DOM stub (zero deps)
- [x] 3. import-all sweep with reasoned exclusions
- [x] 4. Measure the honest baseline (38.91 / 74.52 / 39.41)
- [x] 5. Prove the floor fails below threshold, then wire it into CI
- [x] 5b. Fix the smoke flake at its root: CDP client + condition-based waits
      (unplanned — the flake surfaced mid-phase and had been dismissed twice)
- [ ] 6. Ship via /ship (PR links specs/013-testing-overhaul/)

## Phase 1 — unit coverage to 95% (next PR)

- [ ] 7. Extract pure logic from the 12 session kinds
- [ ] 8. Direct tests: markdown, router, search, progress, content
- [ ] 9. Branch coverage: computes.ts, sim/models.ts
- [ ] 10. Ratchet the floor to what Phase 1 earns

## Phase 2 — real-browser e2e

- [ ] 11. CDP driver over the built-in WebSocket
- [ ] 12. Play all 12 session kinds end to end
- [ ] 13. Screenshot baselines + comparator (mutation-checked)
- [ ] 14. Browser V8 coverage merged with the unit run
- [ ] 15. Service-worker / offline navigation

## Phase 3 — delivery path + contracts

- [ ] 16. tools/ scripts incl. their failure paths
- [ ] 17. Build artifacts: base path, no external URLs, sw precache list
- [ ] 18. Content contract fetched as the app fetches it
- [ ] 19. Post-deploy version verification
