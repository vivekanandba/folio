let liveRegion: HTMLElement | null = null

/** Register the shared polite live region (called once from main). */
export function setLiveRegion(node: HTMLElement): void {
  liveRegion = node
}

/** Announce a message to screen readers via the polite live region. */
export function liveAnnounce(message: string): void {
  if (!liveRegion) return
  // Clear first so identical consecutive messages are re-announced.
  liveRegion.textContent = ''
  window.setTimeout(() => {
    if (liveRegion) liveRegion.textContent = message
  }, 30)
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
