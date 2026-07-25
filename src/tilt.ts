import { prefersReducedMotion } from './a11y'

/**
 * Pointer-tilt: the card leans toward the cursor like a piece under glass.
 * rAF-throttled; skipped entirely for reduced-motion users and coarse/touch
 * pointers (where hover tilt is meaningless).
 */
export function attachTilt(card: HTMLElement, maxDeg = 4): void {
  if (prefersReducedMotion()) return
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

  let raf = 0
  let lastEvent: PointerEvent | null = null

  const apply = () => {
    raf = 0
    if (!lastEvent) return
    const r = card.getBoundingClientRect()
    if (!r.width || !r.height) return
    const px = (lastEvent.clientX - r.left) / r.width - 0.5
    const py = (lastEvent.clientY - r.top) / r.height - 0.5
    card.style.transform =
      `perspective(700px) rotateX(${(-py * maxDeg).toFixed(2)}deg) rotateY(${(px * maxDeg).toFixed(2)}deg) translateY(-2px)`
  }

  card.addEventListener('pointermove', (e) => {
    lastEvent = e
    if (!raf) raf = requestAnimationFrame(apply)
  })
  card.addEventListener('pointerleave', () => {
    if (raf) { cancelAnimationFrame(raf); raf = 0 }
    lastEvent = null
    card.style.transform = ''
  })
}
