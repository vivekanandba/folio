# OpenAI Agents SDK — agents, tools, handoffs, guardrails

> Ridiculously easy — an Agent is a name, instructions, and the things you let it do.

> [!key] The SDK's primitives: **`Agent`** (name + instructions + model), **`Runner`** (runs it, streamed or not), **`function_tool`** (any Python function becomes a callable tool), **`handoffs`** (an agent delegates the *whole conversation* to a specialist), **guardrails** (`@input_guardrail` agents that can block a run), and **`trace`** (every step inspectable at platform.openai.com/traces).

## The SDR project — the primitives in anger

Three differently-styled sales agents draft cold emails **in parallel** under one `trace`; a **picker agent** selects the best; tools send it (SendGrid); an **emailer agent** with a `handoff_description` takes over formatting-and-sending via **handoff**.

```viz
{"type":"annotated","title":"Tool vs handoff — the week's key distinction","prompt":"Tap each.","points":[{"label":"Tool","value":3,"note":"The calling agent stays in charge: it invokes the function, gets the result back, and continues its own run."},{"label":"Handoff","value":4,"note":"Control TRANSFERS: the receiving agent takes over the conversation from here. Delegation, not consultation."},{"label":"Guardrail","value":3,"note":"An agent judging the run: @input_guardrail returns GuardrailFunctionOutput and can trip BEFORE the expensive work happens (the lab blocks personal names in requests)."},{"label":"Trace","value":2,"note":"Wrap runs in trace('name') — the platform shows every model call, tool call, and handoff. Debugging agents without traces is guesswork."}]}
```

## Structure and portability

- **Structured outputs**: give an Agent a Pydantic `output_type` and it returns parsed objects, not prose to regex.
- **Any model**: `OpenAIChatCompletionsModel` points an Agent at any OpenAI-compatible endpoint — DeepSeek, Gemini, local — the SDK is less vendor-locked than its name.

> [!warn] Guardrails run as agents *about* agents — the lab's `guardrail_agent` checks input before the sales pipeline spends money. Autonomy without a guardrail isn't a feature, it's an incident report waiting to happen.

> [!more] Where this sits among the frameworks
> The SDK is the **lightest** of the course's four: minimal abstraction, explicit control flow, best when *you* orchestrate and agents are competent workers. The moment you want role-played teams or explicit state machines, weeks [3](#/pack/ai-agentic-engg-2026/concept/crewai) and [4](#/pack/ai-agentic-engg-2026/concept/langgraph) take over.

## Architect's move

- **Tool** to consult, **handoff** to delegate — pick deliberately.
- Guardrails **before** the expensive path, structured outputs **after**.
- Never run agents without **traces** on.

*(Personal study notes paraphrased from Ed Donner's "Master AI Agentic Engineering" (Udemy), week 2. Not affiliated; for personal revision.)*
