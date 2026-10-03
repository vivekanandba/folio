# Applications of the derivative — rates, direction, and the extreme you forgot to check

> The derivative answers three different questions depending on what you ask it. How fast is this changing? Which way is it going? And where does it stop going that way?

> [!key] A derivative is a **rate**; related rates link two of them through a geometric relation and the chain rule. The **sign of f′** gives monotonicity: positive means increasing, negative decreasing, and the roots of f′ = 0 are the turning points. A **critical point** is where f′(c) = 0 *or* f is non-differentiable. Classify with the second-derivative test — f″(c) < 0 is a maximum, f″(c) > 0 a minimum — and fall back to the first-derivative test when f″(c) = 0. For **absolute** extrema on a closed interval [a, b], compare the interior critical points against the **endpoints**.

## Related rates: one rate drives another

Differentiate the relation, not the quantities. A sphere inflating at a constant volume rate Q:

`V = (4/3)πr³` → `dV/dt = 4πr²·(dr/dt)` → `dr/dt = Q / (4πr²)`

The consequence is worth holding onto: with **Q constant, dr/dt falls as the sphere grows.** Volume rises linearly with time, but the radius goes as t^(1/3) — the same inflow spread over an ever-larger surface. Tank pressurisation, climb rate against air density, `I = C·dV/dt` and `V = L·di/dt` in electronics: all the same move, a geometric relation differentiated once.

## Monotonicity is just the sign of f′

For `f(x) = x³ - 3x² - 9x + 15`, `f′(x) = 3x² - 6x - 9 = 3(x - 3)(x + 1)`, so:

| Interval | sign of f′ | behaviour |
|---|---|---|
| (-∞, -1) | positive | increasing |
| (-1, 3) | negative | decreasing |
| (3, ∞) | positive | increasing |

```viz
{"type":"annotated","title":"What the sign of f′ tells you","prompt":"Tap each region.","points":[{"label":"f′ > 0","value":3,"note":"Increasing. In a loss landscape this is the direction gradient descent refuses to go; in flight, still climbing."},{"label":"f′ = 0","value":2,"note":"A turning point OR an inflection — the sign CHANGE decides which, not the zero itself. Max-Q sits here."},{"label":"f′ < 0","value":1,"note":"Decreasing. Monotone RC discharge, a loss actually falling."}]}
```

> [!tip] A zero of f′ is not automatically an extremum. If f′ does **not** change sign across it, the point is an inflection — the curve pauses and carries on the same way. Checking the sign on both sides costs nothing and is the only thing that distinguishes the two.

## Classifying a critical point

- **Second-derivative test**, when f′(c) = 0: `f″(c) < 0` ⇒ local **maximum** (concave down), `f″(c) > 0` ⇒ local **minimum**, and `f″(c) = 0` ⇒ **inconclusive** — fall back to the first-derivative test.
- **First-derivative test**: f′ changing + → − at c is a maximum, − → + a minimum, and no change at all is an inflection.

The classic worked case: cut x × x squares from the corners of an S × S sheet and fold up the sides, giving `V(x) = x(S - 2x)²`. For S = 30 cm the maximum sits at **x = S/6 = 5 cm**, where V = 2000 cm³. The algebra is ordinary; what makes it worth doing is that the answer is a *ratio* — S/6 — so it transfers to any sheet.

## The extreme that lives at the edge

This is the one that gets missed. **Absolute extrema on a closed interval can sit at an endpoint**, where the derivative says nothing at all.

Take that same cubic on **[-2, 6]**:

| Point | f | |
|---|---|---|
| x = -2 (endpoint) | 13 | |
| x = -1 (local max) | 20 | ← the interior peak |
| x = 3 (local min) | -12 | |
| x = 6 (endpoint) | **69** | ← the actual maximum |

The local maximum is 20. The absolute maximum is **69**, at the right-hand endpoint, and no amount of staring at f′ will produce it — f′(6) = 27, nowhere near zero. An optimiser that only collects stationary points reports 20 and is wrong by a factor of three.

> [!more] Where this bites in practice
> **Glide ratio.** Maximising L/D = C_L/(C_D0 + K·C_L²) gives the optimum lift coefficient `C_L,opt = √(C_D0/K)` — an interior maximum, found properly by setting the derivative to zero.
> **Maximum power transfer.** `P(R_L) = V_th²·R_L/(R_th + R_L)²` is maximised at `R_L = R_th`, the matched load, which is the whole reason impedance matching is a design goal rather than a preference.
> **Training.** Gradient descent `w := w - α∇J` converges where ∇J ≈ 0 — a stationary point, with no guarantee it is the best one *in the feasible region*. Constrained problems are exactly where the boundary wins.

## The engineer's move

- Differentiate the **relation** to link rates; don't guess which quantity drives which.
- Read monotonicity off f′'s sign, and confirm a turning point by the sign *change*.
- On a closed interval, evaluate the endpoints. Always. The derivative is blind to them.

*(Personal study notes from my Class XII Maths revision project, Days 16–18 — CBSE Chapter 6. Verified symbolically and numerically in the source lessons.)*
