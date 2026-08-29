# LangGraph — explicit graphs over implicit magic

> LangGraph is all about Python functions — it doesn't even need LLMs.

> [!key] LangGraph makes control flow **explicit**: a typed **State** object (TypedDict or Pydantic, with `Annotated` **reducers** that define how updates merge — `add_messages` for the common case), **nodes** (plain Python functions taking and returning state), **edges** (including conditional ones), then **compile** the graph and run it. Agents are just nodes that happen to call LLMs.

## The five steps, verbatim from the lab

1. Define the **State** class (the reducer annotation tells LangGraph how to combine a node's output with existing state).
2. Start the **Graph Builder** with that State.
3. Create **nodes** — any Python function.
4. Create **edges** (conditional edges = your branches).
5. **Compile** — then invoke.

```viz
{"type":"annotated","title":"What the graph buys you","prompt":"Tap each.","points":[{"label":"State","value":3,"note":"One typed object flowing through the graph; reducers make concurrent updates principled instead of last-write-wins."},{"label":"Checkpoints","value":4,"note":"Persistence per step — the labs use a SQLite checkpointer (memory.db). Resume, replay, time-travel: the graph remembers where it was."},{"label":"Conditional edges","value":3,"note":"Explicit branch logic — retries, escalation, tool-vs-answer decisions — visible in the graph, not buried in a prompt."},{"label":"Tools node","value":2,"note":"Tool execution is itself a node; the LLM node emits tool calls, the edge routes them, results flow back through state."}]}
```

## The Sidekick project

The week culminates in **Sidekick**, a personal co-worker agent: an LLM node with tools (including browser automation via Playwright), a success-evaluator node, and conditional edges that loop until the evaluator passes or the user's criteria are met — the [parallel-and-judge pattern](#/pack/ai-agentic-engg-2026/concept/agent-foundations) rebuilt as an explicit, checkpointed graph.

> [!warn] The trade: LangGraph asks more of you up front (state design, reducers, edges) and repays it with **determinism you can test** — the same property folio's own blueprint machines assert. If a workflow must never silently skip a step, draw it as a graph.

> [!more] Graphs vs crews vs handoffs
> Handoffs delegate a conversation; crews delegate to roles; **graphs delegate nothing** — they route state through functions you named. Choose by how much control-flow certainty the job demands.

## Architect's move

- Design the **State first**; reducers before nodes.
- Put loops and retries in **conditional edges**, not inside prompts.
- Turn on **checkpointing** the day you go past a toy.

*(Personal study notes paraphrased from Ed Donner's "Master AI Agentic Engineering" (Udemy), week 4. Not affiliated; for personal revision.)*
