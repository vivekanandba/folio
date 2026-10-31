import { liveAnnounce } from '../a11y'
import { loadHalls, loadPackMeta, loadSession } from '../content'
import { loadingLine } from '../curator'
import { el } from '../dom'
import { cue, resetRun } from '../feedback'
import { acquisitionCard, ceremony } from '../fx'
import { awardMilestones, saveSessionResult } from '../progress'
import type { Hall, Milestone } from '../milestones'
import { href } from '../router'
import { kindBlurb, kindIcon, kindLabel, mountSession } from '../sessions'
import { resolvePackPath } from './pack'

export async function renderSession(
  root: HTMLElement,
  packId: string,
  sessionId: string,
): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, [loadingLine('session')]))
  const packPath = await resolvePackPath(packId)
  const meta = await loadPackMeta(packPath)

  const file =
    meta.sessions.find(
      (s) =>
        s.replace(/\.json$/, '').replace(/^\d+-/, '') === sessionId ||
        s.replace(/\.json$/, '') === sessionId,
    ) ?? `${sessionId}.json`

  const session = await loadSession(packPath, file)

  // Each exhibit starts the ladder again — a run belongs to a session.
  resetRun()

  const shell = el('div', { class: 'session-shell immersive' })
  const mount = el('div', { class: 'session-mount' })

  root.classList.add('main-wide')
  root.replaceChildren(
    el('nav', { class: 'crumb' }, [
      el('a', { href: href({ name: 'hub' }) }, ['Folio']),
      el('span', {}, [' / ']),
      el('a', { href: href({ name: 'pack', packId }) }, [meta.title]),
      el('span', {}, [' / ']),
      el('span', {}, [session.title]),
    ]),
    el('header', { class: 'page-header compact session-hero' }, [
      kindIcon(session.kind),
      el('div', {}, [
        el('span', { class: 'tag kind' }, [kindLabel(session.kind)]),
        el('h1', {}, [session.title]),
        el('p', { class: 'muted small' }, [kindBlurb(session.kind)]),
      ]),
    ]),
    shell,
  )
  shell.append(mount)


  /** Hang plaques on the wall, and say so out loud. */
  const showPlaques = (items: Milestone[]): void => {
    const card = acquisitionCard(items)
    if (!card) return
    cue('milestone')
    shell.append(card)
    // A live region that is inserted ALREADY holding its content is not
    // reliably announced — the region has to exist before the mutation. The
    // app keeps one for exactly this, so the plaque reaches a screen reader
    // rather than being a purely visual reward.
    liveAnnounce(
      items.length === 1
        ? `Plaque earned: ${items[0].title}`
        : `${items.length} plaques earned: ${items.map((m) => m.title).join(', ')}`,
    )
  }

  let saved = false
  mountSession(mount, session, (score, maxScore) => {
    if (saved) return
    saved = true
    const earned = saveSessionResult(
      {
        packId,
        sessionId: session.id,
        kind: session.kind,
        score,
        maxScore,
        completedAt: new Date().toISOString(),
      },
      session.conceptIds,
    )
    // The chord is unconditional: finishing an exhibit is worth hearing even
    // if the kind that rendered it has no .stage for the bloom to land on.
    const perfect = maxScore > 0 && score === maxScore
    cue('complete', { perfect })
    // The room celebrates: bloom + bursts + a brass stamp on the exhibit.
    const stageEl = shell.querySelector<HTMLElement>('.stage')
    if (stageEl) ceremony(stageEl, { perfect })
    // What was earned without hall knowledge is shown NOW. saveSessionResult
    // has already recorded it, so deferring it behind a network round-trip
    // risked spending a plaque the learner never saw — detect() never offers a
    // recorded one again, and it would only ever turn up on the shelf.
    showPlaques(earned)

    // The hall-shaped plaques need the whole catalog, which is fetched only
    // now: at render it would have contended with the session's own assets on
    // every visit, including the many that earn nothing.
    void loadHalls()
      .catch((): Hall[] => [])
      .then((halls) => {
        // Only if the learner is still here. Otherwise the shimmer would play
        // over whatever page they navigated to and the card would go onto a
        // shell nobody can see — and feedback.ts's own rule is that a learner
        // who has left an exhibit is not sung to by it. cancelPending() cannot
        // help: this would be a FRESH cue made after the navigation.
        //
        // Skipping the award, not just the display, is the load-bearing half:
        // awardMilestones() RECORDS what it hands out, so granting into an
        // empty room would spend the plaque. Left ungranted it is earned on
        // the next save, which is why detection is satisfied-minus-recorded.
        if (!shell.isConnected) return
        showPlaques(awardMilestones({ halls }))
      })
    shell.append(
      el('div', { class: 'saved-note plaque-card' }, [
        el('span', { class: 'plaque' }, ['Progress saved']),
        el('p', {}, [
          'Recorded on this device. ',
          el('a', { href: href({ name: 'pack', packId }) }, ['Back to the hall →']),
        ]),
      ]),
    )
  })
}
