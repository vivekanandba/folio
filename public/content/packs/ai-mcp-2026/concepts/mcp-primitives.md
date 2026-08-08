# Tools, resources, prompts — the three primitives

> The client invokes tools, queries resources, and interpolates prompts. Knowing which is which is the whole game.

> [!key] A server can expose three primitive types: **tools** (functions the client invokes — retrieve/search, send a message, update records), **resources** (**read-only** data, like GET endpoints — files, database records, API responses), and **prompt templates** (pre-defined, high-quality templates for AI interactions — document Q&A, transcript summary, output-as-JSON).

## The triple, side by side

```viz
{"type":"annotated","title":"Who does what with each","prompt":"Tap each primitive.","points":[{"label":"Tools","value":4,"note":"Actions with effects. The MODEL decides to use them mid-conversation; the client invokes. @mcp.tool() on a function — schema from signature + docstring."},{"label":"Resources","value":3,"note":"Read-only context, GET-like: no significant computation, no side effects. The APP/user pulls them in (the course chatbot: @folders, @topic). mime_type hints the data type."},{"label":"Prompts","value":3,"note":"User-triggered templates: a set of User/Assistant messages, well-tested, interpolated with arguments (the chatbot: /prompts, /prompt <name> <args>)."}]}
```

## Resources: direct and templated

```python
@mcp.resource("papers://folders")          # static URI — list available topics
def get_available_folders() -> str: ...

@mcp.resource("papers://{topic}")          # templated URI — filled at runtime
def get_topic_papers(topic: str) -> str: ...
```

The URI (`scheme://path`) uniquely identifies the resource; templated URIs take runtime parameters. Set **`mime_type`** so the client knows what's coming back.

## Prompts: quality lives on the server

```python
@mcp.prompt(name="generate_search_prompt", description="...")
def generate_search_prompt(topic: str, num_papers: int = 5) -> str: ...
```

A prompt returns message content the client interpolates into the conversation — letting the **server author ship its best-tested prompt** instead of every user improvising one.

> [!warn] The confusion the quiz always finds: *"should this be a tool or a resource?"* Ask about **side effects and initiative**. Fetch-and-store papers from arXiv = side effects, model-initiated → **tool**. Read what's already in `papers_info.json` = read-only, app-initiated → **resource**. A reusable "summarize this document well" recipe → **prompt**.

> [!more] How the course chatbot surfaces them
> Tools flow to the LLM automatically. Resources appear as **@-mentions** (`@folders`, `@ai_interpretability`); prompts as **slash commands** (`/prompts` to list, `/prompt <name> <args>` to run) — a nice reminder that resources and prompts are *user/app-facing*, not model-facing.

## Architect's move

- **Side effects → tool. Read-only context → resource. Reusable recipe → prompt.**
- Give resources honest **URIs + mime types**; templated URIs for runtime lookups.
- Ship your best prompt **on the server** — tested once, reused everywhere.

*(Personal study notes paraphrased from "MCP: Build Rich-Context AI Apps with Anthropic" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
