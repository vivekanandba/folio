# Simulation machines

**Code:** `src/sim/models.ts` (pure), `src/sim/engine.ts` (DOM)
**Gates:** `tests/sim-models.test.ts`, `tests/content-contract.test.ts`, smoke

## Trust model

- Content JSON selects a model **by id** from the `SIM_MODELS` registry and
  sets numeric knobs. No eval, no arbitrary code path. *(content-contract:
  linter whitelist ≡ registry keys)*
- Models are pure: `init(params) → state`, `step(state, params, dt)` mutates
  state only. No DOM imports, so they run under plain node. *(sim-models
  imports them directly)*

## Invariants

1. Every model survives a 60-sim-second run with **finite readout scalars**
   and populated series. *(sim-models: "every model survives")*
2. `queue`: p99 ≈ service time below capacity; queue and p99 diverge past
   `servers × 1000/serviceMs`. The knee must be real, not decorative.
3. `failover`: observed availability converges to MTBF/(MTBF+MTTR); design
   nines are the exact analytic `1 − u^n`. Kill-a-node must never crash on an
   empty fleet.
4. `compound`: gross curve within 3% of the closed-form SIP future value;
   fee drag strictly reduces the corpus.
5. `retention`: recall decays as `exp(−t/S)`; the review action strictly
   grows stability.
6. **Time scale:** the engine seeds ~3 sim-seconds of history on mount — a
   model's teachable window must survive that (e.g. sipVsLump runs at 1s ≈ 3
   months for this reason). *(convention; enforced by authoring review)*

## Engine loop (DOM — covered by smoke, not unit tests)

- Fixed-timestep accumulator under rAF; pauses when hidden/off-screen;
  `everConnected` latch so pre-attach mounts don't self-destroy.
- Reduced motion: starts **paused** with a prominent Step button — identical
  information, opt-in motion. Knobs re-tick while paused.
