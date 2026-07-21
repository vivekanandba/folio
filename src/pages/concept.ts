import { loadConcept, loadPackMeta, loadSession } from '../content'
import { el, prettyId } from '../dom'
import { getConceptState, getSessionResult, markConceptLearned } from '../progress'
import { href } from '../router'
import { kindIcon, kindLabel } from '../sessions'
import { masteryBand } from '../srs'
import { renderRichInto } from '../widgets'
import { resolvePackPath } from './pack'

function titleFromMarkdown(md: string, fallback: string): string {
  const h1 = md.split('\n').find((l) => /^# /.test(l))
  return h1 ? h1.slice(2).trim() : fallback
}

const BAND_LABEL: Record<string, string> = {
  shaky: 'Shaky', developing: 'Developing', solid: 'Solid',
}

export async function renderConcept(
  root: HTMLElement,
  packId: string,
  conceptId: string,
): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
  const packPath = await resolvePackPath(packId)
  const [meta, md] = await Promise.all([
    loadPackMeta(packPath),
    loadConcept(packPath, conceptId),
  ])
  const title = titleFromMarkdown(md, prettyId(conceptId))

  // Deep explainer body (with inline interactive figures mounted).
  const article = el('article', { class: 'concept-body' })
  renderRichInto(article, md)

  // Sessions that reference this concept, split into walkthrough vs practice.
  const sessions = await Promise.all(meta.sessions.map((f) => loadSession(packPath, f).catch(() => null)))
  const related = sessions.filter((s): s is NonNullable<typeof s> => !!s && s.conceptIds.includes(conceptId))
  const walkthroughs = related.filter((s) => s.kind === 'explainer')
  const practice = related.filter((s) => s.kind !== 'explainer')

  // --- learning-path rail (rebuildable, so "Mark as learned" updates in place) ---
  let rail = buildRail()
  function buildRail(): HTMLElement {
    const st = getConceptState(packId, conceptId)
    const learned = !!st?.learnedAt
    const doneCount = practice.filter((s) => getSessionResult(packId, s.id)).length
    const reviewed = (st?.reviewCount ?? 0) > 0

    // Learn
    const learnStep = el('div', { class: `learn-step${learned ? ' done' : ''}` }, [
      el('span', { class: 'ls-kicker' }, ['1 · Learn']),
      el('span', { class: 'ls-state' }, [learned ? 'Learned ✓' : 'Read this page']),
    ])
    if (walkthroughs[0]) {
      learnStep.append(
        el('a', { class: 'ls-sub', href: href({ name: 'session', packId, sessionId: walkthroughs[0].id }) }, ['▶ Take the walkthrough']),
      )
    }
    if (!learned) {
      const mark = el('button', { class: 'ghost small', type: 'button' }, ['Mark as learned'])
      mark.addEventListener('click', () => {
        markConceptLearned(packId, conceptId)
        const fresh = buildRail()
        rail.replaceWith(fresh)
        rail = fresh
      })
      learnStep.append(mark)
    }

    // Practice
    const practiceStep = el('div', { class: `learn-step${practice.length && doneCount === practice.length ? ' done' : ''}` }, [
      el('span', { class: 'ls-kicker' }, ['2 · Practice']),
      el('span', { class: 'ls-state' }, [practice.length ? `${doneCount}/${practice.length} done` : 'No sessions yet']),
      el('span', { class: 'ls-sub' }, [practice.length ? 'Sessions are below' : '—']),
    ])

    // Review
    const reviewStep = el('div', { class: `learn-step${st && st.mastery >= 0.8 ? ' done' : ''}` }, [
      el('span', { class: 'ls-kicker' }, ['3 · Review']),
      el('span', { class: 'ls-state' }, [reviewed ? BAND_LABEL[masteryBand(st!.mastery)] : 'Not yet reviewed']),
      el('span', { class: 'ls-sub' }, [reviewed ? `Next due ${st!.due}` : 'Spaced repetition']),
    ])
    if (reviewed) {
      reviewStep.append(el('a', { class: 'ls-sub', href: href({ name: 'today' }) }, ['Go to review →']))
    }

    return el('div', { class: 'learn-path' }, [learnStep, practiceStep, reviewStep])
  }

  const children: (Node | string)[] = [
    el('nav', { class: 'crumb' }, [
      el('a', { href: href({ name: 'hub' }) }, ['Folio']),
      el('span', {}, [' / ']),
      el('a', { href: href({ name: 'pack', packId }) }, [meta.title]),
      el('span', {}, [' / ']),
      el('span', {}, [title]),
    ]),
    rail,
    article,
  ]

  if (practice.length) {
    const links = el('div', { class: 'session-grid' })
    for (const s of practice) {
      const prev = getSessionResult(packId, s.id)
      links.append(
        el('a', {
          class: `item-card session-card-link kind-${s.kind}${prev ? ' done' : ''}`,
          href: href({ name: 'session', packId, sessionId: s.id }),
        }, [
          kindIcon(s.kind),
          el('div', { class: 'session-card-body' }, [
            el('span', { class: 'tag kind' }, [kindLabel(s.kind)]),
            el('h3', {}, [s.title]),
            el('p', { class: 'muted small status-line' }, [prev ? `Done · ${prev.score}/${prev.maxScore}` : 'Not started']),
          ]),
        ]),
      )
    }
    children.push(el('section', { class: 'practice-this' }, [el('h2', {}, ['Practice this']), links]))
  }

  root.replaceChildren(...children)
}
