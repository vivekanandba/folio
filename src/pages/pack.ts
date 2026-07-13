import { loadCatalog, loadPackMeta, loadSession } from '../content'
import { el, kindLabel } from '../dom'
import { getSessionResult } from '../progress'
import { href } from '../router'

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

  const conceptList = el('div', { class: 'item-list' })
  for (const cid of meta.concepts) {
    conceptList.append(
      el('a', {
        class: 'item-card',
        href: href({ name: 'concept', packId, conceptId: cid }),
      }, [
        el('span', { class: 'tag' }, ['Concept']),
        el('h3', {}, [cid.replace(/-/g, ' ')]),
      ]),
    )
  }

  const sessionList = el('div', { class: 'item-list' })
  for (const file of meta.sessions) {
    const session = await loadSession(packPath, file)
    const prev = getSessionResult(packId, session.id)
    const status = prev
      ? `Done · ${prev.score}/${prev.maxScore}`
      : 'Not started'
    sessionList.append(
      el('a', {
        class: 'item-card',
        href: href({ name: 'session', packId, sessionId: session.id }),
      }, [
        el('span', { class: 'tag kind' }, [kindLabel(session.kind)]),
        el('h3', {}, [session.title]),
        el('p', { class: 'muted small' }, [status]),
      ]),
    )
  }

  root.replaceChildren(
    el('nav', { class: 'crumb' }, [
      el('a', { href: href({ name: 'hub' }) }, ['Folio']),
      el('span', {}, [' / ']),
      el('span', {}, [meta.title]),
    ]),
    el('header', { class: 'page-header' }, [
      el('p', { class: 'eyebrow' }, [meta.subject]),
      el('h1', {}, [meta.title]),
      el('p', { class: 'lead' }, [meta.summary]),
      el('p', { class: 'muted small' }, [meta.source]),
    ]),
    el('section', {}, [
      el('h2', {}, ['Concepts']),
      conceptList,
    ]),
    el('section', {}, [
      el('h2', {}, ['Interactive sessions']),
      sessionList,
    ]),
  )
}

export { resolvePackPath }
