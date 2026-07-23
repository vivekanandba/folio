# What software architecture is

> A structure isn't right or wrong on its own — only relative to what it's for.

> [!key] Architecture is the **high-level description of a system's components and how they communicate** to meet its requirements and constraints. Technologies are *not* architecture — they're implementation details you defer. Decide **topology and protocols first**, code and frameworks last.

## Big idea

Think of a **theatre vs a suburban home**. A theatre is built for acoustics, sightlines, and seating a crowd; a home is built for daily living. Neither structure is "correct" in the abstract — each is correct *only relative to its intended purpose*. Software is the same: structure must fit **explicit intent**. A CRUD web app and a real-time voice platform are both valid — for different intents.

## Unpacking the definition

- **Abstraction** — a high-level view that hides implementation detail to focus on structure and communication.
- **Tech deferral** — frameworks/languages are implementation details. Choose topology + protocols first; delay code-runtime choices to the end.
- **Black-box components** — a component is defined by its public interfaces and observable behaviour, not its internal code.
- **Recursive** — any box on the map can itself be a complex system with its own internal architecture.

## Levels of abstraction

Complexity climbs a ladder — and large global systems are designed at the **Service** level, not the class level:

```
Method → Class → Module → Library → Application → SYSTEM (services / deployable groups)
```

```viz
{"type":"annotated","title":"Where you design for scale","prompt":"Tap a level.","points":[{"label":"Method","value":1,"note":"A single function. Far too fine-grained to reason about a global system."},{"label":"Class","value":2,"note":"Object-level design — still local, not architecture."},{"label":"Module","value":3,"note":"Grouped behaviour inside one app."},{"label":"App","value":4,"note":"One deployable application."},{"label":"Service","value":6,"note":"Processes / deployable groups. THIS is where you orchestrate millions of users, high throughput, and distributed data."}]}
```

## Where it sits — and why it's risky

Architecture lives in the **Design phase** of the SDLC (before Implementation → Testing → Deployment).

> [!warn] A design **cannot be proven correct or optimal up front**. Get it wrong and you lose months of engineering and face a *brutal, expensive rewrite*. Architects mitigate this with organised processes, known patterns, and decision records (e.g. MADR) rather than proofs.

> [!more] Why "just build CRUD" breaks for some systems
> A standard **Request/Response CRUD** stack is stateless and fine for enterprise web apps. A real-time conversational AI (an ~800 ms end-to-end loop) is **latency-bound and stateful** — it needs persistent WebSockets and bidirectional gRPC audio, which CRUD can't support. The *intent* forced a different structure. See [quality attributes](#/pack/sysarch-lss-2026/concept/quality-attributes) and [API design](#/pack/sysarch-lss-2026/concept/api-design).

## Architect's move

- State the **intent** before drawing boxes; structure follows purpose.
- Treat components as **black boxes**; defer tech choices.
- Design large systems at the **Service** level of abstraction.

*(Personal study notes paraphrased from M. Pogrebinsky's "Software Architecture & Design of Large-Scale Systems", §1. Not affiliated; for personal revision.)*
