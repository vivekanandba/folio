# folio — working agreement

> Machine-wide engineering rules live in the **engineering constitution**
> (`~/.claude/CLAUDE.md`, versioned at `~/data-dash/constitution`) and are already loaded in
> this session. Cite a rule ID (e.g. `CON-VER-001`) rather than restating it — copies drift,
> citations don't. This file holds only what is specific to this repo.

## What this is

Personal interactive revision site — concept cards + creative sessions, static, deploys to GitHub Pages.

## Commands

```sh
npm test  ·  npm run build
```

## Gates

- Hooks: `.githooks/` via `core.hooksPath` (installed by the `house-gates` skill) — secret
  scanning, protected branch (CON-PROC-008), commit message.
- CI: ci.yml, pages.yml — the authority; hooks are the fast loop and are bypassable.

## Project notes

ci.yml and pages.yml: the Pages deploy is the live gate.

## Layout

src/ · specs/ (7) · tests/ · tools/ · public/

---

*This file was created when the constitution was introduced, from what the repo shows rather
than from a template. It is deliberately short: grow it from incidents, not from boilerplate,
and put anything transferable in the constitution via `/lesson`.*
