import './style.css'
import { liveAnnounce, setLiveRegion } from './a11y'
import { loadingLine } from './curator'
import { el } from './dom'
import { adoptStoredPreference, cue, feedbackEnabled, FEEDBACK_KEY, setFeedbackEnabled } from './feedback'
import { initPalette } from './palette'
import { onRoute } from './router'
import { renderConcept } from './pages/concept'
import { renderFloor } from './pages/floor'
import { renderHub } from './pages/hub'
import { renderReport } from './pages/report'
import { renderPack } from './pages/pack'
import { renderReview } from './pages/review'
import { renderSession } from './pages/session'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

const palette = initPalette()

const searchBtn = el('button', { class: 'topbar-search', type: 'button', 'aria-label': 'Search (Ctrl/⌘ K)' }, [
  el('span', { 'aria-hidden': 'true' }, ['⌕ Search']),
  el('kbd', {}, ['⌘K']),
])
searchBtn.addEventListener('click', () => palette.open())

// The museum's voice, and the one control that silences it. Sound and
// haptics share a single switch: someone reaching for it wants quiet, not a
// mixing desk.
const SPEAKER_ON = '\u{1F50A}'
const SPEAKER_OFF = '\u{1F507}'
const soundBtn = el('button', { class: 'topbar-sound', type: 'button' })
function paintSoundBtn(): void {
  const on = feedbackEnabled()
  // A toggle's NAME must be the thing, and aria-pressed the state. Naming it
  // after the action ("Sound on — mute") while also setting aria-pressed=true
  // makes a screen reader say the mute control is pressed while sound is on —
  // the opposite of the truth.
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false')
  soundBtn.setAttribute('aria-label', 'Sound and haptics')
  soundBtn.setAttribute('title', on ? 'Mute sound and haptics' : 'Unmute sound and haptics')
  soundBtn.classList.toggle('is-muted', !on)
  soundBtn.replaceChildren(el('span', { 'aria-hidden': 'true' }, [on ? SPEAKER_ON : SPEAKER_OFF]))
}
soundBtn.addEventListener('click', () => {
  const next = !feedbackEnabled()
  setFeedbackEnabled(next)
  paintSoundBtn()
  // Unmuting answers in its own voice — the click IS the gesture the browser
  // needs before a context may start, so this is also how audio first wakes.
  if (next) cue('reveal')
})
paintSoundBtn()
// feedbackEnabled() reads storage first so a change made in another tab is
// honoured. Without this listener the OTHER tab's button would keep showing
// a speaker — and telling a screen reader aria-pressed="true" — while the
// museum was in fact silent. A control that reports the opposite of the
// truth is worse than one that does not update.
window.addEventListener('storage', (e) => {
  if (e.key !== null && e.key !== FEEDBACK_KEY) return
  // Repaint AND act on it: a cross-tab mute that leaves this tab holding an
  // open audio device is silent but still rude to the rest of the system.
  adoptStoredPreference()
  paintSoundBtn()
})

const skipLink = el('a', { class: 'skip-link', href: '#main' }, ['Skip to content'])
const liveRegion = el('div', { class: 'sr-only', id: 'sr-status', 'aria-live': 'polite', role: 'status' })
setLiveRegion(liveRegion)

const shell = el('div', { class: 'app-shell' }, [
  skipLink,
  el('header', { class: 'topbar' }, [
    el('a', { class: 'brand', href: '#/' }, ['Folio']),
    el('div', { class: 'topbar-actions' }, [soundBtn, searchBtn]),
  ]),
  el('main', { class: 'main', id: 'main', tabindex: '-1' }),
  el('footer', { class: 'colophon' }, ['Folio · a private museum of things worth remembering']),
  liveRegion,
])
app.append(shell)

const main = shell.querySelector<HTMLElement>('#main')!

skipLink.addEventListener('click', (e) => {
  e.preventDefault()
  main.focus()
})

function notFound(): void {
  main.replaceChildren(
    el('div', { class: 'error' }, [
      el('h1', {}, ['Page not found']),
      el('p', {}, ['That link does not point anywhere in Folio.']),
      el('a', { class: 'primary', href: '#/' }, ['Back home']),
    ]),
  )
}

onRoute(async (route) => {
  const render = async (): Promise<void> => {
    main.classList.remove('main-wide')
    main.replaceChildren(
      el('p', { class: 'muted', role: 'status' }, [loadingLine(route.name)]),
    )
    try {
      switch (route.name) {
        case 'hub':
          await renderHub(main)
          break
        case 'today':
          await renderReview(main)
          break
        case 'floor':
          await renderFloor(main)
          break
        case 'report':
          await renderReport(main)
          break
        case 'pack':
          await renderPack(main, route.packId)
          break
        case 'concept':
          await renderConcept(main, route.packId, route.conceptId)
          break
        case 'session':
          await renderSession(main, route.packId, route.sessionId)
          break
        case 'notfound':
          notFound()
          break
      }
    } catch (err) {
      main.replaceChildren(
        el('div', { class: 'error' }, [
          el('h1', {}, ['Something broke']),
          el('p', {}, [err instanceof Error ? err.message : String(err)]),
          el('a', { href: '#/' }, ['Back home']),
        ]),
      )
    }
  }

  // Cross-fade page changes via the View Transitions API where available
  // (progressive enhancement; skipped under reduced motion).
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } }
  if (doc.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await doc.startViewTransition(() => render()).finished.catch(() => {})
  } else {
    await render()
  }

  // Central focus + document.title management on every route change.
  const heading = main.querySelector('h1')
  const title = heading?.textContent?.trim()
  document.title = title ? `${title} · Folio` : 'Folio'
  // preventScroll, because #main starts below the sticky topbar and is taller
  // than the viewport: focusing it aligns its top edge to the scrollport and
  // jumps the page ~68px on EVERY route change. Moving focus is for screen
  // readers and the keyboard; it is not a request to scroll, and a learner
  // who has just clicked a link should land at the top of what they chose.
  //
  // This was found as 8.55% of intermittent screenshot drift and first
  // "fixed" by pinning the scroll in the capture harness — which hid it from
  // the gate while leaving every real navigation jumping, and made the
  // baselines encode a framing no user ever sees. The harness pin stays as
  // belt-and-braces; this is the cause.
  main.focus({ preventScroll: true })
  if (title) liveAnnounce(`${title} loaded`)
})

// The pocket museum: after one online visit, everything works offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is progressive — never block the app on it */
    })
  })
}

// Global shortcuts: Cmd/Ctrl+K, or "/" when not typing in a field.
window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null
  const typing =
    !!target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    palette.open()
  } else if (e.key === '/' && !typing) {
    e.preventDefault()
    palette.open()
  }
})
