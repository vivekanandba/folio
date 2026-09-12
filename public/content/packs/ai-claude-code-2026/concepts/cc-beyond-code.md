# Beyond the codebase — notebooks, dashboards, and Figma mockups

> The last two lessons stop editing code and start transforming artifacts: a messy notebook into an engineered analysis, a design file into a running app.

> [!key] Lesson 7 refactors an e-commerce **EDA notebook** with one structured prompt: keep the analysis, add documented sections (objectives → loading → preparation → metrics → summary), extract **reusable modules** (`business_metrics.py`, `data_loader.py`), upgrade every plot (titles, labeled axes, units) — then build a **dashboard** from the result. Lesson 8 goes further: **Figma mockup → Next.js app**, with Claude reading the design through the **Figma Dev-Mode MCP server** and checking its own work through **Playwright**.

## The notebook refactor, as a template

```viz
{"type":"annotated","title":"L7's refactor prompt structure","prompt":"Tap each demand.","points":[{"label":"Inventory","value":2,"note":"First: identify what exists — metrics calculated, visualizations, transformations, quality issues. Same explore-before-modify rule as lesson 2."},{"label":"Structure","value":3,"note":"Named sections, table of contents, a data dictionary of business terms — the notebook becomes a document someone else can read."},{"label":"Extraction","value":4,"note":"business_metrics.py and data_loader.py pulled out with docstrings — analysis code becomes tested, importable modules."},{"label":"Visual bar","value":3,"note":"Every plot: descriptive title, labeled axes with units. The dashboard inherits clean parts."}]}
```

## The Figma pipeline

Initialize (`npx create-next-app@latest .`), attach **two MCP servers** — Figma Dev-Mode (`claude mcp add --transport http figma-dev-mode-mcp-server http://127.0.0.1:3845/mcp`, enabled from the Figma desktop app) and Playwright — verify with `/mcp`, then one prompt: *analyze the mockup via the Figma MCP, build it in this Next.js app with recharts, and **verify it looks as close to the mock as possible via Playwright**.* Follow-up: *"populate these charts with real-world data from FRED."*

> [!tip] The loop is the lesson: **one MCP server to read the source of truth, another to verify the result** — Claude both builds and checks, against artifacts rather than adjectives. (The course notes a free Framelink alternative when Figma's official server needs a paid seat.)

> [!more] Same discipline, new media
> Nothing here is a new idea — inventory-first is lesson 2, verify-with-Playwright is lesson 3, structured demands are lesson 4. The point of the finale is that the workflow transfers: notebooks, dashboards and design files are all just codebases with different file extensions.

## Architect's move

- Refactor notebooks with **inventory → structure → extraction → visual bar**.
- Give Claude the **source of truth** (Figma MCP) and a **verifier** (Playwright).
- Treat every artifact as a codebase — the workflow doesn't change.

*(Personal study notes paraphrased from "Claude Code: A Highly Agentic Coding Assistant" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
