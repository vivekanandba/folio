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
        class: 'pack-card cinematic',
        href: href({ name: 'pack', packId: meta.id }),
      }, [
        el('div', { class: 'pack-card-art', 'aria-hidden': 'true' }, [
          el('div', { class: 'art-orb orb-1' }),
          el('div', { class: 'art-orb orb-2' }),
          el('div', { class: 'art-orb orb-3' }),
        ]),
        el('div', { class: 'pack-card-body' }, [
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
      ]),
    )
  }

  root.replaceChildren(
    el('header', { class: 'page-header hub-hero cinematic-hero' }, [
      el('p', { class: 'eyebrow' }, ['Folio']),
      el('h1', {}, ['Learn it once. Play it back.']),
      el('p', { class: 'lead' }, [
        'Revision as interactive stages — peel clues, drag cards, twist knobs, walk decision forks.',
      ]),
      el('div', { class: 'kind-strip' }, [
        chip('Detective'),
        chip('Lab'),
        chip('Audit map'),
        chip('Decision forks'),
        chip('Sort bench'),
      ]),
    ]),
    cards,
  )
}

function chip(label: string): HTMLElement {
  return el('span', { class: 'kind-chip' }, [label])
}
