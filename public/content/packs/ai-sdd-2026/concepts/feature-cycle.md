# The feature cycle — plan, implement, validate

> One feature, one branch, three documents — and every fix goes through the agent so the specs move with the code.

> [!key] Each roadmap phase runs the same loop on its **own branch**: write the **feature spec** — `plan.md` (numbered task groups), `requirements.md` (scope, decisions, context), `validation.md` (how you'll know it's done and mergeable) — review it, commit it, *then* implement, *then* validate at high altitude and merge.

## The three feature-spec docs

Created in a dated directory (`specs/2026-03-30-hello-hono/`), always referring back to `mission.md` and `tech-stack.md`:

```viz
{"type":"annotated","title":"The feature spec","prompt":"Tap each doc.","points":[{"label":"plan.md","value":3,"note":"Numbered task groups — the approach and sequence. (Phase 1: 4 groups, 10 steps.)"},{"label":"requirements.md","value":3,"note":"Scope, decisions, context — pinned framework version, strict TypeScript, stakeholder notes. Decisions the interview surfaced, written down."},{"label":"validation.md","value":4,"note":"The done-criteria: how you'll verify the feature works and is mergeable. Written BEFORE the code exists."}]}
```

## Practices that make it work

- **Fresh agent context per feature** — start clean; the agent pulls what it needs from the constitution, the official source.
- **Interview before writing** — the agent surfaces choices (scope? pin the version? how to confirm?). You don't have to agree; clarify what bothers you.
- **Commit the spec before implementing.** The implementation prompt is then almost trivial: *"implement this plan."*
- **Review at the right altitude** — does it work, does it reflect the spec? Not which CSS class it chose.
- **Fix the spec, not just the code.** Every correction goes through the agent so `plan/requirements/validation` stay in sync, and the agent **re-validates** (typecheck + smoke) after each change.

> [!warn] **Drift** is the failure mode: hand-editing code leaves specs describing software that no longer exists — and quietly rebuilds the **cognitive debt** (the mental load of tracking what changed and why) that SDD exists to eliminate.

> [!more] Big-bang MVPs — the extreme test
> Once several phases hang together you can spec and implement them **in one large step** — but only if you trust your constitution's quality and can handle the review. The real payoff: asking the agent *"did the build surface anything unclear in the specs?"* exposed planning holes (column names, route nesting) worth taking to stakeholders. Validate the **specs**, not just the code.

## Architect's move

- **Branch → spec → commit → implement → validate → merge**, in that order.
- Keep changes small enough to review; route every fix **through the agent**.
- Treat validation criteria as part of the spec — written before the code.

*(Personal study notes paraphrased from "Spec-Driven Development with Coding Agents" — JetBrains × DeepLearning.AI. Not affiliated; for personal revision.)*
