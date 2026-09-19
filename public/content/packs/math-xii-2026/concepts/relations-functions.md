# Relations & functions — the structure that makes a system reversible

> Every "can we get the original back?" question in engineering is the same question in disguise: is this map a bijection?

> [!key] A relation on a set is an **equivalence relation** iff it is **reflexive** (aRa), **symmetric** (aRb ⇒ bRa) and **transitive** (aRb ∧ bRc ⇒ aRc) — and every equivalence relation **partitions** the set into disjoint classes. A function is **injective** when distinct inputs give distinct outputs, **surjective** when the image fills the codomain, **bijective** when both. A system is invertible **iff** it is a bijection. Composition chains subsystems; the chain is invertible only if it stays a bijection end to end.

## The triad, and the one that fails quietly

Reflexivity and symmetry are easy to satisfy and easy to check. **Transitivity is where real relations break**, because it is a claim about pairs you never measured.

Probe a circuit board for continuity: pin 1 connects to pin 4, pin 4 connects to pin 9. Both readings are honest, both are symmetric, every pin trivially connects to itself. But the extraction never closed **pin 1 ~ pin 9** — so "shares a 0-ohm DC pathway" is *not* an equivalence relation over that data, and the net list it implies is wrong.

```viz
{"type":"annotated","title":"Where each property lives","prompt":"Tap each leg of the triad.","points":[{"label":"Reflexive","value":1,"note":"Every element relates to itself — the diagonal of the adjacency matrix is all 1s. Cheap to satisfy, cheap to check."},{"label":"Symmetric","value":2,"note":"M equals its own transpose. Physical relations (shares a subnet, is bolted to) are usually symmetric by construction."},{"label":"Transitive","value":3,"note":"Two-step reach must already be a direct edge: (M·M) > 0 implies M. This is the one that fails — it asserts things about pairs nobody probed."}]}
```

The matrix test is mechanical: build the 0/1 adjacency matrix `M`, then reflexive = diagonal all ones, symmetric = `M == Mᵀ`, transitive = wherever `(M·M) > 0`, `M` already has an edge. Pass all three and the relation reorders into a **block-diagonal** matrix — the blocks *are* the equivalence classes.

> [!tip] **The partition is the payoff.** "Same rigid sub-assembly as" over aircraft parts, "same broadcast domain as" over IP addresses — once verified, you stop reasoning about individual elements and start reasoning about classes. That collapse is why the triad is worth checking rather than assuming.

## Injective, surjective, bijective — read as failure modes

Represent `f: A → B` as a 0/1 matrix with rows = codomain, columns = domain. Then the classification is a shape:

| Property | Matrix reading | What its failure looks like in a system |
|---|---|---|
| Valid function | exactly one 1 per **column** | an input with two outputs — nondeterminism |
| Injective | at most one 1 per **row** | two keys driving one register: **ghosting** |
| Surjective | at least one 1 per **row** | a service with no route to it: **dead code** |
| Bijective | permutation matrix | — (this is the invertible case) |

The two failures are genuinely different bugs. **Injectivity failure destroys information**: after the collision you cannot tell which input happened. **Surjectivity failure wastes capacity**: a payment service that no route reaches is deployed, paid for, and unreachable.

## Composition, and where invertibility dies

For `f: A → B` and `g: B → C`, the composite is `(g ∘ f)(x) = g(f(x))` — and it only exists when **Range(f) ⊆ Domain(g)**. Chain two bijections and you get a bijection; the receiver inverts it exactly (decrypt ∘ deserialize recovers the original payload byte for byte).

Now saturate one stage. A linkage doubles stick angle, `f(θ) = 2θ`; the hydraulic ram clips at ±10°, so `g(x) = clip(x, ±10)`. Past θ = 5° the ram is against its stop and **every** larger angle produces exactly 10° of deflection. The preimage of 10° is no longer a value — it is a set. Post-flight telemetry reconstruction is impossible in that region, and no amount of downstream cleverness recovers it, because the information is not attenuated: it is gone.

> [!more] The horizontal-line test, stated properly
> A composite is invertible only if it is injective, and injectivity is exactly "every horizontal line meets the curve at most once." A strictly monotonic stage passes. A saturating stage flattens, so the line y = 10 meets it infinitely often. This is the same test you apply to periodic functions in [inverse trigonometry](#/pack/math-xii-2026/concept/inverse-trigonometry) — and the reason those functions need a restricted domain before an inverse can exist at all.

## The engineer's move

- Check **transitivity** explicitly; never infer it from a relation that "obviously" groups things.
- When a design needs reconstruction, name the stage that could go **many-to-one** — saturation, quantization, modular wraparound — and either keep it out of the recorded path or restrict the domain so it stays injective.
- An orphaned codomain element is a real finding: it is unreachable capacity, not a rounding error.

*(Personal study notes from my Class XII Maths revision project, Days 1–3 — CBSE Chapter 1. Verified in NumPy/SymPy in the source lessons.)*
