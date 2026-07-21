# Rolling vs point-to-point returns

> One start date can flatter or damn a fund. Ask how it did across *every* start date.

> [!key] **Point-to-point** return depends entirely on the two dates you pick. **Rolling** return averages performance over *every* window of a given length — so it shows consistency, not a lucky (or unlucky) endpoint.

## Big idea

"5-year return: 18%" sounds precise, but it's just NAV-then vs NAV-now for one pair of dates. Slide the start a few months and the number can swing wildly. **Rolling returns** fix this: compute the N-year return starting from many dates and look at the whole distribution — average, best, worst, and how often it beat a threshold.

## Why the start date lies

| Measure | What it answers | Weakness |
|---|---|---|
| Point-to-point | "What did ₹1 become between date A and date B?" | Cherry-pickable; one endpoint |
| Trailing (1/3/5y) | "…ending today?" | Still one endpoint (today) |
| Rolling | "Across *all* N-year windows, what's typical?" | Needs long history |

> [!tip] When a factsheet shows a headline trailing return, ask for the **rolling** picture: average 5-year return, and the *worst* 5-year window. The gap between best and worst tells you how much the story depends on timing.

## Returns are nominal — inflation is the real test

A number on a factsheet is before inflation. What actually grows your purchasing power is the **real** return:

```viz
{"type":"what-if","compute":"realReturn","title":"Real (inflation-adjusted) return","inputs":[{"key":"nominal","label":"Nominal return","min":4,"max":18,"step":0.5,"value":12,"unit":"%"},{"key":"inflation","label":"Inflation","min":2,"max":9,"step":0.5,"value":6,"unit":"%"}],"output":{"label":"Real return","unit":"%","decimals":2},"caption":"12% nominal at 6% inflation is only ~5.7% real — barely half the headline."}
```

> [!more] A quick mental model
> Real return ≈ nominal − inflation is close enough for a gut check, but the exact form divides the growth factors: `(1+nominal)/(1+inflation) − 1`. At low numbers the two agree; at high inflation the subtraction overstates your real gain.

## Investor move

- Judge funds on **rolling** returns and the **worst** window, not one trailing figure.
- Convert headline returns to **real** returns before deciding they're "enough."
- Longer, more consistent rolling records beat one spectacular point-to-point number.

*(Personal study notes; not investment advice.)*
