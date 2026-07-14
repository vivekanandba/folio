import type { ClassifyCard } from '../types'

/** specs/KIND_classify.md#scenario-perfect-placement */
export function scoreClassify(
  cards: ClassifyCard[],
  assignment: Map<string, string> | Record<string, string>,
): { score: number; maxScore: number; misses: { id: string; expected: string; got?: string }[] } {
  const map =
    assignment instanceof Map
      ? assignment
      : new Map(Object.entries(assignment))
  let score = 0
  const misses: { id: string; expected: string; got?: string }[] = []
  for (const card of cards) {
    const got = map.get(card.id)
    if (got === card.bucketId) score += 1
    else misses.push({ id: card.id, expected: card.bucketId, got })
  }
  return { score, maxScore: cards.length, misses }
}
