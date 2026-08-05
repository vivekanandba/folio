# Folio constitution

The non-negotiable principles every feature is built under. Feature specs
(`specs/NNN-*/spec.md`) may add constraints; they may never relax these.
Each article exists because violating it already cost us once — the incident
is cited so the rule survives its author.

## Article I — Zero runtime dependencies

The app ships with `typescript` + `vite` as devDependencies and **nothing
else**. The dev environment is offline (`npm install` is a no-op; the
lockfile cannot be regenerated), so every capability — WebGL, simulation,
tests, smoke, service worker — is hand-written on platform primitives.
*A dependency once broke CI for everyone: the removed `@anthropic-ai/sdk`
lockfile drift (PR #8).*

## Article II — Verification before merge, not after

Every PR passes the gate (`ci.yml`: lint:content, the full test suite,
tsc + vite build, boot smoke) before merging. Nothing goes straight to main.
*CI-on-main-only let a missing `KIND_WEIGHT` entry break the deploy (PR #18/#19).*

## Article III — Engine change = spec + test, same PR

New engine behavior lands with its invariant recorded in `specs/` and the
test that enforces it. A spec line without a gate is a wish.
*Every logic layer that got tests shipped zero bugs; every layer without
them shipped several.*

## Article IV — Readability is proven, not eyeballed

One dark theme, no toggles. Every (text, background) token pair passes
`tools/contrast.py` (body ≥ 7:1, secondary ≥ 4.5:1) before a color commit.
Visual changes are screenshot-verified at 390px AND 1280px via
`preview:offline`. *The first dark theme shipped unreadable and had to be
removed; the floor's label culling silently broke desktop between widths.*

## Article V — Motion is optional, information is not

Dual reduced-motion gate (CSS blanket + `prefersReducedMotion()`) on all
JS/rAF/WebGL motion. Everything a moving element communicates must survive
stillness: sims step manually, stamps render statically, the floor draws
without pulsing. Canvas/WebGL modules pause off-screen/hidden and must
neither self-destroy pre-attach (PR #17) nor feed their own layout (PR #29).

## Article VI — Content is data, engines are whitelists

Session JSON selects behavior **by id** from whitelisted registries
(kinds, sim models, computes, blueprint rules). No eval, no code in content.
The linter's copies of the whitelists must equal the live registries —
enforced by test, not review. Course/publication-derived packs are personal
paraphrased study notes; no third-party assets are committed.

## Article VII — The learner's data is theirs

Progress lives in localStorage, exportable/importable as validated JSON,
and the app works offline after one visit (service worker). No accounts,
no telemetry, no server.

## Article VIII — Honest teaching

Debriefs claim exactly what the mechanic proves (a single-kill inspection
does not prove cross-wiring). Generated drills carry computed ground truth,
never hand-typed answers. If data is thin (retention buckets), the UI says
"no data yet" rather than implying a measurement.
