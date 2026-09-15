# Plan 009 — WI August 2026 pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Source: extracted issue text (scratchpad wi-08-clean.txt). Concepts:
growth-quality (Arora: kind/durability/priced-in), valuation-lenses
(HCG/BoB/NSE — the right multiple per business), monday-screens (the five
frameworks + the QGV triple), investor-wisdom (decumulation, survivorship +
four bottoms, rupee 9→96). Sessions: explainer ×4, classify ×2, detective
×2, estimate (rupee CAGR via the impliedCagr closed form), quiz.

## Touched surface

Create pack dir; modify catalog.json. No engine changes.

## Verification plan

lint → npm test (40) → smoke (6/6) → /ship linking this spec.

## Risks

Numbers from lossy extraction — each figure verified against its
surrounding sentence (Nvidia 60–70% vs Coke 6–7%; HCG ROCE 12%, ₹1,700cr
capex; BoB 0.9× book, RoA >1%, RoE mid-teens; bottoms: 100× from 2009 =
31%/yr … 10× from 2020 = 47%/yr; 1-in-10 vs 1-in-3; rupee ₹9 → ₹96).
