# API design — RPC, REST, and contracts that last

> An API is a promise. Once clients depend on it, you can add to it far more easily than you can change it.

> [!key] Two dominant styles: **RPC** (call a remote *action* — verb-centric, e.g. gRPC) and **REST** (manipulate *resources* via uniform HTTP verbs — noun-centric). REST wins for public, evolvable, cacheable web APIs; RPC/gRPC wins for fast, strongly-typed internal service-to-service calls. Design for **idempotency, pagination, and versioning** from day one.

## RPC vs REST

- **RPC** — the client calls a function that runs on the server (`createUser`, `sendPayment`). Feels like local code; tight coupling; the interface is a list of *actions*. **gRPC** (HTTP/2 + protobuf, binary, streaming) is the modern high-performance form.
- **REST** — the server exposes **resources** (`/users/42`) manipulated through a *uniform interface* of HTTP verbs. Stateless, cacheable, loosely coupled. **HATEOAS** (responses link to related resources) is REST's fullest form, letting clients discover actions dynamically.

```viz
{"type":"annotated","title":"Pick the style by context","prompt":"Tap each.","points":[{"label":"REST","value":3,"note":"Public web APIs. Resource/noun-centric, stateless, cacheable, loosely coupled, human-readable JSON. Evolves gracefully."},{"label":"gRPC","value":4,"note":"Internal service-to-service. Action-centric, HTTP/2 + protobuf, binary + fast, strongly-typed contracts, streaming. Tighter coupling."},{"label":"GraphQL","value":2,"note":"Client-shaped queries — ask for exactly the fields you need in one round-trip. Great for varied frontends; caching + complexity cost."}]}
```

## The REST verb table

The uniform interface maps HTTP verbs onto resource operations. **Safety** = no side effects; **idempotency** = repeating the call lands the same state:

| Verb | Operation | Safe | Idempotent |
|---|---|---|---|
| GET | Read | ✅ | ✅ |
| POST | Create | ❌ | ❌ |
| PUT | Replace/upsert | ❌ | ✅ |
| PATCH | Partial update | ❌ | ❌* |
| DELETE | Remove | ❌ | ✅ |

> [!tip] **Idempotency is what makes retries safe.** A dropped response over a flaky network means the client retries — if the call is idempotent (`PUT`, `DELETE`), replaying it can't double-charge or double-create. For inherently non-idempotent `POST` (e.g. payments), pass an **idempotency key** so the server dedupes. This is the direct link to [time-redundancy retries](#/pack/sysarch-lss-2026/concept/quality-attributes).

## Designing the contract

- **Model resources, not actions** (REST): nouns in the path, verbs in the method. Prefer `POST /users/42/orders` over `/createOrderForUser`.
- **Pagination** — never return an unbounded list; use cursor or offset/limit so payloads and latency stay bounded.
- **Versioning** — clients will depend on today's shape. Version (`/v2/...` or headers) so you can evolve without breaking them.
- **Predictable errors** — consistent status codes + a stable error body; clients program against them.

> [!more] Where the endpoints come from
> Recall the [requirements](#/pack/sysarch-lss-2026/concept/requirements-drivers) flow: **every message crossing the system boundary in a sequence diagram becomes an endpoint.** So API design isn't guesswork — it's a direct translation of the use-case interactions you already modelled. Group those messages by the resource they act on, and the resource model falls out.

## Architect's move

- Default to **REST** for public/evolvable APIs; reach for **gRPC** on hot internal paths.
- Make writes **idempotent** (or add an idempotency key) so retries are safe.
- Bake in **pagination, versioning, and stable errors** before the first client ships.

*(Personal study notes paraphrased from M. Pogrebinsky's course, §4. Not affiliated; for personal revision.)*
