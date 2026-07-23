# Quality attributes — performance, scalability, availability

> The average latency lies. The tail is where your users live.

> [!key] The big four non-functional drivers: **performance** (response time = processing + waiting), **scalability** (serve more load — scale *up* vs *out*), **availability** (fraction of time the system is usable — the "nines"), and **fault tolerance** (stay available *despite* failures, via redundancy). Measure them at the **tail (p99)**, not the mean.

## Performance: response time has two parts

**Response time = processing time + waiting time.** A request can be computed in 5 ms yet take 800 ms because it sat in a queue behind other work. Optimising the algorithm does nothing if the wait dominates — you fix waiting with concurrency, queuing, and capacity, not faster code.

- **Throughput** — requests handled per second. High throughput and low latency are related but distinct goals.

## Why percentiles beat averages

An average hides the pain. If 99% of requests are fast and 1% take 10 s, the mean looks fine — but that 1% is often your most engaged users (biggest carts, most data). **p99 = 200 ms** means "99% of requests finish within 200 ms" — a promise about the tail.

```viz
{"type":"annotated","title":"Read the latency distribution","prompt":"Tap each marker.","points":[{"label":"avg","value":1,"note":"Mean latency. Hides outliers — a few very slow requests barely move it. Do not SLA on this."},{"label":"p50","value":1,"note":"Median. Half of requests are faster. Still says nothing about the worst experiences."},{"label":"p95","value":2,"note":"95% finish within this. The tail starts to show."},{"label":"p99","value":4,"note":"99% finish within this. THIS is what you promise and alert on — the experience of your heaviest users."}]}
```

> [!warn] Systems don't slow down gracefully. As load rises, latency is flat — then hits a **knee** and degrades sharply. Plan capacity to stay left of the knee; past it, small load increases cause large latency spikes.

## Scalability: up vs out

- **Vertical (scale up)** — a bigger machine. Simple, but bounded by the largest box money can buy, and it's a single point of failure.
- **Horizontal (scale out)** — more machines behind a load balancer. Effectively unbounded and fault-tolerant, but forces you to handle **statelessness, data distribution, and coordination**.

> [!tip] Large-scale systems favour **horizontal** scaling — it's the only path past one machine's ceiling and it doubles as redundancy. The cost is complexity: no local state, distributed data, consensus.

## Availability: the nines, and MTBF/MTTR

**Availability = MTBF / (MTBF + MTTR)** — mean time *between* failures over total time (uptime + repair). You raise it by failing less often *or* recovering faster.

```viz
{"type":"what-if","title":"Availability → downtime per year","compute":"downtime","inputs":[{"key":"availability","label":"Availability","min":90,"max":99.999,"step":0.001,"value":99.9,"unit":"%","decimals":3}],"output":{"label":"Downtime / year","unit":"min","decimals":1},"caption":"Each extra 'nine' cuts allowed downtime ~10×."}
```

| Availability | Downtime / year |
|---|---|
| 99% (two nines) | ~3.65 days |
| 99.9% (three nines) | ~8.76 hours (525.6 min) |
| 99.99% (four nines) | ~52.6 min |
| 99.999% (five nines) | ~5.26 min |

## Fault tolerance = redundancy

Availability targets are met by tolerating failure, and the mechanism is **redundancy** — no single point of failure:

- **Spatial redundancy** — multiple copies across machines / availability zones / regions.
- **Time redundancy** — retry the operation (safe only when it's [idempotent](#/pack/sysarch-lss-2026/concept/api-design)).
- **Active-active** — all replicas serve traffic; failure just removes capacity.
- **Active-passive** — a standby takes over on failover; simpler, but the standby sits idle and failover isn't instant.

> [!more] Trade-offs are unavoidable
> Every nine costs money and complexity (more regions, more replication, harder consistency). Five nines is right for a payments core and wildly over-engineered for an internal dashboard. Set the target from the **business cost of downtime**, then buy exactly the redundancy that hits it — no more.

## Architect's move

- SLA on **p99**, not the average; find and stay left of the **knee**.
- Prefer **horizontal** scaling; accept the statelessness/consistency cost.
- Set an availability target from downtime cost; hit it with the cheapest sufficient **redundancy**.

*(Personal study notes paraphrased from M. Pogrebinsky's course, §3. Not affiliated; for personal revision.)*
