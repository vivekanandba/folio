# Features, prompts, and MCP verification

> A good feature prompt names the files, states current behavior, and defines done. A great one comes with a screenshot.

> [!key] Lesson 3 adds three features to the RAG chatbot, and every prompt shares an anatomy: **plan mode** first, **`@file` anchors** (`@backend/search_tools.py`), a statement of **how it works now**, the **desired behavior**, and explicit **constraints** ("links embedded invisibly — no visible URL text"). Visual work adds two more tools: **pasted screenshots** ("these links are hard to read — make them more appealing") and the **Playwright MCP server** so Claude can look at the running app itself.

## The prompt anatomy

```viz
{"type":"annotated","title":"What strong feature prompts contain","prompt":"Tap each element.","points":[{"label":"@ anchors","value":3,"note":"Exact files: @backend/document_processor.py, @frontend. No guessing where the change lives."},{"label":"Current → desired","value":4,"note":"'When courses are processed, the link is stored in course_catalog' → 'each source becomes a clickable link opening the lesson in a new tab'. State both sides."},{"label":"Constraints","value":3,"note":"'Match the styling of existing sections — same font size, color, uppercase.' Acceptance criteria in the prompt, not in your head."},{"label":"Visual feedback","value":3,"note":"Paste a screenshot for iteration — or let Claude take its own via Playwright MCP and compare against the target."}]}
```

## MCP in the loop

The course wires **Playwright** (`claude mcp add playwright npx @playwright/mcp@latest`, verify with `/mcp`) so follow-ups become: *"Using the playwright MCP server, visit 127.0.0.1:8000 and view the '+ New Chat' button… make sure it's left-aligned and the border is removed."* Claude sees the page, not your description of it.

- **`/permissions`** manages what runs unprompted — the course adds an allow rule for the screenshot tool by its full name (`mcp__playwright__browser_take_screenshot`), found via `/mcp` → server → tools.

> [!warn] The third feature (an outline tool for the chatbot) shows the ceiling: Claude Code can design *new tools for your AI system* — but only because the prompt explained the data (the `course_metadata` collection) it should build on. The model is the muscle; the context is still the brain.

> [!more] Protocol details
> How MCP servers, clients and tools actually fit together is the [MCP pack's](#/pack/ai-mcp-2026/concept/mcp-architecture) territory; here they're simply capabilities you attach to your coding session.

## Architect's move

- Prompt with **anchors, both behaviors, and constraints** — plan mode on.
- Close visual loops with **screenshots or Playwright**, not adjectives.
- Curate **`/permissions`** deliberately; allow by full tool name.

*(Personal study notes paraphrased from "Claude Code: A Highly Agentic Coding Assistant" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
