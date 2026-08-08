# Remote servers — transports, deployment, and the inspector

> A stdio server is launched *by* its client. A remote server must already be running before any client arrives.

> [!key] Locally, **stdio** rules: the client spawns the server as a subprocess. Remotely, two HTTP transports: **HTTP+SSE** (stateful; client POSTs, server streams Server-Sent Events; URL ends `/sse`) and **streamable HTTP** (the newer spec; **stateless or stateful**; URL ends `/mcp/`). With FastMCP the tool/resource/prompt code is *identical* — only the run line changes.

## The transport decision

```viz
{"type":"annotated","title":"Pick a transport","prompt":"Tap each.","points":[{"label":"stdio","value":3,"note":"Local subprocess, launched by the client (server_config command/args). Zero network setup; auth via environment variables."},{"label":"HTTP+SSE","value":3,"note":"Remote, STATEFUL connection (protocol 2024-11-05). POST up, SSE stream down. What the course deploys (the SDK's streamable support was still landing)."},{"label":"Streamable HTTP","value":4,"note":"Protocol 2025-03-26. FastMCP('research', stateless_http=True) for independent request/response — or stateful when a workflow needs session memory across requests."}]}
```

```python
mcp = FastMCP("research", port=8001)
mcp.run(transport="sse")               # or: transport="streamable-http"
```

- **Stateless** fits simple, independent requests (and scales like any web service); **stateful** fits multi-step workflows where the server should remember the client across requests.

## Deploying and testing

- **Deploy** (the course uses Render): the server becomes an independent process with a public URL — append `/sse` (or `/mcp/`) and hand that URL to any client.
- **Test with the inspector**: `npx @modelcontextprotocol/inspector`, paste the URL, list and call tools — the same loop as local development.
- Since the March 2025 spec, remote servers can authorize via **OAuth 2.1** (Auth0, Google, GitHub…) — optional in the protocol; stdio servers keep using env vars.

> [!warn] The operational difference that bites: a **stdio server that dies is just relaunched** by its client next session. A **remote server that isn't running serves nobody** — it's infrastructure now, with uptime, auth and versioning concerns. (The sysarch pack's [availability machinery](#/pack/sysarch-lss-2026/concept/quality-attributes) applies the moment your MCP server goes remote.)

> [!more] Claude Desktop and the wider ecosystem
> Hosts like Claude Desktop consume the same config idea — declare a server (command for stdio, URL for remote) and its tools/resources/prompts appear in the app. And composability still holds remotely: a client can be a server, so chains of remote MCP nodes compose into larger agent systems.

## Architect's move

- Same FastMCP code, different run line: **transport is a deploy-time choice**.
- Default remote to **streamable HTTP, stateless** — go stateful only for real workflows.
- The **inspector + URL** is your smoke test after every deploy.

*(Personal study notes paraphrased from "MCP: Build Rich-Context AI Apps with Anthropic" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
