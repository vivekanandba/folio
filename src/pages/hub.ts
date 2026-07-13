import { loadCatalog, loadPackMeta } from '../content'
import { el } from '../dom'
import { packCompletion } from '../progress'
import { href } from '../router'

function sessionIdFromFile(file: string): string {
  return file.replace(/\.json$/, '').replace(/^\d+-/, '')
}

export async function renderHub(root: HTMLElement): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
  const catalog = await loadCatalog()
  const cards = el('div', { class: 'pack-grid' })

  for (const ref of catalog.packs) {
    const meta = await loadPackMeta(ref.path)
    const sessionIds = meta.sessions.map(sessionIdFromFile)
    const { done, total } = packCompletion(meta.id, sessionIds)
    cards.append(
      el('a', {
        class: 'pack-card',
        href: href({ name: 'pack', packId: meta.id }),
      }, [
        el('span', { class: 'tag' }, [meta.subject]),
        el('h2', {}, [meta.title]),
        el('p', {}, [meta.summary]),
        el('p', { class: 'muted small' }, [
          `${done}/${total} sessions · ${meta.type}`,
        ]),
      ]),
    )
  }

  root.replaceChildren(
    el('header', { class: 'page-header' }, [
      el('p', { class: 'eyebrow' }, ['Folio']),
      el('h1', {}, ['What you’ve learned, ready to revisit']),
      el('p', { class: 'lead' }, [
        'Interactive sessions and concept cards — start with finance, grow into anything you study.',
      ]),
    ]),
    cards,
  )
}
