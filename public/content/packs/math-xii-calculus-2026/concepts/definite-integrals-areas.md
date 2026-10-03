# Definite integrals and areas — boundary states, slices, and a free shortcut

> The definite integral is an accumulation, and the Fundamental Theorem says you can read an accumulation off its two endpoints without ever watching it happen.

> [!key] `∫ₐᵇ f dx` is the **net signed area** under f. The **Second FTC** evaluates it from boundary states alone: `F(b) - F(a)`. The **First FTC** confirms integration inverts differentiation: `d/dx ∫ₐˣ f(t) dt = f(x)`. The **trapezoidal rule** approximates the same area with discrete slices and converges as roughly 1/N² — which is what software actually does. On symmetric bounds `[-a, a]`, **check parity first**: an odd integrand is 0 instantly, an even one is `2∫₀ᵃ`. Area *between* curves is `∫ₐᵇ (upper - lower) dx`, with the bounds solved from where they cross.

## Boundary states are enough

`∫₀⁴ (-x² + 4x) dx`. The antiderivative is `-x³/3 + 2x²`, so the value is `(-64/3 + 32) - 0 = 32/3 ≈ 10.667`. Nothing about the interior was examined; two evaluations settled it.

That is the whole engineering appeal. A rocket's **total impulse** `I = ∫F(t) dt = m·Δv` comes from the burn's endpoints, not from tracking thrust instant by instant. A capacitor's voltage `V(t) = (1/C)∫₀ᵗ I dτ + V(0)` accumulates charge — and note that `V(0)`, the initial condition from the previous concept, is right there in the formula.

## What software actually does

Closed-form antiderivatives are a luxury. In practice a solver slices:

| Slices N | Trapezoid error on ∫₀⁴(-x²+4x) |
|---|---|
| 10 | 0.1067 |
| 20 | 0.0267 |
| 40 | 0.0067 |

The error **quarters as N doubles** — that is the 1/N² signature, and it is the honest reason you double resolution rather than nudge it. The PID controller's integral term is this same sum, accumulating error every clock tick to kill steady-state drift.

```viz
{"type":"annotated","title":"Three ways to get the same number","prompt":"Tap each.","points":[{"label":"Second FTC","value":4,"note":"F(b) − F(a). Exact, instant, and needs an antiderivative you can write down — which most real integrands do not have."},{"label":"Trapezoidal rule","value":2,"note":"Sum of slices; error ~1/N². What every numerical library does when the closed form is unavailable. Converges to the exact value as N grows."},{"label":"Parity shortcut","value":3,"note":"On [−a, a]: odd ⇒ 0 with no work at all; even ⇒ 2∫₀ᵃ, halving the work. An O(1) test in front of an O(N) computation."}]}
```

## Check parity before you integrate anything

On symmetric bounds, the integrand's symmetry can settle the answer before the integration starts:

- **Odd** (f(-x) = -f(x)): `∫₋ₐᵃ f dx = 0`. Exactly zero, no computation.
- **Even** (f(-x) = f(x)): `∫₋ₐᵃ f dx = 2∫₀ᵃ f dx`. Half the work.

This is a **culling pattern** — an O(1) guard in front of an O(N) computation — and it is the same instinct physics engines use when they reject a collision pair by bounding box before doing the real test.

The aerodynamic reading is the clearest: across a symmetric delta wing, **lift is even** and accumulates, while **roll moment is odd** and cancels to zero. Same wing, same integral bounds; the symmetry of the integrand decides which one you even have to compute. In AC, net voltage over a full cycle is odd and vanishes, while power dissipation is even and piles up — which is why a device with zero average voltage still gets hot.

> [!tip] **Substituting in a definite integral translates the limits.** With u = g(x), `∫ₐᵇ` becomes `∫_{g(a)}^{g(b)}` — evaluate there and stop. Back-substituting to x and then applying the original limits is a double correction, and it silently gives the wrong number.

## Area between curves

`A = ∫ₐᵇ [g(x) - f(x)] dx`, where g is the **upper** curve and a, b come from solving `f(x) = g(x)`. Both halves of that sentence are where mistakes live: picking the wrong curve as upper flips the sign, and guessing the bounds instead of solving for the intersections gets a region nobody asked about.

The standard check: `y = x + 2` against `y = x²` meet at x = -1 and x = 2, enclosing exactly **9/2**. Worth verifying against closed forms you know — a circle's πr², an ellipse's πab — because an area routine that gets those wrong will get your airfoil section wrong too, just less visibly. The same bounded-area idea is **ROC-AUC**: a classifier's quality expressed as the area under a curve.

*(Personal study notes from my Class XII Maths revision project, Days 22–24 — CBSE Chapter 7 §7.7–7.10 and Chapter 8. Trapezoid convergence and the closed forms were verified numerically in the source lessons.)*
