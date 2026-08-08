# Plan 004 — MCP pack

**Spec:** ./spec.md  **Status:** executed

## Approach

Content-only pack. Sources: L3–L7/L9 notebook markdown (contents API),
L1/L2/L10 via git blobs API (>1MB) with embedded slide PNGs extracted and
**transcribed via the Read tool (vision)** — key slides captured: the REST/
LSP analogy, fragmented-vs-standardized (M×N→M+N), host/client/server
definitions, the primitives table (client invokes/queries/interpolates ↔
server exposes), @mcp.tool/resource/prompt code, transports (stdio;
HTTP+SSE stateful; streamable HTTP stateless-or-stateful), OAuth 2.1 note,
composability (a client can be a server). `mcp_project/` grounds config/code
fences (server_config.json with npx/uvx/uv commands).

## Touched surface

- **Create:** `public/content/packs/ai-mcp-2026/` (folio.json, 5 concepts,
  13 sessions); blueprint case in `tests/blueprint.test.ts`.
- **Modify:** `public/content/catalog.json`.
- **Reuse:** 12 kinds, annotated viz, blueprint test helpers.

## Engine/data changes

None. No whitelist / exhaustive-Record updates.

## Verification plan

lint:content → blueprint case (chain N/N; host→data and client→tool wires
fail) → npm test (37 expected) → npm run smoke (6/6) → /ship linking this
spec.

## Risks

1. **Slide-transcription fidelity** — mitigated by transcribing verbatim
   claims only (definitions, tables) and grounding everything else in the
   L3–L9 text + project code.
2. **Primitives nuance** (control model) — the course states client
   invokes tools / queries resources / interpolates prompts; the
   user/app/model-control framing is kept to what L7 + slides support:
   tools = model-invoked via client, resources = read-only app data
   (GET-like), prompts = user-triggered templates.
