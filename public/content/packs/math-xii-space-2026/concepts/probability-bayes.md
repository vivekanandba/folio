# Probability and Bayes — why strong evidence against a rare thing still isn't proof

> A 95%-accurate test for a 1-in-100 condition, returning positive, leaves you at about one in six. The arithmetic is not controversial; the intuition is just wrong.

> [!key] **Conditional probability** `P(E|F) = P(E ∩ F)/P(F)` literally shrinks the sample space to F and re-measures inside it. **Independence** means the product rule holds exactly: `P(E ∩ F) = P(E)·P(F)`. **Bayes' theorem** is prior × likelihood, normalised by the total probability of the evidence — and the normalisation is where base rates do their work.

## Conditioning is re-measuring in a smaller room

Roll two dice. The probability of a total of 8 is 5/36. Now condition on the first die showing 3: the sample space collapses from 36 outcomes to 6, and only one of them totals 8, so the probability becomes **1/6**.

Nothing about the dice changed. The question changed — and the denominator with it. That is the whole mechanism, and keeping sight of "what is my denominator now?" prevents most conditional-probability errors.

## Bayes, and the tyranny of the base rate

`P(H|E) = P(H)·P(E|H) / P(E)`, where `P(E)` sums over every hypothesis.

Work the standard case. A condition affects **1%** of a population. A test is **95% sensitive** (positive when the condition is present) with a **5% false-positive rate**. The test comes back positive. What is the chance the condition is present?

- Evidence from true positives: `0.01 × 0.95 = 0.0095`
- Evidence from false positives: `0.99 × 0.05 = 0.0495`
- Posterior: `0.0095 / (0.0095 + 0.0495) ≈ **0.161**`

**About 16%.** The evidence multiplied the prior sixteen-fold — from 1% to 16%, a genuinely large update — and the answer is *still* that the condition is probably absent. The false positives win because there are ninety-nine times more people for them to come from.

```viz
{"type":"annotated","title":"Where a positive result actually comes from","prompt":"Tap each slice of the evidence.","points":[{"label":"True positives","value":1,"note":"0.01 × 0.95 = 0.0095. Real cases the test caught. A small population, well detected."},{"label":"False positives","value":5,"note":"0.99 × 0.05 = 0.0495 — over FIVE TIMES larger. A small error rate applied to a large healthy population outnumbers the true cases."},{"label":"Posterior ≈ 16%","value":2,"note":"A sixteen-fold update on the prior, and still probably not present. Both halves of that sentence are true and neither is intuitive."}]}
```

> [!tip] The failure mode has a name: **base-rate neglect**. People hear "95% accurate" and report 95% confidence, which silently discards the prior. The corrective is mechanical — always ask how big the *other* population is, because the false-positive rate is multiplied by it.

## What it is good for

Bayes is not only a warning; it is the update rule that makes noisy sensors usable.

- **Tracking.** A radar observation multiplies a 1% missile prior roughly thirty-fold, to about 34%. That is still not dominant against "airliner" at 61% — but it is far past any alert threshold, and a *second* confirming observation flips the ranking. Evidence accumulates multiplicatively, which is why two independent weak signals beat one strong one.
- **Communications.** Given a noise profile, a received "1" can be assigned a confidence — about 96.7% genuine in the lesson's channel — rather than being accepted or rejected outright.
- **Classification.** Naive Bayes spam filtering is this same multiply-and-normalise, run over word likelihoods.

> [!more] Why a Monte Carlo check is worth running
> Simulating a million trials with a seeded generator and counting outcomes reproduces the analytic posterior to about three decimal places, and the estimate visibly converges on it as the sample grows.
> That matters for more than reassurance. The analytic route is easy to get subtly wrong — a prior that doesn't sum to one, a likelihood attached to the wrong hypothesis — and a simulation makes different mistakes than algebra does. When two methods with independent failure modes agree, the answer is probably right. When they disagree, you have learned something immediately rather than in production.

*(Personal study notes from my Class XII Maths revision project, Day 32 — CBSE Chapter 13. The posterior was recomputed independently for this pack: 0.01×0.95 / (0.01×0.95 + 0.99×0.05) = 0.161.)*
