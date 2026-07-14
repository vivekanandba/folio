# Progress v2

## Store

```ts
{
  version: 2,
  lastPackId?: string,
  sessions: Record<string, {
    attempts: Array<{ at: string; score: number; maxScore: number }>
    bestScore: number
    bestMax: number
    completedAt?: string
    reflectionOnly?: boolean
  }>,
  concepts: Record<string, { strength: number; lastPracticedAt?: string }>
}
```

## Migration

On read: if `folio-progress-v1` exists, convert each stamp to one attempt + best; write v2.

## UI language

Completed / Best score / Practice again / Continue / Revisit weak — never “Mastered” until revisit heuristics are honest (Phase 4).

## Concept strength

Average of linked knowledge-session `score/max` (exclude `reflectionOnly` audit completions). Phase 4 adds weak queue via lowest strength.

## Tests

- `tests/unit/progress.v2.test.ts`
