# Blueprint boards

**Code:** `src/sessions/blueprint-rules.ts` (pure graph logic),
`src/sessions/blueprint.ts` (DOM)
**Gates:** `tests/blueprint.test.ts`, `tools/lint/referential.ts`

## Rule semantics

Declarative rules over an undirected graph of placed part-instances:

- `minCount` / `maxCount` — instances of a part type (maxCount 0 = trap part:
  offering it in the tray is the point; placing it must fail).
- `connected a b` — at least one direct edge between the part types.
- `noDirect a b` — no direct edge; offenders are the endpoints of each
  violating wire.
- `pathExists from to` — any path between instances of the types.
- `survivesKill from to` — for EVERY single node not of the endpoint types,
  removing it must leave a from→to path. Offenders are the SPOFs.

## Invariants

1. **Every shipped blueprint is winnable** — its intended solution passes all
   rules, proven from the real session JSON, not a fixture. *(blueprint.test)*
2. **Every designed trap fails** — single-LB SPOF is named, cheat wires are
   refused, trap parts break inspection. *(blueprint.test)*
3. `connectivityAvailability` is the exact subset enumeration
   (guarded ≤ 14 middles): two independent middles at 0.99 → 0.9999; a series
   middle → 0.99. `shortestHops` is BFS depth. *(blueprint.test)*
4. Rules may only reference declared part ids; every session needs parts,
   rules, briefing, debrief. *(linter)*

## Authoring notes

- Debriefs must claim exactly what the rule set proves. A single-kill test
  does NOT force cross-wiring (disjoint chains pass it) — say so honestly.
