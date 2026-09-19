# Determinants — one number that decides whether the problem has an answer

> det A ≠ 0 is not a calculation step. It is the boundary between a system that has a unique answer and one that does not.

> [!key] A square matrix A is **invertible iff det A ≠ 0** (non-singular), and then A⁻¹ is unique. The determinant carries geometry: |det| is the area/volume scaling factor, and its **sign** is orientation. The **minor** Mᵢⱼ is the determinant after deleting row i and column j; the **cofactor** is the signed minor `Aᵢⱼ = (-1)^(i+j) Mᵢⱼ`. The adjoint is the transpose of the cofactor matrix, satisfying `A·adj A = (adj A)·A = |A|·I`, from which `A⁻¹ = adj A / |A|`.

## What the number means

For a 3×3 matrix, Laplace expansion along the first row gives

`det A = a₁₁(a₂₂a₃₃ - a₂₃a₃₂) - a₁₂(a₂₁a₃₃ - a₂₃a₃₁) + a₁₃(a₂₁a₃₂ - a₂₂a₃₁)`

and the properties worth carrying: `det(Aᵀ) = det(A)`, `det(AB) = det(A)·det(B)`, `det(kA) = kⁿ·det(A)` for an n×n matrix, and **any identical or proportional pair of rows (or a zero row) forces det = 0**.

That last one is the practical detector. A zero determinant almost never arrives as a coincidence; it means some row is a combination of others — a redundant equation, a floating node, a degenerate geometry.

```viz
{"type":"annotated","title":"Reading det A off a transformation","prompt":"Tap each regime.","points":[{"label":"det > 1","value":4,"note":"Expands: the unit square maps to a larger parallelogram. In graphics, geometry grows."},{"label":"0 < det < 1","value":3,"note":"Shrinks, but stays invertible — information is compressed, not destroyed."},{"label":"det < 0","value":2,"note":"Orientation FLIPS. Vertex winding reverses, which is why backface culling can silently invert after a bad transform. A rotation must have det = +1; det = -1 is a reflection — a physically impossible attitude for a rigid body."},{"label":"det = 0","value":1,"note":"Collapse. The map squashes space into a lower dimension; area goes to zero and the inverse does not exist. A singular admittance matrix = a floating, ungrounded network with no unique node-voltage solution."}]}
```

> [!tip] For a valid rotation matrix (a DCM), two facts are worth more than the formula: **det R = +1**, and R is orthogonal, so **R⁻¹ = Rᵀ**. Flight software inverts attitude by transposing — no determinant, no adjoint, no division.

## Area, collinearity, and the sign you should not discard

The triangle with vertices (x₁,y₁), (x₂,y₂), (x₃,y₃) has area

`Δ = ½ · |det [[x₁, y₁, 1], [x₂, y₂, 1], [x₃, y₃, 1]]|`

Take the absolute value and you get area. **Keep the sign** and you get winding order — which is what a GPU's barycentric test uses to decide whether a pixel is inside a triangle, and which way a face points.

When that determinant is **zero**, the three points are collinear: no triangle is bounded. In trajectory work that vanishing is a signal, not an error — three telemetry points going collinear is an intercept path.

## Adjoint, inverse, and the consistency test

The route from A to A⁻¹ is mechanical: every cofactor → the cofactor matrix → **transpose it** (that is the adjoint) → divide by |A|. The transpose step is the one people drop; without it the identity `A·adj A = |A|·I` simply does not hold.

For a system `AX = B`, the determinant alone does not finish the story:

| Test | Verdict |
|---|---|
| det A ≠ 0 | **Unique** solution, X = A⁻¹B — consistent |
| det A = 0 and (adj A)·B ≠ 0 | **No solution** — inconsistent |
| det A = 0 and (adj A)·B = 0 | **Infinitely many**, or none — dependent equations |

Geometrically, for two equations in two unknowns those are exactly three pictures: lines that **intersect** (one point), lines that are **identical** (a whole line of solutions), and lines that are **parallel** (nothing). A singular system is not automatically unsolvable — it is unsolvable *or* underdetermined, and the (adj A)·B test is what tells them apart.

> [!more] Why a parameter that makes det = 0 is worth finding
> When a matrix carries a design parameter k, solving `det A(k) = 0` finds the values at which the system loses its unique solution. That is a design boundary: the component value at which a network floats, the geometry at which a mechanism locks, the gain at which the equations stop being independent. Finding it symbolically once is cheaper than discovering it numerically in production.

## The engineer's move

- Compute det **before** reaching for an inverse; if it is zero, the question changes from "what is X" to "which regime am I in".
- Preserve the determinant's sign wherever orientation matters — winding, handedness, reflection-vs-rotation.
- For orthogonal matrices, transpose instead of inverting.

*(Personal study notes from my Class XII Maths revision project, Days 9–11 — CBSE Chapter 4. Laplace expansion checked against NumPy and all four properties verified in the source lessons.)*
