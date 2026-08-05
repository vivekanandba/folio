# Spec 001 — Data-storage machines (sysarch §6)

**Status:** draft — blocked on source notes (`learning` repo: sysarch §5–10
lesson.ipynb files are empty skeletons; the user fills notes first, per the
pack pipeline). The spec exists ahead of the notes so the feature starts
spec-first when unblocked.
**Constitution check:** Art. I (machines hand-written, no deps), Art. III
(each model lands with analytic tests), Art. VI (models whitelisted; content
stays data), Art. VIII (debriefs claim only what the sim proves).

## Why (the learner's problem)

The Software Architecture pack teaches §1–4 with live machines, but the
course's hardest intuitions are in data storage at global scale (§6):
replication lag, quorum arithmetic, and the read/write availability
trade-off are exactly the kind of dynamics that reading cannot convey and a
touchable system can. Today the pack simply stops before them.

## What (user-visible behavior)

1. A learner on the (new) data-storage concept page can run a **replication
   machine**: write to a leader, watch followers lag, kill the leader, and
   see stale reads happen (or not) depending on their read-consistency knob.
2. A **quorum machine** lets the learner set N/R/W and immediately see
   whether reads are consistent (R+W > N), plus the write/read availability
   consequence of their choice when nodes die.
3. At least one **lab** sets a goal state expressible in those scalars
   (e.g. "survive one node kill with zero stale reads, N ≤ 5").
4. At least one **blueprint** exercises topology intuition (e.g. leader,
   followers, and a client that must never read stale during failover).
5. Existing packs/machines are untouched.

## Not in scope

- §5, §7–§10 content (each gets its own spec when its notes exist).
- Multi-region latency modelling (a later machine; keep quorum math clean).
- Any change to the SRS/gauntlet engines.

## Acceptance criteria — each line names its gate

- [ ] Quorum model: consistency flag ≡ (R+W > N) for all N ≤ 9 combinations;
      availability under k failures matches closed-form C(N,k) arithmetic
      *(gate: tests/sim-models.test.ts)*
- [ ] Replication model: follower lag is finite and monotone in the lag knob;
      leader kill triggers promotion within the stated window
      *(gate: tests/sim-models.test.ts)*
- [ ] Lab goals reference only metrics the models produce
      *(gate: tests/content-contract.test.ts — already generic)*
- [ ] Blueprint solution + traps proven from the shipped JSON
      *(gate: tests/blueprint.test.ts)*
- [ ] New models registered in linter whitelist ≡ registry
      *(gate: tests/content-contract.test.ts parity)*
- [ ] Concept page boots with machines mounted
      *(gate: smoke — new route added to CHECKS)*
- [ ] Drill templates for the new concept (quorum arithmetic is ideal
      generator material) *(gate: tests/generators.test.ts sweep)*

## Open questions

- One combined concept (replication+quorum) or two? Depends on the user's
  notes structure — decide in plan.md.
- Does the quorum machine need a partition (split-brain) action button in v1,
  or is kill-node enough? Lean: kill-node only; partitions are §7 territory.
