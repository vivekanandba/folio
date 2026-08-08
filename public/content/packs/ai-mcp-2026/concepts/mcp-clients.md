# MCP clients — the session lifecycle and multi-server chatbots

> The client's ritual never changes: connect, initialize, list tools, call tools.

> [!key] A client opens a **1:1 session** with each server. For stdio, `stdio_client(server_params)` **launches the server as a subprocess** and hands back read/write streams; a `ClientSession` then runs the lifecycle: **`initialize()` → `list_tools()` → `call_tool(name, arguments)`**. Multi-server apps read a **`server_config.json`** instead of hardcoding — one session per configured server.

## The lifecycle, in code shape

```python
async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools = await session.list_tools()
        result = await session.call_tool("search_papers", arguments={"topic": "llm reasoning"})
```

The chatbot (`MCP_ChatBot` class) keeps only `process_query` and `chat_loop` — the tools now come from whatever servers it connects to, fed to the LLM as available tools; when the model requests one, the client routes the call to the right session.

## Going multi-server

```viz
{"type":"annotated","title":"server_config.json — one entry per server","prompt":"Tap each entry.","points":[{"label":"research","value":3,"note":"{\"command\": \"uv\", \"args\": [\"run\", \"research_server.py\"]} — your own server, launched with uv."},{"label":"filesystem","value":3,"note":"npx -y @modelcontextprotocol/server-filesystem . — a reference server; the '.' scopes it to the current directory."},{"label":"fetch","value":3,"note":"uvx mcp-server-fetch — fetches a URL and returns its contents as markdown. npx/uvx install reference servers on the fly."}]}
```

- The chatbot iterates the config, opens **one session per server**, aggregates every server's tools into a single tool list, and keeps a `tool → session` mapping for dispatch.
- **Reference servers** (the official repo) mean real capabilities — files, web fetch — with zero code written.

> [!warn] The classic failure: a server runs perfectly standalone but its tools never appear in the chatbot — because it was **never added to `server_config.json`**. The client only connects to what the config declares. No entry → no session → no tools.

> [!more] Where the tools meet the LLM
> Each tool's name/description/schema (from the server) goes into the LLM's tool list. The model *decides* to use a tool; the **client executes** the call through the session and returns the result into the conversation — the same tool-use loop as ever, with the definitions outsourced to servers. See [primitives](#/pack/ai-mcp-2026/concept/mcp-primitives) for what else a session can query.

## Architect's move

- Memorize the ritual: **connect → initialize → list → call**.
- **Config over hardcoding** — servers are data, not code.
- Debug missing tools at the **config first**, the server second.

*(Personal study notes paraphrased from "MCP: Build Rich-Context AI Apps with Anthropic" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
