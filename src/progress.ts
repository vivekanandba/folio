import type { ProgressStore, SessionResult } from './types'

const KEY = 'folio-progress-v1'

function empty(): ProgressStore {
  return { sessions: {} }
}

export function loadProgress(): ProgressStore {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    return JSON.parse(raw) as ProgressStore
  } catch {
    return empty()
  }
}

export function saveSessionResult(result: SessionResult): void {
  const store = loadProgress()
  const key = `${result.packId}::${result.sessionId}`
  store.sessions[key] = result
  store.lastPackId = result.packId
  localStorage.setItem(KEY, JSON.stringify(store))
}

export function getSessionResult(
  packId: string,
  sessionId: string,
): SessionResult | undefined {
  return loadProgress().sessions[`${packId}::${sessionId}`]
}

export function packCompletion(
  packId: string,
  sessionIds: string[],
): { done: number; total: number } {
  const store = loadProgress()
  const done = sessionIds.filter(
    (id) => store.sessions[`${packId}::${id}`],
  ).length
  return { done, total: sessionIds.length }
}
