# Prompting for images and video

> Keywords are for you. The model prefers one rich paragraph — so let an LLM write it.

> [!key] Both formulas structure a scene, then two power-ups apply: **LLM-enhanced prompting** (hand the keyword list to an LLM; it weaves one detailed paragraph — the form the model actually prefers) and a **reference image** (style blueprint for images; the **first frame** for video).

## The image formula (Nano Banana)

```viz
{"type":"annotated","title":"Six dimensions of an image prompt","prompt":"Tap each.","points":[{"label":"Subject","value":3,"note":"Who/what the image is about."},{"label":"Action","value":2,"note":"What the subject is doing — life and movement."},{"label":"Location","value":2,"note":"Scene, environment, background."},{"label":"Camera","value":3,"note":"Composition: depth of field, perspective, framing — 'low-angle shot', 'shallow depth of field'."},{"label":"Lighting","value":2,"note":"'Cinematic lighting', 'white lighting' — how the scene is lit."},{"label":"Style","value":3,"note":"The aesthetic: 'minimalistic vector art' — colors, textures, feel."}]}
```

## The video formula (Veo) — three keyword groups

- **Main** — subject, action, **scene** (the where *and when*), style, and **temporal** (how the scene changes over time — pacing, flow).
- **Camera** — angle (eye-level, high-angle, close-up), **movement** (static, pan, tilt), lens effects (wide-angle, lens flare, bokeh).
- **Audio** — dialogue and sound effects (video generates **native audio**: a ticking clock is part of the prompt).

> [!warn] The two formulas overlap but aren't the same: video adds **temporal**, **camera movement**, and **audio** — the dimensions that only exist once time does. Mixing them up is the classic revision slip.

## The workflow that compounds

Basic prompt → structured keywords → **LLM enhancement** → plus a reference image → generate → **save the output** (it becomes the next lesson's reference: the image you made feeds the video's first frame). Videos come back as a **long-running operation you poll** (~15s intervals) — media generation is asynchronous by nature.

> [!more] Code knobs worth remembering
> `response_modalities` (image only, or image+text to see the model's reasoning), `aspect_ratio`, and video's `GenerateVideosConfig`. The pipeline models: Nano Banana (Gemini Flash Image) for stills, Veo for clips, a Gemini text model as the **prompt-enhancing director**.

## Architect's move

- Write **keywords for structure**, then let an LLM turn them into the paragraph.
- Anchor consistency with a **reference image** — style for stills, first frame for motion.
- Prompt the **audio and the camera**, not just the picture, when time is involved.

*(Personal study notes paraphrased from "AI Agents for Image and Video Generation" — DeepLearning.AI × Google. Not affiliated; for personal revision.)*
