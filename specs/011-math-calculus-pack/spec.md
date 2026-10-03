# Spec 011 — Calculus pack (Class XII chapters 6–9)

**Status:** agreed (user: "Go ahead and do it", 2026-10-03; packaging chosen
2026-09-20 — two packs, calculus first)
**Constitution check:** Art. VI (content-only), Art. VIII (personal study
notes; every claim traceable to a lesson that verified it in code).

## Why

Days 16–26 of the Class XII track sat on `_sync-staging` and were missed by a
survey that read only the default branch. They are denser than the chapters
already shipped: 2.7–4.5 KB of authored markdown each, every code cell
executed, each theorem mapped onto aerospace, electronics and computing.

The revision value is the traps, not the formulas: an absolute maximum that
sits at an **endpoint** rather than the interior peak; `+C` as a lost physical
baseline rather than bookkeeping; a parity check that is an O(1) guard in front
of an O(N) integration; and a degree that is **undefined** when the equation
is not polynomial in its derivatives.

## What

A 14th pack, `math-xii-calculus-2026` ("Calculus in Anger"), Mathematics
category: 4 concepts, 16 sessions.

1. **`derivative-applications`** (Days 16–18) — related rates through the chain
   rule; monotonicity from the sign of f′; the second-derivative test with its
   first-derivative fallback when f″(c) = 0; and absolute extrema, where the
   endpoints must be compared.
2. **`integration-techniques`** (19–21) — the antiderivative family and what
   `+C` physically is; substitution as the chain rule reversed; partial
   fractions and integration by parts with ILATE.
3. **`definite-integrals-areas`** (22–24) — the two Fundamental Theorems, the
   trapezoidal rule as what software actually does, parity shortcuts on
   symmetric bounds, and area between curves.
4. **`differential-equations`** (25–26) — order, degree and when degree does
   not exist; general versus particular solutions; separable and homogeneous
   first-order equations.

Crown jewels: **"the optimum that wasn't"** (an interior local max reported
while the endpoint wins on [-2, 6]) and **"the navigator that drifted"**
(integration dropped its constant — the lost initial velocity).

## Not in scope

LaTeX rendering (the renderer has no math mode; notation is Unicode).
Chapters 10–13 and the capstone — spec 012.

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (4 concepts / 16 sessions) *(lint:content)*
- [ ] Estimate answers strictly inside their sliders *(content-contract)*
- [ ] Every numeric answer recomputed from its definition, not copied from
      lesson prose *(authoring review — CON-VER-006)*
- [ ] Every session renders and plays *(session-mount, widgets-interaction)*
- [ ] Content reachable over HTTP *(delivery)* · boots *(smoke, e2e)*
