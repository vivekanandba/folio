# Inverse trigonometry — restricting a domain until an inverse can exist

> sin⁻¹ is not "undo sine". Sine has no inverse. sin⁻¹ is the inverse of a *deliberately crippled* sine, and the crippling is the whole idea.

> [!key] Trig functions are periodic, so they map infinitely many inputs to one output — injectivity fails outright and no inverse exists. **Domain restriction** fixes this: cut the function down to one strictly monotonic interval where it *is* a bijection. The output interval of the resulting inverse is its **principal value branch**: `[-π/2, π/2]` for sin⁻¹, `[0, π]` for cos⁻¹, `(-π/2, π/2)` for tan⁻¹. Every identity that follows is bound to those branches.

## The three branches

| Inverse | Domain (input) | Principal range (output) | Parent restricted to | Monotonic |
|---|---|---|---|---|
| sin⁻¹ x | [-1, 1] | [-π/2, π/2] | sin on [-π/2, π/2] | increasing |
| cos⁻¹ x | [-1, 1] | [0, π] | cos on [0, π] | decreasing |
| tan⁻¹ x | ℝ | (-π/2, π/2) | tan on (-π/2, π/2) | increasing |

Note that cos⁻¹ takes the *decreasing* branch `[0, π]` — it cannot share sine's interval, because cosine is not one-to-one there. Each branch is chosen for exactly one reason: monotonic ⇒ injective ⇒ invertible. Geometrically, the restricted function and its inverse are mirror images across the line y = x.

```viz
{"type":"annotated","title":"Why each branch was cut where it was","prompt":"Tap each inverse.","points":[{"label":"sin⁻¹ → [-π/2, π/2]","value":3,"note":"Sine climbs monotonically across this interval and covers all of [-1, 1] exactly once. Shift the window and you either lose surjectivity onto [-1,1] or regain the many-to-one problem."},{"label":"cos⁻¹ → [0, π]","value":2,"note":"Cosine is NOT injective on [-π/2, π/2] — it rises then falls. [0, π] is its nearest monotonic (decreasing) window covering [-1, 1]."},{"label":"tan⁻¹ → (-π/2, π/2)","value":4,"note":"Open interval, not closed: tan blows up at the endpoints. In exchange the domain is all of ℝ — every real number has an arctangent."}]}
```

## The quadrant trap

A radar computes a target's look angle from telemetry as `θ = tan⁻¹(y/x)`. The division happens before the arctangent, and that is where the information dies.

A drone at (10, 10) and one at (-10, -10) both give `y/x = 1`. Both return **45°**. One of them is in the third quadrant — the fire-control system is pointed **180° wrong**, and nothing about the computation looks broken: no exception, no NaN, a perfectly plausible angle.

The structural fix is `atan2(y, x)`, which takes x and y *separately* and inspects their signs to pick the quadrant, recovering the full (-π, π] range. This is not a numerical refinement; it is a restoration of the injectivity that the ratio `y/x` threw away.

> [!tip] Any time you see a ratio formed *before* an inverse trig call, look for a lost sign. `tan⁻¹(y/x)` is the canonical case, but the same collapse hides in phase calculations, heading computations and anywhere a slope is fed to an angle.

## The arctan-sum identity is piecewise

The sum identity is usually memorised in one line:

`tan⁻¹ x + tan⁻¹ y = tan⁻¹((x + y) / (1 - xy))`

It is only valid when **xy < 1**. The right-hand side always lands in `(-π/2, π/2)` — the principal branch — but the true sum need not, so the identity picks up a branch correction:

| Regime | Correct value |
|---|---|
| xy < 1 | tan⁻¹((x+y)/(1-xy)) |
| xy > 1, x, y > 0 | **π +** tan⁻¹((x+y)/(1-xy)) |
| xy > 1, x, y < 0 | **-π +** tan⁻¹((x+y)/(1-xy)) |

At **xy = 1** the denominator collapses to zero: the sum is ±π/2, the sign following x + y. In RF work that singularity is not an abstraction — cascading two stages whose phase parameters multiply to 1 is exactly the resonance condition, a 90° shift where the design risks reflection.

The identity's honesty check: a symbolic engine asked to simplify the difference between the two sides does **not** return zero, and it is right not to. The difference is a regime-dependent multiple of π.

> [!more] The complementary identities
> `sin⁻¹ x + cos⁻¹ x = π/2` on [-1, 1], and `tan⁻¹ x + cot⁻¹ x = π/2` on ℝ. These are flat — no piecewise behaviour — because the pairs are defined on branches chosen to be complementary. Verifying cot⁻¹ non-circularly needs `atan2(1, x)`, which lands in (0, π) as the CBSE branch requires; defining it as `tan⁻¹(1/x)` quietly breaks at x = 0 and puts negatives on the wrong branch.

## The engineer's move

- Before inverting anything periodic, name the branch. An inverse without a stated range is ambiguous by construction.
- Use `atan2(y, x)`, never `tan⁻¹(y/x)`, whenever the quadrant carries meaning.
- Treat `xy = 1` in a cascaded-phase design as a singularity to be designed away, not a value to be computed through.

*(Personal study notes from my Class XII Maths revision project, Days 4–5 — CBSE Chapter 2. Branches verified monotonic with machine-precision round-trips in the source lessons.)*
