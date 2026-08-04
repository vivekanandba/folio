# Drill generators & the daily gauntlet

**Code:** `src/gauntlet/generators.ts` (pure), `src/gauntlet/drill.ts` +
`src/pages/review.ts` (DOM)
**Gates:** `tests/generators.test.ts`, `tests/srs.test.ts`

## Generators

1. **Deterministic:** `dailyDrill(pack, concept, date)` is a pure function of
   its arguments — same drill on every device, fresh tomorrow. Seed =
   `mulberry32(fnv1a("pack::concept::date"))`. *(generators.test)*
2. **Ground truth:** every answer comes from `COMPUTES` or a closed form
   stated in the debrief — never hand-typed constants. *(computes.test pins
   COMPUTES themselves)*
3. **Sane sliders:** answer strictly inside `(min, max)`, never pinned above
   99.5% of the range; tolerance ∈ (0, 1]; prompts/debriefs substantial.
   Sweep: 28 days × all concepts. *(generators.test)*
4. **Variety:** ≥ 4 distinct prompts per concept over 30 days. *(generators.test)*
5. **Coverage:** at least one drillable concept per pack; unknown concepts
   return null and the gauntlet degrades to flashcards. *(generators.test)*
6. New templates must curate parameter combos so answers stay on-scale
   (the 16×-in-5-years → 74% CAGR lesson).

## The daily gauntlet (review loop)

- Per due concept: flashcards (5 when a drill follows, 8 otherwise), then
  today's drill. Final SRS grade = `0.6 × self-graded recall + 0.4 × drill`
  (objective performance tempers self-assessment). No cards → drill on a
  0.75 neutral prior; no drill → cards alone.
- Drill scoring: 1 within tolerance, 0.4 within 2.5× tolerance, else 0.
- The queue arrives **already pack-interleaved** from `buildToday` — do not
  re-interleave in the page. *(srs.test pins buildToday's interleave + caps)*
