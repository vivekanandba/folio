# Runtime

## Phases

`intro` → `interact` → `check` → `debrief` → `done`

Rules:

- Cannot `complete` before entering `check` (or kind signals ready via `api.requestCheck()`)
- Chrome (title, kind badge, concept chips) mounts once; interact host updates in place
- Focus moves on phase change
- `prefers-reduced-motion`: disable burst/glow

## RuntimeApi

```ts
requestCheck(): void
complete(result: { score: number; maxScore: number; conceptDeltas?: Record<string, number>; pathNotes?: string[]; reflectionOnly?: boolean }): void
setPhase(phase: Phase): void
reducedMotion: boolean
```

## KindMount

```ts
interface KindMount {
  mount(host: HTMLElement, session: Session, api: RuntimeApi): void
  destroy(): void
}
```

## Tests

- `tests/unit/runtime.phases.test.ts`
