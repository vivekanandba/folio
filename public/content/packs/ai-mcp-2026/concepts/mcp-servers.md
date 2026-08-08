# Building MCP servers — FastMCP and the two requests

> A server's whole job is answering two questions: "what tools do you have?" and "run this one."

> [!key] An MCP server handling tools serves two request types: **`ListToolsRequest`** and **`CallToolRequest`**. You can implement them low-level (full control) — or use **FastMCP**, where you *just write Python functions* and the decorators turn them into protocol-compliant tools, schemas included.

## Two ways to build

- **Low-level**: define and handle each request type yourself — customize every aspect of the server.
- **FastMCP (the course's path)**: declare the server, decorate functions, run. The docstring and type hints *become* the tool schema the client sees:

```python
mcp = FastMCP("research")

@mcp.tool()
def search_papers(topic: str, max_results: int = 5) -> List[str]:
    """Search arXiv for papers on a topic and store their info."""
    ...
```

## The research server

The course wraps the Lesson-3 chatbot's two functions — `search_papers` (arXiv query, saves `papers_info.json` under a per-topic folder) and `extract_info` — into `research_server.py`, run with **uv** in its own project (`uv init`, venv, `uv add mcp arxiv`).

```viz
{"type":"annotated","title":"From function to tool","prompt":"Tap each step.","points":[{"label":"Write fn","value":2,"note":"A plain Python function with type hints and a docstring — the same code the chatbot called directly."},{"label":"@mcp.tool()","value":3,"note":"The decorator registers it; FastMCP derives the schema from the signature + docstring. No handwritten JSON schema."},{"label":"Transport","value":3,"note":"mcp.run(transport='stdio') for local — the client will launch this file as a subprocess."},{"label":"Inspect","value":4,"note":"npx @modelcontextprotocol/inspector — connect, list tools, call them interactively before any client exists."}]}
```

> [!tip] **Test with the inspector before writing any client.** The inspector is a browser UI that connects to your server, lists its capabilities, and lets you invoke tools by hand — the fastest feedback loop MCP has.

> [!more] The burden moves, and that's the point
> After Lesson 5's refactor, the chatbot's code contains *no tool definitions and no execution logic* — only query processing and the chat loop. The server owns the tools; **any** MCP-compatible app can now use them. That's the "build once, adopted everywhere" promise from [the architecture](#/pack/ai-mcp-2026/concept/mcp-architecture) made concrete.

## Architect's move

- Reach for **FastMCP** first; drop to low-level only when you must control the protocol.
- Let **signatures + docstrings** be the schema — one source of truth.
- **Inspector before client** — verify list/call by hand.

*(Personal study notes paraphrased from "MCP: Build Rich-Context AI Apps with Anthropic" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
