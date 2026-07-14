# Folio product principles

Personal revision studio: distill what you read into a **pack** (sheet + concepts + interactive sessions), then revisit until ideas stick.

Not a content marketplace, LMS, or magazine mirror. Not graded by self-confidence alone.

## Constraints

- Static GitHub Pages only (no backend, auth, or sync)
- Published paraphrases under `public/content/` only — no magazine PDFs or verbatim long excerpts
- `~/per/learning` stays the raw vault — no submodule
- Progress in `localStorage` (device-local)
- Branch → PR → `main` → Pages

## Kind cognitive verbs

| Kind | Verb | Win condition |
|---|---|---|
| `detective` | Diagnose | Match assembled visual/case state to correct diagnosis |
| `decision` | Judge | Path score from node weights; map shows where you went |
| `audit` | Inventory | Self-report (not mastery); outputs remediation links |
| `lab` | Construct | Derived metric enters pass band; then optional transfer check |
| `classify` | Discriminate | Placement accuracy (+ optional second round) |
| `quiz` | Retrieve | Classic MCQ after concepts, used sparingly |

## Chrome freeze (through Phase 2)

No PRs whose primary change is glow, particles, cinematic hub art, or new session kinds. Pedagogy and architecture first. Spec → failing tests → implementation.

## MFI Jul 2026 gap inventory

- [x] Crowded Corners concept had no session (add in Phase 2)
- [x] Detective / lab climax as detached MCQ (fix in Phase 2)
- [x] Decision trees funnel without path scoring (fix in Phase 2)
- [x] Dual beige/dark visual systems (unify in Phase 1)
- [x] Quiz engine unused (wire retrieval in Phase 2/4)
- [x] Session files used numeric prefixes vs route ids (stabilize in Phase 1)
- [x] `conceptIds` unused in UI (wire in Phase 1)
- [x] No automated tests (SDD/TDD harness in Phase 0)
