# Spec 005 — Agentic AI Engineering pack

**Status:** agreed (plan approved 2026-08-29 — "the next big thing")
**Constitution check:** Art. VI (content-only, existing kinds), Art. VIII
(no official quiz key → self-check framing; commercial-implication claims
kept to what the labs state).

## Why (the learner's problem)

Ed Donner's 6-week "Master AI Agentic Engineering" is the largest coherent
course in the learning repo and the capstone of the user's agent-engineering
track — yet none of it is revisable. Its core knowledge is framework
*discrimination*: when handoffs beat crews beat graphs beat group chats —
exactly the confusable, decision-shaped material folio exists for. It also
closes the AI wing's arc: SDD → media agents → MCP protocol → **the
framework landscape** (week 6 is MCP-in-practice, cross-linking ai-mcp-2026).

## What (user-visible behavior)

1. An 8th pack, `ai-agentic-engg-2026` (AI category): 6 concepts (one per
   course week), 15 sessions.
2. The agentic system is **buildable**: a blueprint where goal → agent →
   tools → guardrail → output, with forbidden wires `agent → output`
   ("no unguarded autonomy") and `goal → tools` ("tools don't pick
   themselves — an agent decides").
3. Framework discrimination is practiced, not read: a which-framework
   classify (8 scenarios) and a coordination-primitive classify (handoff vs
   crew role vs graph edge vs group chat).
4. A runaway-agent detective (loops, tool spam, cost blowup → missing
   termination/guardrails) and an autonomy decision fork with a meter.
5. Existing packs, engines, whitelists untouched.

## Not in scope

- New sim models/computes; per-project deep dives (deploy steps, API-key
  setup logistics); community_contributions.

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (6 concepts / 15 sessions) *(lint:content)*
- [ ] Blueprint chain passes; both named forbidden wires fail, from shipped
      JSON *(tests/blueprint.test.ts — new case)*
- [ ] Generic content invariants hold *(content-contract tests)*
- [ ] Concept pages boot *(smoke)*
- [ ] Quiz self-check framing, internally consistent *(authoring review)*

## Open questions

None — resolved in plan.md.
