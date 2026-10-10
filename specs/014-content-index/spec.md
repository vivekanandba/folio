# Spec 014 — Precompute the constellation's wires

**Status:** agreed (user: "go ahead and do it", 2026-10-10, after a measured
review of improvement points)
**Constitution check:** Art. III — this changes app behaviour and the build, so
the spec, the test and the code land together.

## Why

The museum floor is the home page, and the page a phone opens first. It drew
its constellation by fetching **every concept's full markdown** to extract the
cross-links between them.

Measured on the offline preview with 15 packs:

| | requests | bytes |
|---|---|---|
| before | 138 | 584 KB |
| after | **66** | **350 KB** |

73 of those requests were markdown, downloaded to render 41 line segments. The
cost grew with every pack added — the Class XII work alone added 13 — and the
links themselves cannot change between deploys.

A second defect sat in the same loop: it swallowed errors. A renamed or deleted
concept did not fail, the wires just quietly disappeared.

## What

1. `tools/content-index/build.mjs` precomputes the cross-links into
   `public/content/index.json` (~4 KB, 41 edges).
2. The floor loads that file instead of the whole corpus.
3. The index is **committed**, so the dev server and offline preview need no
   build step — which makes staleness the risk, so a test asserts the committed
   file equals what regeneration produces.
4. The content linter gains a **cross-link rule**: every `#/pack/…/concept|session/…`
   in concept prose or session JSON must resolve. Cross-pack links make this a
   whole-registry check, not a per-pack one.

## Not in scope

Bundling, image optimisation, or the remaining per-request cost of the
unbundled preview (production bundles the JS; the preview does not).

## Acceptance criteria — each line names its gate

- [ ] The floor no longer fetches concept markdown *(measured: 138 → 66 requests)*
- [ ] A stale index fails *(delivery test: index is current)*
- [ ] A dead in-app link fails *(delivery test + lint, proven on concept,
      session and cross-pack links)*
- [ ] The index ships in the build *(verify-build)* and is served *(delivery)*
- [ ] The floor still renders its constellation *(pages, smoke, e2e)*
