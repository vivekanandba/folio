// Pure, dependency-free content validation. No fs, no DOM — operates on parsed data,
// so it can be unit-tested and shares intent with each SessionModule.validate() in-app.

export interface LintIssue {
  level: 'error' | 'warn'
  file: string
  message: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any

export interface PackInput {
  packId: string
  meta: Json
  /** Concept slugs that actually have a <slug>.md on disk. */
  conceptSlugs: string[]
  /** Session filenames that actually exist under sessions/. */
  sessionFiles: string[]
  sessions: { file: string; data: Json }[]
}

const KNOWN_KINDS = new Set([
  'quiz', 'classify', 'detective', 'calculator', 'audit', 'decision',
  'sequence', 'estimate', 'hotspot',
])

export function lintCatalog(catalog: Json, packPaths: string[]): LintIssue[] {
  const issues: LintIssue[] = []
  const file = 'content/catalog.json'
  if (!catalog || !Array.isArray(catalog.packs)) {
    issues.push({ level: 'error', file, message: 'catalog.packs must be an array' })
    return issues
  }
  const ids = new Set<string>()
  catalog.packs.forEach((p: Json, i: number) => {
    if (!p.id) issues.push({ level: 'error', file, message: `packs[${i}].id missing` })
    if (ids.has(p.id)) issues.push({ level: 'error', file, message: `duplicate pack id "${p.id}"` })
    ids.add(p.id)
    if (!p.path || !packPaths.includes(p.path)) {
      issues.push({ level: 'error', file, message: `packs[${i}].path "${p.path}" has no folio.json` })
    }
  })
  return issues
}

export function lintPack(pack: PackInput): LintIssue[] {
  const issues: LintIssue[] = []
  const metaFile = `${pack.packId}/folio.json`
  const meta = pack.meta ?? {}

  const declaredConcepts: string[] = Array.isArray(meta.concepts) ? meta.concepts : []
  const declaredSessions: string[] = Array.isArray(meta.sessions) ? meta.sessions : []
  const conceptSet = new Set(declaredConcepts)

  // folio.json concept/session references must resolve to files on disk.
  for (const slug of declaredConcepts) {
    if (!pack.conceptSlugs.includes(slug)) {
      issues.push({ level: 'error', file: metaFile, message: `concept "${slug}" has no concepts/${slug}.md` })
    }
  }
  for (const f of declaredSessions) {
    if (!pack.sessionFiles.includes(f)) {
      issues.push({ level: 'error', file: metaFile, message: `session "${f}" not found on disk` })
    }
  }
  // Files on disk not referenced by folio.json (warn — easy to forget to register).
  for (const slug of pack.conceptSlugs) {
    if (!conceptSet.has(slug)) {
      issues.push({ level: 'warn', file: metaFile, message: `concepts/${slug}.md is not listed in folio.json` })
    }
  }

  for (const { file, data } of pack.sessions) {
    const at = `${pack.packId}/sessions/${file}`
    issues.push(...lintSession(at, data, conceptSet))
  }
  return issues
}

function lintSession(file: string, s: Json, conceptSet: Set<string>): LintIssue[] {
  const issues: LintIssue[] = []
  const err = (message: string) => issues.push({ level: 'error', file, message })
  const warn = (message: string) => issues.push({ level: 'warn', file, message })

  if (!s || typeof s !== 'object') { err('session is not an object'); return issues }
  if (!s.id) err('missing id')
  if (!s.title) err('missing title')
  if (!KNOWN_KINDS.has(s.kind)) { err(`unknown kind "${s.kind}"`); return issues }
  if (!Array.isArray(s.conceptIds)) err('conceptIds must be an array')
  else {
    for (const cid of s.conceptIds) {
      if (!conceptSet.has(cid)) err(`conceptId "${cid}" is not a concept in this pack`)
    }
    if (!s.conceptIds.length) warn('conceptIds is empty — session links to no concept')
  }

  const inRange = (idx: unknown, len: number, label: string) => {
    if (typeof idx !== 'number' || idx < 0 || idx >= len) err(`${label} out of range`)
  }

  switch (s.kind) {
    case 'quiz':
      if (!Array.isArray(s.questions) || !s.questions.length) err('quiz needs questions[]')
      else s.questions.forEach((q: Json, i: number) => {
        if (!Array.isArray(q.choices) || q.choices.length < 2) err(`questions[${i}].choices needs ≥2`)
        else inRange(q.answerIndex, q.choices.length, `questions[${i}].answerIndex`)
      })
      break
    case 'classify': {
      const ids = new Set((s.buckets ?? []).map((b: Json) => b.id))
      if (ids.size < 2) err('classify needs ≥2 buckets')
      ;(s.cards ?? []).forEach((c: Json, i: number) => {
        if (!ids.has(c.bucketId)) err(`cards[${i}].bucketId "${c.bucketId}" has no bucket`)
      })
      if (!s.debrief) warn('missing debrief')
      break
    }
    case 'detective':
      if (!Array.isArray(s.facts) || !s.facts.length) err('detective needs facts[]')
      if (!Array.isArray(s.choices) || s.choices.length < 2) err('detective needs choices[] (≥2)')
      else inRange(s.answerIndex, s.choices.length, 'answerIndex')
      ;(s.composition ?? []).forEach((c: Json, i: number) => {
        if (c.revealAfter < 1 || c.revealAfter > (s.facts?.length ?? 0)) {
          err(`composition[${i}].revealAfter out of [1, ${s.facts?.length}]`)
        }
      })
      break
    case 'calculator':
      if (!Array.isArray(s.holdings) || !s.holdings.length) err('calculator needs holdings[]')
      if (!Array.isArray(s.judgmentChoices) || s.judgmentChoices.length < 2) err('needs judgmentChoices[] (≥2)')
      else inRange(s.judgmentAnswerIndex, s.judgmentChoices.length, 'judgmentAnswerIndex')
      break
    case 'audit': {
      const ids = new Set<string>()
      ;(s.pillars ?? []).forEach((p: Json, i: number) => {
        if (ids.has(p.id)) err(`pillars[${i}].id "${p.id}" duplicated`)
        ids.add(p.id)
        if (!Array.isArray(p.actions) || !p.actions.length) err(`pillars[${i}].actions empty`)
      })
      if (!ids.size) err('audit needs pillars[]')
      break
    }
    case 'decision': {
      const nodes: Json[] = Array.isArray(s.nodes) ? s.nodes : []
      const ids = new Set(nodes.map((n) => n.id))
      const referenced = new Set<string>([s.startId])
      let endings = 0
      if (!ids.has(s.startId)) err(`startId "${s.startId}" has no node`)
      nodes.forEach((n) => {
        const hasChoices = Array.isArray(n.choices) && n.choices.length > 0
        const hasEnding = !!n.ending
        if (hasChoices === hasEnding) err(`node "${n.id}" must have choices XOR ending`)
        if (hasEnding) endings += 1
        ;(n.choices ?? []).forEach((c: Json) => {
          referenced.add(c.next)
          if (!ids.has(c.next)) err(`node "${n.id}" → unknown node "${c.next}"`)
        })
      })
      if (!endings) err('decision has no ending node')
      nodes.forEach((n) => {
        if (n.id !== s.startId && !referenced.has(n.id)) warn(`node "${n.id}" is unreachable`)
      })
      break
    }
    case 'sequence':
      if (!Array.isArray(s.steps) || s.steps.length < 2) err('sequence needs ≥2 steps')
      else {
        const ids = new Set<string>()
        s.steps.forEach((st: Json, i: number) => {
          if (ids.has(st.id)) err(`steps[${i}].id "${st.id}" duplicated`)
          ids.add(st.id)
        })
      }
      break
    case 'estimate':
      if (typeof s.min !== 'number' || typeof s.max !== 'number' || s.min >= s.max) err('estimate needs min < max')
      if (typeof s.answer !== 'number' || s.answer < s.min || s.answer > s.max) err('answer must be within [min, max]')
      if (s.tolerance != null && (s.tolerance <= 0 || s.tolerance > 1)) err('tolerance must be in (0, 1]')
      break
    case 'hotspot':
      if (!Array.isArray(s.series) || !s.series.length) err('hotspot needs series[]')
      else if (!s.series.some((p: Json) => p.anomaly === true)) err('hotspot needs ≥1 point with anomaly:true')
      break
  }
  return issues
}
