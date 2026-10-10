# Plan 014 — Precompute the constellation's wires

**Spec:** ./spec.md  **Status:** executed

## Approach

The index is a pure function of the content: no timestamp, sorted edges,
undirected and de-duplicated, with links to non-existent concepts dropped at
build time rather than shipped. That purity is what lets `--check` distinguish
staleness from the clock moving.

Committed rather than build-generated, because `npm run dev` and the offline
preview serve `public/` directly and should not require a build step. The
staleness that invites is closed by a test, not by a convention.

## Touched surface

Create `tools/content-index/build.mjs`, `public/content/index.json`,
`specs/014-content-index/`. Modify `src/content.ts` (a loader),
`src/types.ts` (the shape), `src/pages/floor.ts` (consume it; the now-unused
LINK_RE removed), `tools/lint/{referential,cli}.ts` (the cross-link rule),
`tools/verify-build.mjs`, `tests/delivery.test.ts`, `package.json`.

## Verification plan

Measure before and after on the offline preview. Prove the link rule fails on a
dead concept link, a dead session link and a dead cross-pack link. Prove a stale
index fails. Then lint → test:gate → smoke → e2e → coverage:gate.

## Risks

- **A missing index is fatal to the home page**, since the loader throws like
  the catalog's. That is deliberate: it is verified in the build, over HTTP, and
  at deploy, so a missing index means a broken deploy and the error page is the
  honest signal. The alternative — degrading silently to no wires — is the
  defect this change exists to remove.
