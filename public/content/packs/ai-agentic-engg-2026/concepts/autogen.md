# AutoGen — chat as coordination, runtime as infrastructure

> AgentChat looks familiar on purpose. AutoGen Core is the different idea.

> [!key] AutoGen comes in layers. **AgentChat** is the high-level, familiar one — Model, Message, Agent, `on_messages` — agents coordinating by *talking*. **AutoGen Core** is the deeper idea: it **decouples an agent's logic from how messages are delivered**. The framework provides the communication infrastructure — a **Runtime** — plus agent lifecycle; agents are responsible only for their own work.

## The layers

```viz
{"type":"annotated","title":"AutoGen's stack","prompt":"Tap each layer.","points":[{"label":"AgentChat","value":3,"note":"Model + Message + Agent, driven by on_messages. Deliberately similar to Crew and the Agents SDK — the lab builds a ticket-price assistant with a local DB tool."},{"label":"Core","value":4,"note":"Framework-agnostic interaction layer: agents register with a RUNTIME that owns message delivery and lifecycle. Your agent logic doesn't know or care how messages travel."},{"label":"Distributed","value":3,"note":"The same Core abstractions across processes/machines — the runtime becomes a distributed message fabric (lab 4)."}]}
```

## Why Core matters

Because message delivery is the runtime's job, the *same agents* can run in-process today and distributed tomorrow — the course explicitly positions Core "similarly to LangGraph": an interaction substrate that doesn't even require AutoGen's own agents. Coordination by **conversation** (group chats, speaker selection) suits open-ended collaboration; coordination by **structure** (graphs) suits guaranteed flows.

> [!warn] Chat-as-coordination is the most flexible and the least predictable of the coordination models — great for brainstorm-shaped work, risky where a step must never be skipped. Match the coordination model to the job's tolerance for surprise.

> [!more] The four frameworks in one line each
> **Agents SDK**: you orchestrate, agents work — lightest. **CrewAI**: org chart — roles and tasks. **LangGraph**: state machine — explicit, checkpointed. **AutoGen**: conversation over a runtime — most decoupled. The course's real lesson is this taxonomy, not any one API.

## Architect's move

- Prototype in **AgentChat**; graduate to **Core** when delivery/lifecycle needs to scale.
- Use chat coordination for **open-ended** work, graphs for **guaranteed** flows.
- Treat the runtime as infrastructure — agent logic should never know the transport.

*(Personal study notes paraphrased from Ed Donner's "Master AI Agentic Engineering" (Udemy), week 5. Not affiliated; for personal revision.)*
