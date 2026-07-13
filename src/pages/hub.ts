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
    const pct = total ? Math.round((done / total) * 100) : 0
    cards.append(
      el('a', {
        class: 'pack-card',
        href: href({ name: 'pack', packId: meta.id }),
      }, [
        el('div', { class: 'pack-card-top' }, [
          el('span', { class: 'tag' }, [meta.subject]),
          el('span', { class: 'pack-type' }, [meta.type]),
        ]),
        el('h2', {}, [meta.title]),
        el('p', {}, [meta.summary]),
        el('div', { class: 'pack-progress' }, [
          el('div', { class: 'pack-progress-track' }, [
            el('div', {
              class: 'pack-progress-fill',
              style: `width:${pct}%`,
            }),
          ]),
          el('span', { class: 'muted small' }, [
            `${done}/${total} sessions`,
          ]),
        ]),
      ]),
    )
  }

  root.replaceChildren(
    el('header', { class: 'page-header hub-hero' }, [
      el('p', { class: 'eyebrow' }, ['Folio']),
      el('h1', {}, ['What you’ve learned, ready to revisit']),
      el('p', { class: 'lead' }, [
        'Interactive visual sessions and concept cards — start with finance, grow into anything you study.',
      ]),
      el('div', { class: 'kind-strip' }, [
        chip('Detective'),
        chip('Lab'),
        chip('Audit map'),
        chip('Decision forks'),
        chip('Classify'),
      ]),
    ]),
    cards,
  )
}

function chip(label: string): HTMLElement {
  return el('span', { class: 'kind-chip' }, [label])
}
