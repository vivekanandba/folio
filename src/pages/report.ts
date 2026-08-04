import { loadCatalog, loadPackMeta } from '../content'
import { el, prettyId } from '../dom'
import { exportProgress, importProgress, loadProgress, packCompletion } from '../progress'
import { href } from '../router'
import { computeStreak, masteryBand, retentionRate, today } from '../srs'
import type { Attempt, FolioPackMeta } from '../types'

/**
 * The Curator's Report — your museum, measured. Everything here is computed
 * from the attempt log and concept states that folio already records:
 * measured recall by gap since the previous review (your real forgetting
 * curve), the weakest lamps, the visiting streak, and per-hall progress.
 */

interface GapBucket {
  label: string
  minDays: number
  maxDays: number
  scores: number[]
}

/** Avg recall per time-gap-since-previous-review, reconstructed per concept. */
function retentionByGap(attempts: Attempt[]): GapBucket[] {
  const buckets: GapBucket[] = [
    { label: 'same day', minDays: 0, maxDays: 1, scores: [] },
    { label: '1–2 days', minDays: 1, maxDays: 3, scores: [] },
    { label: '3–6 days', minDays: 3, maxDays: 7, scores: [] },
    { label: '1–2 weeks', minDays: 7, maxDays: 14, scores: [] },
    { label: '2–4 weeks', minDays: 14, maxDays: 30, scores: [] },
    { label: '1 month +', minDays: 30, maxDays: Infinity, scores: [] },
  ]
  // Walk chronologically, tracking each concept's previous attempt time.
  const lastSeen = new Map<string, number>()
  const ordered = [...attempts].sort((a, b) => a.at.localeCompare(b.at))
  for (const attempt of ordered) {
    const t = Date.parse(attempt.at)
    if (!Number.isFinite(t)) continue
    for (const cid of attempt.conceptIds) {
      const key = `${attempt.packId}::${cid}`
      const prev = lastSeen.get(key)
      lastSeen.set(key, t)
      if (prev == null) continue // first exposure — not a retention datum
      const gapDays = (t - prev) / 86400000
      const bucket = buckets.find((b) => gapDays >= b.minDays && gapDays < b.maxDays)
      bucket?.scores.push(attempt.normalized)
    }
  }
  return buckets
}

function bar(label: string, pct: number | null, note: string): HTMLElement {
  return el('div', { class: 'radar-row report-bar' }, [
    el('span', { class: 'muted small' }, [label]),
    el('div', { class: 'radar-track' }, [
      el('div', {
        class: 'radar-fill',
        style: `width:${pct == null ? 0 : Math.round(pct * 100)}%`,
      }),
    ]),
    el('span', { class: 'small report-bar-note' }, [note]),
  ])
}

/** GitHub-style dot calendar over the last `weeks` weeks of store.daily. */
function streakCalendar(daily: Record<string, number>, weeks = 8): HTMLElement {
  const grid = el('div', { class: 'streak-grid', 'aria-hidden': 'true' })
  const now = new Date()
  const days = weeks * 7
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000)
    const iso = d.toISOString().slice(0, 10)
    const count = daily[iso] ?? 0
    const level = count === 0 ? 0 : count < 3 ? 1 : count < 6 ? 2 : 3
    grid.append(el('span', { class: `streak-dot level-${level}`, title: `${iso}: ${count}` }))
  }
  return grid
}

/** Backup / restore — progress lives in this browser unless you carry it out. */
function ledgerSection(): HTMLElement {
  const exportBtn = el('button', { class: 'ghost', type: 'button' }, ['⬇ Export progress'])
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = el('a', { href: url, download: `folio-progress-${today()}.json` })
    document.body.append(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  })

  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.accept = 'application/json,.json'
  fileInput.className = 'sr-only'
  const importBtn = el('button', { class: 'ghost', type: 'button' }, ['⬆ Import backup'])
  const note = el('p', { class: 'muted small' }, [
    'Progress lives in this browser only. Export a ledger before switching devices; importing replaces what’s here.',
  ])
  importBtn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file) return
    const text = await file.text()
    const check = importProgress(text)
    if (check.ok) {
      note.textContent = 'Ledger restored. Reloading…'
      window.setTimeout(() => location.reload(), 600)
    } else {
      note.textContent = `Import refused: ${check.error}`
      note.classList.add('bad')
    }
  })

  return el('section', {}, [
    el('h2', {}, ['The ledger']),
    note,
    el('div', { class: 'session-actions' }, [exportBtn, importBtn, fileInput]),
  ])
}

export async function renderReport(root: HTMLElement): Promise<void> {
  root.replaceChildren(el('p', { class: 'muted' }, ['The curator is tallying…']))
  const catalog = await loadCatalog()
  const metas: FolioPackMeta[] = await Promise.all(catalog.packs.map((r) => loadPackMeta(r.path)))
  const store = loadProgress()

  const crumb = el('nav', { class: 'crumb' }, [
    el('a', { href: href({ name: 'floor' }) }, ['Folio']),
    el('span', {}, [' / ']),
    el('span', {}, ['Curator’s report']),
  ])
  const head = el('header', { class: 'page-header' }, [
    el('p', {}, [el('span', { class: 'plaque' }, ['Curator’s report'])]),
    el('h1', {}, ['Your museum, measured']),
  ])

  if (!store.attempts.length) {
    root.replaceChildren(
      crumb,
      head,
      el('p', { class: 'lead' }, [
        'Nothing to tally yet — play a session or run the daily review, and the curator will start keeping records.',
      ]),
      el('a', { class: 'primary', href: href({ name: 'today' }) }, ['Start today’s review']),
      ledgerSection(),
    )
    return
  }

  // ---- headline stats -----------------------------------------------------
  const streak = computeStreak(store.daily)
  const recall30 = retentionRate(store.attempts)
  const states = Object.values(store.concepts)
  const touched = states.filter((s) => s.reviewCount > 0 || s.learnedAt)
  const solid = touched.filter((s) => masteryBand(s.mastery) === 'solid').length
  const stat = (value: string, label: string): HTMLElement =>
    el('div', { class: 'sim-readout' }, [
      el('span', { class: 'sim-readout-value' }, [value]),
      el('span', { class: 'sim-readout-label' }, [label]),
    ])
  const stats = el('div', { class: 'sim-readouts report-stats' }, [
    stat(String(streak), 'day streak'),
    stat(String(store.attempts.length), 'attempts logged'),
    stat(recall30 == null ? '—' : `${Math.round(recall30 * 100)}%`, '30-day recall'),
    stat(`${solid}/${touched.length || 0}`, 'concepts solid'),
  ])

  // ---- your real forgetting curve ----------------------------------------
  const buckets = retentionByGap(store.attempts)
  const curve = el('section', {}, [
    el('h2', {}, ['Your forgetting curve, measured']),
    el('p', { class: 'muted small' }, [
      'Average recall by how long you waited since the previous visit to the same concept. Spaced repetition earns its keep when the right-hand bars hold up.',
    ]),
    ...buckets.map((b) =>
      bar(
        b.label,
        b.scores.length ? b.scores.reduce((a, c) => a + c, 0) / b.scores.length : null,
        b.scores.length
          ? `${Math.round((b.scores.reduce((a, c) => a + c, 0) / b.scores.length) * 100)}% · n=${b.scores.length}`
          : 'no data yet',
      ),
    ),
  ])

  // ---- weakest lamps -------------------------------------------------------
  const packTitle = new Map(metas.map((m) => [m.id, m.title]))
  const weakest = [...touched]
    .sort((a, b) => a.mastery - b.mastery)
    .slice(0, 6)
  const lamps = el('section', {}, [
    el('h2', {}, ['Dimmest lamps']),
    el('p', { class: 'muted small' }, ['The concepts most in need of a visit, weakest first.']),
    el('div', { class: 'item-list' },
      weakest.map((s) =>
        el('a', {
          class: 'item-card report-lamp',
          href: href({ name: 'concept', packId: s.packId, conceptId: s.conceptId }),
        }, [
          el('span', { class: `tag band-${masteryBand(s.mastery)}` }, [masteryBand(s.mastery)]),
          el('h3', {}, [prettyId(s.conceptId)]),
          el('p', { class: 'muted small' }, [
            `${packTitle.get(s.packId) ?? s.packId} · mastery ${(s.mastery * 100).toFixed(0)}% · due ${s.due}`,
          ]),
        ]),
      ),
    ),
  ])

  // ---- visits -------------------------------------------------------------
  const visits = el('section', {}, [
    el('h2', {}, ['Visits — last 8 weeks']),
    streakCalendar(store.daily),
    el('p', { class: 'muted small' }, [`Today: ${store.daily[today()] ?? 0} reviews.`]),
  ])

  // ---- halls --------------------------------------------------------------
  const halls = el('section', {}, [
    el('h2', {}, ['Hall progress']),
    ...metas.map((m) => {
      const ids = m.sessions.map((f) => f.replace(/\.json$/, '').replace(/^\d+-/, ''))
      const { done, total } = packCompletion(m.id, ids)
      return bar(m.title, total ? done / total : 0, `${done}/${total} sessions`)
    }),
  ])

  root.replaceChildren(crumb, head, stats, curve, lamps, visits, halls, ledgerSection())
}
