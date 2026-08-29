# CrewAI — teams of role-played specialists

> Describe the people, describe the work, and let the crew run it.

> [!key] CrewAI's model is **organizational**: agents are *roles* (role / goal / backstory / llm in `agents.yaml`), work is *tasks* (`tasks.yaml`, each with an expected output and an assigned agent), and a **crew** (`crew.py`) wires them together under a **process** — sequential or hierarchical (with a manager). Configuration lives in YAML; code stays thin.

## The anatomy

```viz
{"type":"annotated","title":"A crew in three files","prompt":"Tap each.","points":[{"label":"agents.yaml","value":3,"note":"Each agent = role, goal, backstory, model. The stock_picker crew: a trending-company finder ('never pick the same company twice'), a senior financial researcher, a stock picker."},{"label":"tasks.yaml","value":3,"note":"Each task = description, expected_output, agent. Tasks chain: find trending companies → research them → pick one and notify."},{"label":"crew.py","value":4,"note":"The @crew wiring: agents + tasks + process (sequential / hierarchical) + extras — memory, tools, structured outputs (Pydantic), custom tools like the push notification."}]}
```

## Six projects, one lesson each

The week is project-driven: **debate** (two agents argue, one judges), **financial_researcher** (search + analysis), **stock_picker** (memory so it never re-picks; push notification tool), **coder** (writes and *executes* code), **engineering_team** (a *crew that builds software* — design, code, test roles producing a working app). Each project adds one capability: tools → structured outputs → memory → code execution → hierarchical process.

> [!tip] The YAML templating (`{sector}` interpolated at kickoff) is the quiet power feature: one crew definition, many runs — the crew is a reusable machine, not a script.

> [!more] When crews fit — and when they chafe
> Crews shine when work decomposes into **stable roles with clear hand-off points** (a newsroom, a research desk). The abstraction chafes when you need *precise control flow* — retries, branches, checkpoints — which is exactly the gap [LangGraph](#/pack/ai-agentic-engg-2026/concept/langgraph) fills with explicit graphs. The course sequences them back-to-back to make that contrast felt.

## Architect's move

- Model the **org chart, not the algorithm**: roles + tasks + process.
- Put **backstories to work** — they're prompt engineering with a personnel file.
- Reach for memory/tools/structured outputs *per project need*, not by default.

*(Personal study notes paraphrased from Ed Donner's "Master AI Agentic Engineering" (Udemy), week 3. Not affiliated; for personal revision.)*
