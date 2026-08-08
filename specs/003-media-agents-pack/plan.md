# Plan 003 — AI media agents pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Content-only pack (rejected: a "generation-quality sim" — quality/latency/
cost trade-offs don't reduce to honest closed-form state). Concept pairing
follows the course's own halves: map → prompting → evaluation → agents →
agents-building-agents. Session kinds chosen by knowledge shape: classify for
the confusable formulas/evaluators, sequence for the funnel, blueprint for
the image agent's architecture, detective for the failure-type retry logic,
quiz as an honest self-check (no official key exists — Art. VIII framing).

## Touched surface

- **Create:** `public/content/packs/ai-media-agents-2026/` (folio.json,
  5 concepts, 12 sessions); one blueprint case in `tests/blueprint.test.ts`.
- **Modify:** `public/content/catalog.json`.
- **Reuse:** existing kinds + annotated viz; zero engine code.

## Engine/data changes

None. No whitelist / exhaustive-Record updates required.

## Verification plan

lint:content → blueprint case (pipeline passes; unevaluated-output and
ungrounded-generation wires fail) → npm test → npm run smoke → /ship linking
this spec.

## Risks

1. **Formula confusion between image (L2) and video (L3) prompts** — handled
   by giving each its own viz and a classify that mixes them deliberately.
2. **Quiz authority** — no answer key exists; intro must say the questions
   are self-checks from the notes (spec criterion, Art. VIII).
