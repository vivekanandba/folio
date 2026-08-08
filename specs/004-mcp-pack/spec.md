# Spec 004 — MCP pack (Build Rich-Context AI Apps with Anthropic)

**Status:** agreed (user picked the course; plan approved 2026-08-08)
**Constitution check:** Art. VI (content-only; existing kinds; no engine
changes), Art. VIII (no official quiz key → self-check framing; debriefs
claim only what the course teaches). New sourcing precedent: L1/L2/L10 are
slide-image decks transcribed **via vision** at build time — same fidelity
bar as text.

## Why (the learner's problem)

The user completed the DLAI × Anthropic MCP course (certificate on file) but
left no revision digests — and MCP is now load-bearing knowledge for them
(the SDD pack names it as one of the four agent-agnostic standards; their
daily tooling runs on it). The confusable core — host vs client vs server,
tools vs resources vs prompts, stdio vs SSE vs streamable HTTP — is exactly
what spaced repetition holds onto.

## What (user-visible behavior)

1. A 7th pack, `ai-mcp-2026` (AI category): 5 concepts, 13 sessions, from
   the course notebooks (L3–L7, L9 markdown; L1/L2/L10 slide transcription)
   grounded in the working `mcp_project/` code.
2. The ecosystem is **buildable**: a blueprint wiring host → client →
   server → tool → data, with forbidden wires named after the course's
   own arguments (`host → data`: "the M×N problem MCP exists to kill";
   `client → tool`: "clients speak protocol to servers, never to tools").
3. The primitives triple (tools / resources / prompts — who controls each)
   gets a dedicated classify; roles and transports get their own.
4. A detective diagnoses the classic multi-server failure: the new server's
   tools are invisible because it was never registered in
   `server_config.json`.
5. Existing packs, engines, whitelists untouched.

## Not in scope

- New sim models/computes; the sampling/roots-of-MCP papers in `papers/`.
- Claude Desktop step-by-step setup (environment-specific; one mention).

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (5 concepts / 13 sessions) *(gate: lint:content)*
- [ ] Blueprint: chain passes; both named forbidden wires fail — from the
      shipped JSON *(gate: tests/blueprint.test.ts — new case)*
- [ ] Quiz framed as self-checks; answers consistent with authored
      explanations *(gate: authoring review; linter answerIndex bounds)*
- [ ] Generic content invariants hold *(gate: content-contract tests)*
- [ ] Concept pages boot *(gate: smoke — engine path covered)*

## Open questions

None — resolved in plan.md.
