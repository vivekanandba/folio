# Serving with vLLM — continuous batching, PagedAttention, prefix caching

> The GPU should never wait for work, and no byte of cache should sit reserved for a token that never comes.

> [!key] Shrinking the model is half the story; serving **many users** without idling the GPU or exhausting memory is the other half. Three engine techniques power vLLM: **continuous batching** (keep the GPU busy), **PagedAttention** (no cache waste), **prefix caching** (never recompute shared context).

## Why batching, and why *continuous*

Each decode step streams **all** the weights from HBM whether it serves 1 user or 64 — tensor cores mostly wait for data. Batching reads the weights **once** for many users:

```viz
{"type":"sim","model":"llmServe","title":"The token factory","caption":"Raise the batch and watch throughput soar while data-per-token collapses. Then cut precision — the fixed cost itself shrinks."}
```

**Static** batching (fine for BERT/YOLO) schedules whole batches: a short answer sits idle behind a 2000-word essay. **Continuous** batching schedules at the **token level** — the moment a request finishes, a queued one takes its slot next step. LLM output lengths vary wildly, so this is the difference between a busy GPU and a mostly-idle one.

## PagedAttention — virtual memory for the cache

Early servers pre-allocated each request one **contiguous** block at max length. Result: **internal fragmentation** (reserved slots never used), **external fragmentation** (gaps too small to reuse), **over-reservation** — only **20–40%** of cache memory held real tokens (Kwon et al., SOSP 2023).

vLLM's fix is the OS playbook: split the cache into **fixed-size blocks (pages)** scattered anywhere in memory, stitched by a **block table** per request. Blocks are allocated one at a time, only as tokens actually land; all requests share one physical pool. No pre-allocation, no fragmentation — the wasted 60–80% comes back as concurrency.

## Prefix caching — compute once, reuse

When requests share a prefix — the same system prompt, few-shot examples, RAG context, or the previous turns of a conversation — the shared KV blocks are **reused, not recomputed**. At a 75% hit rate this alone is ~4× throughput (Llama 3.1 8B on one H100).

## Seeing it live

`vllm serve Qwen/Qwen3-0.6B` exposes an **OpenAI-compatible API** — the standard `openai` client just works — plus a Prometheus **`/metrics`** endpoint: `num_requests_running` (continuous batching in action), `prefix_cache_queries`/hits (reuse happening), KV-cache usage. Fire five concurrent requests and watch `running` hit 5.

## Remember

- Decode is bandwidth-bound: the weights stream per step. Batching amortizes; quantization shrinks.
- Continuous batching = token-level scheduling; no slot waits for the longest request.
- PagedAttention = paged virtual memory for KV; recovers the 60–80% a naive allocator wastes.
- Prefix caching turns shared context into free throughput — engineer your prompts to share.

*Personal paraphrase of my notes from "Fast and Efficient LLM Inference with vLLM" (DeepLearning.AI × Red Hat, Cedric Clyburn). Not affiliated.*
