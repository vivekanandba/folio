# Spec NNN — <feature name>

> Copy this folder to `specs/NNN-<slug>/` when starting a feature. The spec
> says WHAT and WHY — no file paths, no implementation. It is reviewed in the
> same PR as the code (or earlier, as a spec-only PR for big features).

**Status:** draft | agreed | shipped (PR #…) | superseded
**Constitution check:** list any article this feature strains, and how it complies.

## Why (the learner's problem)

One paragraph. What can't the learner do today, or what do they get wrong?
What evidence do we have (a bug, a complaint, a gap in the packs)?

## What (user-visible behavior)

Numbered, testable statements about behavior — not architecture.

1. When the learner …, folio …
2. …

## Not in scope

The tempting adjacent things this feature deliberately excludes, with a word
on why (keeps review honest and the diff small).

## Acceptance criteria — each line names its gate

A criterion without a gate is a wish (specs/README.md). Choose from:
`tests/*.test.ts` (logic), linter (content), smoke (boot/layout),
`contrast.py` (color), or a named manual check with a screenshot.

- [ ] … *(gate: tests/…)*
- [ ] … *(gate: smoke — route …)*

## Open questions

Things the plan must resolve, or decisions deferred to the user.
