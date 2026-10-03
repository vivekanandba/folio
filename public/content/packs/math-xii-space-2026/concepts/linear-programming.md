# Linear programming — the optimum is always at a corner

> Every constraint is a wall. The best point in a room bounded by flat walls is always a corner, which turns an infinite search into a short list.

> [!key] An LP has a linear **objective** `Z = ax + by`, linear inequality **constraints**, and non-negativity. The feasible region is a **convex polygon**, and the **corner-point theorem** says the optimum sits at a **vertex** — so enumerating the corners and evaluating Z at each is a complete method, not an approximation. One practical trap dominates: `scipy.optimize.linprog` **strictly minimises**, so maximising means passing `-c` and re-inverting the result.

## Why corners are enough

The objective `Z = ax + by` has a constant gradient, so its contour lines are parallel straight lines sweeping across the region. Push that sweep as far as the walls allow and the last point of contact is a vertex — or, in the tie case, an entire edge whose endpoints are vertices anyway.

That is why LP is tractable. The feasible region contains infinitely many points, but only finitely many corners, and the optimum is guaranteed to be among them.

Worked: maximise `Z = 30x + 50y` subject to `x + 2y ≤ 40`, `3x + y ≤ 60`, `x, y ≥ 0`.

| Vertex | Z = 30x + 50y |
|---|---|
| (0, 0) | 0 |
| (20, 0) | 600 |
| (0, 20) | 1000 |
| **(16, 12)** | **1080** ← optimum |

The winning vertex is where the two constraints **intersect** — both are binding, both resources fully consumed. That is the common shape of an LP answer, and it has a reading: at the optimum you have usually run out of more than one thing at once.

```viz
{"type":"annotated","title":"Reading an LP solution","prompt":"Tap each.","points":[{"label":"Interior point","value":1,"note":"Never optimal. If you are inside the region, some resource is unspent and you can still move along the gradient."},{"label":"Edge","value":2,"note":"Better, but unless the objective happens to be parallel to that edge you can still slide along it to a corner."},{"label":"Vertex (16, 12)","value":4,"note":"Z = 1080. Both constraints binding: the power budget and the thermal limit are simultaneously exhausted."}]}
```

## The sign-inversion trap

This is the one that ships. `scipy.optimize.linprog` **minimises**, always. There is no `maximize=True`. To maximise `Z = c·x` you must:

1. pass `-c` as the objective,
2. solve (the library finds the minimum of -Z),
3. **negate the returned optimal value** to recover max Z.

Skip step 3 and you get the right vertex with a negated objective — a sign error that looks like a bug. Skip step 1 and it is far worse: you get the **minimum**, which is a perfectly valid-looking point, usually the origin or some corner where you have allocated almost nothing. No exception, no warning, just a confident answer to the opposite question.

> [!tip] The cheap defence is the corner table. Enumerate the feasible vertices, evaluate Z at each by hand, and confirm the solver's answer is the best of them. It is O(number of corners), it takes seconds on a small problem, and it catches a sign inversion instantly — because the solver's "optimum" will be sitting at the *worst* corner in your table.

## The same skeleton, different coefficients

The structure transfers wholesale; only the numbers change:

- **System-on-chip power split** — allocate watts between CPU and NPU under a power budget and a thermal ceiling, maximising throughput. The answer above: 16 W and 12 W for 1080 teraFLOPS.
- **Aerospace Δv** — split mass between stages under lift and volume limits.
- **Cloud allocation** — distribute pods across node types under CPU and memory constraints.

Recognising that these are one problem is most of the value. The modelling work is choosing the right variables and writing honest constraints; the solving is mechanical once that's done.

*(Personal study notes from my Class XII Maths revision project, Day 31 — CBSE Chapter 12. The (16, 12) optimum was confirmed two ways in the source lesson: the HiGHS solver, and brute-force evaluation at every feasible vertex.)*
