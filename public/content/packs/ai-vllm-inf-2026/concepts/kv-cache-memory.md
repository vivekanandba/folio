# Inference & memory — the forward pass and the KV cache

> Every token is a full trip through the model. The cache exists so the past only gets computed once.

> [!key] Generation is **autoregressive**: one token at a time, each conditioned on all previous tokens — a 500-token answer is 500 forward passes. Two tenants share GPU memory: the **weights** (fixed for the server's life) and the **KV cache** (grows with every token of every active request). Managing the cache is the #1 job of a production inference server.

## Inside one forward pass

```
tokens → embeddings → [ Self-Attention + Feed-Forward ] × N layers → LM head → next-token scores
```

Almost all parameters and compute live in **linear layers** (vector × weight-matrix): four in attention (`q/k/v/o_proj`), three in the FFN (`gate/up/down_proj`). Attention lets tokens exchange information — the current token's **Q**uery is scored against every previous token's **K**ey, and the softmaxed weights blend their **V**alues.

## Why the KV cache exists

To generate a new token you need the **K and V of every previous token** but only the **Q of the current one**. Past K/V never change — recomputing them every step would be pure waste — so they're cached in GPU memory, at **every one of the N layers**.

## How big it gets

`mem/token = 2 × layers × KV-heads × head-dim × dtype-bytes` — for Llama 3 70B: 2 × 80 × 8 × 128 × 2 ≈ **320 KB per token**. That's 640 MB for a 2K chat turn, 10 GB for a 32K document, **40 GB for one 128K request** — a third of the weights, per request. It grows linearly with context length × concurrent users:

```viz
{"type":"sim","model":"kvcache","title":"The pressure vessel","caption":"180 GB of cache after the weights. Raise users and context — then drop the whale and watch everyone else starve."}
```

## The memory hierarchy the speed comes from

| Tier | What | A100 |
|---|---|---|
| **SRAM** | on-chip, beside the tensor cores | 20 MB @ ~19 TB/s |
| **HBM** | "GPU memory" on the card | 40 GB @ 1.5 TB/s |
| **CPU DRAM** | host memory, far away | big, but ~12 GB/s to the GPU |

Weights load into HBM once at startup; the cache lives there too. Every forward pass streams chunks of both **HBM → SRAM** for the tensor cores — per linear layer, per layer, per token. Two things govern speed: how fast that data moves, and how fast the cores compute once it arrives.

## Remember

- One token = one full forward pass; K/V of the past are cached, only Q is fresh.
- ~320 KB/token on a 70B — context length is a memory budget, not just a quality knob.
- Weights are the fixed tenant; the KV cache is the growing one. Plan for the cache.
- Inference speed = data movement (HBM→SRAM) + tensor-core math. Optimize the movement first.

*Personal paraphrase of my notes from "Fast and Efficient LLM Inference with vLLM" (DeepLearning.AI × Red Hat, Cedric Clyburn). Not affiliated.*
