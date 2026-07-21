import type { Session } from '../types'
import { iconSpan, FALLBACK_SVG } from './icon'

export type OnComplete = (score: number, max: number) => void

/** Context passed to a module's validate() — pack-level facts for referential checks. */
export interface ValidateCtx {
  conceptIds: string[]
}

/**
 * One self-contained session kind. Adding a kind means dropping a file in
 * src/sessions/ that builds one of these and calls register(). No other edits.
 */
export interface SessionModule<S extends Session = Session> {
  kind: S['kind']
  label: string
  blurb: string
  icon: () => HTMLElement
  mount: (root: HTMLElement, session: S, onComplete: OnComplete) => void
  /** Optional in-app referential check; shares intent with tools/lint. Returns error strings. */
  validate?: (session: S, ctx: ValidateCtx) => string[]
}

const registry = new Map<string, SessionModule>()

export function register<S extends Session>(mod: SessionModule<S>): void {
  registry.set(mod.kind, mod as unknown as SessionModule)
}

export function getModule(kind: string): SessionModule | undefined {
  return registry.get(kind)
}

export function allModules(): SessionModule[] {
  return [...registry.values()]
}

export function kindLabel(kind: string): string {
  return getModule(kind)?.label ?? kind
}

export function kindBlurb(kind: string): string {
  return getModule(kind)?.blurb ?? ''
}

export function kindIcon(kind: string): HTMLElement {
  const mod = getModule(kind)
  return mod ? mod.icon() : iconSpan(kind, FALLBACK_SVG)
}
