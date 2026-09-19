# Plan 010 — Class XII Mathematics pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Source: the 15 lesson notebooks under `math/XII` in `vivekanandba/learning`
(fetched via the git blobs API; markdown cells + the data cells that carry
the worked cases). One concept per CBSE chapter, sessions drawn from the
trap each lesson was built to expose.

| Concept | Days | The trap it teaches |
|---|---|---|
| `relations-functions` | 1–3 | transitivity fails quietly; saturation kills invertibility |
| `inverse-trigonometry` | 4–5 | quadrant blindness; the arctan-sum branch jump |
| `matrices` | 6–8 | order matters (AB ≠ BA); strain vs rigid rotation |
| `determinants` | 9–11 | det = 0 is the solvability boundary |
| `continuity-differentiability` | 12–15 | continuous ⇏ differentiable; the d²y/dx² trap |

Sessions: explainer ×5, classify ×5, detective ×5, estimate ×3, sequence,
blueprint, quiz — 20 total.

## Touched surface

Create `public/content/packs/math-xii-2026/`; register in catalog.json; add
one blueprint case to `tests/blueprint.test.ts`. No engine changes, no new
whitelist entries.

## Verification plan

Recompute every numeric answer from the definition (not from the lesson's
printed output), then lint → npm test (41 with the new blueprint case) →
smoke (6/6) → PR gates → Pages deploy.

## Risks

- **Notation without LaTeX.** Mitigation: Unicode throughout; formulas that
  need structure go in `code` spans. Reviewed by reading the rendered text,
  not the source.
- **Answers copied from prose.** The lessons print their results, which makes
  it tempting to transcribe. Every figure in an estimate or quiz is
  recomputed here independently (CON-VER-006).
