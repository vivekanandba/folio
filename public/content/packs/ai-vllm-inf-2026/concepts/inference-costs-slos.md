# Why inference efficiency is the new bottleneck

> Training happens once. Inference happens every single time a user hits send.

> [!key] Most AI cost is **inference, not training**. Good open models are now abundant (thousands on Hugging Face — Llama, Mistral, Qwen, DeepSeek, even gpt-oss); running them cheaply is the hard part. A deployment is only viable if it is **both fast enough AND accurate enough** — and you can't know either without measurable targets (**SLOs**).

## Why self-host at all?

| Reason | Payoff |
|---|---|
| **Cost** | match model size to task difficulty instead of paying per token |
| **Security** | data never leaves your environment (healthcare, finance) |
| **Control** | upgrade on your schedule — no rate limits, no third-party downtime |
| **Customization** | fine-tune for your accuracy and cost point |

## The four performance metrics

```viz
{"type":"annotated","title":"The metrics an LLM SLO is written in","prompt":"Tap each metric.","points":[{"label":"TTFT","value":2,"note":"Time to first token — how long the user stares at nothing before any response starts. Chatbots demand ≤200 ms at p99."},{"label":"ITL","value":1,"note":"Inter-token latency — average gap between streamed tokens. Governs how smooth the answer feels."},{"label":"Req latency","value":4,"note":"Total end-to-end time for the full answer. What a non-streaming client experiences."},{"label":"Throughput","value":3,"note":"Output tokens/sec across ALL requests — whether the deployment survives production scale."}]}
```

Different use cases set different thresholds: an e-commerce chatbot might demand TTFT ≤ 200 ms and ITL ≤ 50 ms at p99; a RAG system can relax TTFT to 300 ms but cap end-to-end at 3 s. **Define the SLO before you benchmark** — numbers only mean something relative to targets.

## The hardware reality (Llama 3 70B)

GPU memory must hold **weights** (fixed, ~140 GB at BF16) plus the **KV cache** (grows per token, per active request). Four 80-GB GPUs = 320 GB → about 180 GB left for cache. One 32K-token request eats ~10 GB of it:

```viz
{"type":"what-if","compute":"kvCacheGB","title":"How much cache does a context eat?","inputs":[{"key":"tokensK","label":"Context length","min":1,"max":128,"step":1,"value":32,"unit":"K tok"}],"output":{"label":"KV cache for ONE request","unit":"GB","decimals":1},"caption":"Llama-3-70B geometry: ~320 KB per token. Drag to 128K — one request rivals a third of the weights."}
```

Naive serving fits 2–3 users in that space. Managed well, the same hardware serves ~18 long-context users. That gap is the whole course.

## The tradeoff triangle

**Accuracy ↔ Performance ↔ Cost — pick two.** Better latency needs more compute; bigger models cost more; aggressive optimization can dent accuracy. Two optimization families push the frontier: **model optimizations** (quantization, sparsification — applied before deployment) and **inference optimizations** (continuous batching, PagedAttention, prefix caching — applied at runtime). Stacking them is roughly a 10× cost cut versus naive serving.

## Remember

- Inference dominates AI cost because it recurs per message; training is one-off.
- SLOs first, benchmarks second — TTFT / ITL / request latency / throughput, at percentiles.
- GPU memory = weights (fixed) + KV cache (grows); the cache is the contested resource.
- Model optimizations shrink the model; inference optimizations run it smarter. Stack both.

*Personal paraphrase of my notes from "Fast and Efficient LLM Inference with vLLM" (DeepLearning.AI × Red Hat, Cedric Clyburn). Not affiliated.*
