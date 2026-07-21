import { loadCatalog, loadPackMeta, loadSession } from '../content'
import { el, prettyId } from '../dom'
import { getConceptState, getSessionResult } from '../progress'
import { href } from '../router'
import { kindBlurb, kindIcon, kindLabel } from '../sessions'
import { masteryBand } from '../srs'

const BAND_LABEL: Record<string, string> = { shaky: 'Shaky', developing: 'Developing', solid: 'Solid' }

function conceptStatus(packId: string, cid: string): string {
  const st = getConceptState(packId, cid)
  if (st && st.reviewCount > 0) return `${BAND_LABEL[masteryBand(st.mastery)]} · next ${st.due}`
  if (st?.learnedAt) return 'Learned — not yet reviewed'
  return 'New'
}

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

  const conceptList = el('div', { class: 'item-list concept-grid' })
  for (const cid of meta.concepts) {
    const st = getConceptState(packId, cid)
    const done = st && st.mastery >= 0.8
    conceptList.append(
      el('a', {
        class: `item-card concept-card${done ? ' done' : ''}`,
        href: href({ name: 'concept', packId, conceptId: cid }),
      }, [
        el('span', { class: 'tag' }, ['Concept']),
        el('h3', {}, [prettyId(cid)]),
        el('p', { class: 'muted small status-line' }, [conceptStatus(packId, cid)]),
      ]),
    )
  }

  const sessionList = el('div', { class: 'session-grid' })
  const sessions = await Promise.all(meta.sessions.map((file) => loadSession(packPath, file)))
  for (const session of sessions) {
    const prev = getSessionResult(packId, session.id)
    const status = prev
      ? `Done · ${prev.score}/${prev.maxScore}`
      : 'Not started'
    const card = el('a', {
      class: `item-card session-card-link kind-${session.kind}${prev ? ' done' : ''}`,
      href: href({ name: 'session', packId, sessionId: session.id }),
    })
    card.append(
      kindIcon(session.kind),
      el('div', { class: 'session-card-body' }, [
        el('span', { class: 'tag kind' }, [kindLabel(session.kind)]),
        el('h3', {}, [session.title]),
        el('p', { class: 'muted small' }, [kindBlurb(session.kind)]),
        el('p', { class: 'muted small status-line' }, [status]),
      ]),
    )
    sessionList.append(card)
  }

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
    ]),
    el('section', {}, [
      el('h2', {}, ['Interactive sessions']),
      el('p', { class: 'muted' }, [
        'Each session is a different visual mode — detective charts, labs, maps, forks.',
      ]),
      sessionList,
    ]),
    el('section', {}, [
      el('h2', {}, ['Concepts']),
      conceptList,
    ]),
  )
}

export { resolvePackPath }
