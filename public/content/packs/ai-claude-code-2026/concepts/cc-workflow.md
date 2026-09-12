# The Claude Code workflow — memory, context, control

> Before asking for a single feature: give it memory, learn the controls, and let it read the codebase.

> [!key] The course's foundation (its RAG-chatbot example runs lessons 2–6): **`/init`** scans the codebase and writes **CLAUDE.md** — commands, architecture, style — auto-loaded into context every launch. **`#`** appends a quick memory the moment you see a repeated mistake. Context is managed, not hoarded: **`/clear`** (wipe), **`/compact`** (summarize), **`ESC`** (interrupt and redirect), **`ESC ESC`** (rewind to an earlier point).

## The control surface

```viz
{"type":"annotated","title":"The five controls that matter","prompt":"Tap each.","points":[{"label":"CLAUDE.md","value":4,"note":"Project memory from /init — architecture, commands, style. The course's first # additions: 'use uv to run python files' and the vector DB's two collections (course_catalog, course_content) with their schemas."},{"label":"# memory","value":3,"note":"One keystroke to teach it something permanent — used the moment an error repeats, not after the third time."},{"label":"/clear vs /compact","value":3,"note":"Clear between unrelated tasks; compact when the task continues but the history is bloating. Context is a budget."},{"label":"ESC / ESC ESC","value":3,"note":"Interrupt to redirect mid-flight; double-ESC rewinds the conversation — cheaper than arguing with a wrong turn."},{"label":"@ and !","value":2,"note":"@file pins exact files into the prompt; !command runs bash inline (!pwd). Precision beats prose."}]}
```

## Understanding before changing

Lesson 2 spends its whole session **asking questions**: "give me an overview of this codebase", how documents are chunked, how the two ChromaDB collections differ, how sessions persist. The pattern: *explore → correct misunderstandings with `#` → only then modify*. The chunking regex, the tool-based search, the session continuity — all mapped before a line changed.

> [!tip] The CLAUDE.md that `/init` writes is a draft, not a verdict — the course immediately patches it with `#` (the uv note, the DB schema). Treat project memory like code: review it, correct it, keep it current.

> [!more] Where this pack sits
> This is the session-level discipline underneath the [SDD pack's](#/pack/ai-sdd-2026/concept/feature-cycle) artifact-level one: SDD manages *specs across features*; this manages *context within a working session*. Folio itself is built with both.

## Architect's move

- **`/init` first**, then correct the memory with `#` as you learn.
- Budget context deliberately: `/clear` between tasks, `/compact` within them.
- **Explore before you modify** — questions are cheaper than reverts.

*(Personal study notes paraphrased from "Claude Code: A Highly Agentic Coding Assistant" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
