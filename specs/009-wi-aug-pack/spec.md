# Spec 009 — Wealth Insight August 2026 pack

**Status:** agreed (user: "go ahead and do that too", 2026-09-15)
**Constitution check:** Art. VI (content-only), Art. VIII (magazine
paraphrase; figures from the issue; stock cases framed as analysis lessons,
never recommendations — mirroring the issue's own disclaimer).

## Why (the learner's problem)

The August Wealth Insight is a stock-analysis teaching issue: Arora's
growth-quality lesson (Nvidia vs Coca-Cola), a screening special built on
five frameworks ("not five lists for five personalities"), three valuation
case studies where the obvious multiple misleads (HCG's 400× P/E), and the
survivorship-bias + market-bottoms study. Completes the magazine trio the
user queued (Aug MFI, Sep MFI, Aug WI).

## What (user-visible behavior)

1. A 12th pack, `equity-wi-2026-08` (Finance): 4 concepts, 10 sessions.
2. The HCG case is a **detective**: 400× P/E screams no; depreciation from
   ₹1,700 crore of capex explains why P/E is the wrong lens.
3. The QGV compromise is a **classify** (Castrol = quality without growth;
   HDFC Bank = quality + growth with the honest lesson about the third leg).
4. Survivorship + the four-bottoms method is a detective (1-in-10 clear the
   bar from ordinary corrections; 1-in-3 from 2020 — entry discount, not
   skill).
5. The rupee's 9→96 lifetime is an **estimate** (implied ~5.5%/yr).

## Not in scope

- Stock recommendations (the issue's own framing); scoreboard pages;
  new machines/computes.

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (4 concepts / 10 sessions) *(lint:content)*
- [ ] Estimate answer strictly inside the slider *(content-contract)*
- [ ] Generic invariants hold *(content-contract)* · boots *(smoke)*
- [ ] Quiz self-check framing *(authoring review)*
