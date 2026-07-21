# Active share

> Being different from the index is a *process* claim — not a performance guarantee.

> [!key] Active share tells you **how different** a fund is from its benchmark — not whether that difference has paid off. High active share is a precondition for beating the index, never a promise of it.

## Big idea

**Active share** measures how far a fund's holdings stray from its benchmark. Add up the absolute weight differences across every stock and halve the total:

```
Active share ≈ ½ × Σ | w_fund − w_index |
```

- **~80%+** → the portfolio looks very little like the index.
- **~10–20%** → a "closet indexer": charging active fees for near-index behaviour.

```viz
{"type":"gauge","value":0.62,"label":"Active share","note":"Moderately active","caption":"A fund at 62% active share overlaps the index on roughly a third of its weight."}
```

## A worked example

Two funds benchmarked to the same index:

| Fund | Weight shared with index | Active share | What it means |
|---|---|---|---|
| A | ~85% | ~15% | Closet indexer — index-like, active fee |
| B | ~35% | ~65% | Genuinely active bets |

Fund B is *taking positions*. Whether those positions are **right** is a separate question active share cannot answer.

## What it does *not* mean

Higher active share does **not** reliably imply higher returns. Very-active funds tend to split into two camps: some consistently beat, others consistently lag. Divergence measures **intention and risk**, not skill.

> [!warn] "Most active" lists are not "best fund" lists. A fund can be maximally different from the index and still be maximally wrong.

> [!more] Why halve the sum?
> Every overweight in one stock is funded by an underweight somewhere else, so each real difference is counted twice when you sum absolute deviations. Halving corrects the double-count, landing the score on a clean 0–100% scale.

## Investor move

1. Ask: am I paying active fees for **low** active share?
2. Ask *separately*: has the active risk been **rewarded** over full market cycles?
3. Pair active share with tracking error and long-horizon results before judging.

*(Personal study notes; not investment advice.)*
