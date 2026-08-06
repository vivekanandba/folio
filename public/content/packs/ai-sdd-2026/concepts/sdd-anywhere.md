# SDD anywhere — legacy code, replaceable agents

> Your specs should outlive your codebase's messiness — and your coding agent's market share.

> [!key] SDD is not greenfield-only: on a **brownfield** project the agent **reverse-engineers the constitution** from code, README, TODOs and docs, then the normal feature loop applies unchanged. And because the workflow rests on **open standards** (MCP, Agent Skills, AGENTS.md, ACP), the *agent* is a replaceable part — your specs and skills move with you.

## Brownfield: SDD on a legacy codebase

- Same constitution prompt, richer inputs: the agent **explores the code** (expect many tool calls) and extracts the *actual* stack — including **honest gaps** ("no linter, no CI") — while the roadmap grows out of the existing `TODO.md`.
- Review, commit, then proceed **exactly** as greenfield: next phase → branch → `plan/requirements/validation` → implement → validate → merge.
- Give the first **replanning** extra time: a freshly SDD-ified legacy project has the most to tune.

## The agent is the replaceable part

```viz
{"type":"annotated","title":"Four open standards","prompt":"Tap each.","points":[{"label":"MCP","value":3,"note":"Model Context Protocol — agent ↔ external systems (data, tools). Any agent reaches the same resources. Trend: for many cases, Skills + a CLI tool are lighter (less setup, lower context cost, can take action)."},{"label":"Skills","value":4,"note":"Portable capability folders — the feature-spec skill you wrote in one agent is picked up unchanged by another."},{"label":"AGENTS.md","value":2,"note":"A README for agents (60k+ projects) — any agent finds build/test/convention context."},{"label":"ACP","value":3,"note":"Agent Client Protocol — editor ↔ agent, like LSP: any ACP agent works in any ACP editor."}]}
```

The course's demo: the same project — constitution, specs, and the hand-rolled feature-spec skill — driven by **Claude Code**, then **Codex**, then **OpenCode**. The agent swaps; nothing else moves.

> [!more] Choosing (and re-choosing) your agent
> Because agents are interchangeable, pick by evidence: agent scoreboards and code-arena leaderboards rank agents and models per task. When a better one ships, switch — your SDD workflow stays exactly as-is. That's the strategic payoff of keeping specs [agent-agnostic](#/pack/ai-sdd-2026/concept/constitution-and-roadmap).

## Architect's move

- Legacy project? **Reverse-engineer the constitution first**, then run the normal loop.
- Keep every workflow artifact on **open standards** — never inside one vendor's chat history.
- Re-evaluate agents freely; **your specs are the durable asset**.

*(Personal study notes paraphrased from "Spec-Driven Development with Coding Agents" — JetBrains × DeepLearning.AI. Not affiliated; for personal revision.)*
