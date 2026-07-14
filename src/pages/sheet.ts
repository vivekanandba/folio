import type { SheetDoc } from '../types'
import { el } from '../dom'
import { href } from '../router'

export function renderSheet(sheet: SheetDoc, packId: string): HTMLElement {
  const root = el('article', { class: 'sheet' })
  root.append(
    el('header', { class: 'sheet-header' }, [
      el('h2', {}, [sheet.title]),
      el('p', { class: 'sheet-claim lead' }, [sheet.claim]),
    ]),
  )

  const blocks = el('div', { class: 'sheet-blocks' })
  for (const b of sheet.blocks) {
    const card = el('section', { class: 'sheet-block', id: `sheet-${b.id}` }, [
      el('h3', {}, [b.title]),
      el('p', {}, [b.body]),
    ])
    const links = el('p', { class: 'sheet-links muted small' })
    if (b.sessionId) {
      links.append(
        el(
          'a',
          {
            href: href({
              name: 'session',
              packId,
              sessionId: b.sessionId,
            }),
          },
          ['Open session'],
        ),
      )
    }
    if (b.conceptId) {
      if (b.sessionId) links.append(document.createTextNode(' · '))
      links.append(
        el(
          'a',
          {
            href: href({
              name: 'concept',
              packId,
              conceptId: b.conceptId,
            }),
          },
          ['Concept'],
        ),
      )
    }
    if (b.sessionId || b.conceptId) card.append(links)
    blocks.append(card)
  }
  root.append(blocks)

  if (sheet.diagram) {
    const diagram = el('div', {
      class: 'sheet-diagram',
      role: 'img',
      'aria-label': 'Revision flow',
    })
    const row = el('div', { class: 'flow-row' })
    for (const n of sheet.diagram.nodes) {
      row.append(el('span', { class: 'flow-node' }, [n.label]))
    }
    diagram.append(row)
    root.append(diagram)
  }

  return root
}
