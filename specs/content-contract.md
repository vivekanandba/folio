# Content contract

**Code:** `public/content/**`, `tools/lint/referential.ts`
**Gates:** `npm run lint:content`, `tests/content-contract.test.ts`

## Structure

- `catalog.json` lists packs (unique ids, paths resolving to `folio.json`).
- Each pack: `folio.json` (id, title, subject, optional `category` for the
  landing grouping, source line, concepts[], sessions[]) + `concepts/*.md`
  + `sessions/*.json`. Every declared file must exist; files on disk should
  be declared (warn). *(linter)*

## Sessions

- `kind` ∈ `KNOWN_KINDS` (12). Per-kind field checks live in the linter
  next to each kind (answer indices in range, buckets exist, decision graphs
  reachable with ≥1 ending, estimates inside their sliders, lab goals typed,
  blueprint rules referencing declared parts…).
- Narrative fields (intro/debrief/briefing/explanations) are markdown and
  may embed ```viz fences — every fence must parse and reference known
  widget types / computes / sim models. *(linter)*

## Whitelists — the sync law

The linter's `KNOWN_KINDS`, `SIM_MODELS`, `COMPUTES` are hand-copied
whitelists. **They must equal the live registries** (`src/sim/models.ts`,
`src/computes.ts`) — drift is a test failure, not a code review hope.
*(content-contract.test: set equality both ways)*

## Machines in content

- Every lab's goal metrics must exist on its machine (a knob key or a scalar
  the model actually produces when run). *(content-contract.test — runs the
  real model against the real JSON)*
- Lab starting params must be declared knobs within their min/max.
  *(content-contract.test)*
- Every shipped blueprint must be winnable and its traps must fail.
  *(tests/blueprint.test.ts, from the real JSON)*

## Framing

- Packs derived from courses/publications carry a "personal study notes,
  paraphrased, not affiliated" source line; no third-party assets are
  committed.
