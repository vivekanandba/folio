# Plan 006 — Claude Code pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Content-only. Source: authored notes `course/L0–L8_notes.md` (fetched to
scratchpad). Concept split by practice area, not lesson number: workflow
(L0/L2), features+MCP (L3), testing/debugging (L4), parallel+automation
(L5/L6), beyond-code (L7/L8). Sessions: explainer ×5, classify ×3 (commands,
prompt anatomy, automation mechanisms), sequence ×2 (onboarding, worktrees),
blueprint, detective (L4's engineered bug), quiz.

## Touched surface

- **Create:** `public/content/packs/ai-claude-code-2026/`; blueprint case in
  tests/blueprint.test.ts. **Modify:** catalog.json. **Reuse:** 12 kinds,
  viz, test helpers.

## Engine/data changes

None — no whitelist / exhaustive-Record updates.

## Verification plan

lint:content → blueprint case → npm test (39) → smoke (6/6) → /ship.

## Risks

1. Overlap with the SDD pack's workflow blueprint — differentiated: SDD's is
   artifact-level (constitution→spec→code), this one is session-level
   (plan mode→implement→verify→commit); cross-linked, not duplicated.
2. Product-surface drift (commands change over time) — notes are quoted as
   course-taught practice, not as current CLI reference.
