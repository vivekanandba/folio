# MCP architecture — one protocol instead of M×N glue

> Models are only as good as the context given to them — MCP standardizes how they get it.

> [!key] **MCP is an open protocol that standardizes how LLM applications connect to tools and data sources** — what REST did for web↔backend and LSP did for IDE↔language tools, MCP does for AI apps ↔ external systems. Without it, every AI app × every data source needs custom glue (**M×N**); with it, each side implements the protocol once (**M+N**).

## The roles

```viz
{"type":"annotated","title":"Host, client, server","prompt":"Tap each role.","points":[{"label":"Host","value":3,"note":"The LLM application that wants context: Claude Desktop, an IDE, an AI agent. The host contains one MCP client per connection."},{"label":"Client","value":3,"note":"Lives INSIDE the host; maintains a 1:1 connection with one server, speaking MCP protocol. Invokes tools, queries resources, interpolates prompts."},{"label":"Server","value":4,"note":"A lightweight program exposing specific capabilities: tools, resources, prompt templates. Built once, reusable by every MCP-compatible app."}]}
```

## Why the industry moved

- **Without MCP**: every AI app re-implements custom prompt logic, custom tool calls, custom data access — per data source. Fragmented, duplicated, unmaintainable.
- **With MCP**: an MCP-compatible app talks to a Data-Store server, a CRM server, a version-control server — and the *same* Google Drive server serves an assistant, an agent, and an IDE unchanged.
- **Who wins**: app developers (connect to any server with zero extra work), tool/API developers (build a server once, adopted everywhere), users (apps with extensive capabilities), enterprises (separation of concerns between AI teams). The ecosystem passed **3,000+ community servers** during the course.

> [!tip] "Isn't this just tool use?" — the course's own FAQ: with direct API calls *you* author the tool schemas and functions every time. **An MCP server ships the schemas + functions already defined** — tool use with the integration work done once, by the people who know the service best.

## Transports

- **stdio** — for local servers: the client launches the server as a **subprocess** and speaks over standard I/O.
- **Remote**: **HTTP+SSE** (stateful connection, protocol 2024-11-05) and **streamable HTTP** (2025-03-26, **stateless or stateful**) — a remote server runs independently and must already be running before the client connects. Details in [deployment](#/pack/ai-mcp-2026/concept/mcp-deployment).

> [!more] Composability — the slide most people miss
> **An MCP client can itself be a server, and vice-versa** — chains of client/server nodes compose into multi-hop agent architectures (user & LLM → client/server → client/server → …). And since the March 2025 spec, MCP supports **OAuth 2.1** for authorizing remote servers (stdio servers just use environment variables). This is the same standard the [SDD pack](#/pack/ai-sdd-2026/concept/sdd-anywhere) lists among the four that make agents replaceable.

## Architect's move

- See **M×N glue** in a design? That's the smell MCP removes — demand M+N.
- Keep the roles straight: **host** wants context, **client** speaks protocol 1:1, **server** exposes capabilities.
- Choose transport by locality: **stdio** local subprocess, **HTTP** remote service.

*(Personal study notes paraphrased from "MCP: Build Rich-Context AI Apps with Anthropic" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
