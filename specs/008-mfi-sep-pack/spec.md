# Spec 008 — Mutual Fund Insight September 2026 pack

**Status:** agreed (user: "and September also, one after another", 2026-09-12)
**Constitution check:** Art. VI (content-only — no engine changes this
time), Art. VIII (magazine paraphrase; figures from the issue).

## Why (the learner's problem)

The September issue is a discipline-heavy number: a reader-stories special
(the almost-paused SIP, the liquidity gap, step-up habits), the "four checks"
review discipline, a flat flexi-cap year + small-cap slump + the IT-selloff
anatomy, and retirement-corpus arithmetic (25×, promised-away money,
inflation). Continues the monthly Finance-hall cadence after specs/007.

## What (user-visible behavior)

1. An 11th pack, `finance-mfi-2026-09` (Finance): 4 concepts, 10 sessions.
2. The reader-story wisdom is a **decision fork** (the first-crash SIP
   pause) with a meter; review discipline is a signal-vs-noise classify.
3. The IT selloff's subtle finding (AUM-weighted IT weight sat ABOVE the
   median all the way down — the biggest funds held on more) is a detective.
4. Two **estimates with computed answers**: the small-cap 3-year shock
   (5.5%/yr — below liquid funds) and the 25× corpus rule (₹54L/yr →
   ₹13.5 crore).

## Not in scope

- Fund-manager interview specifics beyond quoted discipline principles;
  scoreboard pages; new machines/computes.

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (4 concepts / 10 sessions) *(lint:content)*
- [ ] Estimate answers sit strictly inside their sliders *(content-contract)*
- [ ] Generic invariants hold *(content-contract)*
- [ ] Concept pages boot *(smoke)*
- [ ] Quiz self-check framing, consistent with explanations *(authoring review)*
