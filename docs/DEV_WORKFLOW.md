# Development workflow — SDD + TDD

## Red → green (every PR)

1. Write or update the **spec** (`specs/…`) and **schema** if the contract changes.
2. Add **failing tests** that reference the acceptance scenario (`specs/KIND_x.md#scenario-id`).
3. **Implement** until green.
4. Run `npm test` and `npm run validate` on the real packs.
5. PR checklist: spec link, test file link, not chrome-only.

If implementation wants behavior not in the spec → **update spec first**, then tests, then code.

## Bind rules

- Schema is law for content. Types that disagree with `schemas/` fail contract tests.
- Win conditions live in pure functions under `src/scoring/` — mounts call those; tests import the same functions.
- Kind mounts must not invent scoring rules in UI code.
- Content PRs must pass `npm run test:contract`.
- No merge to `main` if `npm test` is red (enforced in GitHub Actions before Pages deploy).

## Commands

```bash
npm test              # unit + contract + kind logic
npm run test:contract # validate packs + negative fixtures
npm run validate      # validate-content against public/content
npm run build         # validate + tsc + vite build
```
