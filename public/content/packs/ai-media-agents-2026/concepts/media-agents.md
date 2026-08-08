# Media agents — generate, judge, retry

> An agent is a model that decides, tools that act, and an instruction that sets the rules of the loop.

> [!key] Every ADK agent = **model** (the brain that picks the next tool) + **tools** (functions it can invoke autonomously) + **instruction** (the system prompt that orchestrates them). The course builds two: an **image agent** (brand-true UI mockups) and a **video agent** (multi-scene explainers) — both wrap generation in an **evaluate-and-retry loop** so nothing ships unjudged.

## The image agent — four tools, one discipline

```viz
{"type":"annotated","title":"The image agent's tools","prompt":"Tap each.","points":[{"label":"brand_analysis","value":3,"note":"Gemini extracts the brand's visual DNA from a style-guide image → structured JSON (colors, typography, icon style, voice)."},{"label":"concepts","value":2,"note":"generate_design_concepts: brief + brand DNA → distinct concepts, each with a title, description, and generation prompt."},{"label":"generate","value":3,"note":"generate_idea_image: Nano Banana renders the mockup from prompt + the style guide image."},{"label":"evaluate","value":4,"note":"evaluate_image: LLM-as-judge scores vs the guide on aesthetics + the CRAP design principles (Contrast, Repetition, Alignment, Proximity), pass/fail vs a threshold, with actionable feedback."}]}
```

The instruction encodes the loop: analyse → concepts (regenerate if not distinct) → per concept: generate → evaluate (threshold 4.8) → on fail, **adjust the prompt from the feedback** and retry (max 1) → still failing? new concept. Tools return **structured JSON** (`response_schema` + Pydantic) so the loop can parse its own state.

## The video agent — the smarter retry

`plan_scenes` (brief → per-scene JSON: `visual_description`, `narration_script` ~20 words ≈ 8s, `camera_motion`) → per scene: reference frame (Nano Banana) → 8s clip with native audio (Veo) → `evaluate_scene`.

> [!tip] The judge returns a **`failure_type`**, and the retry is targeted: **audio failure → regenerate the video only (reuse the image); visual failure → regenerate both.** Diagnosing *what kind* of failure halves the cost of fixing it.

Two consistency knobs, defined once and reused everywhere: **`STYLE_PREFIX`** on every image prompt (visual consistency) and **`VOICE_PROFILE`** on every audio prompt (voice consistency). All passing clips concat (ffmpeg) into one explainer.

> [!more] Where the judges came from
> Both `evaluate_*` tools are the [LLM-as-a-judge tier](#/pack/ai-media-agents-2026/concept/media-evaluation) moved *inside* the loop — with thresholds, criteria (the video judge adds temporal consistency, motion coherence, narration alignment), and feedback that becomes the next attempt's prompt.

## Architect's move

- Structure agents as **model + tools + instruction**; make tool I/O **schema'd JSON**.
- Put the **judge inside the loop**; feed its feedback into the retry prompt.
- Classify failures (**visual vs audio**) and retry only what failed.

*(Personal study notes paraphrased from "AI Agents for Image and Video Generation" — DeepLearning.AI × Google. Not affiliated; for personal revision.)*
