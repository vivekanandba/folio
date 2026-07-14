# Content contract (schemaVersion 2)

Source of truth for pack shape: `schemas/*.json`. TypeScript types in `src/types.ts` must agree. Validator: `scripts/validate-content.ts`.

## Pack layout

```text
packs/<packId>/
  folio.json
  sheet.json            # optional until Phase 3
  concepts/<id>.md      # YAML frontmatter + markdown body
  sessions/<id>.json    # id === filename stem (no numeric prefix)
```

## folio.json

Required: `schemaVersion` (2), `id`, `title`, `subject`, `type` (`magazine|course|book|notes`), `source`, `summary`, `tags`, `curriculum`.

`curriculum`:

- `sheet` — optional filename (e.g. `sheet.json`)
- `concepts` — ordered concept ids
- `sessions` — ordered session ids (match file stems)

Every concept must either appear in at least one session’s `conceptIds`, or be marked in folio with `"practiceNone": ["crowded-corners"]` (escape hatch). Prefer linking a session.

## Concept frontmatter

```yaml
---
title: Flexi-cap vs multi-cap
summary: Labels sell a promise; holdings are what you own.
relatedSessions: [label-detective, sebi-fork]
---
```

## Session common header

```json
{
  "schemaVersion": 2,
  "id": "label-detective",
  "kind": "detective",
  "title": "Label Detective",
  "conceptIds": ["flexi-cap-vs-multi-cap"],
  "estimatedMinutes": 8,
  "intro": "…",
  "debrief": { "summary": "…", "principle": "…" }
}
```

`id` must equal the filename stem. Kind-specific body follows KIND specs under `specs/`.

## Alias

`kind: "calculator"` is accepted as alias for `lab` during migration, then renamed.
