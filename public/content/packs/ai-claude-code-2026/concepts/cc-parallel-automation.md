# Parallel work and automation — worktrees, commands, hooks, @claude

> One Claude is a pair programmer. Worktrees give you a team; hooks and slash commands give the team standing orders.

> [!key] **Git worktrees** check out multiple branches of the *same repo* into separate directories — isolated files, shared history. Lesson 5's workflow: commit clean → `mkdir .trees` → `git worktree add .trees/<feature>` per feature → **run a Claude Code session in each** → commit each → have Claude merge them all back and resolve conflicts. Three features (UI toggle, tests, quality) land simultaneously.

## The automation toolbox

```viz
{"type":"annotated","title":"Four mechanisms, four jobs","prompt":"Tap each.","points":[{"label":"Slash commands","value":3,"note":"A markdown file in .claude/commands/ becomes a command; $ARGUMENTS interpolates your input. The course's implement-feature.md bakes in scope rules ('only front-end') and standing permissions (always write frontend-changes.md)."},{"label":"Worktrees","value":4,"note":"True parallelism: N features, N directories, N Claude sessions, one shared git history — merged at the end by Claude itself."},{"label":"Hooks","value":3,"note":"Shell commands at lifecycle points — before/after tool execution, when a subagent finishes, when Claude finishes responding. Determinism where instructions might drift."},{"label":"@claude","value":3,"note":"GitHub integration via /install-github-app: mention @claude in any PR or issue and it implements, creates PRs, reviews — the workflow leaves your terminal."}]}
```

## Choosing the mechanism

A **slash command** packages a *prompt you keep retyping*. A **hook** guarantees a *side effect at a lifecycle moment* — it runs whether or not anyone remembers. **Worktrees** buy *throughput* when features are independent. **@claude on GitHub** moves the loop to where reviews already live.

> [!warn] The worktree flow starts with "make sure you've added and committed any previous changes" — parallelism on a dirty tree merges chaos. And the merge step is real work: the course's final prompt is explicitly *"merge in all the worktrees of the .trees folder into main and fix any conflicts."*

> [!more] The same ideas, one level up
> Slash commands are the [SDD pack's skills lesson](#/pack/ai-sdd-2026/concept/replanning-and-skills) in miniature — repeated prompt → packaged capability. And folio's own `/ship` command plus its pre-merge hooks are this exact toolbox, in production, in the repo you're reading this in.

## Architect's move

- Retyped prompt → **slash command**; must-always-happen → **hook**.
- Independent features → **worktrees**, from a clean tree, merged by Claude.
- Reviews living on GitHub → **@claude** there, not in your terminal.

*(Personal study notes paraphrased from "Claude Code: A Highly Agentic Coding Assistant" — DeepLearning.AI × Anthropic. Not affiliated; for personal revision.)*
