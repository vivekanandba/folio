# Continuity & differentiability — smoothness is a stricter demand than you think

> Continuous means the curve has no gap. Differentiable means it has no corner. Engineering keeps discovering, expensively, that the second is a much stronger requirement.

> [!key] f is **continuous at c** iff all three hold: f(c) is defined, the limit exists (LHL = RHL), and they are **equal**. f is **differentiable at c** iff the one-sided derivatives agree (LHD = RHD, finite). **Differentiable ⇒ continuous, but not conversely** — |x| at 0 is the standing counter-example. Tower functions f(x)^g(x) need **logarithmic differentiation**; parametric curves differentiate through the parameter, and the second derivative chains again — dividing by dx/dt, *not* by d²x/dt².

## Three conditions, three failures

The limit exists only when the one-sided limits agree: `lim(x→c⁻) f = lim(x→c⁺) f`. From that, the failure taxonomy:

- **Jump discontinuity** — LHL ≠ RHL. The two sides disagree about where the function is heading. A normal shockwave is this: pressure, density and velocity change near-instantaneously across it, and modelling the jump is what feeds the Rankine–Hugoniot conditions.
- **Removable discontinuity** — LHL = RHL, but that common value isn't f(c), or f(c) doesn't exist. `(x² - 4)/(x - 2)` at x = 2 has a perfectly good limit of 4 and no value at all: a hole you can fill by *defining* f(2) = 4.

```viz
{"type":"annotated","title":"The three-condition test, and what each failure looks like","prompt":"Tap each verdict.","points":[{"label":"Continuous","value":3,"note":"f(c) defined, LHL = RHL, and the limit equals f(c). The graph passes through the point with no break — you could trace it without lifting the pen."},{"label":"Jump","value":1,"note":"LHL ≠ RHL. No limit exists at all, so no repair is possible: the function genuinely teleports. Shockwaves, ideal switches, quantiser steps."},{"label":"Removable","value":2,"note":"The limit exists but the function doesn't meet it — a single missing or misplaced point. The only discontinuity you can fix by redefining one value."}]}
```

> [!tip] An ideal switch is a Heaviside jump — infinite slew rate, physically impossible. Real parasitic RC smooths it into `V(t) = V₀(1 - e^(-t/RC))`, which is continuous, and *that* is what makes setup times and propagation delays computable as limits.

## Continuity is not enough

Differentiability at c asks the difference quotient to agree from both sides:

`LHD = lim(h→0⁻) [f(c+h) - f(c)] / h`  must equal  `RHD = lim(h→0⁺) [f(c+h) - f(c)] / h`

|x| at 0 is continuous — no gap, one unbroken curve — yet LHD = -1 and RHD = +1. The derivative of |x| is sign(x), which **jumps** across zero. The corner is the obstruction.

This matters far beyond the textbook:

- **Trajectories.** A sharp corner in a path is an instantaneous velocity change: infinite acceleration, and by F = ma, infinite thruster force. Real paths must be C² splines — the corner is not "slightly uncomfortable", it is unachievable.
- **Waveforms.** A triangular wave is continuous but non-differentiable at its peaks. Differentiate it through `L·di/dt` and you get step jumps and slowly-decaying harmonics — EMI with a mathematical cause.
- **ReLU.** `max(0, x)` is a corner at the origin, so backpropagation cannot use a derivative there. It uses a **subgradient**: the value at 0 is simply assigned (0, or 0.5) by convention. The network trains anyway, because the corner is a measure-zero event — but the honest description is "we picked a number", not "we differentiated".

## Towers: when the variable is in the base *and* the exponent

Neither the power rule (`d/dx xⁿ = nxⁿ⁻¹`, exponent constant) nor the exponential rule (`d/dx aˣ = aˣ ln a`, base constant) applies to `y = f(x)^g(x)`. Take logs first:

1. `ln y = g(x)·ln f(x)`
2. `(1/y)·dy/dx = g'(x)·ln f(x) + g(x)·f'(x)/f(x)`
3. `dy/dx = f(x)^g(x) · [g'(x)·ln f(x) + g(x)·f'(x)/f(x)]`

The canonical case: `y = xˣ` gives `dy/dx = xˣ(ln x + 1)`. Setting that to zero — and xˣ is never zero — leaves `ln x = -1`, so the curve bottoms out at **x = 1/e ≈ 0.368**, where y = e^(-1/e) ≈ 0.6922.

The same machinery is the log-derivative used as **fractional sensitivity**, `S = (∂ ln Y)/(∂ ln X)`: for Y = X³ it returns a clean dimensionless 3, meaning a 1% change in X produces a 3% change in Y.

## Parametric curves, and the trap

When y cannot be isolated, parametrise: x = f(t), y = g(t). Then

`dy/dx = (dy/dt)/(dx/dt)`, for dx/dt ≠ 0

The second derivative is where it goes wrong. dy/dx is a function of **t**, so differentiating it with respect to x needs the chain rule again:

`d²y/dx² = [d/dt (dy/dx)] / (dx/dt)`

> [!more] Why d²y/dx² ≠ (d²y/dt²)/(d²x/dt²)
> The tempting formula drops the dt/dx scaling factor entirely. On the parametrised circle x = a cos t, y = a sin t, the correct answer is `-(1/a)·csc³t` while the naive one collapses to `tan t` — at t = π/4 (a = 1) that is **-2.83 against +1.00**: wrong in magnitude and wrong in sign. A curvature term that is wrong in sign means a spline that bends the wrong way, or a g-load computed with the acceleration pointing outward instead of toward the centre. (For that circle, the acceleration vector works out to exactly -r(t): centripetal, pointing at the centre, as it must.)

## The engineer's move

- Test continuity with all three conditions; identify jump versus removable, because only one of them is repairable.
- Never assume differentiability from continuity — look for corners wherever a max, an abs, or a clip appears.
- For towers, take logs. For parametric second derivatives, divide by dx/dt and check the sign against a physical expectation.

*(Personal study notes from my Class XII Maths revision project, Days 12–15 — CBSE Chapter 5. One-sided limits and derivatives computed from the definitions in the source lessons, after the symbolic library was found to mis-evaluate one-sided limits of piecewise functions.)*
