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
