# Matrices — operators, not arrays

> A matrix is not a table of numbers you happen to have stacked. It is a linear transformation, and every structural property of the array is a physical statement about what that transformation does.

> [!key] An m×n matrix maps ℝⁿ → ℝᵐ. The structural special cases **nest**: Identity ⊂ Scalar ⊂ Diagonal ⊂ Square. Addition and scalar multiplication are element-wise (identical shapes); multiplication **composes** maps and requires the **inner dimensions** to match — and it is **not commutative**: AB ≠ BA in general. Every square matrix splits *uniquely* into a symmetric part ½(A + Aᵀ) and a skew-symmetric part ½(A - Aᵀ), and that split separates deformation from rotation.

## The structure hierarchy, and why "is it diagonal?" is the wrong question

- **Diagonal** — square, with zeros off the diagonal. Scales each axis independently; no cross-axis mixing.
- **Scalar** — diagonal with all diagonal entries equal: uniform scaling, `kI`.
- **Identity** — scalar with entries 1: the multiplicative identity, a zero-distortion baseline.

A checker that only asks "are the off-diagonal entries zero?" reports *diagonal* for all three and learns nothing. The useful classifier returns the **most specific** class, because each level means something different physically: a diagonal inertia tensor means the body has been rotated to its principal axes (pure roll torque gives pure roll acceleration, no cross-coupling); a scalar channel matrix is a balanced attenuator; identity is the clean slate a vertex pipeline resets to before stacking transforms.

```viz
{"type":"annotated","title":"Identity ⊂ Scalar ⊂ Diagonal ⊂ Square","prompt":"Tap each level.","points":[{"label":"Square","value":1,"note":"n×n. Same input and output space — the precondition for asking about inverses, determinants and eigenvalues at all."},{"label":"Diagonal","value":2,"note":"Off-diagonals zero: each axis scaled independently. An inertia tensor becomes diagonal exactly when you align with the principal axes — roll/pitch/yaw stop fighting each other."},{"label":"Scalar","value":3,"note":"kI — every axis scaled by the same k. Uniform gain: a balanced multi-channel attenuator, geometric similarity with no distortion."},{"label":"Identity","value":4,"note":"k = 1. Passes the signal through untouched. The baseline a graphics pipeline resets to before composing model, view and projection."}]}
```

## Multiplication composes — and order is physics

`C = AB` is defined **iff** A is m×n and B is n×p, giving m×p, with `Cᵢⱼ = Σₖ AᵢₖBₖⱼ`. The inner dimension is not bookkeeping: it says the output space of B must *be* the input space of A, or the composition is meaningless.

Non-commutativity is the part that carries real consequences. Rotate a square 45° then scale it by diag(2, 0.5), and you land somewhere different from scaling first and rotating after. In attitude kinematics that is the statement that **yaw-then-pitch is not pitch-then-yaw** — sequential body-axis rotations compound as `R_total = R_y(φ) R_x(θ)`, and swapping the order points the aircraft somewhere else. Cascades everywhere are just repeated multiplication: two-port ABCD networks (`T = T₁T₂T₃`), the model→view→projection stack every vertex passes through.

> [!tip] When a dimension mismatch throws, the message should name **which** dimension. "Cannot multiply (3,2) by (3,4): columns of A (2) must equal rows of B (3)" tells you the composition is backwards; a generic shape error makes you rediscover that every time.

## The decomposition that separates strain from rotation

For any square A: `A = P + Q`, where `P = ½(A + Aᵀ)` is **symmetric** and `Q = ½(A - Aᵀ)` is **skew-symmetric**.

The split is **unique**. P satisfies Pᵀ = P (mirror across the diagonal); Q satisfies Qᵀ = -Q, which forces its diagonal to be zero — since `aᵢᵢ = -aᵢᵢ` can only mean `aᵢᵢ = 0`.

This is the single most useful theorem in the chapter, because of what the two halves *mean* when A is a displacement-gradient tensor:

| Part | Mechanics | Networks | Kinematics |
|---|---|---|---|
| Symmetric P | actual **strain** — stretch, compression, shear | reciprocal, passive R/L/C behaviour | — |
| Skew Q | rigid-body **rotation**: no deformation at all | **non-reciprocal** elements: circulators, gyrators, active devices | the cross-product operator |

A structure can show a large displacement gradient and be under no strain whatsoever — it simply turned. Reading the raw tensor tells you the parts moved; reading P tells you whether anything is being damaged.

> [!more] The skew matrix *is* the cross product
> Build `[ω]ₓ` from an angular-velocity vector ω = (ωₓ, ω_y, ω_z) by placing 0 on the diagonal and ∓ω components off it. Then `[ω]ₓ v = ω × v`, exactly. This is the bridge from an angular-velocity *vector* to an infinitesimal rotation *operator*, and it is how ω enters rigid-body kinematics (v̇ = ω × v) and 3-D graphics. A skew-symmetric 3×3 matrix and a 3-vector carry the same three numbers; the matrix form is the one you can multiply by.

## The engineer's move

- Classify structure to the **most specific** level — the level is the physical claim.
- Check inner dimensions before composing, and remember the composition reads right to left.
- When a gradient tensor looks alarming, decompose it first: the skew part is rotation and costs nothing.

*(Personal study notes from my Class XII Maths revision project, Days 6–8 — CBSE Chapter 3. Decomposition and the cross-product identity verified numerically in the source lessons.)*
