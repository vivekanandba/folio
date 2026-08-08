# Evaluating generated media

> A creative prompt has many valid outputs — so evaluation is a funnel, not a checkpoint.

> [!key] Media quality is **subjective, multi-dimensional, and has no single ground truth** — yet you can't human-review every asset. The answer is a **tiered funnel**: fast scoring metrics filter first (SigLIP), LLM judges and rubrics explain the survivors (Gemini, Gecko), and scarce human judgment lands only where automation can't.

## Four evaluators, four trade-offs

```viz
{"type":"annotated","title":"Pick the right evaluator","prompt":"Tap each tier.","points":[{"label":"Metric","value":2,"note":"Scoring metric (SigLIP for images, FVD for video): fast, cheap, deterministic — ONE alignment number. Tells you nothing about WHY it failed or whether it's beautiful."},{"label":"LLM judge","value":3,"note":"Gemini + a rubric: multi-dimensional scores, reasoning, actionable feedback. Medium cost, non-deterministic."},{"label":"Rubric","value":3,"note":"Gecko: decompose the prompt into questions, verify each — interpretable per-element pass/fail; same question set across images = fair comparison. Less flexible for subjective traits."},{"label":"Human","value":4,"note":"The gold standard for nuance, culture, safety — and the only tier that doesn't scale. Spend it last."}]}
```

## How the two automated stars work

- **SigLIP** — a **dual encoder**: text and image are embedded *independently* into a shared space; a sigmoid similarity yields 0→1. Use as the **quick first filter**; mind its **max token limit** (score against a condensed prompt).
- **Gecko** — **decompose → verify**: an LLM turns the prompt into questions ("is there a cat?", "is it right of the flower?"), then answers each against the image. Runs on Gemini under the hood via the Vertex Gen-AI Evaluation Service, for images *and* video.

## The funnel

`generate → auto-score → LLM/rubric evaluate → human validate → iterate` — each tier filters for the next, and **insights feed back into generation**. Don't skip to humans; let automation do the work first.

> [!warn] Evaluation is a **continuous mechanism**, not a release gate. The agents in [the next concept](#/pack/ai-media-agents-2026/concept/media-agents) embed a judge *inside* the generation loop — every asset is born already evaluated.

## Architect's move

- Order evaluators by **cost**: metric → judge/rubric → human.
- Want *why*, not just *how good*? Use a **rubric** — per-element pass/fail is debuggable.
- Keep the **same question set** across candidates for fair comparison.

*(Personal study notes paraphrased from "AI Agents for Image and Video Generation" — DeepLearning.AI × Google. Not affiliated; for personal revision.)*
