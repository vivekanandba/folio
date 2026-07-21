import { el } from '../dom'

/** Wrap an inline SVG string in a kind-tinted icon span. Leaf helper (no registry import). */
export function iconSpan(kind: string, svg: string): HTMLElement {
  const wrap = el('span', { class: `kind-icon kind-${kind}`, 'aria-hidden': 'true' })
  wrap.innerHTML = svg
  return wrap
}

/** Generic fallback used when a kind has no registered module yet. */
export const FALLBACK_SVG =
  `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="currentColor" stroke-width="2"/></svg>`
