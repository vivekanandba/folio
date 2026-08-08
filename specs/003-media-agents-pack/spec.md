# Spec 003 — AI media agents pack

**Status:** agreed (user: "go ahead", 2026-08-08 — the last note-ready course
in the pipeline)
**Constitution check:** Art. VI (content-only, existing kinds, no engine
changes), Art. VIII (no official quiz answer key exists for this course — the
self-check quiz is framed as written from the notes, not as the graded quiz).

## Why (the learner's problem)

The user completed *AI Agents for Image and Video Generation* (Google ×
DeepLearning.AI; 10 authored lesson notebooks). Its knowledge is exactly the
kind that fades: two prompt formulas with overlapping dimensions, four
evaluation approaches with distinct trade-offs, two agent architectures whose
loops differ in one crucial detail (failure-type-targeted retries). Nothing
in folio covers it, and the AI category should carry the user's whole
agent-engineering track.

## What (user-visible behavior)

1. A 6th pack, `ai-media-agents-2026` (AI category): 5 concepts, 12 sessions.
2. The image agent's architecture is **buildable**: a blueprint where a
   request must flow through brand analysis and concepts before generation,
   and **nothing ships unevaluated** (generate → output directly is a
   forbidden wire).
3. The video agent's smartest trick — retrying by failure type (audio →
   regenerate video only; visual → regenerate both) — is a detective case.
4. The evaluation funnel (auto-score → LLM/rubric → human) is orderable, and
   choosing the right evaluator for a scenario is a sorting bench.
5. Existing packs, engines, and whitelists untouched.

## Not in scope

- New sim models/computes (no honest numeric machine in this material).
- Course assets (images, notebooks, videos) — notes-paraphrase only.
- Spec 001 (data-storage machines) — still blocked on sysarch §6 notes.

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (catalog + folio.json + 5 concepts + 12
      sessions) *(gate: `npm run lint:content`)*
- [ ] Media-agent blueprint: intended pipeline passes; generate→output and
      request→generate shortcut wires fail, from the shipped JSON
      *(gate: tests/blueprint.test.ts — new case)*
- [ ] Generic invariants hold (no labs/estimates shipped → trivially)
      *(gate: content-contract tests)*
- [ ] Concept pages boot *(gate: smoke — existing concept-route checks cover
      the engine path; no new route needed)*

## Open questions

None — resolved in plan.md.
