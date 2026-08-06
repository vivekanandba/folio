# The constitution — mission, tech stack, roadmap

> Give the agent the best-quality context: project decisions first, feature details second.

> [!key] An SDD project has two levels. The **constitution** — `mission.md` (the *why*), `tech-stack.md` (the *how*), `roadmap.md` (the *when*) — captures project-level agreements between human & agent *and* between the humans. Every feature then runs the same **plan → implement → validate** loop underneath it.

## The three documents

```viz
{"type":"annotated","title":"The constitution","prompt":"Tap each doc.","points":[{"label":"mission.md","value":3,"note":"The WHY — vision, target audiences, scope. Guides every later decision. (AgentClinic: a satirical vet clinic where the patients are AI agents with chronic hallucination.)"},{"label":"tech-stack.md","value":3,"note":"The HOW — shared engineering understanding: languages, frameworks, constraints. Narrow choices by trade-offs and what your team already uses."},{"label":"roadmap.md","value":4,"note":"The WHEN — a LIVING document: a sequence of small phases, each run through its own feature loop. Ask for nano-phases so every review stays small."}]}
```

> [!warn] The graded quiz's favourite trap: the **constitution** is `mission / tech-stack / roadmap` (project level). The **feature spec** is `plan / requirements / validation` (per feature). Different triple, different altitude — see [the feature cycle](#/pack/ai-sdd-2026/concept/feature-cycle).

## Writing it *with* the agent

The constitution is produced **in conversation**: describe the project (point the agent at stakeholder input in the README), require it to **interview you before writing to disk** (AskUserQuestion), review, then **commit it** — it's a living document, part of version control.

- **Edit via conversation, not by hand** — when the mission missed a target audience, continuing the conversation let the agent keep *related docs consistent*.
- **The one key skill: the right level of detail.** Rich context on goals, audiences, and constraints; silence on low-level decisions the agent can make itself. *Control the process; don't oversteer.*

> [!more] Constitution vs `agents.md`
> Many developers use a top-level `agents.md` as the project brief. A constitution is one level more structured — and **agent-agnostic**: it belongs to the project, not to whichever coding agent is fashionable this quarter ([why that matters](#/pack/ai-sdd-2026/concept/sdd-anywhere)).

## Architect's move

- Write the **why / how / when** before any feature work.
- Demand **small roadmap phases** — granular changes are reviewable changes.
- **Commit the constitution** and evolve it through the agent, never by hand-editing one file in isolation.

*(Personal study notes paraphrased from "Spec-Driven Development with Coding Agents" — JetBrains × DeepLearning.AI. Not affiliated; for personal revision.)*
