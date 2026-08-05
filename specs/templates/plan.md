# Plan NNN — <feature name>

> The HOW for an agreed spec. Written after spec.md, before code. Keep it
> scannable: an implementer (human or agent) should be able to execute it
> without re-deriving decisions.

**Spec:** ./spec.md  **Status:** draft | agreed | executed

## Approach

A few sentences: the shape of the solution and the one or two alternatives
rejected (with the reason — one line each).

## Touched surface

- **Create:** …
- **Modify:** … (keep selectors/exports stable where possible)
- **Reuse:** existing modules/utilities this must build on instead of duplicating

## Engine/data changes

New types, registry entries, schema fields. For each: the whitelist(s) and
exhaustive `Record`s that must be updated in the same PR (linter KNOWN_KINDS /
SIM_MODELS / COMPUTES, srs KIND_WEIGHT — see specs/content-contract.md).

## Verification plan

How each acceptance criterion's gate gets satisfied, plus:
- new tests to write (file + what they pin)
- spec invariants to add/update in specs/*.md
- offline checks (`npm test`, `npm run smoke`, syntax, contrast) and what CI adds

## Risks

Top 2–3, each with its mitigation or kill-switch.
