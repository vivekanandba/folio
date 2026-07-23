import { loadCatalog, loadPackMeta } from '../content'
import { el } from '../dom'
import type { FolioPackMeta } from '../types'
import { getResume, loadProgress, packCompletion } from '../progress'
import { href } from '../router'
import {
  buildToday,
  computeStreak,
  masteryBand,
  retentionRate,
  today,
  type ConceptRef,
} from '../srs'

function sessionIdFromFile(file: string): string {
  return file.replace(/\.json$/, '').replace(/^\d+-/, '')
}

/** Known subject → broad umbrella. Unmapped subjects fall back to a title-cased label. */
const SUBJECT_CATEGORY: Record<string, string> = {
  finance: 'Finance',
  equity: 'Finance',
  'system-design': 'Software',
}

/** Resolve a pack's landing-page category: explicit field, else subject map, else title-cased subject. */
function packCategory(meta: { category?: string; subject: string }): string {
  if (meta.category) return meta.category
  return (
    SUBJECT_CATEGORY[meta.subject] ??
    meta.subject.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

function statTile(value: string, label: string, tone = ''): HTMLElement {
  return el('div', { class: `stat-tile ${tone}` }, [
    el('span', { class: 'stat-value' }, [value]),
    el('span', { class: 'stat-label' }, [label]),
  ])
}

export async function renderHub(root: HTMLElement): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['Loading…']))
  const catalog = await loadCatalog()
  const metas = await Promise.all(catalog.packs.map((ref) => loadPackMeta(ref.path)))

  const store = loadProgress()
  const allConcepts: ConceptRef[] = []
  for (const meta of metas) {
    for (const conceptId of meta.concepts) allConcepts.push({ packId: meta.id, conceptId })
  }
  const queue = buildToday(store.concepts, allConcepts)
  const dueCount = queue.filter((q) => q.status !== 'new').length
  const newCount = queue.filter((q) => q.status === 'new').length
  const streak = computeStreak(store.daily)
  const reviewedToday = store.daily[today()] ?? 0

  const bands = { shaky: 0, developing: 0, solid: 0 }
  for (const st of Object.values(store.concepts)) bands[masteryBand(st.mastery)] += 1
  const retention = retentionRate(store.attempts)
  const learnedCount = Object.values(store.concepts).filter((s) => s.learnedAt).length

  // --- Today panel ---
  const todayPanel = el('section', { class: 'today-panel' }, [
    el('div', { class: 'today-copy' }, [
      el('p', { class: 'eyebrow' }, ['Spaced repetition']),
      el('h2', {}, [dueCount > 0 ? `${dueCount} concept${dueCount === 1 ? '' : 's'} due` : 'Nothing due right now']),
      el('p', { class: 'muted' }, [
        dueCount > 0
          ? 'A quick recall pass keeps them from fading.'
          : newCount > 0
            ? `${newCount} new concept${newCount === 1 ? '' : 's'} ready to learn.`
            : 'You are all caught up — play a session to add more.',
      ]),
      el('a', { class: 'primary pulse', href: href({ name: 'today' }) }, [
        queue.length > 0 ? 'Start review' : 'Browse concepts',
      ]),
    ]),
    el('div', { class: 'stat-row' }, [
      statTile(String(streak), 'day streak', streak > 0 ? 'tone-good' : ''),
      statTile(String(reviewedToday), 'reviewed today'),
      statTile(retention == null ? '—' : `${Math.round(retention * 100)}%`, '30-day recall'),
      statTile(`${learnedCount}/${allConcepts.length}`, 'concepts learned'),
      statTile(`${bands.solid}/${bands.solid + bands.developing + bands.shaky}`, 'concepts solid'),
    ]),
  ])

  // --- Resume card ---
  const resume = getResume()
  let resumeCard: HTMLElement | null = null
  if (resume) {
    const meta = metas.find((m) => m.id === resume.packId)
    if (meta) {
      const sessionIds = meta.sessions.map(sessionIdFromFile)
      const { done, total } = packCompletion(meta.id, sessionIds)
      const nextUnstarted = meta.sessions
        .map(sessionIdFromFile)
        .find((id) => !store.sessions[`${meta.id}::${id}`])
      const dest = nextUnstarted
        ? href({ name: 'session', packId: meta.id, sessionId: nextUnstarted })
        : href({ name: 'pack', packId: meta.id })
      resumeCard = el('a', { class: 'resume-card', href: dest }, [
        el('div', {}, [
          el('span', { class: 'eyebrow' }, ['Resume']),
          el('h3', {}, [meta.title]),
          el('p', { class: 'muted small' }, [
            nextUnstarted ? 'Pick up the next session' : `${done}/${total} sessions done`,
          ]),
        ]),
        el('span', { class: 'resume-arrow', 'aria-hidden': 'true' }, ['→']),
      ])
    }
  }

  // --- Pack browser: filter chips + category sections ---
  // Group packs by category, preserving catalog order of first appearance.
  const groups: { category: string; metas: typeof metas }[] = []
  for (const meta of metas) {
    const category = packCategory(meta)
    let group = groups.find((g) => g.category === category)
    if (!group) {
      group = { category, metas: [] }
      groups.push(group)
    }
    group.metas.push(meta)
  }

  const sections = el('div', { class: 'cat-sections' })
  for (const group of groups) {
    const grid = el('div', { class: 'pack-grid' }, group.metas.map(packCard))
    sections.append(
      el('section', { class: 'cat-section', 'data-cat': group.category }, [
        el('h3', { class: 'cat-heading' }, [
          group.category,
          el('span', { class: 'cat-count' }, [String(group.metas.length)]),
        ]),
        grid,
      ]),
    )
  }

  // Filter chips — "All" plus one per category. Clicking shows only matching sections.
  const chipRow = el('div', { class: 'cat-filter', role: 'group', 'aria-label': 'Filter packs by category' })
  const chipDefs = [{ label: 'All', cat: 'all' }, ...groups.map((g) => ({ label: g.category, cat: g.category }))]
  const chips = chipDefs.map(({ label, cat }) => {
    const isAll = cat === 'all'
    const btn = el('button', {
      class: `cat-chip${isAll ? ' active' : ''}`,
      type: 'button',
      'aria-pressed': isAll ? 'true' : 'false',
      'data-cat': cat,
    }, [label])
    btn.addEventListener('click', () => {
      chips.forEach((c) => {
        const on = c === btn
        c.classList.toggle('active', on)
        c.setAttribute('aria-pressed', on ? 'true' : 'false')
      })
      sections.querySelectorAll<HTMLElement>('.cat-section').forEach((sec) => {
        sec.hidden = cat !== 'all' && sec.getAttribute('data-cat') !== cat
      })
    })
    return btn
  })
  chipRow.append(...chips)

  // Only show the filter row when there's more than one category to filter by.
  const packBrowser = el('div', { class: 'pack-browser' }, groups.length > 1 ? [chipRow, sections] : [sections])

  const children: (Node | string)[] = [
    el('header', { class: 'page-header hub-hero cinematic-hero' }, [
      el('p', { class: 'eyebrow' }, ['Folio']),
      el('h1', {}, ['Learn it once. Play it back.']),
      el('p', { class: 'lead' }, [
        'Revision as interactive stages — peel clues, drag cards, twist knobs, walk decision forks.',
      ]),
      el('div', { class: 'kind-strip' }, [
        chip('Detective'),
        chip('Lab'),
        chip('Audit map'),
        chip('Decision forks'),
        chip('Sort bench'),
      ]),
    ]),
    todayPanel,
  ]
  if (resumeCard) children.push(resumeCard)
  children.push(el('h2', { class: 'section-title' }, ['Your packs']), packBrowser)

  root.replaceChildren(...children)
}

/** One pack card for the landing grid. */
function packCard(meta: FolioPackMeta): HTMLElement {
  const sessionIds = meta.sessions.map(sessionIdFromFile)
  const { done, total } = packCompletion(meta.id, sessionIds)
  const pct = total ? Math.round((done / total) * 100) : 0
  return el('a', {
    class: 'pack-card cinematic',
    href: href({ name: 'pack', packId: meta.id }),
  }, [
    el('div', { class: 'pack-card-art', 'aria-hidden': 'true' }, [
      el('div', { class: 'art-orb orb-1' }),
      el('div', { class: 'art-orb orb-2' }),
      el('div', { class: 'art-orb orb-3' }),
    ]),
    el('div', { class: 'pack-card-body' }, [
      el('div', { class: 'pack-card-top' }, [
        el('span', { class: 'tag' }, [meta.subject]),
        el('span', { class: 'pack-type' }, [meta.type]),
      ]),
      el('h2', {}, [meta.title]),
      el('p', {}, [meta.summary]),
      el('div', { class: 'pack-progress' }, [
        el('div', { class: 'pack-progress-track' }, [
          el('div', { class: 'pack-progress-fill', style: `width:${pct}%` }),
        ]),
        el('span', { class: 'muted small' }, [`${done}/${total} sessions`]),
      ]),
    ]),
  ])
}

function chip(label: string): HTMLElement {
  return el('span', { class: 'kind-chip' }, [label])
}
