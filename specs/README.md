# Folio specs

Two complementary halves, one contract: **a spec statement without an
automated gate is a wish, not a spec** — if you find one, write the test or
delete the line.

1. **Invariants** (the domain files below) — what must stay true about the
   system as shipped. This is the regression side; every line maps to a test
   file, the linter, or a CI job.
2. **Feature lifecycle** (spec-driven development, spec-kit style) — new
   features start as `specs/NNN-<slug>/spec.md` (what/why, acceptance
   criteria each naming their gate) → `plan.md` (how) → `tasks.md` (steps),
   built under [constitution.md](constitution.md) and reviewed in the PR with
   the code. Templates: [templates/](templates/). Worked example:
   [001-data-storage-machines/](001-data-storage-machines/).

## The rules

- **An engine change lands its spec update and its test in the same PR.**
- **A feature bigger than a fix starts with `specs/NNN-<slug>/spec.md`** —
  written and agreed before implementation; the PR body links it.
- Content-only changes are gated by `npm run lint:content` and the
  content-contract tests; they need neither spec edits nor a feature folder.

## The verification pyramid

| Layer | Gate | Catches |
|---|---|---|
| Pure logic (sim, rules, generators, SRS, computes) | `npm test` — 34 tests, node:test, zero deps, runs offline | math drift, contract breaks, regression of shipped puzzles |
| Types | `tsc` via `npm run build` (CI `gate` job — offline box cannot run it) | exhaustive-Record breaks, interface drift |
| Content | `npm run lint:content` + `tests/content-contract.test.ts` | dangling refs, unknown kinds/models/computes, unwinnable goals |
| Boot & layout | `npm run smoke` (CI `smoke` job) | blank pages, dead module graphs, layout feedback loops |
| Color | `python3 tools/contrast.py` (manual, before any token commit) | WCAG regressions on the single dark theme |

All of the first four run on **every pull request** (`.github/workflows/ci.yml`);
merge is blocked on red. `pages.yml` re-runs lint+test before deploy.

## Specs

- [engine-sim.md](engine-sim.md) — simulation machines & the engine loop
- [engine-blueprint.md](engine-blueprint.md) — construction boards & graph rules
- [engine-gauntlet.md](engine-gauntlet.md) — drill generators & the daily review
- [srs-scheduler.md](srs-scheduler.md) — spaced repetition
- [content-contract.md](content-contract.md) — packs, sessions, whitelists
- [visual-system.md](visual-system.md) — the night gallery's non-negotiables

## History

An earlier SDD/TDD foundation (PR #5, July 2026) defined per-kind specs and a
Vitest suite for a codebase that was then rebuilt as the Living Museum
(PRs #6–#34). These specs replace it, describing the museum as shipped; the
test runner is Node's built-in (`node --test`) because the offline dev
environment cannot install packages.
