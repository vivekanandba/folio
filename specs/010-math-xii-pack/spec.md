# Spec 010 — Class XII Mathematics pack

**Status:** agreed (user: "Go ahead and do the XII maths", 2026-09-19, after a
full-repo survey established `math/XII` as the richest unconverted source)
**Constitution check:** Art. VI (content-only), Art. VIII (personal study
notes; every claim traceable to a lesson notebook that verified it in code).

## Why (the learner's problem)

The `math/XII` project in the learning repo holds 15 authored "Day N"
micro-sprint lessons covering CBSE chapters 1–5 — the only unconverted
source in the repo that meets the digest bar, and the densest: each lesson
states the theorem, verifies it in NumPy/SymPy, and maps it onto three
engineering domains (aerospace, electronics, computing). That material is
written to be *revised*, not re-read, and folio has no Mathematics wing.

The revision value is not "can you recall the formula". It is the set of
traps the lessons were built around: a relation that looks like an
equivalence until transitivity fails; `atan⁻¹` that points fire control
180° the wrong way; `AB ≠ BA`; `det = 0` as the boundary between a solvable
and an unsolvable network; continuity that does **not** imply
differentiability; and the parametric second-derivative formula that is
wrong even in sign.

## What (user-visible behavior)

1. A 13th pack, `math-xii-2026` — folio's first **Mathematics** category:
   5 concepts (one per CBSE chapter), 20 sessions.
2. Chapter 1 ends in a **detective**: the saturating hydraulic ram whose
   telemetry cannot be reconstructed — invertibility lost to a lost
   injection, not to a broken sensor.
3. Chapter 2's quadrant ambiguity is a **detective** (naive `atan(y/x)`
   returns 45° for targets 180° apart) and the arctan-sum branch is an
   **estimate** where the naive formula gives a negative answer.
4. Chapter 3 carries a **classify** on the Identity ⊂ Scalar ⊂ Diagonal ⊂
   Square hierarchy (most-specific class wins) and a strain-vs-rotation
   **detective** resolved by the symmetric/skew decomposition.
5. Chapter 4 gives the adjoint→inverse→solve **sequence** and a **classify**
   of the three consistency regimes via det and (adj A)B.
6. Chapter 5 supplies the continuity **classify** (continuous / jump /
   removable) and the parametric second-derivative **detective**.
7. A **blueprint** — "wire a recoverable measurement chain" — where the two
   ways invertibility dies are the two designed failures: a periodic sensor
   read without domain restriction, and a saturating stage anywhere in the
   chain.

## Not in scope

- LaTeX rendering. The repo's markdown renderer has no math mode, so all
  notation is written in Unicode (`sin⁻¹`, `θ`, `≠`, `∘`, `Δ`, `A ᵀ`).
  Introducing a math renderer would be an engine change and its own spec.
- New sim models, computes, or session kinds — content only.
- Chapters 6–13 (the lessons stop at Day 15).

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (5 concepts / 20 sessions) *(lint:content)*
- [ ] Blueprint is winnable; both designed traps fail *(blueprint.test.ts)*
- [ ] Estimate answers strictly inside their sliders *(content-contract)*
- [ ] Every numeric answer recomputed independently, not copied from prose
      *(authoring review — CON-VER-006)*
- [ ] Generic invariants hold *(content-contract)* · boots *(smoke)*
