import { loadPackMeta, loadSession } from '../content'
import { el, kindBlurb, kindLabel } from '../dom'
import { saveSessionResult } from '../progress'
import { href } from '../router'
import { mountSession } from '../sessions'
import { kindIcon } from '../visuals'
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

  const shell = el('div', { class: 'session-shell' })
  const mount = el('div', { class: 'session-mount' })

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

  let saved = false
  mountSession(mount, session, (score, maxScore) => {
    if (saved) return
    saved = true
    saveSessionResult({
      packId,
      sessionId: session.id,
      kind: session.kind,
      score,
      maxScore,
      completedAt: new Date().toISOString(),
    })
    shell.append(
      el('p', { class: 'saved-note' }, [
        'Progress saved on this device. ',
        el('a', { href: href({ name: 'pack', packId }) }, ['Back to pack']),
      ]),
    )
  })
}
