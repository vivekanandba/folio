# Integration techniques — undoing a derivative, and the baseline you lost doing it

> Differentiation throws something away. Integration can give you back the shape, but never the constant — someone has to measure that.

> [!key] `∫f dx = F(x) + C` inverts differentiation, confirmed by the round trip `d/dx F = f`. The **+ C is not bookkeeping**: it is an infinite family of parallel curves, collapsed to one by a single initial condition. **Substitution** reverses the chain rule — `∫f(g(x))·g′(x) dx = ∫f(u) du` with u = g(x). **Integration by parts** reverses the product rule — `∫u dv = uv - ∫v du` — and **ILATE** (Inverse trig, Logarithmic, Algebraic, Trigonometric, Exponential) tells you which factor to call u. **Partial fractions** split a rational function into pieces that integrate to logarithms.

## What + C actually is

Every antiderivative of the same f differs by a constant, so `∫f dx` names a *family* of curves stacked vertically, all with identical slope at every x. One data point picks the member: knowing the curve passes through (0, 5) forces C = 5.

That constant is not an artefact of notation. It is a physical quantity that differentiation destroyed:

| Domain | What + C is |
|---|---|
| Navigation | the **initial velocity** — integrate acceleration without it and your speed is wrong by a constant, forever |
| Electronics | the **residual capacitor voltage** — the charge already on the plates before you started watching |
| Event sourcing | the **genesis balance** — replaying every transaction from zero gives the wrong total if the account didn't start at zero |

```viz
{"type":"annotated","title":"The family, and the member","prompt":"Tap each.","points":[{"label":"∫f dx = F + C","value":1,"note":"An infinite family of parallel curves. Identical slope everywhere; different heights. The shape is recoverable, the offset is not."},{"label":"One initial condition","value":3,"note":"f(0) = 5 picks a single curve out of the family. One measurement is all it takes — but it has to be MADE, not assumed."},{"label":"Assuming C = 0","value":0,"note":"The default that silently asserts the system started at rest, uncharged, at zero balance. It is a measurement claim disguised as a convention."}]}
```

> [!tip] An integration that drops + C does not fail loudly. It produces a plausible curve of exactly the right shape, displaced by a constant — the hardest kind of wrong to see in a plot, and the easiest to see in a residual.

## Substitution: the chain rule, read backwards

Spot the inner function and its derivative sitting next to it. With u = g(x) and du = g′(x) dx:

`∫f(g(x))·g′(x) dx = ∫f(u) du`

Then integrate in the easier variable and substitute back. The point is to turn an unfamiliar integrand into a standard form — `∫uⁿ du`, `∫eᵘ du`, `∫sin u du` — rather than to find a clever trick. Velocity-dependent drag (`dv/v² = -k dt`), AC power integrals (`∫sin(ωt)cos(ωt) dt`), and the Gaussian normalisation behind every softmax are all this move.

## Parts: the product rule, read backwards

`∫u dv = uv - ∫v du`. The whole skill is choosing u so that the *remaining* integral is easier than the one you started with, and **ILATE** is the ordering that usually achieves it: pick u as early in Inverse-trig → Logarithmic → Algebraic → Trigonometric → Exponential as appears.

The instructive case is `∫ln x dx`, which looks like it has no parts to separate. Take u = ln x and dv = dx — ILATE says logarithmic beats algebraic — and it falls out as `x·ln x - x + C`. Choosing the other way round makes it worse, which is the test of whether you've understood the rule rather than memorised it.

> [!more] Partial fractions: making a rational function integrable
> A quotient like `P(x)/Q(x)` with a factorable denominator splits into `A/(x-a) + B/(x-b)`, and each piece integrates straight to a logarithm. The decomposition is the work; the integration afterwards is trivial.
> This is the same decomposition that drives **Laplace-domain circuit analysis**: an RLC transfer function is split into partial fractions precisely so that each term inverts to a known exponential, which is how you get the time-domain response back. In structural work it's load decomposition; in algorithm analysis it's the shape of recursive cost.

## The engineer's move

- Treat **+ C as a measurement**, not a formality. Name what it is physically, then go and get its value.
- Reach for substitution when you can see an inner function *and* its derivative; for parts when you have a product that ILATE can order.
- Verify by differentiating the answer. The round trip is cheap and catches the sign error you actually made.

*(Personal study notes from my Class XII Maths revision project, Days 19–21 — CBSE Chapter 7 §7.1–7.6. Each result verified against symbolic differentiation in the source lessons.)*
