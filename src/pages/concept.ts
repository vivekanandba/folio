import { loadConcept, loadPackMeta, loadSession } from '../content'
import { el, prettyId } from '../dom'
import { renderMarkdown } from '../markdown'
import { href } from '../router'
import { kindIcon, kindLabel } from '../sessions'
import { resolvePackPath } from './pack'

function titleFromMarkdown(md: string, fallback: string): string {
  const h1 = md.split('\n').find((l) => /^# /.test(l))
  return h1 ? h1.slice(2).trim() : fallback
}

export async function renderConcept(
  root: HTMLElement,
  packId: string,
  conceptId: string,
): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
  const packPath = await resolvePackPath(packId)
  const [meta, md] = await Promise.all([
    loadPackMeta(packPath),
    loadConcept(packPath, conceptId),
  ])

  const title = titleFromMarkdown(md, prettyId(conceptId))

  const article = el('article', { class: 'concept-body' })
  article.innerHTML = renderMarkdown(md)

  // "Practice this" — sessions that reference this concept.
  const sessions = await Promise.all(meta.sessions.map((f) => loadSession(packPath, f).catch(() => null)))
  const related = sessions.filter((s): s is NonNullable<typeof s> => !!s && s.conceptIds.includes(conceptId))

  const children: (Node | string)[] = [
    el('nav', { class: 'crumb' }, [
      el('a', { href: href({ name: 'hub' }) }, ['Folio']),
      el('span', {}, [' / ']),
      el('a', { href: href({ name: 'pack', packId }) }, [meta.title]),
      el('span', {}, [' / ']),
      el('span', {}, [title]),
    ]),
    article,
  ]

  if (related.length) {
    const links = el('div', { class: 'session-grid' })
    for (const s of related) {
      links.append(
        el('a', {
          class: `item-card session-card-link kind-${s.kind}`,
          href: href({ name: 'session', packId, sessionId: s.id }),
        }, [
          kindIcon(s.kind),
          el('div', { class: 'session-card-body' }, [
            el('span', { class: 'tag kind' }, [kindLabel(s.kind)]),
            el('h3', {}, [s.title]),
          ]),
        ]),
      )
    }
    children.push(
      el('section', { class: 'practice-this' }, [
        el('h2', {}, ['Practice this']),
        links,
      ]),
    )
  }

  root.replaceChildren(...children)
}
