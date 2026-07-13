import './style.css'
import { el } from './dom'
import { onRoute } from './router'
import { renderConcept } from './pages/concept'
import { renderHub } from './pages/hub'
import { renderPack } from './pages/pack'
import { renderSession } from './pages/session'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

const shell = el('div', { class: 'app-shell' }, [
  el('header', { class: 'topbar' }, [
    el('a', { class: 'brand', href: '#/' }, ['Folio']),
    el('span', { class: 'topbar-note' }, ['Personal revision']),
  ]),
  el('main', { class: 'main', id: 'main' }),
])
app.append(shell)

const main = shell.querySelector<HTMLElement>('#main')!

onRoute(async (route) => {
  main.classList.remove('main-wide')
  try {
    switch (route.name) {
      case 'hub':
        await renderHub(main)
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
})
