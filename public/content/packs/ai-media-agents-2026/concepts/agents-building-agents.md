# Agents building agents

> Teach a coding agent two skills, state your goal in a sentence, and it scaffolds the media agent for you.

> [!key] The course's finale: use the **Gemini CLI** as an AI pair-programmer that *builds* an ADK media agent. Two **skills** — one teaching how to scaffold/run ADK agents, one teaching Nano Banana image generation — give the CLI the capabilities; a natural-language goal does the rest.

## The workflow

`skills (what it can do) → Gemini CLI (natural-language goal) → agent.py → run locally → iterate`

1. **Register the skills** — `adk-agent-creator` (venv, `adk create`, the `agent.py` + `.env` structure, `adk run`/`adk web`) and `nano-banana-image-gen` (generation + conversational editing via the genai SDK). Both were themselves authored by handing docs to the CLI.
2. **State the goal** — the CLI activates the relevant skills, scaffolds the project, wires the env, writes the tools and root agent.
3. **Run and iterate** — watch its decisions in real time; refine until the output matches your vision.

## What it built: the infographic agent

A single ADK **`LlmAgent`** whose one tool, `infographic_workflow`, chains three functions:

```viz
{"type":"annotated","title":"The generated workflow","prompt":"Tap each stage.","points":[{"label":"fetch","value":2,"note":"fetch_blog_content(url) — plain requests, truncate to ~5000 chars, log it."},{"label":"generate","value":3,"note":"generate_infographic(content, feedback) — Nano Banana renders; on a retry, the PRIOR FEEDBACK is appended to the prompt."},{"label":"evaluate","value":4,"note":"evaluate_infographic — judges factual accuracy, spelling, aesthetic alignment; returns PASS or specific feedback."},{"label":"loop","value":3,"note":"Up to max_attempts = 3: feedback → regenerate → re-judge. After 3, return the last version; every step logged."}]}
```

Notably, the skill **overrode the CLI's default model choice** for the agent's brain — the instructions you package win over tool defaults.

> [!more] The same pattern as the rest of your stack
> This is [SDD's skills lesson](#/pack/ai-sdd-2026/concept/replanning-and-skills) applied to media: repeated capability → package it as a skill → any coding agent can use it. The generated loop is the [image agent's discipline](#/pack/ai-media-agents-2026/concept/media-agents) rebuilt from a one-sentence goal: generate, judge, feed feedback back, cap the attempts.

## Architect's move

- Package capabilities as **skills**; let the agent write the agent.
- **Watch the build** — verify it's making the choices your skills specified.
- Keep the generated loop honest: judge inside, feedback-driven retries, an **attempt cap**.

*(Personal study notes paraphrased from "AI Agents for Image and Video Generation" — DeepLearning.AI × Google. Not affiliated; for personal revision.)*
