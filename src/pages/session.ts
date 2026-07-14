import {
  canonicalizeSessionId,
  loadPackMeta,
  loadSession,
  packSessions,
} from '../content'
import { el, kindBlurb, kindLabel } from '../dom'
import { saveSessionResult } from '../progress'
import { href } from '../router'
import { mountSessionShell } from '../runtime/session-shell'
import { getKindMount } from '../sessions'
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
  const sid = canonicalizeSessionId(sessionId)
  const known = packSessions(meta)
  const file = known.includes(sid) ? sid : sid

  const session = await loadSession(packPath, file)

  const shell = el('div', { class: 'session-shell immersive' })
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
  let saved = false
  mountSessionShell(shell, session, {
    mount: getKindMount(session),
    onComplete: (result) => {
      if (saved) return
      saved = true
      saveSessionResult({
        packId,
        sessionId: session.id,
        kind: session.kind,
        score: result.score,
        maxScore: result.maxScore,
        completedAt: new Date().toISOString(),
        reflectionOnly: result.reflectionOnly,
        conceptIds: session.conceptIds,
      })
      shell.append(
        el('p', { class: 'saved-note' }, [
          'Progress saved on this device. ',
          el('a', { href: href({ name: 'pack', packId }) }, ['Back to pack']),
        ]),
      )
    },
  })
}
