# Folio

Personal **interactive revision** site — concept cards + creative sessions, static and deployable to **GitHub Pages**.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (with base `/folio/`, usually `http://localhost:5173/folio/`).

```bash
npm run build
npm run preview
```

## Content

Packs live under `public/content/`:

- `catalog.json` — registered packs
- `packs/<id>/folio.json` — metadata
- `packs/<id>/concepts/*.md` — paraphrased notes
- `packs/<id>/sessions/*.json` — interactive sessions (`kind`: quiz | classify | detective | calculator | audit | decision | sequence | estimate | hotspot | explainer | lab | blueprint)

Narrative fields (intro, debrief, briefing, quiz explanations) are Markdown and can embed
interactive figures as ` ```viz ` fences holding a JSON widget spec (`src/widgets.ts`) —
sliders (`what-if`), tap-to-annotate charts (`annotated`), or full live simulations (`sim`).
Estimate sessions can add a `live` spec so the guess slider drives a consequence readout
while dragging (whitelisted computes: `src/computes.ts`).

Pilot pack: **Mutual Fund Insight — Jul 2026** (personal paraphrases only; not affiliated with Value Research; not investment advice).

## GitHub Pages

1. Push this repo to GitHub as `folio` (or change `VITE_BASE` / `pages:build` to match the repo name).
2. Settings → Pages → Source: **GitHub Actions**.
3. Push to `main` (workflow: `.github/workflows/pages.yml`).

Progress is stored in **localStorage** (per browser); nothing is synced to a server.

## License

Private personal project unless you choose otherwise.
