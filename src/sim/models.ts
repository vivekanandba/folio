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
    { key: 'rate', label: 'Return', min: 4, max: 30, step: 0.5, value: 12, unit: '%' },
    { key: 'fee', label: 'Drag (fees/churn)', min: 0, max: 2.5, step: 0.05, value: 1, unit: '%' },
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

/* ------------------------------------------------------------- sipVsLump --
 * ₹12 L deployed all at once vs spread as monthly SIP instalments into a
 * noisy market. Rupee-cost averaging made touchable: crash the market during
 * the SIP window and watch the average cost drop below the lump's.          */
const CORPUS = 1200000
const sipVsLump: SimModel = {
  id: 'sipVsLump',
  title: 'SIP vs lumpsum race',
  params: [
    { key: 'spreadM', label: 'SIP spread', min: 3, max: 36, step: 1, value: 12, unit: 'months' },
    { key: 'drift', label: 'Market drift', min: -5, max: 20, step: 1, value: 10, unit: '%/yr' },
    { key: 'vol', label: 'Volatility', min: 0, max: 40, step: 2, value: 16, unit: '%' },
  ],
  series: [
    { key: 'lump', label: 'Lumpsum (₹ L)', color: '#f4a26b' },
    { key: 'sip', label: 'SIP (₹ L)', color: '#4fd1c5' },
  ],
  readouts: [
    { key: 'years', label: 'Years', decimals: 1 },
    { key: 'lumpL', label: 'Lumpsum', unit: '₹ L', decimals: 1 },
    { key: 'sipL', label: 'SIP', unit: '₹ L', decimals: 1 },
    { key: 'sipCost', label: 'SIP avg cost', decimals: 1 },
  ],
  actions: [
    {
      id: 'crash',
      label: 'Crash −20%',
      apply(state) {
        state.scratch.price = (state.scratch.price as number) * 0.8
      },
    },
  ],
  init() {
    const s = baseState()
    s.scratch.price = 100 // lump buys everything here, at t=0
    s.scratch.months = 0
    s.scratch.sipUnits = 0
    s.scratch.sipSpent = 0
    s.scratch.monthFrac = 0
    return s
  },
  step(state, params, dt) {
    // 1 real second ≈ 1 year, integrated monthly.
    const spreadM = Math.round(params.spreadM ?? 12)
    const drift = (params.drift ?? 10) / 100 / 12
    const vol = ((params.vol ?? 16) / 100) / Math.sqrt(12)
    let price = state.scratch.price as number
    let months = state.scratch.months as number
    let units = state.scratch.sipUnits as number
    let spent = state.scratch.sipSpent as number

    const frac = (state.scratch.monthFrac as number) + dt * 12
    const whole = Math.floor(frac)
    state.scratch.monthFrac = frac - whole
    for (let i = 0; i < whole; i++) {
      price = Math.max(5, price * (1 + drift + vol * (Math.random() * 2 - 1)))
      if (months < spreadM) {
        const instalment = (CORPUS - spent) / (spreadM - months) // remaining spread evenly
        units += instalment / price
        spent += instalment
      }
      months += 1
    }
    state.scratch.price = price
    state.scratch.months = months
    state.scratch.sipUnits = units
    state.scratch.sipSpent = spent

    const L = 100000
    const lumpVal = CORPUS * (price / 100) // all units bought at 100
    const sipVal = units * price + (CORPUS - spent) // uninvested cash idles at 0%
    state.scalars.years = months / 12
    state.scalars.lumpL = lumpVal / L
    state.scalars.sipL = sipVal / L
    state.scalars.sipCost = units > 0 ? spent / units : 100
    state.scalars.price = price
    push(state, 'lump', lumpVal / L)
    push(state, 'sip', sipVal / L)
    state.t += dt
  },
}

/* ------------------------------------------------------------- retryStorm --
 * Clients that retry on failure amplify load exactly when the system can
 * least afford it. Below capacity retries are invisible; knock the service
 * over and watch offered load spike — then take ages to drain at high retry
 * budgets. The death-spiral made touchable.                                  */
const retryStorm: SimModel = {
  id: 'retryStorm',
  title: 'Retry storm',
  params: [
    { key: 'rps', label: 'Client traffic', min: 50, max: 1000, step: 10, value: 400, unit: 'req/s' },
    { key: 'capacity', label: 'Capacity', min: 100, max: 1500, step: 25, value: 600, unit: 'req/s' },
    { key: 'retries', label: 'Retry budget', min: 0, max: 4, step: 1, value: 2 },
  ],
  series: [
    { key: 'offered', label: 'Offered load (req/s)', color: '#f4a26b' },
    { key: 'success', label: 'Success (%)', color: '#4fd1c5' },
  ],
  readouts: [
    { key: 'offered', label: 'Offered', unit: 'req/s', decimals: 0 },
    { key: 'success', label: 'Success', unit: '%', decimals: 0 },
    { key: 'amp', label: 'Amplification', unit: '×', decimals: 2 },
    { key: 'backlog', label: 'Retry backlog', decimals: 0 },
  ],
  actions: [
    {
      id: 'outage',
      label: 'Cause an outage',
      apply(state) {
        state.scratch.outage = 6 // seconds of sim time at zero capacity
      },
    },
  ],
  init() {
    const s = baseState()
    s.scratch.pending = 0 // failed attempts waiting to retry
    s.scratch.outage = 0
    return s
  },
  step(state, params, dt) {
    const rps = params.rps ?? 400
    const capacity = params.capacity ?? 600
    const retries = Math.round(params.retries ?? 2)
    let outage = state.scratch.outage as number
    const capEff = outage > 0 ? 0 : capacity
    if (outage > 0) state.scratch.outage = Math.max(0, outage - dt)

    // Attempts this tick: fresh traffic + retry backlog (with light jitter).
    const backlog = state.scratch.pending as number
    const offered = rps * dt * (0.95 + Math.random() * 0.1) + backlog
    const served = Math.min(offered, capEff * dt)
    const failed = offered - served
    // Of failed attempts, the fraction that still has retry budget respawns.
    const respawn = retries > 0 ? retries / (retries + 1) : 0
    state.scratch.pending = failed * respawn

    const offeredRate = offered / dt
    state.scalars.offered = offeredRate
    state.scalars.success = offered > 0 ? (served / offered) * 100 : 100
    state.scalars.amp = rps > 0 ? offeredRate / rps : 1
    state.scalars.backlog = Math.round(state.scratch.pending as number)
    push(state, 'offered', offeredRate)
    push(state, 'success', state.scalars.success)
    state.t += dt
  },
}

/* ----------------------------------------------------------------- fanout --
 * Tail latency at scale: a request that fans out to N backends is as slow as
 * the SLOWEST of the N. Even with fast medians, p99 climbs as fanout grows —
 * the reason tail SLOs get harder the more services you compose.             */
const fanout: SimModel = {
  id: 'fanout',
  title: 'Fan-out tail latency',
  params: [
    { key: 'fanout', label: 'Backends called', min: 1, max: 50, step: 1, value: 10 },
    { key: 'p50', label: 'Backend median', min: 5, max: 100, step: 5, value: 20, unit: 'ms' },
    { key: 'slowPct', label: 'Slow-call chance', min: 1, max: 20, step: 1, value: 5, unit: '%' },
  ],
  series: [
    { key: 'p99', label: 'Overall p99 (ms)', color: '#f4a26b' },
    { key: 'p50', label: 'Overall p50 (ms)', color: '#4fd1c5' },
  ],
  readouts: [
    { key: 'p99', label: 'Overall p99', unit: 'ms', decimals: 0 },
    { key: 'p50', label: 'Overall p50', unit: 'ms', decimals: 0 },
    { key: 'hitSlow', label: '≥1 slow call', unit: '%', decimals: 1 },
  ],
  init() {
    const s = baseState()
    s.scratch.lat = [] as number[]
    return s
  },
  step(state, params, dt) {
    const n = Math.round(params.fanout ?? 10)
    const p50 = params.p50 ?? 20
    const pSlow = (params.slowPct ?? 5) / 100
    const lat = state.scratch.lat as number[]

    // Sample a few whole requests per tick; each = max of n backend calls.
    // Slow calls land anywhere from 3× to 8× the median — a real long tail.
    for (let r = 0; r < 3; r++) {
      let worst = 0
      for (let i = 0; i < n; i++) {
        const call = Math.random() < pSlow
          ? p50 * (3 + Math.random() * 5)
          : p50 * (0.7 + Math.random() * 0.6)
        if (call > worst) worst = call
      }
      lat.push(worst)
    }
    if (lat.length > 240) lat.splice(0, lat.length - 240)

    const sorted = [...lat].sort((a, b) => a - b)
    state.scalars.p50 = percentile(sorted, 50)
    state.scalars.p99 = percentile(sorted, 99)
    state.scalars.hitSlow = (1 - Math.pow(1 - pSlow, n)) * 100
    push(state, 'p50', state.scalars.p50)
    push(state, 'p99', state.scalars.p99)
    state.t += dt
  },
}

/* ------------------------------------------------------------ marketCycle --
 * Price is earnings times a mood. Earnings compound quietly; the P/E mood
 * swings through bull/bear cycles (and panics on demand) — yet over a long
 * runway price CAGR converges to earnings CAGR. Wealth tracks earnings.      */
const marketCycle: SimModel = {
  id: 'marketCycle',
  title: 'Price vs earnings',
  params: [
    { key: 'growth', label: 'Earnings growth', min: 5, max: 30, step: 1, value: 18, unit: '%/yr' },
    { key: 'cycleYears', label: 'Mood cycle', min: 2, max: 10, step: 1, value: 5, unit: 'yrs' },
    { key: 'swing', label: 'Mood swing', min: 10, max: 80, step: 5, value: 40, unit: '%' },
  ],
  series: [
    { key: 'price', label: 'Price (indexed)', color: '#f4a26b' },
    { key: 'earnings', label: 'Earnings (indexed)', color: '#4fd1c5' },
  ],
  readouts: [
    { key: 'years', label: 'Years', decimals: 1 },
    { key: 'priceCagr', label: 'Price CAGR', unit: '%', decimals: 1 },
    { key: 'earnCagr', label: 'Earnings CAGR', unit: '%', decimals: 1 },
    { key: 'mood', label: 'Mood premium', unit: '%', decimals: 0 },
  ],
  actions: [
    {
      id: 'panic',
      label: 'Panic crash',
      apply(state) {
        state.scratch.shock = -0.35 // decays back to 0 in step()
      },
    },
  ],
  init() {
    const s = baseState()
    s.scratch.earnings = 100
    s.scratch.years = 0
    s.scratch.shock = 0
    return s
  },
  step(state, params, dt) {
    // 1 real second ≈ 1 year.
    const growth = (params.growth ?? 18) / 100
    const cycle = Math.max(0.5, params.cycleYears ?? 5)
    const swing = (params.swing ?? 40) / 100
    const years = (state.scratch.years as number) + dt
    const earnings = (state.scratch.earnings as number) * Math.pow(1 + growth, dt)
    // Panic shocks decay with a ~1-year half-life.
    const shock = (state.scratch.shock as number) * Math.pow(0.5, dt)
    state.scratch.years = years
    state.scratch.earnings = earnings
    state.scratch.shock = shock

    const mood = swing * Math.sin((2 * Math.PI * years) / cycle) + shock
      + swing * 0.1 * (Math.random() * 2 - 1)
    // Max swing + a panic can push mood below −1; a price floor keeps it sane.
    const price = earnings * Math.max(0.05, 1 + mood)

    state.scalars.years = years
    state.scalars.mood = mood * 100
    state.scalars.earnCagr = years > 0.5 ? (Math.pow(earnings / 100, 1 / years) - 1) * 100 : growth * 100
    state.scalars.priceCagr = years > 0.5 ? (Math.pow(Math.max(1, price) / 100, 1 / years) - 1) * 100 : growth * 100
    state.scalars.price = price
    push(state, 'price', price)
    push(state, 'earnings', earnings)
    state.t += dt
  },
}

export const SIM_MODELS: Record<string, SimModel> = {
  queue,
  failover,
  compound,
  retention,
  sipVsLump,
  retryStorm,
  fanout,
  marketCycle,
}
