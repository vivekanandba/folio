# Compressing a model for real — the LLM Compressor workflow

> Expected 75% smaller, measured 42% — knowing why is the difference between reading about quantization and doing it.

> [!key] The end-to-end recipe: **① pick model + calibration dataset → ② pick algorithm (GPTQ/AWQ/…) → ③ pick scheme (W4A16/INT8/…) → ④ run one-shot post-training quantization → verify size, sample output, and perplexity → serve the checkpoint directly in vLLM.** Calibration data is what lets the algorithm protect the weights that matter.

## Choosing the algorithm

| Algorithm | Type | When |
|---|---|---|
| **Round-to-nearest** | W & A | fastest, no calibration; baseline & CPU/GGUF experiments — degrades at INT4 |
| **AWQ** | weights | best accuracy/speed for INT4 on NVIDIA; lighter calibration |
| **GPTQ** | weights | industry standard, widely supported; needs more VRAM |
| **SmoothQuant** | transform | the W8A8 INT8 pick — flattens activation spikes |
| **SparseGPT** | sparsity | extreme 2:4 compression on supporting GPUs |

## The one-shot run

```python
oneshot(
    model=model,                     # e.g. Qwen3-0.6B
    dataset="wikitext-2",            # representative calibration text
    recipe=GPTQModifier(targets="Linear", scheme="W4A16", ignore=["lm_head"]),
    num_calibration_samples=256,     # solid default; more → tiny gains
)
```

Targets the **linear layers** (where the parameters are), ignores `lm_head` (protects accuracy). Key GPTQ knobs: smaller `block_size` → better recovery, longer run; `actorder="static"` is the safe default.

## Why 4-bit ≠ 4× smaller

16 → 4 bits *suggests* −75%, but the measured drop on Qwen3-0.6B was **~42%**: only the linear-layer weights quantize; the LM head and normalization layers stay high-precision and drag the total. **Bigger models get closer to the theoretical 4×** — the un-quantized parts stop mattering.

## Proving it still works

Two checks before celebrating:

1. **Sample prompt** — same prompt, same sampling; expect *similar, not identical* output.
2. **Perplexity** — how well the model predicts held-out text (lower = better). Base 32.79 → quantized 35.48, ~**8% worse** — usually well worth a 42–75% size cut, but "acceptable" always depends on the use case.

```viz
{"type":"what-if","compute":"gpusNeeded","title":"Size → hardware","inputs":[{"key":"gb","label":"Checkpoint size","min":5,"max":250,"step":5,"value":140,"unit":"GB"},{"key":"gpuGB","label":"GPU memory","min":24,"max":96,"step":8,"value":80,"unit":"GB"}],"output":{"label":"GPUs just to load","decimals":0},"caption":"The point of the whole exercise: drag the checkpoint smaller and watch the GPU count fall."}
```

## Remember

- Workflow: model + calibration data → algorithm → scheme → one-shot → verify → serve.
- Calibration data is not training — it's a few hundred samples used to *measure* sensitivity.
- Small models under-deliver on the theoretical shrink; big models approach it.
- Always re-measure: size on disk, a sample generation, and perplexity against base.

*Personal paraphrase of my notes from "Fast and Efficient LLM Inference with vLLM" (DeepLearning.AI × Red Hat, Cedric Clyburn). Not affiliated.*
