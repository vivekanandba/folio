# Quantization — fewer bits, same answers

> Store π as 3.14 instead of 3.14159 — for seventy billion numbers at once.

> [!key] Model sizes double roughly yearly; GPU memory doesn't. **Quantization** closes the gap: store weights (and optionally activations) in fewer bits — BF16 → FP8/INT8 → INT4 — trading precision for size. Done **naively** it hurts accuracy; done with **calibration** (GPTQ, AWQ, SmoothQuant) the quality loss is typically a rounding error while memory halves or quarters.

## What it buys (Llama 4 Scout, 109B)

```viz
{"type":"what-if","compute":"modelMemory","title":"Bits → gigabytes","inputs":[{"key":"paramsB","label":"Parameters","min":1,"max":700,"step":1,"value":109,"unit":"B"},{"key":"bits","label":"Precision","min":4,"max":16,"step":4,"value":16,"unit":"bit"}],"output":{"label":"Weight memory","unit":"GB","decimals":0},"caption":"BF16 → 220 GB (3 GPUs). FP8 → half. INT4 → 55 GB — one 80-GB card."}
```

## The two schemes — a performance distinction, not an accuracy one

| | **W8A16** (weight-only) | **W8A8** (weight + activation) |
|---|---|---|
| Quantized | weights only | weights **and** activations |
| At inference | load compressed → dequantize to BF16 → BF16 cores | math runs on low-precision tensor cores |
| Speeds up | **data movement** (HBM→SRAM halves) | data movement **+ compute** (FP8 cores ≈ 2× BF16 FLOPS) |

The classic exam trap: weight-only does **not** "lose less accuracy" — with calibrated methods both preserve it. The difference is *which bottleneck you speed up*. Quantizing weights halves the bytes streamed per forward pass; quantizing activations too unlocks the fast low-precision tensor cores (FP8 on Hopper+, INT8 on Ampere).

## Why calibration keeps quality

Blind round-to-nearest degrades, especially at 4-bit. Calibrated methods run a **small representative dataset** through the model to find what matters:

- **AWQ** — *not all weights are equal*: protects weights tied to large activations, compresses the rest hard. Lighter and faster to calibrate; the INT4 favourite.
- **GPTQ** — *compensate for error*: measures per-weight sensitivity (Hessian), quantizes layer by layer, and nudges remaining weights to offset the rounding error. Industry standard.
- **SmoothQuant** — flattens activation spikes; the pick for W8A8 INT8.

Published check (Qwen-14B, avg pass@1 over AIME/MATH-500/GPQA): BF16 = 73.6, INT W4A16 = 72.8, FP W8A8 = 74.3 — differences within run-to-run noise. A real RAG workload (Llama 3 70B, 2×H100, FP16→FP8) tripled throughput (~158 → ~474 tok/s).

## Sparsification, the sibling

Zero out the least-useful weights and skip them at inference — commonly **2:4** (2 of every 4 values). Cuts memory *and* compute; pairs with quantization under the banner of **compression**. The embedding layer and LM head are left un-quantized in both techniques to protect accuracy.

## Remember

- Bits are a memory **and** bandwidth lever: 8-bit halves what moves HBM→SRAM.
- W8A16 speeds data movement; W8A8 speeds movement **and** compute. Not an accuracy split.
- Calibration (AWQ/GPTQ/SmoothQuant) is what separates "4× smaller, same quality" from "broken".
- Verify against the model card: look for ~99% accuracy **recovery**, per benchmark.

*Personal paraphrase of my notes from "Fast and Efficient LLM Inference with vLLM" (DeepLearning.AI × Red Hat, Cedric Clyburn). Not affiliated.*
