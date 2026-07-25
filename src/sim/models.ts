/**
 * Whitelisted simulation models — the museum's working machines.
 *
 * Same trust model as widgets' COMPUTES: content JSON picks a model by id and
 * sets numeric knobs; there is no eval and no arbitrary code path. Each model
 * is a tiny fixed-timestep system: `init` builds state, `step` advances it by
 * dt seconds of sim time, `readouts` project scalars for display and goals.
 */

export interface SimParam {
  key: string
  label: string
  min: number
  max: number
  step: number
  value: number
  unit?: string
}

export interface SimSeries {
  key: string
  label: string
  color: string
}

export interface SimReadout {
  key: string
  label: string
  unit?: string
  decimals?: number
}

export interface SimAction {
  id: string
  label: string
  apply: (state: SimState, params: Record<string, number>) => void
}

export interface SimState {
  t: number
  /** Rolling series for the strip chart (engine trims length). */
  series: Record<string, number[]>
  /** Scalars readouts/goals read from. */
  scalars: Record<string, number>
  /** Model-private scratch space. */
  scratch: Record<string, unknown>
}

export interface SimModel {
  id: string
  title: string
  params: SimParam[]
  series: SimSeries[]
  readouts: SimReadout[]
  actions?: SimAction[]
  init: (params: Record<string, number>) => SimState
  step: (state: SimState, params: Record<string, number>, dt: number) => void
}

function baseState(): SimState {
  return { t: 0, series: {}, scalars: {}, scratch: {} }
}

function push(state: SimState, key: string, v: number): void {
  ;(state.series[key] ??= []).push(v)
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

/* ------------------------------------------------------------------ queue --
 * A request queue in front of c parallel servers: the latency "knee" made
 * touchable. Below capacity the queue drains and p99 hugs service time;
 * past it, waiting time dominates and latency runs away.                    */
const queue: SimModel = {
  id: 'queue',
  title: 'Request queue',
  params: [
    { key: 'rps', label: 'Traffic', min: 50, max: 1500, step: 10, value: 400, unit: 'req/s' },
    { key: 'servers', label: 'Servers', min: 1, max: 12, step: 1, value: 5 },
    { key: 'serviceMs', label: 'Service time', min: 5, max: 50, step: 1, value: 10, unit: 'ms' },
  ],
  series: [
    { key: 'p99', label: 'p99 latency (ms)', color: '#f4a26b' },
    { key: 'p50', label: 'p50 latency (ms)', color: '#4fd1c5' },
  ],
  readouts: [
    { key: 'p99', label: 'p99', unit: 'ms', decimals: 0 },
    { key: 'p50', label: 'p50', unit: 'ms', decimals: 0 },
    { key: 'util', label: 'Utilisation', unit: '%', decimals: 0 },
    { key: 'queueLen', label: 'In queue', decimals: 0 },
  ],
  init(params) {
    const s = baseState()
    s.scratch.queueLen = 0
    s.scratch.lat = [] as number[]
    void params
    return s
  },
  step(state, params, dt) {
    const rps = params.rps ?? 400
    const servers = params.servers ?? 3
    const serviceMs = params.serviceMs ?? 20
    const capacity = servers * (1000 / serviceMs) // req/s the fleet can absorb
    let q = state.scratch.queueLen as number

    // Arrivals with light noise; departures bounded by capacity.
    const arrivals = rps * dt * (0.9 + Math.random() * 0.2)
    const served = Math.min(q + arrivals, capacity * dt)
    q = Math.max(0, q + arrivals - served)
    state.scratch.queueLen = q

    // Latency for a request finishing now: queue wait + service.
    const waitMs = (q / capacity) * 1000
    const jitter = 0.85 + Math.random() * 0.3
    const latency = (waitMs + serviceMs) * jitter
    const lat = state.scratch.lat as number[]
    lat.push(latency)
    if (lat.length > 120) lat.splice(0, lat.length - 120)

    const sorted = [...lat].sort((a, b) => a - b)
    state.scalars.p50 = percentile(sorted, 50)
    state.scalars.p99 = percentile(sorted, 99)
    state.scalars.util = Math.min(100, (rps / capacity) * 100)
    state.scalars.queueLen = Math.round(q)
    state.scalars.servers = servers
    state.scalars.rps = rps
    push(state, 'p50', state.scalars.p50)
    push(state, 'p99', state.scalars.p99)
    state.t += dt
  },
}

/* --------------------------------------------------------------- failover --
 * N replicas failing and being repaired: availability = MTBF/(MTBF+MTTR),
 * and the "kill a node" button makes redundancy visceral. Sim time runs at
 * hours-per-second so the nines accumulate while you watch.                 */
const failover: SimModel = {
  id: 'failover',
  title: 'Replica fleet',
  params: [
    { key: 'replicas', label: 'Replicas', min: 1, max: 6, step: 1, value: 2 },
    { key: 'mtbfH', label: 'MTBF', min: 5, max: 300, step: 5, value: 60, unit: 'h' },
    { key: 'mttrM', label: 'MTTR', min: 2, max: 120, step: 2, value: 30, unit: 'min' },
  ],
  series: [
    { key: 'up', label: 'Replicas up', color: '#4fd1c5' },
    { key: 'avail', label: 'Availability (%)', color: '#e3c88d' },
  ],
  readouts: [
    { key: 'avail', label: 'Observed avail', unit: '%', decimals: 3 },
    { key: 'predNines', label: 'Design nines', decimals: 1 },
    { key: 'downMinYr', label: 'Downtime/yr', unit: 'min', decimals: 0 },
    { key: 'up', label: 'Up now', decimals: 0 },
  ],
  actions: [
    {
      id: 'kill',
      label: 'Kill a node',
      apply(state) {
        const nodes = state.scratch.nodes as { up: boolean; timer: number }[]
        const alive = nodes.filter((n) => n.up)
        if (alive.length) alive[Math.floor(Math.random() * alive.length)].up = false
      },
    },
  ],
  init(params) {
    const s = baseState()
    const n = Math.round(params.replicas ?? 2)
    s.scratch.nodes = Array.from({ length: n }, () => ({ up: true, timer: 0 }))
    s.scratch.upTime = 0
    s.scratch.total = 0
    return s
  },
  step(state, params, dt) {
    // 1 real second ≈ 2 simulated hours: the year of uptime happens on stage.
    const hours = dt * 2
    const want = Math.round(params.replicas ?? 2)
    const mtbfH = params.mtbfH ?? 60
    const mttrH = (params.mttrM ?? 30) / 60
    let nodes = state.scratch.nodes as { up: boolean; timer: number }[]

    // Knob changed: grow/shrink the fleet (new nodes join healthy).
    if (nodes.length !== want) {
      nodes = nodes.slice(0, want)
      while (nodes.length < want) nodes.push({ up: true, timer: 0 })
      state.scratch.nodes = nodes
    }

    for (const node of nodes) {
      if (node.up) {
        if (Math.random() < hours / mtbfH) { node.up = false; node.timer = 0 }
      } else {
        node.timer += hours
        // Repairs complete on average after MTTR (probabilistic per tick).
        if (Math.random() < hours / mttrH) { node.up = true; node.timer = 0 }
      }
    }

    const up = nodes.filter((n) => n.up).length
    const serviceUp = up > 0 ? 1 : 0
    state.scratch.upTime = (state.scratch.upTime as number) + serviceUp * hours
    state.scratch.total = (state.scratch.total as number) + hours

    const avail = ((state.scratch.upTime as number) / Math.max(1e-9, state.scratch.total as number)) * 100
    const nines = avail >= 100 ? 5 : -Math.log10(1 - avail / 100)
    state.scalars.avail = avail
    state.scalars.nines = Math.min(5, nines)
    state.scalars.up = up
    state.scalars.replicas = want

    // Design (analytic) availability for active-active independent replicas:
    // per-node unavailability u = MTTR/(MTBF+MTTR); service is down when ALL are.
    const u = mttrH / (mtbfH + mttrH)
    const predAvail = (1 - Math.pow(u, want)) * 100
    state.scalars.predAvail = predAvail
    state.scalars.predNines = predAvail >= 100 ? 5 : Math.min(5, -Math.log10(1 - predAvail / 100))
    state.scalars.downMinYr = (1 - predAvail / 100) * 525600
    push(state, 'up', up)
    push(state, 'avail', avail)
    state.t += dt
  },
}

/* --------------------------------------------------------------- compound --
 * Capital compounding against fee drag: each real second is a year. The gap
 * between the gross and net curves is the invisible cost made visible.      */
const compound: SimModel = {
  id: 'compound',
  title: 'Compounding engine',
  params: [
    { key: 'monthly', label: 'Monthly SIP', min: 1000, max: 100000, step: 1000, value: 10000, unit: '₹' },
    { key: 'rate', label: 'Return', min: 4, max: 18, step: 0.5, value: 12, unit: '%' },
    { key: 'fee', label: 'Fee (TER)', min: 0, max: 2.5, step: 0.05, value: 1, unit: '%' },
  ],
  series: [
    { key: 'gross', label: 'Before fees (₹ L)', color: '#4fd1c5' },
    { key: 'net', label: 'After fees (₹ L)', color: '#f4a26b' },
  ],
  readouts: [
    { key: 'years', label: 'Years', decimals: 0 },
    { key: 'netL', label: 'Corpus', unit: '₹ L', decimals: 1 },
    { key: 'lostL', label: 'Lost to fees', unit: '₹ L', decimals: 1 },
    { key: 'lostPct', label: 'Of corpus', unit: '%', decimals: 1 },
  ],
  init() {
    const s = baseState()
    s.scratch.gross = 0
    s.scratch.net = 0
    s.scratch.years = 0
    return s
  },
  step(state, params, dt) {
    // 1 real second ≈ 1 year, integrated monthly.
    const years = dt
    const months = years * 12
    const monthly = params.monthly ?? 10000
    const rGross = (params.rate ?? 12) / 100 / 12
    const rNet = ((params.rate ?? 12) - (params.fee ?? 1)) / 100 / 12
    let gross = state.scratch.gross as number
    let net = state.scratch.net as number
    const whole = Math.floor((state.scratch.years as number) * 12 + months) - Math.floor((state.scratch.years as number) * 12)
    for (let i = 0; i < whole; i++) {
      gross = gross * (1 + rGross) + monthly
      net = net * (1 + rNet) + monthly
    }
    state.scratch.gross = gross
    state.scratch.net = net
    state.scratch.years = (state.scratch.years as number) + years

    const L = 100000
    state.scalars.years = state.scratch.years as number
    state.scalars.grossL = gross / L
    state.scalars.netL = net / L
    state.scalars.lostL = (gross - net) / L
    state.scalars.lostPct = gross > 0 ? ((gross - net) / gross) * 100 : 0
    push(state, 'gross', gross / L)
    push(state, 'net', net / L)
    state.t += dt
  },
}

/* -------------------------------------------------------------- retention --
 * The forgetting curve folio itself is built on: memory strength decays,
 * reviewing at the right moment multiplies stability (SM-2's heart).        */
const retention: SimModel = {
  id: 'retention',
  title: 'Forgetting curve',
  params: [
    { key: 'stability', label: 'Initial stability', min: 1, max: 30, step: 1, value: 3, unit: 'days' },
  ],
  series: [
    { key: 'recall', label: 'Recall probability (%)', color: '#c4b5fd' },
  ],
  readouts: [
    { key: 'recall', label: 'Recall now', unit: '%', decimals: 0 },
    { key: 'sinceDays', label: 'Since review', unit: 'd', decimals: 1 },
    { key: 'stabilityNow', label: 'Stability', unit: 'd', decimals: 1 },
    { key: 'reviews', label: 'Reviews', decimals: 0 },
  ],
  actions: [
    {
      id: 'review',
      label: 'Review now',
      apply(state) {
        const recall = state.scalars.recall ?? 100
        // Reviewing near the edge of forgetting grows stability the most.
        const factor = 1.3 + (1 - recall / 100) * 1.7
        state.scratch.stability = (state.scratch.stability as number) * factor
        state.scratch.since = 0
        state.scratch.reviews = (state.scratch.reviews as number) + 1
      },
    },
  ],
  init(params) {
    const s = baseState()
    s.scratch.stability = params.stability ?? 3
    s.scratch.since = 0
    s.scratch.reviews = 0
    return s
  },
  step(state, params, dt) {
    void params
    // 1 real second ≈ 2 days of forgetting.
    const days = dt * 2
    state.scratch.since = (state.scratch.since as number) + days
    const since = state.scratch.since as number
    const stability = state.scratch.stability as number
    const recall = 100 * Math.exp(-since / Math.max(0.1, stability))
    state.scalars.recall = recall
    state.scalars.sinceDays = since
    state.scalars.stabilityNow = stability
    state.scalars.reviews = state.scratch.reviews as number
    push(state, 'recall', recall)
    state.t += dt
  },
}

export const SIM_MODELS: Record<string, SimModel> = {
  queue,
  failover,
  compound,
  retention,
}
