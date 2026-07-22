import './style.css'
import { liveAnnounce, setLiveRegion } from './a11y'
import { el } from './dom'
import { initPalette } from './palette'
import { onRoute } from './router'
import { renderConcept } from './pages/concept'
import { renderHub } from './pages/hub'
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

const skipLink = el('a', { class: 'skip-link', href: '#main' }, ['Skip to content'])
const liveRegion = el('div', { class: 'sr-only', id: 'sr-status', 'aria-live': 'polite', role: 'status' })
setLiveRegion(liveRegion)

const shell = el('div', { class: 'app-shell' }, [
  skipLink,
  el('header', { class: 'topbar' }, [
    el('a', { class: 'brand', href: '#/' }, ['Folio']),
    el('div', { class: 'topbar-actions' }, [searchBtn]),
  ]),
  el('main', { class: 'main', id: 'main', tabindex: '-1' }),
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

  // Central focus + document.title management on every route change.
  const heading = main.querySelector('h1')
  const title = heading?.textContent?.trim()
  document.title = title ? `${title} · Folio` : 'Folio'
  main.focus()
  if (title) liveAnnounce(`${title} loaded`)
})

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
