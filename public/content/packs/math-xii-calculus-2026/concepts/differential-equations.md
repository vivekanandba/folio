# Differential equations — a family of behaviours, pinned down by a measurement

> An ODE describes how something changes. It does not describe what happened — that takes a boundary condition, and without one you have a family of possible pasts.

> [!key] **Order** is the highest derivative present. **Degree** is the power of that highest derivative — but only when the equation is **polynomial in its derivatives**; otherwise degree is **undefined**. A **general solution** carries as many arbitrary constants as the order; initial or boundary conditions collapse it to a **particular solution**. First-order, first-degree equations yield to two moves: **separable** (gather y with dy, x with dx, integrate both sides) and **homogeneous** (every term the same total degree ⇒ the substitution y = vx forces separability). Verification is substitution: put the candidate back and the residual must simplify to zero.

## Order, degree, and when degree doesn't exist

Order is easy to read off. Degree has a precondition people skip:

| Equation | Order | Degree |
|---|---|---|
| `y′ + 2y = 0` | 1 | 1 |
| `(y″)³ + y = 0` | 2 | 3 |
| `y″ + (y′)² = x` | 2 | 1 (the *highest* derivative's power) |
| `y′ + cos(y′) = 0` | 1 | **undefined** |

That last row is the trap. The derivative is trapped inside a transcendental function, so the equation is not polynomial in y′ and **degree is not defined at all** — not zero, not one. "Undefined" is the correct answer, and a classifier that returns a number there is lying rather than failing.

```viz
{"type":"annotated","title":"Reading an equation before solving it","prompt":"Tap each.","points":[{"label":"Order","value":3,"note":"Highest derivative present. Tells you how many arbitrary constants the general solution carries — and therefore how many conditions you need to pin it down."},{"label":"Degree","value":2,"note":"The power of that highest derivative. Only meaningful when the equation is polynomial in its derivatives."},{"label":"Undefined degree","value":1,"note":"y′ + cos(y′) = 0. The derivative sits inside a transcendental function. The honest answer is that degree does not apply."}]}
```

## General, then particular

A second-order equation's general solution carries two arbitrary constants — a two-parameter family of behaviours, all obeying the same physics. Supply `y(0) = 2` and `y′(0) = 4` and the family collapses to one curve: `y = 2e^(2x)`.

> [!tip] **Verification is substitution, not inspection.** Put the candidate back into the equation and simplify; the residual must be exactly zero. A plausible-looking wrong answer leaves a residual that announces itself — substituting sin(2x) into one of these leaves `-8·sin(2x)`, which is not zero and not subtle.

The engineering reading of the general-versus-particular distinction is the whole point:

- **Aerospace** — the general solution is the family of conic orbits; the boundary conditions are *this* vehicle's position and velocity, which select one trajectory out of all possible ones.
- **Electronics** — an RLC ring-down after a switch flip is a decaying oscillation whose *shape* is set by the circuit and whose *amplitude and phase* are set by the state at the instant of the flip.
- **Computing** — a physics engine steps frame by frame (Euler, Runge-Kutta). Each frame is a numerical particular solution; the initial state is what makes it this object's motion and not some other's.

## The two first-order moves

**Separable.** Get it to `f(y) dy = g(x) dx` and integrate both sides. `dy/dx = -2xy` separates to `dy/y = -2x dx`, giving the Gaussian family `y = C·e^(-x²)`; the condition y(0) = 10 pins C = 10.

**Homogeneous.** When every term has the same total degree, `y = vx` forces separability. `dy/dx = (x + y)/x` collapses under that substitution to `x·dv/dx = 1`, giving `y = x·ln|x| + Cx`. The substitution is the whole trick — it converts a form you can't separate into one you can.

> [!more] Boundary conditions as the physical answer
> **RC discharge**: `V = 5e^(-1000t)`, so the time constant τ = 1 ms, and at t = τ the voltage has fallen to exactly `V₀/e ≈ 37%` of where it started. That number is not a rule of thumb — it falls out of the solution.
> **Barometric decay**: `P = 101.3·e^(-h/8.5)` kPa with h in kilometres. At 11 km — ordinary cruise altitude — that is about **27.8 kPa**, roughly a quarter of sea-level pressure. The equation gives the family; the sea-level measurement of 101.3 selects the atmosphere we actually live in.

*(Personal study notes from my Class XII Maths revision project, Days 25–26 — CBSE Chapter 9. Solutions verified by substitution in the source lessons.)*
