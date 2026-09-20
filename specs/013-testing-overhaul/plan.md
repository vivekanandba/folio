# Plan 013 — Testing overhaul

**Spec:** ./spec.md  **Status:** Phase 0 executed; Phases 1–3 queued

## Approach

**Phase 0 (this PR) — make the number honest, then gate it.**
`tests/support/module-hooks.mjs` registers Node module hooks that resolve the
app's extensionless specifiers to `.ts` and load `src/` through the same
vite-ism patch the preview builder uses, preserving the file URL so V8
attributes coverage to the real source and `strip` mode keeps line numbers
meaningful. `tests/support/dom-stub.ts` supplies a hand-written DOM so
rendering modules can load. `tests/import-all.test.ts` sweeps the tree.

**Phase 1** — extract pure logic from the session renderers into testable
modules; test `markdown.ts`, `router.ts`, `search.ts`, `progress.ts`,
`content.ts` directly; raise branch coverage on `computes.ts` (35%) and
`sim/models.ts` (56%). Ratchet toward 95%.

**Phase 2** — real-browser e2e over CDP: play all 12 session kinds, screenshot
baselines with a hand-rolled comparator, browser V8 coverage merged with the
unit run, service-worker offline check.

**Phase 3** — delivery path: `tools/` scripts, build artifacts, the content
contract fetched as the app fetches it, post-deploy version verification.

## Touched surface

Create `tests/import-all.test.ts`, `tests/support/{dom-stub.ts,module-hooks.mjs}`,
`tools/preview/vite-isms.mjs`. Modify `tools/preview/build.mjs` (use the shared
transform), `package.json` (`test:gate`, include-filtered `test:coverage`),
`.github/workflows/ci.yml` (floor replaces the bare test run). **No `src/`
changes** — the hooks exist precisely so the app is tested as it ships.

## Verification plan

Prove the gate fails before trusting it (done: exit 1 at a 99% threshold,
exit 0 at baseline). Then lint → test:gate → smoke, each gated on its exit
code, plus the PR gate and a green Pages deploy.

## Risks

- **A stub is not a browser.** The DOM stub can make a module *load* without
  proving it *renders*. Mitigation: function coverage (39.41%) is the metric
  quoted alongside lines, because import-only execution inflates line coverage;
  real rendering belongs to Phase 2 and is not claimed before then.
- **Hook divergence.** If the loader and the preview builder patched sources
  differently, tests would exercise code the browser never runs. Mitigated by
  sharing one transform; smoke is the cross-check that the builder still works.
