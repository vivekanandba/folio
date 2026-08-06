# Vibe coding vs spec-driven development

> The agent is the muscle. The spec is the brain.

> [!key] **Vibe coding** — prompt, eyeball, correct by chatting — is fast and produces **disposable code, technical debt, and drift**; the dialogue that shaped the code is thrown away. **SDD** keeps a **maintained specification**: a permanent, version-controlled artifact that captures the *what & why* and lets the agent own the *how*.

## Big idea

"Make it green and big" → the button overshoots → "Not so big!!!" → finally right — and **nothing is captured**. That loop is fine for a button and fatal for a project. A spec is a **universal contract**: between humans, and between humans and the agent. Your job shifts from typing code to **converting intentions into clear specifications**.

## The three benefits

```viz
{"type":"annotated","title":"Why a maintained spec wins","prompt":"Tap each benefit.","points":[{"label":"Small edits","value":3,"note":"Control large changes with small spec edits — a few sentences become hundreds of lines. Less cognitive overhead steering an ultra-fast agent."},{"label":"No decay","value":4,"note":"Context decay eliminated: a chat's context window fills and the agent degrades. Specs persist across sessions — and across agents — re-anchoring every run."},{"label":"Intent fidelity","value":3,"note":"Writing the spec forces problem, success criteria, constraints and flows BEFORE code is generated — output matches your goals."}]}
```

## The compiler analogy

A compiler turns `code.cpp` into machine code. SDD turns `spec.md` into source code — the "source" is now **human-readable intent**, legible to stakeholders who will never read a line of TypeScript.

## Why SDD needs an *agent*, not a chatbot

- A **chatbot** talks *about* code; you paste snippets in and its context balloons.
- An **agent** plans, reasons, and reaches your **codebase and dev tools** (files, DB, terminal, web) — a highly capable pair programmer.
- In SDD you are the **senior architect** providing blueprints; the agent supplies speed and technical breadth.

> [!more] The movement, not just a course
> The same shape is appearing everywhere: a Wikipedia article (specify → plan → task → implement), GitHub **spec-kit** and Agent OS tooling, "the specs must flow" conference talks, and Karpathy's framing of **agentic engineering** as the successor to vibe coding. See [the workflow](#/pack/ai-sdd-2026/concept/constitution-and-roadmap) for how it's structured.

## Architect's move

- Capture intent in a **permanent spec**, not a disposable dialogue.
- Steer with **small spec edits**; let the agent own the how.
- Use an **agent with tool access** — a chatbot can't run this loop.

*(Personal study notes paraphrased from "Spec-Driven Development with Coding Agents" — JetBrains × DeepLearning.AI. Not affiliated; for personal revision.)*
