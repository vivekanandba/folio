# Requirements & architectural drivers

> Features tell you what to build. Quality attributes decide how it must be built.

> [!key] Three kinds of requirement: **Features** (functional — *what* it does), **Quality Attributes** (non-functional — *how well*), and **Constraints** (unnegotiable limits). Features rarely drive architecture — almost any structure can be made to deliver a feature. **Quality attributes and constraints are the real architectural drivers.**

## Big idea

Systems are seldom ripped apart and rewritten because a *feature* is missing — features can usually be added to an existing structure. They're rewritten when they're **too slow, insecure, or can't scale** — non-functional failures that mean the architecture itself is wrong. So the non-functional requirements are what you design around.

> [!warn] "Refactor it later" fails at system scale. Architectural choices carry heavy infrastructure cost, months of engineering, and rigid service contracts — too expensive to undo late. The architect's most valuable work is in the **pre-code** phase.

## The three requirement types

```viz
{"type":"annotated","title":"Which ones drive the architecture?","prompt":"Tap each.","points":[{"label":"Features","value":1,"note":"Functional — what the system does (login, payment). Do NOT drive architecture; most structures can deliver them."},{"label":"Quality attributes","value":3,"note":"Non-functional — scalability, availability, security, performance. DRIVE the architecture."},{"label":"Constraints","value":2,"note":"Unnegotiable limits (regulation like GDPR, a mandated vendor). Pillars you design around."}]}
```

## Three rules for a quality attribute

1. **Testable & measurable** — use numbers, not adjectives. "Fast" is meaningless; "p99 < 200 ms" is a spec.
2. **Trade-offs** — you can't maximise everything; heavy encryption/handshakes buy security by costing performance.
3. **Feasibility** — stay within economic reality and physical law (e.g. the speed of light in fibre).

## Functional discovery, in 3 steps

Capture features systematically, then let them reveal the APIs:

1. **Actors** — enumerate every external person or system.
2. **Use cases** — the meaningful interactions (success *and* failure paths).
3. **UML sequence diagrams** — model those interactions over time.

> [!tip] Every message that **crosses the system boundary** in a sequence diagram becomes a **public API endpoint**. Sequence diagrams are how you turn requirements into API contracts — the bridge to [API design](#/pack/sysarch-lss-2026/concept/api-design).

> [!more] Handling imposed constraints
> Treat constraints as pillars — but **challenge self-imposed ones** to tell internal bias from immutable external law. For mandatory third-party vendors, use **loose coupling**: keep them behind an abstract boundary so they can be swapped with a minimal "blast radius."

## Architect's move

- Separate **features / quality attributes / constraints** early; design around the last two.
- Write every quality attribute as a **measurable number** with acknowledged trade-offs.
- Run **actors → use cases → sequence diagrams**; harvest API endpoints at the boundary.

*(Personal study notes paraphrased from M. Pogrebinsky's course, §2. Not affiliated; for personal revision.)*
