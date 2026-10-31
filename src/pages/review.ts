import { liveAnnounce } from '../a11y'
import { loadCatalog, loadPackMeta, sessionIdOf } from '../content'
import { loadingLine } from '../curator'
import { el, prettyId } from '../dom'
import { cue, resetRun } from '../feedback'
import { deriveFlashcards } from '../flashcards'
import { acquisitionCard, ceremony, countUp } from '../fx'
import { mountDrill } from '../gauntlet/drill'
import { dailyDrill } from '../gauntlet/generators'
import { awardMilestones, loadProgress, recordConceptReview } from '../progress'
import { href } from '../router'
import { mountFlashcards } from '../sessions/flashcard'
import { mountSim } from '../sim/engine'
import { buildToday, today, type ConceptRef } from '../srs'

function header(): HTMLElement {
  return el('nav', { class: 'crumb' }, [
    el('a', { href: href({ name: 'hub' }) }, ['Folio']),
    el('span', {}, [' / ']),
    el('span', {}, ['Today’s review']),
  ])
}

export async function renderReview(root: HTMLElement): Promise<void> {
  // The daily round is its own run; it does not inherit one from a session.
  resetRun()
  root.classList.add('main-wide')
  root.replaceChildren(el('p', { class: 'muted' }, [loadingLine('today')]))

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
  // This page already has every pack's metadata, so the halls are free here.
  const halls = metas.map(({ meta }) => ({
    packId: meta.id,
    title: meta.title,
    sessionIds: meta.sessions.map(sessionIdOf),
  }))
  // Plaques earned across the whole round, shown once at the end rather than
  // interrupting between cards.


  const store = loadProgress()
  const queue = buildToday(store.concepts, allConcepts) // already pack-interleaved

  if (!queue.length) {
    // The museum explains itself: a live forgetting curve while you wait.
    const curveHost = el('div', { class: 'viz-slot' })
    const curve = mountSim(curveHost, {
      model: 'retention',
      title: 'Why folio nags you — the forgetting curve, live',
      caption: 'Memory decays; reviewing near the edge of forgetting multiplies stability. That timing is what the review queue computes.',
    })
    // Marked from mountSim's RETURN, not asserted on its behalf. It returns
    // null for an unknown model and renders "(unknown simulation)" instead,
    // and this used to add `widget-mounted` either way — declaring a figure
    // mounted that may never have been, to anything that reads the class.
    curveHost.classList.add(curve ? 'widget-mounted' : 'widget-failed')
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
    // Everything this screen wants said, gathered and spoken ONCE. The live
    // region holds one message at a time.
    const spoken: string[] = [`Review complete. ${reviewed} concept${reviewed === 1 ? '' : 's'} reviewed.`]
    const score = el('p', { class: 'score-hero' }, [String(reviewed)])
    const card = el('div', { class: 'result-card pop-in review-summary' }, [
      el('h2', {}, ['Review complete']),
      score,
      el('p', {}, [
        `concept${reviewed === 1 ? '' : 's'} reviewed today. Fresh drills return tomorrow.`,
      ]),
    ])
    if (reviewed === 0) {
      // A round where every concept was skipped cleared no gauntlet, so it is
      // not stamped — the stamp is the loudest claim on the card, and sounding
      // nothing while stamping "cleared" would leave the two disagreeing.
      // role="status" so a screen reader is told as much (CON-DATA-001).
      // The note is plain text and the announcement is COMPOSED below, not
      // made here. a11y.ts clears the one shared region and re-fills it on a
      // 30ms timer, so two liveAnnounce calls in the same synchronous pass
      // leave only the second — and an empty round that also earns a plaque
      // would lose exactly this sentence to the plaque's.
      card.append(
        el('div', { class: 'muted small' }, [
          'Nothing was due that had material to review.',
        ]),
      )
      spoken.push('Nothing was due that had material to review.')
    }
    const cta = el('p', {}, [
      el('a', { class: 'primary', href: href({ name: 'hub' }) }, ['Back to the museum']),
    ])
    root.replaceChildren(header(), card)
    countUp(score, reviewed)

    if (reviewed > 0) {
      cue('complete', { perfect: false })
      // ceremony(), not a hand-built stamp. This page used to re-implement
      // the markup and the burst, so a change to how the museum celebrates
      // reached every session and not the daily round. `perfect` stays false:
      // these grades are self-reported, so this is attendance rather than
      // mastery, and the label says exactly that.
      ceremony(card, { perfect: false, label: 'Gauntlet cleared' })
    }
    // The CTA goes on AFTER the ceremony. ceremony() appends its stamp to the
    // end of the card, so building the card with the link already in it put
    // the brass "Gauntlet cleared" plaque underneath "Back to the museum" —
    // the stamp belongs to the result, not after the way out of it.
    card.append(cta)
    // Awarded here, where they are also shown — recorded and celebrated in
    // the same breath, so neither can happen without the other.
    const earned = awardMilestones({ halls })
    const plaques = acquisitionCard(earned)
    if (plaques) {
      cue('milestone')
      root.append(plaques)
      // A live region appended ALREADY populated is not reliably announced,
      // so the shared one carries it — otherwise a plaque earned in the daily
      // review is a purely visual reward, while the same plaque on a session
      // page is announced.
      spoken.push(
        earned.length === 1
          ? `Plaque earned: ${earned[0].title}`
          : `${earned.length} plaques earned: ${earned.map((m) => m.title).join(', ')}`,
      )
    }
    liveAnnounce(spoken.join(' '))
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
        // `null`: record the progress, award nothing yet. The round shows its
        // plaques once at the end, and awarding here would RECORD them — so a
        // learner who closed the tab before the summary would have spent the
        // moment without ever seeing it (detect() never offers a recorded
        // plaque again). session.ts guards the same hole on its own path.
        recordConceptReview(item.ref.packId, item.ref.conceptId, normalized, null)
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
