# Folio

Personal **revision studio** — distill reading into packs (sheet + concepts + sessions), then revisit until ideas stick. Static site for **GitHub Pages**.

## Quick start

```bash
npm install
npm test
npm run validate
npm run dev
```

Open the URL Vite prints (base `/folio/`, usually `http://localhost:5173/folio/`).

```bash
npm run build
npm run preview
```

## Development

See `docs/PRODUCT.md`, `docs/CONTENT_CONTRACT.md`, and `docs/DEV_WORKFLOW.md` (spec → failing tests → implementation). Specs live under `specs/`.

## Content

Packs under `public/content/packs/<id>/`:

- `folio.json` — schemaVersion 2 + `curriculum` graph
- `sheet.json` — optional revision one-pager
- `concepts/*.md` — YAML frontmatter + paraphrased notes
- `sessions/<id>.json` — kinds: quiz | classify | detective | lab | audit | decision

Pilot: **Mutual Fund Insight — Jul 2026** (paraphrases only; not affiliated with Value Research; not investment advice).

## GitHub Pages

Push to `main` → workflow runs `npm test` then `npm run pages:build`. Progress stays in **localStorage**.

## License

Private personal project unless you choose otherwise.
