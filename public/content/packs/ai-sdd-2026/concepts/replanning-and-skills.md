# Replanning & skills — run slow to run fast

> Replanning isn't a sign of failure. It's the step that makes the next feature cheaper than the last.

> [!key] Between features, pause on a dedicated branch and **replan**: update the constitution (e.g. finally tell the agent your testing preferences), absorb product changes, restructure the roadmap, and improve the **workflow itself** — by turning repeated prompts into **skills**.

## What replanning covers

```viz
{"type":"annotated","title":"Three radii of replanning","prompt":"Tap each.","points":[{"label":"A feature","value":2,"note":"Adjust one feature's spec — small course corrections."},{"label":"The project","value":3,"note":"Constitution + roadmap: add Vitest to tech-stack.md and cascade it (config, extracted app module, a real test suite); combine phases 2–5 into one when they hang together."},{"label":"The workflow","value":4,"note":"Improve HOW you work: package repeated prompts into skills that outlive this project — and this agent."}]}
```

- **Judgment call** for mid-project product changes (e.g. "make it responsive"): small and early → implement during replanning; big → schedule it as its **own roadmap phase**.
- Specs capture **decisions**, not just code — updating product specs *and* feature specs *and* code together is the point.

## Skills — when a prompt earns a package

You keep retyping the feature-spec interview prompt. Stop: a **skill** is a reusable package of instructions and resources that gives the agent a repeatable capability — and agents have skill-creators, so **let the agent write it** while you watch its choices. Then `/feature-spec` replaces the paragraph you used to paste.

- If you *know* you want a skill used, **name it** — saves the agent's routing effort.
- Skills can call other skills; global skills work **across all projects**.
- Candidates: the changelog-on-merge ritual, a validation bundle (lint + format + tests + README refresh).

> [!more] Don't reinvent the workflow
> Whole frameworks package this loop — GitHub **Spec Kit** (`/constitution → /plan → /tasks → /implement`) and OpenSpec map directly onto this course's flow. Adopt one, or grow your own skills; the discipline is the same. Mid-feature ideas go in a **research backlog** instead of derailing the current branch.

## Architect's move

- Schedule replanning **as a normal step** — its own branch, its own review.
- The moment you retype a prompt, **make it a skill**.
- Cascade constitution changes through specs *and* code in one pass.

*(Personal study notes paraphrased from "Spec-Driven Development with Coding Agents" — JetBrains × DeepLearning.AI. Not affiliated; for personal revision.)*
