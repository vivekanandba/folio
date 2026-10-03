# Spec 012 — Vectors, Space & Uncertainty (Class XII chapters 10–13 + capstone)

**Status:** agreed (user: "Go ahead and do it", 2026-10-03)
**Constitution check:** Art. VI (content-only), Art. VIII (personal study notes).

## Why

Days 27–33 complete the Class XII track: vector algebra, lines in space,
linear programming, probability, and a capstone that couples all of them into
one computational pipeline. They were invisible to the survey that read only
the default branch, and they close the arc the Mathematics hall started.

The traps here are unusually practical. `scipy.optimize.linprog` **strictly
minimises**, so a maximisation handed `+c` returns a confident wrong vertex.
Strong evidence against a 1% prior still leaves you at ~16%. And skew lines —
neither parallel nor intersecting — are a possibility that only exists in 3-D,
which is exactly why a 2-D intuition misses the collision case.

## What

A 15th pack, `math-xii-space-2026`, Mathematics: 5 concepts, 16 sessions.

1. **`vector-algebra`** (27–28) — direction cosines and the unity constraint;
   dot projects, cross orients; torque, Lorentz, diffuse lighting; cosine
   similarity as the same ratio wearing an ML costume.
2. **`lines-in-space`** (29–30) — a line as point + direction; the frozen
   coordinate when a direction ratio is zero; parallel / intersecting / skew
   from the cross product and the distance; closest-point-of-approach.
3. **`linear-programming`** (31) — the feasible region as a convex polygon,
   the corner-point theorem, and the sign-inversion trap.
4. **`probability-bayes`** (32) — conditional probability as a shrunken sample
   space; Bayes as prior × likelihood, normalised; base rates.
5. **`systems-integration`** (33) — one engine's output as the next one's
   boundary condition.

Crown jewels: **"the solver that maximised nothing"**, **"the alert that was
probably wrong"**, and a **blueprint** wiring the capstone mission loop.

## Not in scope

LaTeX (Unicode notation throughout). Chapters beyond 13 — the track ends here.

## Acceptance criteria — each line names its gate

- [ ] Pack registers cleanly (5 concepts / 16 sessions) *(lint:content)*
- [ ] Blueprint winnable; both designed traps fail *(blueprint.test.ts)*
- [ ] Every numeric answer recomputed independently *(review — CON-VER-006)*
- [ ] Sessions render and play *(session-mount)* · reachable *(delivery)*
- [ ] Boots and plays in a browser *(smoke, e2e)*
