# Plan 011 — Calculus pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Source: Days 16–26 extracted from `_sync-staging` (scratchpad `math-new/`).
One concept per teaching cluster rather than per chapter — chapter 8 is a
single lesson, so area-between-curves joins the definite-integral concept
where it belongs.

Sessions: explainer ×4, classify ×3, detective ×3, estimate ×3, sequence ×2,
quiz. All twelve kinds are not needed here; the kinds chosen are the ones the
material argues for.

## Touched surface

Create `specs/011-math-calculus-pack/`, the pack directory; modify
`public/content/catalog.json`. **No engine changes** — no new kinds, models or
computes, so no whitelist edits.

## Verification plan

Recompute every figure first (done: ∫₀⁴(-x²+4x)dx = 32/3; the parabola/line
area = 9/2; the box maximum at x = S/6 = 5 cm giving 2000 cm³; the cubic's
absolute max at the endpoint x = 6 giving 69 against the local max of 20;
trapezoid error quartering as N doubles). Then lint → test:gate → smoke → e2e
→ coverage:gate, each on its exit code.

## Risks

- **Notation without LaTeX.** Unicode throughout (∫, Δ, →, ⁿ, ₀); formulas
  that need structure go in code spans. Verified by reading the rendered page,
  not the source.
- **Numbers copied from prose.** The lessons print their results. Every figure
  used here was recomputed independently first.
