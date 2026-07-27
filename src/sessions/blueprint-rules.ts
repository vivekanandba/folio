import type { BlueprintRule } from '../types'

/**
 * Pure graph logic for the blueprint kind — no DOM imports, so it runs under
 * plain `node --experimental-strip-types` for offline rule/solvability tests.
 */

/** One placed component instance on the board. */
export interface BpNode {
  uid: number
  part: string
  label: string
  fixed: boolean
}

export type Edge = [number, number]

export const edgeKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`)

export function nodesOf(nodes: BpNode[], part: string): BpNode[] {
  return nodes.filter((n) => n.part === part)
}

function neighbors(uid: number, edges: Edge[]): number[] {
  const out: number[] = []
  for (const [a, b] of edges) {
    if (a === uid) out.push(b)
    else if (b === uid) out.push(a)
  }
  return out
}

/** Any path between a node of type `from` and a node of type `to`, ignoring `dead` uids. */
export function pathExists(nodes: BpNode[], edges: Edge[], from: string, to: string, dead = new Set<number>()): boolean {
  const starts = nodesOf(nodes, from).filter((n) => !dead.has(n.uid))
  const targets = new Set(nodesOf(nodes, to).filter((n) => !dead.has(n.uid)).map((n) => n.uid))
  if (!starts.length || !targets.size) return false
  const seen = new Set<number>()
  const stack = starts.map((n) => n.uid)
  while (stack.length) {
    const cur = stack.pop() as number
    if (seen.has(cur) || dead.has(cur)) continue
    seen.add(cur)
    if (targets.has(cur)) return true
    for (const next of neighbors(cur, edges)) {
      if (!seen.has(next) && !dead.has(next)) stack.push(next)
    }
  }
  return false
}

/** Hop count of the shortest from→to path, or null when unreachable. */
export function shortestHops(nodes: BpNode[], edges: Edge[], from: string, to: string): number | null {
  const targets = new Set(nodesOf(nodes, to).map((n) => n.uid))
  if (!targets.size) return null
  const seen = new Set<number>()
  let frontier = nodesOf(nodes, from).map((n) => n.uid)
  if (!frontier.length) return null
  let depth = 0
  while (frontier.length) {
    const next: number[] = []
    for (const uid of frontier) {
      if (seen.has(uid)) continue
      seen.add(uid)
      if (targets.has(uid)) return depth
      for (const nb of neighbors(uid, edges)) if (!seen.has(nb)) next.push(nb)
    }
    frontier = next
    depth += 1
  }
  return null
}

/**
 * Probability that a from→to path exists when every MIDDLE node (any part
 * other than the endpoints') is independently up with `perNodeAvail`.
 * Exact subset enumeration — boards are small (guarded at 14 middles).
 */
export function connectivityAvailability(
  nodes: BpNode[],
  edges: Edge[],
  from: string,
  to: string,
  perNodeAvail = 0.99,
): number | null {
  const middles = nodes.filter((n) => n.part !== from && n.part !== to)
  const k = middles.length
  if (k > 14) return null // 2^14 subsets is the sanity ceiling for a toy board
  let total = 0
  for (let mask = 0; mask < 1 << k; mask++) {
    let p = 1
    const dead = new Set<number>()
    for (let i = 0; i < k; i++) {
      if (mask & (1 << i)) {
        dead.add(middles[i].uid)
        p *= 1 - perNodeAvail
      } else {
        p *= perNodeAvail
      }
    }
    if (p > 0 && pathExists(nodes, edges, from, to, dead)) total += p
  }
  return total
}

export interface RuleResult {
  ok: boolean
  /** uids implicated in a failure (lit red on the board). */
  offenders: number[]
}

export function evalRule(rule: BlueprintRule, nodes: BpNode[], edges: Edge[]): RuleResult {
  switch (rule.rule) {
    case 'minCount':
      return { ok: nodesOf(nodes, rule.part).length >= rule.count, offenders: [] }
    case 'maxCount': {
      const found = nodesOf(nodes, rule.part)
      return { ok: found.length <= rule.count, offenders: found.slice(rule.count).map((n) => n.uid) }
    }
    case 'connected': {
      const ok = edges.some(([a, b]) => {
        const na = nodes.find((n) => n.uid === a)
        const nb = nodes.find((n) => n.uid === b)
        if (!na || !nb) return false
        return (na.part === rule.a && nb.part === rule.b) || (na.part === rule.b && nb.part === rule.a)
      })
      return { ok, offenders: [] }
    }
    case 'noDirect': {
      const offenders: number[] = []
      for (const [a, b] of edges) {
        const na = nodes.find((n) => n.uid === a)
        const nb = nodes.find((n) => n.uid === b)
        if (!na || !nb) continue
        if ((na.part === rule.a && nb.part === rule.b) || (na.part === rule.b && nb.part === rule.a)) {
          offenders.push(a, b)
        }
      }
      return { ok: !offenders.length, offenders }
    }
    case 'pathExists':
      return { ok: pathExists(nodes, edges, rule.from, rule.to), offenders: [] }
    case 'survivesKill': {
      if (!pathExists(nodes, edges, rule.from, rule.to)) return { ok: false, offenders: [] }
      const middles = nodes.filter((n) => n.part !== rule.from && n.part !== rule.to)
      const spofs = middles
        .filter((n) => !pathExists(nodes, edges, rule.from, rule.to, new Set([n.uid])))
        .map((n) => n.uid)
      return { ok: !spofs.length, offenders: spofs }
    }
  }
}
