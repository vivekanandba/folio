# Plan 012 — Vectors, Space & Uncertainty

**Spec:** ./spec.md  **Status:** executed

## Approach

Source: Days 27–33 (scratchpad `math-new/`). Five concepts, 16 sessions:
explainer ×5, classify ×3, detective ×3, estimate ×3, blueprint, quiz.

The capstone becomes a **blueprint** rather than prose because its own claim —
"the output of one mathematical structure becomes the input boundary condition
of the next" — is a wiring statement. Forbidden wires: acting on a prior
without fusing the observation, and committing an allocation without the
physics check.

## Touched surface

Create the spec dir and pack; modify `catalog.json`; add one blueprint case to
`tests/blueprint.test.ts`. No engine changes.

## Verification plan

Figures recomputed first (done): LP optimum at (16, 12) giving Z = 1080;
skew distance 1/√2 ≈ 0.7071; |(3, -4, 12)| = 13 so direction cosines are
thirteenths; a 1% prior with 95% sensitivity and 5% false-positive rate giving
a posterior of 16.1%. The lesson's factory example (P(B|defect) ≈ 0.44) is
**not** used — its priors could not be reproduced from the extract, and an
unverifiable figure does not go in.

Then lint → test:gate → smoke → e2e → coverage:gate.

## Risks

Unicode notation for vectors (î, ĵ, k̂, ×, ·, →) — verified rendered.
