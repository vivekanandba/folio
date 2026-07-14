export type LabFormula = {
  id: string
  compute: (inputs: Record<string, number>, meta?: {
    indexValues?: Record<string, number>
  }) => Record<string, number>
}

export const activeShareFormula: LabFormula = {
  id: 'active-share',
  compute: (inputs, meta) => {
    const ids = Object.keys(inputs)
    let sum = 0
    for (const id of ids) {
      const fund = inputs[id] ?? 0
      const index = meta?.indexValues?.[id] ?? 0
      sum += Math.abs(fund - index)
    }
    return { activeShare: sum / 2 }
  },
}

const formulas: Record<string, LabFormula> = {
  [activeShareFormula.id]: activeShareFormula,
}

export function getLabFormula(id: string): LabFormula | undefined {
  return formulas[id]
}

export function listLabFormulas(): string[] {
  return Object.keys(formulas)
}
