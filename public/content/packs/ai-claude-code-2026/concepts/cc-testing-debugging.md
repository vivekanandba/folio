# Tests-first debugging and honest refactors

> Don't ask "fix it." Ask for the tests that prove which layer is broken — then fix what they reveal.

> [!key] Lesson 4's bug is engineered (`MAX_RESULTS: int = 0` in config), but the method is universal: the prompt asks Claude Code to **write tests at three layers** (the search tool's `execute`, the AI generator's tool-calling, the RAG system's end-to-end handling), **run them against the current system to identify which components fail**, and only then **propose fixes based on what the tests reveal**. It ends with one word: **Think.**

## The debugging prompt, dissected

```viz
{"type":"annotated","title":"Anatomy of the L4 debugging prompt","prompt":"Tap each part.","points":[{"label":"Symptom","value":2,"note":"'The RAG chatbot returns query failed for any content-related question' — observed behavior, no guesses."},{"label":"Test layers","value":4,"note":"Three deliberate altitudes: the tool's execute method, the generator's tool-calling, the system's query handling. Layered tests triangulate the broken component."},{"label":"Diagnose→fix","value":3,"note":"'Run those tests against the current system to identify which components are failing. Propose fixes based on what the tests reveal.' Evidence before surgery."},{"label":"Think","value":2,"note":"The extended-reasoning nudge, appended exactly where the problem is genuinely hard."}]}
```

## Refactors that state both worlds

The sequential-tool-calls refactor prompt is a template worth stealing: **current behavior** (one tool call, then tools are removed, then a final response), **desired behavior** (each call a separate API round with reasoning between), a **worked example flow** (the lesson-4-topic search), and **hard requirements** — max 2 rounds, explicit termination conditions (rounds exhausted / no tool_use blocks / tool failure), context preserved, errors handled.

> [!tip] Notice the requirements include **termination conditions** — the same rule the [agentic pack](#/pack/ai-agentic-engg-2026/concept/agent-foundations) applies to autonomous loops. A refactor prompt that specifies when the new behavior *stops* prevents the bug you'd otherwise write next.

> [!more] Why tests-first beats describe-and-hope
> "Fix the query failure" invites a plausible patch to the wrong layer. Tests at three altitudes force the failure to localize itself — the same reason folio's own suite tests computes, models, and content contracts separately. The engineered `MAX_RESULTS=0` is found *by the tests*, not by staring.

## Architect's move

- Debug with **layered tests that localize**, not adjectives that describe.
- Refactor prompts state **current, desired, example, termination**.
- Append **Think** where the problem is actually hard — not everywhere.

*(Personal study notes paraphrased from "Claude Code: A Highly Agentic Coding Assistant" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
