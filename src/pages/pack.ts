import {
  loadCatalog,
  loadConcept,
  loadPackMeta,
  loadSession,
  loadSheet,
  packConcepts,
  packSessions,
} from '../content'
import { el, kindBlurb, kindLabel } from '../dom'
import {
  getSessionResult,
  nextIncompleteSession,
  weakConcepts,
} from '../progress'
import { href } from '../router'
import { kindIcon } from '../visuals'
import { renderSheet } from './sheet'

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
  const sessionIds = packSessions(meta)
  const conceptIds = packConcepts(meta)

  const conceptMetas = await Promise.all(
    conceptIds.map((cid) => loadConcept(packPath, cid)),
  )
  const titleById = Object.fromEntries(conceptMetas.map((c) => [c.id, c.title]))

  const practicedBy = new Map<string, string[]>()
  for (const sid of sessionIds) {
    const session = await loadSession(packPath, sid)
    for (const cid of session.conceptIds) {
      const list = practicedBy.get(cid) ?? []
      list.push(sid)
      practicedBy.set(cid, list)
    }
  }

  const continueId =
    nextIncompleteSession(packId, sessionIds) ?? sessionIds[0]

  const tabs = el('div', { class: 'pack-tabs', role: 'tablist' })
  const panels = el('div', { class: 'pack-panels' })
  const sheetPanel = el('section', { class: 'pack-panel', id: 'panel-sheet' })
  const conceptsPanel = el('section', {
    class: 'pack-panel',
    id: 'panel-concepts',
    hidden: 'true',
  })
  const sessionsPanel = el('section', {
    class: 'pack-panel',
    id: 'panel-sessions',
    hidden: 'true',
  })

  const makeTab = (id: string, label: string, selected: boolean) => {
    const btn = el(
      'button',
      {
        class: `pack-tab${selected ? ' active' : ''}`,
        type: 'button',
        role: 'tab',
        'aria-selected': selected ? 'true' : 'false',
        'data-tab': id,
      },
      [label],
    )
    btn.addEventListener('click', () => {
      for (const t of tabs.querySelectorAll('.pack-tab')) {
        t.classList.toggle('active', t === btn)
        t.setAttribute('aria-selected', t === btn ? 'true' : 'false')
      }
      sheetPanel.hidden = id !== 'sheet'
      conceptsPanel.hidden = id !== 'concepts'
      sessionsPanel.hidden = id !== 'sessions'
    })
    return btn
  }

  tabs.append(
    makeTab('sheet', 'Sheet', true),
    makeTab('sessions', 'Sessions', false),
    makeTab('concepts', 'Concepts', false),
  )

  if (meta.curriculum.sheet) {
    try {
      const sheet = await loadSheet(packPath, meta.curriculum.sheet)
      sheetPanel.append(renderSheet(sheet, packId))
    } catch {
      sheetPanel.append(
        el('p', { class: 'muted' }, ['Sheet not available for this pack yet.']),
      )
    }
  } else {
    sheetPanel.append(el('p', { class: 'muted' }, ['No sheet for this pack.']))
  }

  const conceptList = el('div', { class: 'item-list concept-grid' })
  for (const c of conceptMetas) {
    const practiced = practicedBy.get(c.id) ?? []
    const chips = el('div', { class: 'session-chips' })
    for (const sid of practiced) {
      chips.append(
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
    conceptList.append(
      el(
        'a',
        {
          class: 'item-card concept-card',
          href: href({ name: 'concept', packId, conceptId: c.id }),
        },
        [
          el('span', { class: 'tag' }, ['Concept']),
          el('h3', {}, [c.title]),
          c.summary
            ? el('p', { class: 'muted small' }, [c.summary])
            : el('span', {}),
          practiced.length
            ? el('p', { class: 'muted small' }, ['Practiced by:'])
            : el('span', {}),
          chips,
        ],
      ),
    )
  }
  conceptsPanel.append(
    el('h2', {}, ['Concepts']),
    conceptList,
  )

  const weak = weakConcepts(conceptMetas.map((c) => ({ id: c.id })))
  if (weak.length) {
    const revisit = el('div', { class: 'revisit-block' }, [
      el('h3', {}, ['Revisit weak concepts']),
      el('p', { class: 'muted small' }, [
        'Lowest practice strength from knowledge sessions (not self-audit scores).',
      ]),
    ])
    const list = el('ul', { class: 'revisit-list' })
    for (const w of weak) {
      const sessions = practicedBy.get(w.id) ?? []
      list.append(
        el('li', {}, [
          el(
            'a',
            {
              href: href({
                name: 'concept',
                packId,
                conceptId: w.id,
              }),
            },
            [titleById[w.id] ?? w.id],
          ),
          ` · strength ${Math.round(w.strength * 100)}%`,
          sessions[0]
            ? el('span', {}, [
                ' · ',
                el(
                  'a',
                  {
                    href: href({
                      name: 'session',
                      packId,
                      sessionId: sessions[0],
                    }),
                  },
                  ['Practice again'],
                ),
              ])
            : '',
        ]),
      )
    }
    revisit.append(list)
    conceptsPanel.append(revisit)
  }

  const sessionList = el('div', { class: 'session-grid' })
  for (const sid of sessionIds) {
    const session = await loadSession(packPath, sid)
    const prev = getSessionResult(packId, session.id)
    const status = prev
      ? `Best · ${prev.score}/${prev.maxScore}`
      : 'Not started'
    const conceptChips = el('div', { class: 'concept-chips compact' })
    for (const cid of session.conceptIds) {
      conceptChips.append(
        el('span', { class: 'concept-chip' }, [titleById[cid] ?? cid]),
      )
    }
    const card = el('a', {
      class: `item-card session-card-link kind-${session.kind === 'calculator' ? 'lab' : session.kind}${prev ? ' done' : ''}`,
      href: href({ name: 'session', packId, sessionId: session.id }),
    })
    card.append(
      kindIcon(session.kind),
      el('div', { class: 'session-card-body' }, [
        el('span', { class: 'tag kind' }, [kindLabel(session.kind)]),
        el('h3', {}, [session.title]),
        el('p', { class: 'muted small' }, [kindBlurb(session.kind)]),
        conceptChips,
        el('p', { class: 'muted small status-line' }, [status]),
      ]),
    )
    sessionList.append(card)
  }
  sessionsPanel.append(
    el('h2', {}, ['Sessions']),
    el('p', { class: 'muted' }, [
      'Practice until the mechanic sticks — diagnose, judge, inventory, construct, discriminate.',
    ]),
    sessionList,
  )

  panels.append(sheetPanel, sessionsPanel, conceptsPanel)

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
      continueId
        ? el(
            'a',
            {
              class: 'primary continue-btn',
              href: href({
                name: 'session',
                packId,
                sessionId: continueId,
              }),
            },
            ['Continue'],
          )
        : el('span', {}),
    ]),
    tabs,
    panels,
  )
}

export { resolvePackPath }
