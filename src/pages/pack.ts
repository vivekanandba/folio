import { loadCatalog, loadPackMeta, loadSession } from '../content'
import { el, kindBlurb, kindLabel } from '../dom'
import { getSessionResult } from '../progress'
import { href } from '../router'
import { kindIcon } from '../visuals'

async function resolvePackPath(packId: string): Promise<string> {
  const catalog = await loadCatalog()
  const ref = catalog.packs.find((p) => p.id === packId)
  if (!ref) throw new Error(`Unknown pack ${packId}`)
  return ref.path
}

export async function renderPack(
  root: HTMLElement,
  packId: string,
): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
  const packPath = await resolvePackPath(packId)
  const meta = await loadPackMeta(packPath)

  const conceptList = el('div', { class: 'item-list concept-grid' })
  for (const cid of meta.concepts) {
    conceptList.append(
      el('a', {
        class: 'item-card concept-card',
        href: href({ name: 'concept', packId, conceptId: cid }),
      }, [
        el('span', { class: 'tag' }, ['Concept']),
        el('h3', {}, [prettyId(cid)]),
      ]),
    )
  }

  const sessionList = el('div', { class: 'session-grid' })
  for (const file of meta.sessions) {
    const session = await loadSession(packPath, file)
    const prev = getSessionResult(packId, session.id)
    const status = prev
      ? `Done · ${prev.score}/${prev.maxScore}`
      : 'Not started'
    const card = el('a', {
      class: `item-card session-card-link kind-${session.kind}${prev ? ' done' : ''}`,
      href: href({ name: 'session', packId, sessionId: session.id }),
    })
    card.append(
      kindIcon(session.kind),
      el('div', { class: 'session-card-body' }, [
        el('span', { class: 'tag kind' }, [kindLabel(session.kind)]),
        el('h3', {}, [session.title]),
        el('p', { class: 'muted small' }, [kindBlurb(session.kind)]),
        el('p', { class: 'muted small status-line' }, [status]),
      ]),
    )
    sessionList.append(card)
  }

  root.replaceChildren(
    el('nav', { class: 'crumb' }, [
      el('a', { href: href({ name: 'hub' }) }, ['Folio']),
      el('span', {}, [' / ']),
      el('span', {}, [meta.title]),
    ]),
    el('header', { class: 'page-header pack-hero' }, [
      el('p', { class: 'eyebrow' }, [meta.subject]),
      el('h1', {}, [meta.title]),
      el('p', { class: 'lead' }, [meta.summary]),
      el('p', { class: 'muted small' }, [meta.source]),
    ]),
    el('section', {}, [
      el('h2', {}, ['Interactive sessions']),
      el('p', { class: 'muted' }, [
        'Each session is a different visual mode — detective charts, labs, maps, forks.',
      ]),
      sessionList,
    ]),
    el('section', {}, [
      el('h2', {}, ['Concepts']),
      conceptList,
    ]),
  )
}

function prettyId(id: string): string {
  return id
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export { resolvePackPath }
