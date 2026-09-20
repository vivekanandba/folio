# Spec 013 — Testing overhaul: an honest coverage floor, then 95%

**Status:** agreed (user, 2026-09-20: unit coverage above 95%, plus end-to-end
with screenshots, repo scripts and contract testing — "that takes precedence
over any other plan")
**Constitution check:** Art. II (verification before merge), Art. III (engine
change ships with its test). Cites CON-VER-001, CON-VER-005, CON-COV-001/002/003,
CON-PROC-003/005.

**Record of order (CON-PROC-005):** the Phase 0 mechanism was built alongside
this spec, not before it. The failing state was demonstrated first — the gate
was proven to exit 1 at a 99% threshold and 0 at the baseline — but the spec
text was written after that experiment, and says so rather than back-dating it.

## Why (the problem)

`npm run test:coverage` reported **87.65% lines**. That number measured the
five source files some test happened to import. The other **42 of 47 files**
— every session renderer, every page, the markdown renderer, the router, the
sim engine, the visual layer — had never executed under test at all, and
could not appear in the report, because Node only reports files that were
loaded. `--test-coverage-include='src/**'` does **not** pull unloaded files
into the denominator; this was verified, not assumed.

A report that cannot see 79% of the tree is not a measurement, it is a
reassurance (CON-VER-005). There was also **no coverage threshold in CI**, so
nothing stopped the number moving either way.

The cause is structural rather than negligent: `src/` is written for vite
(extensionless specifiers, `import.meta.env`, `import.meta.glob`), so Node's
test runner could not import it, and Article I plus an offline box rule out
jsdom, vitest and playwright.

## What (user-visible behaviour)

1. **The denominator is the whole source tree.** `tests/import-all.test.ts`
   imports every file under `src/`; any module that cannot load outside a
   browser is named in an explicit exclusion list **with its reason**, and a
   test asserts each exclusion still corresponds to a real file.
2. **The reported number is the real one.** Baseline on adoption:
   **38.91% lines · 74.52% branches · 39.41% functions**.
3. **CI enforces a floor** (`npm run test:gate`) that ratchets upward only.
4. Two capabilities make this possible without dependencies: Node's built-in
   coverage thresholds, and `module.registerHooks` for resolving the app's
   vite-style imports.
5. The vite-ism transform is **shared** between the preview builder and the
   test loader (`tools/preview/vite-isms.mjs`) — one copy, exercised from both
   sides, because two copies would drift (CON-COV-003).

6. **The smoke suite stops flaking.** It waited on `--virtual-time-budget`, a
   virtual clock the app's own timers exhaust, so Chrome sometimes dumped a
   half-loaded page and the harness reported "page did not boot". Measured:
   the *failing* run finished in 1566 ms having served 49 requests; the passing
   run took 2030 ms and served 63 — the faster run was the broken one. I had
   dismissed this as transient twice, which is precisely the cost of a flaky
   harness (CON-PROC-003). Each route now waits for the furniture that defines
   it, over CDP, with a wall-clock timeout.

## Not in scope (this spec covers Phase 0 only)

Later phases, each landing its own ratchet: extracting pure logic from the
renderers to reach 95%; real-browser end-to-end over CDP with screenshot
baselines; delivery-path and content-contract tests.

## Acceptance criteria — each line names its gate

- [ ] Every `src/` file imports cleanly or is excluded with a stated reason
      *(import-all.test.ts)*
- [ ] Coverage report covers all 47 files, not 5 *(test:gate output)*
- [ ] The floor genuinely fails below threshold *(demonstrated: exit 1 at 99%)*
- [ ] Floors ratchet up only, never down to green a build *(review, CON-COV-002)*
- [ ] Preview builder still produces a booting site after sharing the transform
      *(smoke 6/6)*
