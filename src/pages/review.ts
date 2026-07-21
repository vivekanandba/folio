import { loadCatalog, loadPackMeta } from '../content'
import { el, prettyId } from '../dom'
import { deriveFlashcards } from '../flashcards'
import { loadProgress, recordConceptReview } from '../progress'
import { href } from '../router'
import { mountFlashcards } from '../sessions/flashcard'
import { buildToday, type ConceptRef } from '../srs'

function header(): HTMLElement {
  return el('nav', { class: 'crumb' }, [
    el('a', { href: href({ name: 'hub' }) }, ['Folio']),
    el('span', {}, [' / ']),
    el('span', {}, ['Today’s review']),
  ])
}

export async function renderReview(root: HTMLElement): Promise<void> {
  root.classList.add('main-wide')
  root.replaceChildren(el('p', { class: 'muted' }, ['Building your review…']))

  const catalog = await loadCatalog()
  const metas = await Promise.all(
    catalog.packs.map(async (ref) => ({ ref, meta: await loadPackMeta(ref.path) })),
  )

  const packInfo = new Map<string, { path: string; sessionFiles: string[] }>()
  const allConcepts: ConceptRef[] = []
  for (const { ref, meta } of metas) {
    packInfo.set(meta.id, { path: ref.path, sessionFiles: meta.sessions })
    for (const conceptId of meta.concepts) allConcepts.push({ packId: meta.id, conceptId })
  }

  const store = loadProgress()
  const queue = buildToday(store.concepts, allConcepts)

  if (!queue.length) {
    root.replaceChildren(
      header(),
      el('header', { class: 'page-header' }, [
        el('h1', {}, ['All caught up']),
        el('p', { class: 'lead' }, [
          'Nothing is due right now. Play a session or come back tomorrow to keep concepts fresh.',
        ]),
        el('a', { class: 'primary', href: href({ name: 'hub' }) }, ['Back to hub']),
      ]),
    )
    return
  }

  let pos = 0
  let reviewed = 0

  const showSummary = () => {
    root.replaceChildren(
      header(),
      el('div', { class: 'result-card pop-in review-summary' }, [
        el('h2', {}, ['Review complete']),
        el('p', { class: 'score-hero' }, [String(reviewed)]),
        el('p', {}, [
          `concept${reviewed === 1 ? '' : 's'} reviewed today. Spaced out for maximum retention.`,
        ]),
        el('a', { class: 'primary', href: href({ name: 'hub' }) }, ['Back to hub']),
      ]),
    )
  }

  const runNext = async () => {
    while (pos < queue.length) {
      const item = queue[pos]
      const info = packInfo.get(item.ref.packId)
      if (!info) {
        pos += 1
        continue
      }
      const cards = await deriveFlashcards(
        info.path,
        item.ref.packId,
        item.ref.conceptId,
        info.sessionFiles,
      )
      if (!cards.length) {
        pos += 1
        continue
      }

      const host = el('div', { class: 'session-shell immersive' })
      root.replaceChildren(
        header(),
        el('p', { class: 'review-progress muted small' }, [
          `Concept ${pos + 1} of ${queue.length} · ${item.status}`,
        ]),
        host,
      )
      mountFlashcards(host, prettyId(item.ref.conceptId), cards.slice(0, 8), (normalized) => {
        recordConceptReview(item.ref.packId, item.ref.conceptId, normalized)
        reviewed += 1
        pos += 1
        void runNext()
      })
      return
    }
    showSummary()
  }

  await runNext()
}
