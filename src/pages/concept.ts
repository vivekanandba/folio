import { loadConcept } from '../content'
import { el } from '../dom'
import { renderMarkdown } from '../markdown'
import { href } from '../router'
import { resolvePackPath } from './pack'
import { loadPackMeta } from '../content'

export async function renderConcept(
  root: HTMLElement,
  packId: string,
  conceptId: string,
): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
  const packPath = await resolvePackPath(packId)
  const meta = await loadPackMeta(packPath)
  const md = await loadConcept(packPath, conceptId)

  const article = el('article', { class: 'concept-body' })
  article.innerHTML = renderMarkdown(md)

  root.replaceChildren(
    el('nav', { class: 'crumb' }, [
      el('a', { href: href({ name: 'hub' }) }, ['Folio']),
      el('span', {}, [' / ']),
      el('a', { href: href({ name: 'pack', packId }) }, [meta.title]),
      el('span', {}, [' / ']),
      el('span', {}, [conceptId]),
    ]),
    article,
  )
}
