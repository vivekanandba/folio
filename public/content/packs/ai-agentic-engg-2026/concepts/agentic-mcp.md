# MCP in practice — equipping agents, and the trading floor

> Week 6 doesn't teach the protocol — it spends it.

> [!key] Inside the Agents SDK, MCP is three moves: **create a client, have it spawn the server, collect the tools** — then hand those tools to an Agent like any others. The week stacks server after server (fetch, Playwright browsing, a **knowledge-graph memory**, Brave search, financial data) and ends in the **Autonomous Traders** capstone: four trader agents and a researcher running on a slew of MCP servers, including one your "engineering team" wrote.

## The three server shapes the course names

```viz
{"type":"annotated","title":"Three kinds of MCP server","prompt":"Tap each.","points":[{"label":"All-local","value":3,"note":"Runs locally, works locally — the knowledge-graph memory server: persistent entities, observations, relationships. Your agent remembers across sessions."},{"label":"Local+web","value":3,"note":"Runs locally, calls a web service — Brave Search (free API key), financial data. The server is a thin authenticated bridge."},{"label":"Remote","value":2,"note":"Fully remote services — covered in depth in the MCP pack; here they're consumers' choices."}]}
```

## The capstone: Autonomous Traders

An equity-trading simulation where each trader agent gets: the home-made **Accounts MCP server** (balance, holdings, buy/sell **tools**, plus **resources** — `accounts://…` for account state and a strategy resource), fetch, memory, search, and market data. Traders read their strategy *as a resource*, research via *tools*, and act — autonomously, on a loop.

> [!tip] Note what the capstone quietly asserts: the account layer is a **server with tools and resources**, not code inside the agent — so the same accounts server serves four different traders, and swapping a trader's brain never touches the money logic. That's [the M+N argument](#/pack/ai-mcp-2026/concept/mcp-architecture) cashing out inside one project.

> [!warn] Four autonomous traders with buy/sell tools is the course's most honest risk demo: autonomy × real actions = you now care very much about [guardrails and termination](#/pack/ai-agentic-engg-2026/concept/agent-foundations), budgets, and the strategy resource being the *only* instruction channel.

> [!more] Protocol vs practice
> The [MCP pack](#/pack/ai-mcp-2026/concept/mcp-architecture) teaches hosts/clients/servers and transports; this week assumes all of it and shows the payoff: capability assembly at config speed — five servers, one agent definition, a working trading floor.

## Architect's move

- Equip agents by **collecting tools from servers**, not by writing tool code into agents.
- Split **state (resources)** from **actions (tools)** — the accounts server is the template.
- The more autonomous the agent, the more its instructions belong in **versioned resources**, not vibes.

*(Personal study notes paraphrased from Ed Donner's "Master AI Agentic Engineering" (Udemy), week 6. Not affiliated; for personal revision.)*
