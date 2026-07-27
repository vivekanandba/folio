/**
 * Whitelisted numeric computations shared by `what-if` widgets (src/widgets.ts)
 * and live estimates (src/sessions/estimate.ts). No eval / arbitrary
 * expressions — a spec picks one compute by name; inputs are read by key.
 *
 * Pure and dependency-free so it runs offline under
 * `node --experimental-strip-types` for testing. Keep the name whitelist in
 * tools/lint/referential.ts in sync when adding a compute.
 */
export const COMPUTES: Record<string, (v: Record<string, number>) => number> = {
  // Future value of a lump sum: principal grown at rate% for years.
  compound: (v) => (v.principal ?? 0) * Math.pow(1 + (v.rate ?? 0) / 100, v.years ?? 0),
  // Future value of a monthly SIP at annual rate% over years (end-of-month).
  sipFuture: (v) => {
    const i = (v.rate ?? 0) / 1200
    const n = (v.years ?? 0) * 12
    return i ? (v.monthly ?? 0) * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) : (v.monthly ?? 0) * n
  },
  // Inflation-adjusted (real) return, in %.
  realReturn: (v) => ((1 + (v.nominal ?? 0) / 100) / (1 + (v.inflation ?? 0) / 100) - 1) * 100,
  // Income-like yield after stripping return-of-capital, in %.
  weightedYield: (v) => (v.yield ?? 0) * (1 - (v.returnOfCapital ?? 0) / 100),
  // Availability % → downtime minutes per year ((1 - a/100) × 525,600).
  downtime: (v) => (1 - (v.availability ?? 0) / 100) * 525600,
  // Money lost to fees: gross FV minus net FV over `years` on `principal`.
  feeImpact: (v) => {
    const gross = (v.principal ?? 0) * Math.pow(1 + (v.grossReturn ?? 0) / 100, v.years ?? 0)
    const net = (v.principal ?? 0) * Math.pow(1 + ((v.grossReturn ?? 0) - (v.expenseRatio ?? 0)) / 100, v.years ?? 0)
    return gross - net
  },
  // CAGR implied by growing from `start` to `end` over `years`, in %.
  impliedCagr: (v) => (Math.pow((v.end ?? 0) / (v.start || 1), 1 / (v.years || 1)) - 1) * 100,
  // Yearly income on `principal` at `yield` %, in currency units.
  simpleIncome: (v) => ((v.principal ?? 0) * (v.yield ?? 0)) / 100,
  // Downtime minutes per year → implied availability %.
  availabilityPct: (v) => (1 - (v.downtime ?? 0) / 525600) * 100,
}
