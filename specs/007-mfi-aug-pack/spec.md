# Spec 007 — Mutual Fund Insight August 2026 pack

**Status:** agreed (user: "go ahead with August MFI… and September also",
2026-09-12; highlights reviewed with the user 2026-08-23)
**Constitution check:** Art. III — this pack includes an **engine change**
(new `glidepath` sim model), so the model lands with its analytic tests and
an engine-sim.md invariant update in the same PR. Art. VI (whitelist parity
enforced by the existing content-contract test). Art. VIII (magazine
paraphrase framing; no fabricated data — figures from the issue).

## Why (the learner's problem)

The August issue covers two genuinely new product categories (SIFs one year
in; India's first life-cycle funds) plus evergreen discipline pieces (bond-
timing evidence, the gold-rebalance drift, panic statistics). The July issue
is already a pack; monthly continuation keeps the Finance hall current.

## What (user-visible behavior)

1. A 10th pack, `finance-mfi-2026-08` (Finance): 4 concepts, 10 sessions.
2. **The glide path is a machine**: a new whitelisted `glidepath` sim model
   (equity share sliding toward the target year; crash action) embedded in
   the life-cycle concept, plus a lab ("survive a late crash").
3. SIF discrimination is practiced (MF vs SIF vs PMS/AIF) and the cover
   story's finding — the shorting freedom barely used, only one fund
   protecting in Mar–Apr 2026 — is a detective.
4. Bond-timing evidence (duration rose after yields fell) is a detective;
   the gold drift is a decision fork with a meter.

## Not in scope

- Scoreboard/data pages; fund-specific recommendations; ITR mechanics.

## Acceptance criteria — each line names its gate

- [ ] `glidepath` model: equity% interpolates exactly on the glide; corpus
      grows; a crash's damage scales with current equity share
      *(gate: tests/sim-models.test.ts — new cases)*
- [ ] Whitelist parity holds after adding the model
      *(gate: content-contract parity test)*
- [ ] Lab goals reference metrics the model produces *(content-contract)*
- [ ] Pack registers cleanly (4 concepts / 10 sessions) *(lint:content)*
- [ ] Concept pages boot *(smoke)*
- [ ] engine-sim.md gains the glidepath invariant *(this PR's diff)*
