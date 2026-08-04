# The night gallery — visual non-negotiables

**Code:** `src/style.css`, `src/shader.ts`, `tools/contrast.py`
**Gates:** `python3 tools/contrast.py` (before any color-token commit),
`npm run smoke` (boot/layout), manual screenshots via `preview:offline`

## Color

1. **Single dark theme.** No toggles, no media-query themes — the theme
   switch was the failure mode that shipped an unreadable app once.
2. Every declared (text, background) token pair passes WCAG: body ≥ 7:1,
   secondary/status ≥ 4.5:1, non-text ≥ 3:1. `tools/contrast.py` computes
   this; its TOKENS dict must stay in sync with `:root`. Run it before any
   color commit — CI green ≠ readable.

## Motion

3. **Dual reduced-motion gate:** the CSS blanket block AND
   `prefersReducedMotion()` in every JS/rAF/WebGL module. Information must
   survive stillness (stamps render, sims step manually, floor draws static).
4. Canvas/WebGL modules (aurora, sim engine, floor) pause when hidden or
   off-screen and use an `everConnected` latch — they must never self-destroy
   because they were built before DOM attach (PR #17), and never grow the
   layout that contains them (PR #29; smoke asserts aurora height ≤ 700).

## Layout lessons (paid for)

5. Same-specificity CSS ties are resolved by file order — a later `> *` rule
   silently overrode `.aurora-canvas { position: absolute }` and fed a
   ResizeObserver growth loop. When a rule is load-bearing against a tie,
   repeat the property at higher specificity and say why in a comment.
6. `<main>` is a programmatic focus target: it must never show the global
   focus ring (PR #34) — interactive elements keep theirs.
7. Verify visual changes at BOTH 390px and 1280px (the floor's label-cull
   threshold sits between the two fit-all scales).
