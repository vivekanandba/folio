# Lines in space — and the possibility that only exists in three dimensions

> In a plane, two lines either meet or run parallel. In space there is a third option, and it is the one that matters for collisions.

> [!key] A line is a point plus a direction: `r = a + λb` in vector form, or `(x - x₁)/a = (y - y₁)/b = (z - z₁)/c = λ` in Cartesian form. Direction **ratios** are direction **cosines** before normalisation — divide by |b| to recover (l, m, n). Two lines are **parallel** when `b₁ × b₂ = 0`, **intersecting** when the shortest distance is 0, and **skew** otherwise. The angle comes from `cos θ = |b₁ · b₂| / (|b₁||b₂|)`, and the shortest distance by projecting `a₂ - a₁` onto the common normal `b₁ × b₂`.

## Skew is the case a 2-D intuition doesn't have

Two lines in a plane always resolve: they cross, or they never do because they point the same way. In three dimensions they can do **neither** — pass each other at different heights, never meeting, never parallel. That is skew, and it is the normal case rather than the exception. Two aircraft on different flight levels, two PCB traces on different layers, a ray and a triangle's edge.

The classification falls out of two numbers already computed:

| Test | Verdict |
|---|---|
| `b₁ × b₂ = 0` | **parallel** (a different distance formula applies) |
| shortest distance `d = 0` | **intersecting** |
| otherwise | **skew** |

```viz
{"type":"annotated","title":"Three relationships, two numbers","prompt":"Tap each.","points":[{"label":"Parallel","value":1,"note":"Cross product of directions vanishes. They never meet, but the gap is constant — measure it from any point on one line to the other."},{"label":"Intersecting","value":2,"note":"Shortest distance is exactly zero. The common normal still exists; it just has nothing to span."},{"label":"Skew","value":3,"note":"Neither. Only possible in 3-D, and the case collision screening is actually about: how close do they come, and when?"}]}
```

## The shortest distance, and why it is the useful number

The common normal `n = b₁ × b₂` is perpendicular to both lines, so the gap between them is the component of `a₂ - a₁` along `n`:

`d = |(a₂ - a₁) · (b₁ × b₂)| / |b₁ × b₂|`

For the standard pair — `a₁ = (1,1,0), b₁ = (2,-1,1)` and `a₂ = (2,1,-1), b₂ = (1,-2,2)` — this gives `d = 1/√2 ≈ 0.7071`, with the lines meeting at an angle of 35.26°. The connecting segment is perpendicular to both, which is the check worth running: if it is not, the normal was computed wrong.

> [!tip] A zero direction ratio **freezes a coordinate**. In `(x - x₁)/a = (y - y₁)/b = (z - z₁)/c`, a c of zero would mean dividing by zero — but what it actually means is that z never changes: the line lives entirely in the plane `z = z₁`. Writing that constraint explicitly is correct; treating it as an arithmetic error is not.

## What the distance is used for

**Closest point of approach.** Two flight paths, each a line in space plus time. The shortest distance between them is the CPA, and collision-avoidance is a threshold on it: alert when d drops below the separation minimum. The geometry answers "how close do they get?" before either aircraft is anywhere near the conflict.

**Layer separation.** Two PCB traces running on different layers, one along x and one along y, are skew — and the shortest distance between them comes out as exactly the dielectric thickness (1.6 mm for standard FR4). The geometry recovers a physical constant, which is a satisfying way to check the method is working.

**Rendering.** Ray-versus-edge distance is this same computation, used for anti-aliasing: how close did the ray pass to the triangle's edge decides how much the pixel is blended.

> [!more] Direction ratios versus direction cosines
> Direction ratios are any triple proportional to the direction — (2, -1, 1) and (4, -2, 2) describe the same line. Direction cosines are the normalised version, unique up to sign, and they satisfy l² + m² + n² = 1.
> Ratios are what you naturally *have* (the difference between two points); cosines are what you need when the magnitude must not matter — comparing directions, computing angles, checking an attitude. Dividing by |b| is the whole conversion, and forgetting to do it is why an angle sometimes comes out wrong by a scale factor that silently cancels in some formulas and not others.

*(Personal study notes from my Class XII Maths revision project, Days 29–30 — CBSE Chapter 11. The classifier, the 1/√2 distance and the FR4 gap were verified numerically in the source lessons.)*
