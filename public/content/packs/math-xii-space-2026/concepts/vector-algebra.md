# Vector algebra — direction as a number, and two products that answer different questions

> A vector carries magnitude and direction. The two products exist because "how much of this is along that?" and "what is perpendicular to both?" are different questions, and using the wrong one answers a question nobody asked.

> [!key] A position vector is `r = x î + y ĵ + z k̂` with magnitude `|r| = √(x² + y² + z²)`. Its **direction cosines** `(l, m, n) = (x, y, z)/|r|` are the components of the unit vector, and they always satisfy **l² + m² + n² = 1**. The **dot product** `a · b = |a||b|cos θ` measures parallel projection and is **zero exactly when the vectors are perpendicular**. The **cross product** `a × b` is perpendicular to both, and its magnitude `|a||b|sin θ` is the area of the parallelogram they span.

## Direction cosines, and the constraint that checks them

Take `r = 3î - 4ĵ + 12k̂`. Then `|r| = √(9 + 16 + 144) = √169 = 13`, so the direction cosines are clean thirteenths: `(3/13, -4/13, 12/13)`.

Verify: `(9 + 16 + 144)/169 = 169/169 = 1`. ✓

That unity constraint is not decoration — it is a **free integrity check on any direction you are handed**. A normalised direction whose squares don't sum to one has been corrupted somewhere: a sign dropped, a component stale, a normalisation skipped. Attitude software checks it every cycle for precisely that reason.

```viz
{"type":"annotated","title":"Two products, two questions","prompt":"Tap each.","points":[{"label":"a · b = |a||b|cos θ","value":2,"note":"How much of a points along b. A scalar. Zero means perpendicular — which is why it is the orthogonality TEST, not merely a formula."},{"label":"a × b, |a||b|sin θ","value":3,"note":"A vector perpendicular to both, with magnitude equal to the parallelogram's area. Zero means parallel."},{"label":"l² + m² + n² = 1","value":4,"note":"Direction cosines always satisfy it. A free integrity check on any direction you receive."}]}
```

## The dot product: projection, and a test

`a · b = 0` means perpendicular. `[2, 0, 0] · [0, 5, 0] = 0` — the x-axis and the y-axis, as expected.

The reason this matters more than it looks: **diffuse lighting** is `max(0, n̂ · ℓ̂)`, the dot of a surface normal with the direction to the light. Face the light square-on and the dot is 1, fully lit. Turn edge-on and it falls to 0. Turn further and it goes negative — the surface faces *away* — which is why the `max(0, …)` is there rather than for tidiness: without it, back-facing surfaces would be lit by negative light.

The same ratio, normalised, is **cosine similarity** in machine learning: `king · queen ≈ 0.99` (nearly the same direction in embedding space), `king · banana ≈ 0.28` (unrelated). A vector's direction cosines are just its cosine similarity with each axis in turn — one idea, two vocabularies.

## The cross product: orientation and area

`a × b` is perpendicular to both operands, following the right-hand rule, with magnitude `|a||b|sin θ` — the area of the parallelogram they span. For perpendicular vectors of lengths 2 and 5, that area is 10.

Two physical laws *are* cross products, not merely computed with them:

- **Torque**, `τ = r × F`. Push along the spanner and nothing turns — r and F are parallel, sin θ = 0. Push perpendicular and you get everything the lever offers.
- **The Lorentz force**, `F = q(v × B)`. The force is perpendicular to *both* the velocity and the field, which is why a charged particle in a uniform magnetic field travels in a circle rather than being pushed along.

> [!tip] Choosing between them is a question about what you want back. A **scalar** answering "how aligned?" is a dot. A **vector** answering "perpendicular to both, and how much area?" is a cross. If the answer's *type* is wrong, the product is wrong.

*(Personal study notes from my Class XII Maths revision project, Days 27–28 — CBSE Chapter 10. The unity constraint and the parallelogram area were verified numerically in the source lessons.)*
