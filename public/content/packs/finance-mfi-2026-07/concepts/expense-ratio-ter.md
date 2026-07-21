# Expense ratio & TER

> A fee you barely notice each year quietly rewrites your final corpus.

> [!key] The **Total Expense Ratio (TER)** is the annual % a fund charges on your *entire* balance — deducted daily from NAV, whether the fund wins or loses. Because it compounds against you every year, a 1% difference is not 1% of the story.

## Big idea

TER bundles the fund's management fee, admin, and distribution costs into one annual percentage. You never see a bill — it's skimmed from the NAV continuously. Small numbers (0.5% index fund, 1.0% direct active, 1.75%+ regular active) feel trivial, but they're charged on the *whole* pot, *every* year, and the drag **compounds**.

## Feel the drag

Same fund, same gross return — see what the expense ratio alone removes over time:

```viz
{"type":"what-if","compute":"feeImpact","title":"Money lost to fees","inputs":[{"key":"principal","label":"Invested","min":100000,"max":2000000,"step":100000,"value":1000000,"unit":"₹"},{"key":"grossReturn","label":"Gross return","min":6,"max":16,"step":0.5,"value":12,"unit":"%"},{"key":"expenseRatio","label":"Expense ratio","min":0.2,"max":2.5,"step":0.1,"value":1.5,"unit":"%"},{"key":"years","label":"Years","min":5,"max":30,"step":1,"value":20}],"output":{"label":"Lost to fees","unit":"₹","decimals":0},"caption":"₹10L at 12% for 20 years: a 1.5% TER quietly removes several lakh — money that was compounding for you."}
```

## Direct vs regular plans

> [!tip] The **Direct** plan of a fund is the *same portfolio* as the Regular plan, minus the distributor commission — so its TER is lower and its NAV grows faster. Over decades the gap is pure, risk-free saving.

| Plan | Contains | TER | Who it suits |
|---|---|---|---|
| Direct | Same holdings, no commission | Lower | DIY investors |
| Regular | Same holdings + distributor trail | Higher | Advised investors |

> [!more] Why the fee compounds against you
> A fee isn't a one-time haircut — it's a lower growth *rate*. Each year you compound `(gross − TER)` instead of `gross`, so the shortfall grows geometrically, exactly like returns do. That's why the widget's "lost to fees" line curves upward, not flat.

## Investor move

- Compare TER **within a category** (an index fund and an active mid-cap aren't the same job).
- Prefer **Direct** plans if you don't need advice bundled in.
- Don't chase the lowest TER blindly — a slightly pricier fund that genuinely adds return can still win; the fee is one input, not the verdict. See [active share](#/pack/finance-mfi-2026-07/concept/active-share).

*(Personal study notes; not investment advice.)*
