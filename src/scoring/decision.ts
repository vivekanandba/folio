/** specs/KIND_decision.md#scenario-path-score */
export function scoreDecisionPath(
  deltas: number[],
  maxScore = Math.max(1, deltas.length),
): number {
  const sum = deltas.reduce((a, b) => a + b, 0)
  return Math.min(maxScore, Math.max(0, sum))
}

export function clampScore(score: number, maxScore: number): number {
  return Math.min(maxScore, Math.max(0, score))
}
