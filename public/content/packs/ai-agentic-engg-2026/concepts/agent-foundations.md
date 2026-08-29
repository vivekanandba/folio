# Agent foundations — patterns before frameworks

> Before any framework: an agent is an LLM given tools, memory, and the right to decide what happens next.

> [!key] Week 1 builds agents with **no framework at all** — raw API calls against OpenAI-compatible endpoints (and local models via Ollama) — to make the point that agentic behavior is a set of **patterns**, not a library: send a task to **multiple models in parallel and let an evaluator pick the best**, give a model **tools** it can call (a push notification, a database write), and loop until a goal is met.

## The patterns you can build bare-handed

```viz
{"type":"annotated","title":"Week-1 patterns, no framework","prompt":"Tap each.","points":[{"label":"Multi-model","value":2,"note":"The same task sent to several models (GPT, Claude, Gemini, local Llama via Ollama) — APIs are interchangeable behind OpenAI-compatible endpoints."},{"label":"Parallel + judge","value":4,"note":"Generate N candidates in parallel, then an evaluator/picker model selects the best. The lab's own note: this pattern is universal 'where accuracy is critical'."},{"label":"Tool use","value":3,"note":"Functions the model can request — the career chatbot records unknown questions and pushes notifications (Pushover) when someone wants contact."},{"label":"Deploy","value":2,"note":"The 'Professionally You' project ships as a real Gradio app on HuggingFace Spaces — an agent representing you, with tools, in production."}]}
```

## What makes it *agentic*

The week's ladder: a plain completion → structured workflow (fixed steps) → **agent** (the model chooses which tool to call, when to loop, when to stop). Autonomy is bought with risk: every degree of freedom you grant needs a matching **termination condition and guardrail** — the theme every later framework formalizes.

> [!warn] The evaluator/picker isn't decoration. Single-shot generation is a lottery ticket; parallel generation plus judgment is a distribution you can trust. The same idea returns in every framework week — and in [folio's own media agents](#/pack/ai-media-agents-2026/concept/media-agents).

> [!more] The commercial framing the course insists on
> Each lab ends with a business note: these patterns apply "where you need to improve the quality of your LLM response" — accuracy-critical work pays for the extra tokens. The first project is deliberately commercial too: your CV as an agent, answering recruiters, logging what it couldn't answer.

## Architect's move

- Learn the **patterns bare-handed** first; frameworks then read as conveniences, not magic.
- Parallel + judge for anything **accuracy-critical**.
- Grant autonomy only with **termination conditions** attached.

*(Personal study notes paraphrased from Ed Donner's "Master AI Agentic Engineering" (Udemy), week 1. Not affiliated; for personal revision.)*
