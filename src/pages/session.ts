import { loadHalls, loadPackMeta, loadSession } from '../content'
import { el } from '../dom'
import { cue, resetRun } from '../feedback'
import { acquisitionCard, ceremony } from '../fx'
import { awardMilestones, saveSessionResult } from '../progress'
import type { Hall } from '../milestones'
import { href } from '../router'
import { kindBlurb, kindIcon, kindLabel, mountSession } from '../sessions'
import { resolvePackPath } from './pack'

export async function renderSession(
  root: HTMLElement,
  packId: string,
  sessionId: string,
): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
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

  // Started here, never awaited here: loadHalls() fetches the catalog and then
  // every pack's metadata, and awaiting it would leave the exhibit blank until
  // all of them settled — on a page that used to become interactive as soon as
  // its one session JSON arrived.
  //
  // It is also not raced. An earlier draft kept a mutable `halls` and read
  // whatever had arrived, which on a cold visit meant a short session finishing
  // first and the hall-shaped plaques being missed on the very save that earned
  // them. Progress is saved the instant the learner finishes; the plaques that
  // need the whole catalog are awarded a beat later, when it is actually known.
  const hallsReady = loadHalls().catch((): Hall[] => [])

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
    // The plaque goes up once the halls are known, so a hall completed by THIS
    // session is on it. cue() queues the shimmer behind the finishing chord,
    // so the two moments read as a sequence rather than a pile-up.
    void hallsReady.then((halls) => {
      const plaques = acquisitionCard([...earned, ...awardMilestones({ halls })])
      if (!plaques) return
      cue('milestone')
      shell.append(plaques)
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
