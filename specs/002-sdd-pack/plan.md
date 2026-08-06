# Plan 002 — Spec-Driven Development pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Pure content pack on the existing engine (rejected: adding a "workflow sim"
machine — process dynamics don't reduce to honest numeric state; a blueprint
models the structure better). Concepts follow the house style (key callout →
deep dive → annotated viz → collapsible → cross-links). Sessions lean on the
kinds that fit process knowledge: blueprint (structure), classify
(the confusable doc triples), sequence (the feature phase), detective
(drift), decision (replanning), quiz (official answer key), explainers.

## Touched surface

- **Create:** `public/content/packs/ai-sdd-2026/` (folio.json, 5 concepts,
  13 sessions); blueprint solvability cases in `tests/blueprint.test.ts`;
  smoke route for one concept page.
- **Modify:** `public/content/catalog.json` (register pack).
- **Reuse:** all 12 kinds, annotated viz, richBlock fences — zero engine code.

## Engine/data changes

None. No whitelist or exhaustive-Record updates needed (no new kind/model/
compute). This is the checklist saying so explicitly.

## Verification plan

`npm run lint:content` (pack integrity) → new blueprint test cases (solution
6/6, vibe-wire fails, from real JSON) → `npm test` → smoke CHECKS gains
`#/pack/ai-sdd-2026/concept/feature-cycle` → `npm run smoke` → /ship with
gate + smoke on the PR.

## Risks

1. **Answer-key fidelity** — quiz transcription errors teach wrong answers.
   Mitigation: answers copied from quiz.md verbatim; explanations kept.
2. **Blueprint unsolvable/trivial** — mitigation: engine-tested like the
   other four (test written against the shipped JSON, not a copy).
