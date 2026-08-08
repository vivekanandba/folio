# The generative media map

> Before you pick a model, place it on three axes — that's how you reason about quality vs latency vs cost.

> [!key] Generative media extends what LLMs did for text to **image, video, audio, and music**. Every model sits somewhere on three dimensions: **modality** (unimodal / cross-modal / multimodal), **scope** (specialized / general-purpose), and **generation paradigm** (autoregressive / diffusion) — and the strongest systems are **hybrids** of the two paradigms.

## The three axes

```viz
{"type":"annotated","title":"Place any model on three axes","prompt":"Tap each dimension.","points":[{"label":"Modality","value":3,"note":"Unimodal (same in → same out, e.g. image super-resolution), cross-modal (text→image, text→video), multimodal (many in/out). More modalities = broader apps."},{"label":"Scope","value":3,"note":"Specialized goes deep on one domain (Lyria for music, Veo for video+audio); general-purpose covers many tasks flexibly (Gemini). Depth vs breadth."},{"label":"Paradigm","value":4,"note":"Autoregressive builds sequentially token-by-token; diffusion starts from noise and refines the whole output pass by pass."}]}
```

## Autoregressive vs diffusion

- **Autoregressive** — the LLM recipe: predict the next token, sequentially. Pipeline: `encode → generate → decode`. **Excels at instruction following, compositional accuracy, fine control.**
- **Diffusion** — a sculptor carving detail each pass: start from noise, denoise toward the output (in **latent space**). Pipeline: `condition → denoise → decode`. **Excels at high-fidelity detail, rich texture, coherence.**

> [!tip] **Hybrid is the real power**: autoregressive for global structure and coherence feeding diffusion for high-fidelity detail — input → [autoregressive] → [diffusion] → output.

> [!more] Why the map matters in practice
> Every product decision — which model, which size, how many candidates to generate — is a **quality ⚖️ latency ⚖️ cost** trade-off. The axes tell you what you're paying for: multimodality buys breadth, specialization buys domain depth, and the paradigm sets the failure modes you'll fight in [prompting](#/pack/ai-media-agents-2026/concept/media-prompting) and [evaluation](#/pack/ai-media-agents-2026/concept/media-evaluation).

## Architect's move

- Place a candidate model on all **three axes** before comparing benchmarks.
- Match **paradigm to failure mode**: control problems → autoregressive strengths; fidelity problems → diffusion strengths.
- Expect **hybrids** — structure from one, detail from the other.

*(Personal study notes paraphrased from "AI Agents for Image and Video Generation" — DeepLearning.AI × Google. Not affiliated; for personal revision.)*
