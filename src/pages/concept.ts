import { loadConcept, loadPackMeta } from '../content'
import { el } from '../dom'
import { renderMarkdown } from '../markdown'
import { href } from '../router'
import { resolvePackPath } from './pack'

export async function renderConcept(
  root: HTMLElement,
  packId: string,
  conceptId: string,
): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
  const packPath = await resolvePackPath(packId)
  const meta = await loadPackMeta(packPath)
  const concept = await loadConcept(packPath, conceptId)

  const article = el('article', { class: 'concept-body' })
  article.innerHTML = renderMarkdown(concept.body)

  const related = el('div', { class: 'related-sessions' })
  if (concept.relatedSessions.length) {
    related.append(el('h3', {}, ['Practice']))
    for (const sid of concept.relatedSessions) {
      related.append(
        el(
          'a',
          {
            class: 'session-chip',
            href: href({ name: 'session', packId, sessionId: sid }),
          },
          [sid],
        ),
      )
    }
  }

  root.replaceChildren(
    el('nav', { class: 'crumb' }, [
      el('a', { href: href({ name: 'hub' }) }, ['Folio']),
      el('span', {}, [' / ']),
      el('a', { href: href({ name: 'pack', packId }) }, [meta.title]),
      el('span', {}, [' / ']),
      el('span', {}, [concept.title]),
    ]),
    el('header', { class: 'page-header compact' }, [
      el('h1', {}, [concept.title]),
      concept.summary
        ? el('p', { class: 'lead' }, [concept.summary])
        : el('span', {}),
    ]),
    article,
    related,
  )
}
