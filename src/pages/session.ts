import { loadHalls, loadPackMeta, loadSession } from '../content'
import { el } from '../dom'
import { cue, resetRun } from '../feedback'
import { acquisitionCard, ceremony } from '../fx'
import { saveSessionResult } from '../progress'
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

  // Started here, never AWAITED here. loadHalls() fetches the catalog and then
  // every pack's metadata; awaiting it would leave the exhibit blank until all
  // of them settled, on a page that used to become interactive as soon as its
  // one session JSON had arrived. A learner takes seconds to play, so by the
  // time this matters it has landed — and if it has not, the hall-shaped
  // plaques fire on the next save rather than being lost, because detect() is
  // satisfied-minus-recorded and not a diff. Progress is never at risk either way.
  let halls: Hall[] = []
  void loadHalls().then((h) => { halls = h }).catch(() => {})

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
      { halls },
    )
    // The chord is unconditional: finishing an exhibit is worth hearing even
    // if the kind that rendered it has no .stage for the bloom to land on.
    const perfect = maxScore > 0 && score === maxScore
    cue('complete', { perfect })
    // The room celebrates: bloom + bursts + a brass stamp on the exhibit.
    const stageEl = shell.querySelector<HTMLElement>('.stage')
    if (stageEl) ceremony(stageEl, { perfect })
    // The plaque goes up after the room has finished celebrating the exhibit,
    // so the two moments read as a sequence rather than a pile-up.
    const plaques = acquisitionCard(earned)
    if (plaques) {
      cue('milestone')
      shell.append(plaques)
    }
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
