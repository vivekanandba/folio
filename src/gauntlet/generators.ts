import { COMPUTES } from '../computes.ts'

/**
 * Drill generators — the museum never runs out of fresh questions.
 *
 * Each template mints a numeric estimate with FRESH parameters and a
 * ground-truth answer computed from the same whitelisted math the widgets
 * use (src/computes.ts) or a closed form stated inline. Seeded by
 * (pack, concept, date): deterministic per day and per device, Wordle-style,
 * with no server and no AI involved.
 *
 * Pure and DOM-free on purpose (the one value import carries an explicit .ts
 * extension) so the whole module runs under `node --experimental-strip-types`
 * for offline verification.
 */

export interface Drill {
  /** Template id, for attempt logging. */
  id: string
  prompt: string
  unit?: string
  min: number
  max: number
  step: number
  answer: number
  /** Accepted relative error, e.g. 0.08 = ±8%. */
  tolerance: number
  debrief: string
}

interface Template {
  id: string
  make: (rand: () => number) => Drill
}

/* ---------------------------------------------------------------- seeding */

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

/** Slider bounds that include the answer without giving it away. */
function sliderFor(answer: number): { min: number; max: number; step: number } {
  const max = niceCeil(answer * (2.2 + (answer % 1)))
  const step = max > 2000 ? 10 : max > 200 ? 1 : max > 20 ? 0.5 : 0.01
  return { min: 0, max, step }
}

function niceCeil(n: number): number {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, n))))
  return Math.ceil(n / mag) * mag
}

const L = 100000 // ₹1 lakh

/* -------------------------------------------------------------- templates */

const TEMPLATES: Record<string, Template[]> = {
  // ——— Software Architecture ———
  'sysarch-lss-2026::quality-attributes': [
    {
      id: 'qa-downtime',
      make(rand) {
        const avail = pick(rand, [99, 99.5, 99.9, 99.95, 99.99])
        const answer = COMPUTES.downtime({ availability: avail })
        return {
          id: 'qa-downtime',
          prompt: `Your SLA promises ${avail}% availability. Roughly how many minutes of downtime per year does that allow?`,
          unit: 'min/yr',
          ...sliderFor(answer),
          answer,
          tolerance: 0.08,
          debrief: `(1 − ${avail}/100) × 525,600 = **${Math.round(answer).toLocaleString()} min/yr**. Each extra nine cuts allowed downtime ~10× — price the target from the business cost of an outage.`,
        }
      },
    },
    {
      id: 'qa-capacity',
      make(rand) {
        const servers = pick(rand, [2, 3, 4, 6, 8, 10])
        const serviceMs = pick(rand, [5, 10, 20, 25, 40])
        const answer = servers * (1000 / serviceMs)
        return {
          id: 'qa-capacity',
          prompt: `${servers} servers, each handling one request in ${serviceMs} ms. What's the maximum stable traffic (req/s) before the queue starts growing?`,
          unit: 'req/s',
          ...sliderFor(answer),
          answer,
          tolerance: 0.05,
          debrief: `Capacity = servers × (1000 / service ms) = ${servers} × ${1000 / serviceMs} = **${answer} req/s**. Past this knee, waiting time — not processing — owns your p99.`,
        }
      },
    },
    {
      id: 'qa-mtbf',
      make(rand) {
        const mtbfH = pick(rand, [20, 50, 100, 200])
        const mttrMin = pick(rand, [15, 30, 60, 120])
        const answer = (mtbfH / (mtbfH + mttrMin / 60)) * 100
        return {
          id: 'qa-mtbf',
          prompt: `A single node fails on average every ${mtbfH} hours and takes ${mttrMin} minutes to repair. What availability (%) does it deliver?`,
          unit: '%',
          min: 90,
          max: 100,
          step: 0.01,
          answer,
          tolerance: 0.003,
          debrief: `Availability = MTBF / (MTBF + MTTR) = ${mtbfH} / (${mtbfH} + ${(mttrMin / 60).toFixed(2)}) ≈ **${answer.toFixed(2)}%**. You can buy nines by failing less (MTBF up) or repairing faster (MTTR down) — repair speed is usually cheaper.`,
        }
      },
    },
  ],

  // ——— LLM Inference (vLLM) ———
  'ai-vllm-inf-2026::kv-cache-memory': [
    {
      id: 'kv-size',
      make(rand) {
        const tokensK = pick(rand, [8, 16, 32, 64, 128])
        const answer = COMPUTES.kvCacheGB({ tokensK })
        return {
          id: 'kv-size',
          prompt: `At ~0.32 GB per 1K tokens (fp16, Llama-2-7B-class), how much GPU memory does the KV cache need for ${tokensK}K tokens of active context?`,
          unit: 'GB',
          ...sliderFor(answer),
          answer,
          tolerance: 0.06,
          debrief: `${tokensK}K × 0.32 GB ≈ **${answer.toFixed(1)} GB** — and it grows linearly with every concurrent conversation. This is why paged attention and cache budgets, not weights, dominate serving memory.`,
        }
      },
    },
    {
      id: 'kv-users',
      make(rand) {
        const tokensK = pick(rand, [4, 8, 16])
        const poolGB = pick(rand, [80, 160, 180, 320])
        const gb = COMPUTES.kvCacheGB({ tokensK })
        const answer = COMPUTES.usersFit({ poolGB, gb })
        return {
          id: 'kv-users',
          prompt: `Each user session holds ${tokensK}K tokens of KV cache (~${gb.toFixed(1)} GB). With a ${poolGB} GB cache pool, how many concurrent users fit?`,
          unit: 'users',
          ...sliderFor(answer),
          answer,
          tolerance: 0.05,
          debrief: `⌊${poolGB} / ${gb.toFixed(1)}⌋ = **${answer} users**. Concurrency is a memory budget: shrink per-user context (or quantize the cache) and the same GPUs serve more people.`,
        }
      },
    },
  ],
  'ai-vllm-inf-2026::quantization': [
    {
      id: 'quant-mem',
      make(rand) {
        const paramsB = pick(rand, [7, 13, 34, 70])
        const bits = pick(rand, [4, 8, 16])
        const answer = COMPUTES.modelMemory({ paramsB, bits })
        return {
          id: 'quant-mem',
          prompt: `A ${paramsB}B-parameter model stored at ${bits}-bit. Roughly how much memory do the weights need?`,
          unit: 'GB',
          ...sliderFor(answer),
          answer,
          tolerance: 0.06,
          debrief: `${paramsB}B × ${bits}/8 bytes = **${answer.toFixed(0)} GB**. Halving the bit-width halves the weights — which is why W8 or W4 is often the difference between "fits on one GPU" and "doesn't fit at all".`,
        }
      },
    },
    {
      id: 'quant-gpus',
      make(rand) {
        const paramsB = pick(rand, [13, 34, 70])
        const bits = pick(rand, [8, 16])
        const gpuGB = pick(rand, [24, 40, 80])
        const gb = COMPUTES.modelMemory({ paramsB, bits })
        const answer = COMPUTES.gpusNeeded({ gb, gpuGB })
        return {
          id: 'quant-gpus',
          prompt: `Weights for a ${paramsB}B model at ${bits}-bit (~${gb.toFixed(0)} GB), on ${gpuGB} GB GPUs. How many GPUs just to hold the weights?`,
          unit: 'GPUs',
          min: 0,
          max: 12,
          step: 1,
          answer,
          tolerance: 0.01,
          debrief: `⌈${gb.toFixed(0)} / ${gpuGB}⌉ = **${answer}**. Quantization isn't (only) about speed — it's a hardware-count multiplier on your bill.`,
        }
      },
    },
  ],

  // ——— Mutual Fund Insight ———
  'finance-mfi-2026-07::expense-ratio-ter': [
    {
      id: 'ter-lost',
      make(rand) {
        const principalL = pick(rand, [5, 10, 20, 50])
        const grossReturn = pick(rand, [10, 12, 14])
        const expenseRatio = pick(rand, [0.5, 1, 1.5, 2])
        const years = pick(rand, [10, 15, 20])
        const answer = COMPUTES.feeImpact({ principal: principalL * L, grossReturn, expenseRatio, years }) / L
        return {
          id: 'ter-lost',
          prompt: `₹${principalL}L invested at ${grossReturn}% gross for ${years} years, with a ${expenseRatio}% expense ratio. Roughly how much is lost to fees (₹ lakh)?`,
          unit: '₹ L',
          ...sliderFor(answer),
          answer,
          tolerance: 0.1,
          debrief: `Gross grows at ${grossReturn}%, net at ${grossReturn - expenseRatio}% — the gap compounds to **₹${answer.toFixed(1)}L**. The fee cuts your growth *rate*, so its cost rises with the horizon.`,
        }
      },
    },
  ],
  'finance-mfi-2026-07::sip-vs-lumpsum': [
    {
      id: 'sip-corpus',
      make(rand) {
        const monthlyK = pick(rand, [5, 10, 15, 25])
        const rate = pick(rand, [10, 12, 14])
        const years = pick(rand, [10, 15, 20])
        const answer = COMPUTES.sipFuture({ monthly: monthlyK * 1000, rate, years }) / L
        return {
          id: 'sip-corpus',
          prompt: `A ₹${monthlyK}k monthly SIP at ${rate}% for ${years} years. Roughly what corpus does it build (₹ lakh)?`,
          unit: '₹ L',
          ...sliderFor(answer),
          answer,
          tolerance: 0.1,
          debrief: `≈ **₹${answer.toFixed(0)}L** on ₹${((monthlyK * 12 * years) / 100).toFixed(1)}L invested — the rest is compounding. Notice how the answer bends with years far more than with the monthly amount.`,
        }
      },
    },
  ],
  'finance-mfi-2026-07::rolling-returns': [
    {
      id: 'rolling-cagr',
      make(rand) {
        const start = 100
        // Curated pairs keep the implied CAGR in the realistic 7–24% band.
        const [multiple, years] = pick(rand, [
          [2, 5], [2, 10], [4, 10], [4, 15], [8, 10], [8, 15], [16, 15], [16, 20],
        ])
        const answer = COMPUTES.impliedCagr({ start, end: start * multiple, years })
        return {
          id: 'rolling-cagr',
          prompt: `An investment turned ${multiple}× in ${years} years. What CAGR (% a year) does that imply?`,
          unit: '%',
          min: 0,
          max: 40,
          step: 0.1,
          answer,
          tolerance: 0.05,
          debrief: `${multiple}^(1/${years}) − 1 ≈ **${answer.toFixed(1)}%** a year. Multiples flatter over long windows — always translate them back to an annual rate before comparing funds.`,
        }
      },
    },
  ],
  'finance-mfi-2026-07::invit-yields': [
    {
      id: 'invit-income',
      make(rand) {
        const principalL = pick(rand, [5, 10, 25])
        const yieldPct = pick(rand, [6, 7.5, 9, 11])
        const answer = COMPUTES.simpleIncome({ principal: principalL * L, yield: yieldPct }) / 1000
        return {
          id: 'invit-income',
          prompt: `₹${principalL}L in an InvIT distributing ${yieldPct}% a year. Roughly what annual income is that (₹ thousand)?`,
          unit: '₹ k',
          ...sliderFor(answer),
          answer,
          tolerance: 0.06,
          debrief: `${principalL}L × ${yieldPct}% = **₹${answer.toFixed(0)}k a year** — before asking the harder question: how much of that distribution is real yield vs return of your own capital?`,
        }
      },
    },
  ],

  // ——— Wealth Insight ———
  'equity-wi-2026-07::wealth-creators': [
    {
      id: 'wc-runway',
      make(rand) {
        const startCr = pick(rand, [40, 80, 150, 400])
        const rate = pick(rand, [18, 20, 25])
        const years = pick(rand, [10, 15, 20])
        const answer = COMPUTES.compound({ principal: startCr, rate, years })
        return {
          id: 'wc-runway',
          prompt: `A ₹${startCr} crore business compounds value at ~${rate}% for ${years} years. Roughly what is it worth then (₹ crore)?`,
          unit: '₹ cr',
          ...sliderFor(answer),
          answer,
          tolerance: 0.1,
          debrief: `${startCr} × 1.${rate}^${years} ≈ **₹${Math.round(answer).toLocaleString()} cr** (${(answer / startCr).toFixed(0)}×). The outcome lives in the exponent — rate × years — which intuition always underestimates.`,
        }
      },
    },
  ],
}

/* ------------------------------------------------------------------- api */

/** Concepts that can mint drills, as `packId::conceptId` keys. */
export function drillableConcepts(): string[] {
  return Object.keys(TEMPLATES)
}

/**
 * Today's drill for a concept — same (concept, date) always mints the same
 * drill, so the daily challenge matches across devices. Null when the concept
 * has no templates (the gauntlet falls back to flashcards alone).
 */
export function dailyDrill(packId: string, conceptId: string, dateISO: string): Drill | null {
  const templates = TEMPLATES[`${packId}::${conceptId}`]
  if (!templates?.length) return null
  const rand = mulberry32(hashString(`${packId}::${conceptId}::${dateISO}`))
  const template = templates[Math.floor(rand() * templates.length)]
  return template.make(rand)
}
