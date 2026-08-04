# Spaced repetition

**Code:** `src/srs.ts` (pure), `src/progress.ts` (localStorage)
**Gates:** `tests/srs.test.ts`

## Scheduler (SM-2 + mastery EMA)

1. Interval ladder on success: 1 day → 6 days → `round(interval × ease)`;
   failure resets reps, sets interval 1, counts a lapse. *(srs.test)*
2. Ease never falls below 1.3; mastery is a kind-weighted EMA clamped to
   [0, 1]. *(srs.test)*
3. `toGrade` thresholds: ≥0.95→5, ≥0.8→4, ≥0.6→3 (pass), ≥0.4→2, ≥0.2→1.
   *(srs.test)*
4. **`KIND_WEIGHT` must cover every kind in the linter's `KNOWN_KINDS`, and
   vice versa.** This is an exhaustive `Record<SessionKind, …>`: a missing
   entry breaks CI's tsc (it broke main once, PR #18). The parity test makes
   it fail offline first. *(srs.test — the load-bearing guard)*

## Daily queue

5. `buildToday`: overdue + due-today first (most overdue first), then at most
   4 brand-new concepts; hard cap 20; the result is **pack-interleaved**
   round-robin. Due items are never displaced by new ones. *(srs.test)*
6. Streaks count consecutive review days and forgive "haven't reviewed *yet*
   today". *(srs.test)*

## Progress store

- v2 store: sessions, concepts, append-only attempts (capped 500), daily
  counts. Export = full JSON; import validates structure (version 2, all
  four collections) and replaces — refusals carry a reason. *(structure
  validated in importProgress; exercised via smoke's report route)*
