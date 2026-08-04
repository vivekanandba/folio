import { loadCatalog, loadPackMeta } from '../content'
import { el, prettyId } from '../dom'
import { deriveFlashcards } from '../flashcards'
import { burst } from '../fx'
import { mountDrill } from '../gauntlet/drill'
import { dailyDrill } from '../gauntlet/generators'
import { loadProgress, recordConceptReview } from '../progress'
import { href } from '../router'
import { mountFlashcards } from '../sessions/flashcard'
import { mountSim } from '../sim/engine'
import { buildToday, today, type ConceptRef } from '../srs'

/**
 * Interleave the queue across packs (round-robin by packId, order preserved
 * within a pack): mixing subjects during one review beats blocking them.
 */
function interleaveByPack<T extends { ref: ConceptRef }>(queue: T[]): T[] {
  const byPack = new Map<string, T[]>()
  for (const item of queue) {
    const bucket = byPack.get(item.ref.packId) ?? []
    bucket.push(item)
    byPack.set(item.ref.packId, bucket)
  }
  const buckets = [...byPack.values()]
  const out: T[] = []
  for (let i = 0; out.length < queue.length; i++) {
    for (const bucket of buckets) if (i < bucket.length) out.push(bucket[i])
  }
  return out
}

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
  const queue = interleaveByPack(buildToday(store.concepts, allConcepts))

  if (!queue.length) {
    // The museum explains itself: a live forgetting curve while you wait.
    const curveHost = el('div', { class: 'viz-slot' })
    mountSim(curveHost, {
      model: 'retention',
      title: 'Why folio nags you — the forgetting curve, live',
      caption: 'Memory decays; reviewing near the edge of forgetting multiplies stability. That timing is what the review queue computes.',
    })
    curveHost.classList.add('widget-mounted')
    root.replaceChildren(
      header(),
      el('header', { class: 'page-header' }, [
        el('h1', {}, ['All caught up']),
        el('p', { class: 'lead' }, [
          'Nothing is due right now. Play a session or come back tomorrow to keep concepts fresh.',
        ]),
        el('a', { class: 'primary', href: href({ name: 'hub' }) }, ['Back to hub']),
      ]),
      curveHost,
    )
    return
  }

  let pos = 0
  let reviewed = 0

  const showSummary = () => {
    const stamp = el('div', { class: 'exhibit-stamp mastered', role: 'status' }, ['Gauntlet cleared'])
    root.replaceChildren(
      header(),
      el('div', { class: 'result-card pop-in review-summary' }, [
        el('h2', {}, ['Review complete']),
        el('p', { class: 'score-hero' }, [String(reviewed)]),
        el('p', {}, [
          `concept${reviewed === 1 ? '' : 's'} reviewed today. Fresh drills return tomorrow.`,
        ]),
        stamp,
        el('p', {}, [el('a', { class: 'primary', href: href({ name: 'hub' }) }, ['Back to the museum'])]),
      ]),
    )
    burst(stamp)
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
      // Today's generated drill for this concept (null → flashcards only).
      const drill = dailyDrill(item.ref.packId, item.ref.conceptId, today())
      if (!cards.length && !drill) {
        pos += 1
        continue
      }

      const host = el('div', { class: 'session-shell immersive' })
      root.replaceChildren(
        header(),
        el('p', { class: 'review-progress muted small' }, [
          `Concept ${pos + 1} of ${queue.length} · ${item.status}${drill ? ' · fresh drill waiting' : ''}`,
        ]),
        host,
      )

      const advance = (): void => {
        reviewed += 1
        pos += 1
        // Surface a mid-queue failure instead of leaving an unhandled rejection.
        runNext().catch((e) => {
          root.replaceChildren(
            header(),
            el('div', { class: 'error' }, [
              el('h1', {}, ['Review interrupted']),
              el('p', {}, [e instanceof Error ? e.message : String(e)]),
              el('a', { class: 'primary', href: href({ name: 'hub' }) }, ['Back to hub']),
            ]),
          )
        })
      }

      // Recall first, then prove it on fresh numbers. The drill is weighted
      // into the SRS grade: objective performance tempers self-assessment.
      const finishConcept = (flashAvg: number, drillScore: number | null): void => {
        const normalized = drillScore == null ? flashAvg : flashAvg * 0.6 + drillScore * 0.4
        recordConceptReview(item.ref.packId, item.ref.conceptId, normalized)
        advance()
      }

      const runDrill = (flashAvg: number): void => {
        if (!drill) {
          finishConcept(flashAvg, null)
          return
        }
        mountDrill(host, prettyId(item.ref.conceptId), drill, (score) => finishConcept(flashAvg, score))
      }

      if (cards.length) {
        // Time-box the round: fewer cards when a drill follows.
        mountFlashcards(host, prettyId(item.ref.conceptId), cards.slice(0, drill ? 5 : 8), runDrill)
      } else {
        runDrill(0.75) // no cards — the drill alone carries the grade at neutral prior
      }
      return
    }
    showSummary()
  }

  await runNext()
}
