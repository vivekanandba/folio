# Spec 006 — Claude Code pack

**Status:** agreed (user: "let's do the claude code one", 2026-09-12)
**Constitution check:** Art. VI (content-only), Art. VIII (no official quiz
key → self-check framing; claims grounded in the course notes L0–L8).

## Why (the learner's problem)

The DLAI course "Claude Code: A Highly Agentic Coding Assistant" is the
best-sourced remaining candidate (authored notes, ~57KB) — and its knowledge
is the user's daily practice: CLAUDE.md memory, context management, plan
mode, tests-first debugging, worktrees, hooks, MCP-assisted verification.
It's also meta: folio itself is built with these exact techniques, and the
pack cross-links to the SDD pack (same discipline, different altitude).

## What (user-visible behavior)

1. A 9th pack, `ai-claude-code-2026` (AI category): 5 concepts, 13 sessions.
2. The agentic-coding workflow is **buildable**: blueprint task → plan →
   implement → verify → commit; forbidden wires `implement → commit`
   ("nothing lands unverified") and `task → implement` ("plan before code
   on a real codebase").
3. The command surface is practiced: a which-command classify (/init, #,
   /clear vs /compact, @, !, plan mode) and an automation-mechanism
   classify (hooks vs slash commands vs @claude vs MCP).
4. Tests-first debugging is a detective (the MAX_RESULTS=0 case from L4).
5. Existing packs/engine/whitelists untouched.

## Not in scope

- Install/OS setup logistics (L1 beyond one mention); Figma seat pricing;
  new sim models/computes.

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (5 concepts / 13 sessions) *(lint:content)*
- [ ] Blueprint chain passes; both forbidden wires fail, from shipped JSON
      *(tests/blueprint.test.ts — new case)*
- [ ] Generic invariants hold *(content-contract tests)*
- [ ] Concept pages boot *(smoke)*
- [ ] Quiz self-check framing, internally consistent *(authoring review)*
