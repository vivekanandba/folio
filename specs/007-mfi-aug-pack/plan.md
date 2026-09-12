# Plan 007 — MFI August 2026 pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Source: the issue's extracted text (scratchpad mfi-08-clean.txt, reviewed
with the user on 2026-08-23). Concepts: sif-funds, lifecycle-funds,
bond-timing, market-discipline. Engine: one new sim model `glidepath`
(clock 1s ≈ 1yr; linear equity glide start→end over targetYears; equity
12%/yr ± noise vs debt 6.5%; monthly SIP; crash action −30% on the equity
sleeve). Sessions: explainer ×3 (SIF, lifecycle+sim, discipline),
classify ×2 (SIF vs MF vs PMS/AIF; lifecycle vs NPS), detective ×2 (SIF
upgrade?, bond timing), lab (late crash), decision (gold drift), quiz.

## Touched surface

- **Create:** pack dir; glidepath model in `src/sim/models.ts`; test cases
  in `tests/sim-models.test.ts`. **Modify:** catalog.json; linter
  SIM_MODELS whitelist (`tools/lint/referential.ts`); `specs/engine-sim.md`
  (new invariant). **Reuse:** engine, kinds, gates.

## Engine/data changes

`glidepath` sim model + linter whitelist entry — parity enforced by the
existing content-contract test. No new kinds/computes; no exhaustive-Record
updates (KIND_WEIGHT untouched).

## Verification plan

Model analytic tests offline → lint → npm test (expect 40+) → smoke →
/ship linking this spec.

## Risks

1. Sim time scale: engine seeds ~3 sim-seconds — at 1s≈1yr a 25-year glide
   shows 3 years pre-seeded; acceptable (window survives).
2. Honest returns: fixed drift + noise, clearly framed as illustrative.
