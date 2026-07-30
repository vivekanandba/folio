# Benchmarking & evaluation — is it fast enough AND good enough?

> You haven't deployed a model until you've measured both of its faces under load.

> [!key] Two complementary measurements before shipping: **GuideLLM** benchmarks *the deployment* (latency/throughput under controlled load, streaming-aware — TTFT, ITL, end-to-end); **lm_eval** evaluates *the model's answers* (standardized accuracy tasks, pointed at your running server). The **model card** is the third witness. Report **p95/p99**, never just the mean.

## Evaluation vs benchmarking

*Evaluation* asks "is this model fit for purpose?" — broad: accuracy, safety, suitability. *Benchmarking* is one tool that helps answer it: standardized tasks, objective scores. Without both dimensions you can't place yourself on the accuracy ↔ performance ↔ cost triangle — 2× throughput at −15% accuracy may be a bad trade; an accurate model that misses latency SLOs isn't deployable at all.

## GuideLLM's five traffic patterns

| Pattern | What | Use for |
|---|---|---|
| **Synchronous** | one request at a time | clean baseline, no queuing |
| **Concurrent** | fixed parallel streams | "N simultaneous users" |
| **Constant** | fixed async rate | steady traffic |
| **Poisson** | fixed rate, random spacing | closest to real users |
| **Sweep** | floor → ceiling in one run | the full performance curve |

Four questions it answers: will it run on my hardware pre-deployment; servers needed for peak (cost/capacity); did the quantized/swapped model regress (A/B); where is the breaking point (autoscaling). One subtlety: keep `samples ≥ requests` so repeated prompts don't inflate prefix-cache hits and flatter the numbers.

## Why p95/p99, not the mean

Averages hide the tail: p95 is worse than the mean, p99 worse still — and a big mean↔p95 gap means real users are having a bad time even while the dashboard looks green. SLOs are written at percentiles; benchmarks must be read at them too.

## lm_eval and the model card

EleutherAI's harness runs hundreds of standard tasks (MMLU, HellaSwag, GSM8K…) against local models **or a live endpoint** — including your vLLM server. Mind the setup: 20 zero-shot examples gave HellaSwag ~30% ±10 (noise by design); the model card's 43 → 41 (95.3% recovery) came from the full ~10k set with 10-shot. Compare like with like, and read **recovery per benchmark** for the tasks *you* care about.

## Remember

- SLOs first; then benchmark against them. Percentiles, not means.
- GuideLLM = deployment speed under load; lm_eval = answer quality; model card = published recovery.
- Sweep gives the whole latency-vs-RPS curve in one run — find your knee before users do.
- A quantized model is judged by recovery on *your* tasks, not by its size tag.

*Personal paraphrase of my notes from "Fast and Efficient LLM Inference with vLLM" (DeepLearning.AI × Red Hat, Cedric Clyburn). Not affiliated.*
