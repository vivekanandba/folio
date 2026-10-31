import './style.css'
import { liveAnnounce, setLiveRegion } from './a11y'
import { el } from './dom'
import { cue, feedbackEnabled, setFeedbackEnabled } from './feedback'
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
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false')
  soundBtn.setAttribute('aria-label', on ? 'Sound on \u2014 mute' : 'Sound off \u2014 unmute')
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
    main.replaceChildren(el('p', { class: 'muted', role: 'status' }, ['Loading…']))
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
  main.focus()
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
