/** specs/KIND_lab.md#scenario-pass-band */
export function labInPassBand(
  metrics: Record<string, number>,
  passBand: { metric: string; min: number; max: number },
): boolean {
  const v = metrics[passBand.metric]
  if (typeof v !== 'number' || Number.isNaN(v)) return false
  return v >= passBand.min && v <= passBand.max
}
