# Plan 005 — Agentic AI Engineering pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Content-only. Sources: all 21 lab notebooks (markdown + code cells,
text-sized — no vision needed), README, `3_crew/stock_picker` YAML configs,
`6_mcp/accounts_server.py`. Concept-per-week; sessions lean on classify
(framework + coordination discrimination), blueprint (guarded autonomy),
sequence ×2 (agentic loop; crew build), detective (runaway agent), decision
(autonomy ladder, meter), quiz (self-check).

## Touched surface

- **Create:** `public/content/packs/ai-agentic-engg-2026/` (folio.json,
  6 concepts, 15 sessions); blueprint case in tests/blueprint.test.ts.
- **Modify:** catalog.json. **Reuse:** 12 kinds, viz, test helpers.

## Engine/data changes

None — no whitelist / exhaustive-Record updates.

## Verification plan

lint:content → blueprint case (chain N/N; agent→output and goal→tools fail)
→ npm test (38) → smoke (6/6) → /ship linking this spec.

## Risks

1. Framework claims must be defensible from the labs (e.g. AutoGen Core
   "positioned similarly to LangGraph" is the course's own phrasing).
2. Foundations md is logistics-heavy — patterns taken from code + the
   lab's own exercise/commercial notes (parallel + evaluator/picker).
