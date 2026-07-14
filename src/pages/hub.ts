import { loadCatalog, loadPackMeta, packSessions } from '../content'
import { el } from '../dom'
import {
  loadProgress,
  nextIncompleteSession,
  packCompletion,
  weakConcepts,
} from '../progress'
import { href } from '../router'

export async function renderHub(root: HTMLElement): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
  const catalog = await loadCatalog()
  const cards = el('div', { class: 'pack-grid' })
  const revisitBlocks = el('div', { class: 'hub-revisit' })

  for (const ref of catalog.packs) {
    const meta = await loadPackMeta(ref.path)
    const sessionIds = packSessions(meta)
    const { done, total } = packCompletion(meta.id, sessionIds)
    const pct = total ? Math.round((done / total) * 100) : 0
    const continueId = nextIncompleteSession(meta.id, sessionIds)
    cards.append(
      el(
        'a',
        {
          class: 'pack-card',
          href: href({ name: 'pack', packId: meta.id }),
        },
        [
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
                `${done}/${total} sessions completed`,
              ]),
            ]),
            continueId
              ? el(
                  'span',
                  { class: 'continue-hint muted small' },
                  [`Continue → ${continueId}`],
                )
              : el('span', { class: 'muted small' }, ['All sessions completed']),
          ]),
        ],
      ),
    )

    const weak = weakConcepts(
      packConceptsSafe(meta).map((id) => ({ id })),
      loadProgress(),
      3,
    )
    if (weak.length) {
      const list = el('ul', { class: 'revisit-list' })
      for (const w of weak) {
        list.append(
          el('li', {}, [
            el(
              'a',
              {
                href: href({
                  name: 'concept',
                  packId: meta.id,
                  conceptId: w.id,
                }),
              },
              [w.id],
            ),
            ` (${Math.round(w.strength * 100)}%)`,
          ]),
        )
      }
      revisitBlocks.append(
        el('section', { class: 'revisit-section' }, [
          el('h3', {}, [`Revisit · ${meta.title}`]),
          list,
        ]),
      )
    }
  }

  root.replaceChildren(
    el('header', { class: 'page-header hub-hero' }, [
      el('p', { class: 'eyebrow' }, ['Folio']),
      el('h1', {}, ['Personal revision studio']),
      el('p', { class: 'lead' }, [
        'Distill what you read into packs — then diagnose, judge, construct, and revise until it sticks.',
      ]),
    ]),
    cards,
    revisitBlocks.childNodes.length
      ? el('section', { class: 'hub-revisit-wrap' }, [
          el('h2', {}, ['Revisit']),
          revisitBlocks,
        ])
      : el('span', {}),
  )
}

function packConceptsSafe(meta: {
  curriculum?: { concepts: string[] }
  concepts?: string[]
}): string[] {
  return meta.curriculum?.concepts ?? meta.concepts ?? []
}
