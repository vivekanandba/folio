# Systems integration — one engine's answer is the next one's boundary condition

> The capstone introduces no new axiom. It couples the engines, and coupling is where the interesting failures live.

> [!key] A real analysis is a **pipeline**, not a single technique. **Linear algebra** (matrices, vectors) frames space and tracks state. **Calculus** (derivatives, integrals, ODEs) is the engine of how state changes. **Probability** is the error-correction layer over noisy sensors. **Optimisation** picks the operating point. Systems integration is the discipline of making each stage's output a *valid input* to the next — which means its units, its assumptions and its uncertainty all have to survive the handoff.

## The four engines, and what each is for

| Engine | Days | Its job in a pipeline |
|---|---|---|
| Linear algebra | 6–11, 27–30 | the spatial frame and the state vector |
| Calculus | 12–26 | how that state evolves |
| Probability | 32 | what to believe when the measurement is noisy |
| Optimisation | 31 | which operating point to choose |

## A mission loop, in four handoffs

The worked capstone chains all four on one problem:

1. **LP allocates.** Split a 60-unit launch mass budget between payload and propellant, maximising mission value under fairing-volume and booster-lift constraints. Output: an allocation.
2. **Calculus integrates.** That propellant allocation sets a thrust curve; integrating it over the burn gives total impulse `I = ∫F dt`, and `Δv = I / m_total`. Output: a velocity change.
3. **Vectors orient.** Express the burn direction as direction cosines and check `l² + m² + n² = 1`. Output: a vector, not just a magnitude.
4. **Bayes confirms.** Fuse a noisy ground-radar observation to update belief that orbit insertion succeeded. Output: a posterior, not a yes.

Each arrow is a boundary condition. The LP's allocation *is* the calculus stage's input; the Δv *is* the vector stage's magnitude; the predicted orbit *is* the prior Bayes updates.

```viz
{"type":"annotated","title":"Where coupling goes wrong","prompt":"Tap each handoff.","points":[{"label":"LP → calculus","value":1,"note":"An allocation handed on as if it were a measurement. The LP's answer is optimal UNDER ITS CONSTRAINTS — if those were wrong, everything downstream inherits the error with no trace of where it came from."},{"label":"Calculus → vectors","value":2,"note":"A magnitude handed on without its direction. Δv is a vector; carrying only its size is the most common unit-style error in the whole chain."},{"label":"Vectors → Bayes","value":3,"note":"A prediction handed on as a certainty. If the prior arrives with its uncertainty stripped, Bayes updates a point estimate and the posterior is falsely confident."}]}
```

> [!tip] The integration bug that costs most is **not** a wrong formula inside a stage. It is a correct stage fed something that doesn't mean what it thinks: an allocation treated as a measurement, a magnitude treated as a vector, a prediction treated as an observation. Each stage tests clean in isolation, and the pipeline is still wrong.

## Reading it across domains

The same four-engine shape appears everywhere once you see it:

- **Aerospace MDO** — vectors map the trajectory, ODEs model thrust and drag over time, LP optimises the fuel-to-payload split.
- **Full-system electronics simulation** — matrices solve the trace mesh, calculus processes the RF waveforms, conditional probability separates signal from noise.
- **Numerical libraries** — invertibility decides whether serialisation round-trips, monotonic intervals make search valid, matrix inversion un-projects the render.

> [!more] Why the handbook is the notebooks
> The capstone's index is generated from the repository rather than written by hand: the 33 lessons *are* the handbook, so the contents page cannot drift from what exists. A table of contents maintained separately from its chapters is wrong the moment a chapter is added — which is the same argument as a registry that must list every spec, and the same argument as a test suite whose fixtures are the shipped content rather than copies of it.

*(Personal study notes from my Class XII Maths revision project, Day 33 — the capstone. Completes the 33-day track: 13 chapters plus integration.)*
