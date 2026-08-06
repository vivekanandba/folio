# Spec 002 — Spec-Driven Development pack

**Status:** agreed (user: "go ahead and do the full follow-up", 2026-08-06)
**Constitution check:** Art. VI (content is data — reuses the 12 existing
kinds, no engine changes), Art. VIII (quiz answers transcribed from the
course's official key; debriefs claim only what the course teaches). No
articles strained.

## Why (the learner's problem)

The user completed *Spec-Driven Development with Coding Agents* (JetBrains ×
DeepLearning.AI) with authored revision notes for all 14 lessons + the graded
quiz — and then adopted the methodology in this very repo. Nothing in folio
lets them revise it: the concepts (constitution vs feature specs, the feature
cycle, replanning, agent-agnostic workflows) are exactly the confusable,
process-shaped knowledge spaced repetition is for — the course's own quiz
flags mission/tech-stack/roadmap vs plan/requirements/validation as the trap.

## What (user-visible behavior)

1. A fourth AI-category pack, `ai-sdd-2026`, appears in the catalog: 5
   concepts, 13 sessions, built only from the user's own paraphrased notes.
2. The SDD workflow is **buildable, not just readable**: a blueprint where
   intent must flow through constitution → feature spec → implement →
   validate, and wiring intent straight to implementation ("vibe coding")
   fails inspection.
3. The quiz's known confusion (constitution docs vs feature-spec docs) gets
   a dedicated classify session; the graded quiz is replayable with the
   official explanations.
4. A detective session diagnoses **drift** (hand-edits desyncing specs from
   code) from evidence-weighted clues; a decision session walks the
   replanning fork ("run slow to run fast").
5. Existing packs, engines, and whitelists are untouched.

## Not in scope

- New sim models or computes (process course — no natural numeric machine;
  the gauntlet covers this pack via flashcards, drills come later if a good
  numeric angle emerges).
- The image/video-gen course (own spec when picked up).
- Course assets (slides, videos, xlsx) — notes-paraphrase only.

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly: catalog + folio.json + 5 concepts + 13 sessions
      *(gate: `npm run lint:content`)*
- [ ] Blueprint solution passes and the vibe-coding wire fails, proven from
      the shipped JSON *(gate: tests/blueprint.test.ts — new cases)*
- [ ] Quiz answer indices match the course answer key; explanations preserved
      *(gate: linter answerIndex checks + authoring review against quiz.md)*
- [ ] Concept pages boot with their figures *(gate: smoke — new route)*
- [ ] All estimate/lab/goal invariants trivially hold (none shipped)
      *(gate: content-contract tests, generic)*

## Open questions

None — resolved in plan.md.
