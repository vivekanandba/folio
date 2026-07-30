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
  'sequence', 'estimate', 'hotspot', 'explainer', 'lab', 'blueprint',
])

const BLUEPRINT_RULES = new Set(['minCount', 'maxCount', 'connected', 'noDirect', 'pathExists', 'survivesKill'])

/** Whitelisted simulation models — keep in sync with src/sim/models.ts. */
const SIM_MODELS = new Set([
  'queue', 'failover', 'compound', 'retention',
  'sipVsLump', 'retryStorm', 'fanout', 'marketCycle',
  'llmServe', 'kvcache',
])
const LAB_OPS = new Set(['<', '<=', '>', '>='])

/** Whitelisted compute names — keep in sync with src/computes.ts. */
const COMPUTES = new Set([
  'compound', 'sipFuture', 'realReturn', 'weightedYield', 'downtime', 'feeImpact',
  'impliedCagr', 'simpleIncome', 'availabilityPct',
  'kvCacheGB', 'modelMemory', 'gpusNeeded', 'usersFit',
])

/** Widget spec types — keep in sync with build() in src/widgets.ts. */
const WIDGET_TYPES = new Set(['donut', 'gauge', 'radar', 'twinBars', 'what-if', 'annotated', 'sim'])

/** Validate one parsed widget spec (an explainer step.viz or a ```viz fence). */
function checkVizSpec(spec: Json, label: string, err: (m: string) => void): void {
  if (!spec || typeof spec !== 'object') { err(`${label}: viz spec must be an object`); return }
  if (!WIDGET_TYPES.has(spec.type)) { err(`${label}: unknown viz type "${spec.type}"`); return }
  if (spec.type === 'what-if') {
    if (!COMPUTES.has(spec.compute)) err(`${label}: unknown what-if compute "${spec.compute}"`)
    if (!Array.isArray(spec.inputs) || !spec.inputs.length) err(`${label}: what-if needs inputs[]`)
  }
  if (spec.type === 'sim' && !SIM_MODELS.has(spec.model)) {
    err(`${label}: unknown sim model "${spec.model}"`)
  }
}

/** Narrative markdown fields may embed ```viz fences — parse and validate each. */
function checkRichField(text: unknown, label: string, err: (m: string) => void): void {
  if (typeof text !== 'string') return
  const fences = text.matchAll(/```viz\s*\n([\s\S]*?)```/g)
  let i = 0
  for (const m of fences) {
    i += 1
    try {
      checkVizSpec(JSON.parse(m[1]), `${label} viz[${i}]`, err)
    } catch {
      err(`${label} viz[${i}]: fence is not valid JSON`)
    }
  }
}

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

  // Narrative fields render as rich markdown — validate any embedded ```viz fences.
  checkRichField(s.intro, 'intro', err)
  checkRichField(s.debrief, 'debrief', err)
  checkRichField(s.briefing, 'briefing', err)

  switch (s.kind) {
    case 'quiz':
      if (!Array.isArray(s.questions) || !s.questions.length) err('quiz needs questions[]')
      else s.questions.forEach((q: Json, i: number) => {
        if (!Array.isArray(q.choices) || q.choices.length < 2) err(`questions[${i}].choices needs ≥2`)
        else inRange(q.answerIndex, q.choices.length, `questions[${i}].answerIndex`)
        checkRichField(q.explanation, `questions[${i}].explanation`, err)
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
      else s.facts.forEach((f: Json, i: number) => {
        if (f.signal != null && (typeof f.signal !== 'number' || f.signal < 0)) {
          err(`facts[${i}].signal must be a number ≥ 0`)
        }
      })
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
      if (s.meter != null) {
        if (typeof s.meter.min !== 'number' || typeof s.meter.max !== 'number' || s.meter.min >= s.meter.max) {
          err('meter needs numeric min < max')
        } else if (typeof s.meter.start !== 'number' || s.meter.start < s.meter.min || s.meter.start > s.meter.max) {
          err('meter.start must be within [min, max]')
        }
        if (!s.meter.label) err('meter needs a label')
      }
      nodes.forEach((n) => {
        const hasChoices = Array.isArray(n.choices) && n.choices.length > 0
        const hasEnding = !!n.ending
        if (hasChoices === hasEnding) err(`node "${n.id}" must have choices XOR ending`)
        if (hasEnding) endings += 1
        checkRichField(n.ending?.debrief, `node "${n.id}" ending.debrief`, err)
        ;(n.choices ?? []).forEach((c: Json) => {
          referenced.add(c.next)
          if (!ids.has(c.next)) err(`node "${n.id}" → unknown node "${c.next}"`)
          if (c.effect != null && typeof c.effect !== 'number') err(`node "${n.id}" choice.effect must be a number`)
          if (c.effect != null && s.meter == null) err(`node "${n.id}" choice has effect but session has no meter`)
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
      if (s.live != null) {
        if (!COMPUTES.has(s.live.compute)) err(`live.compute "${s.live.compute}" unknown`)
        if (!s.live.inputKey || typeof s.live.inputKey !== 'string') err('live.inputKey must be a string')
        if (!s.live.label) err('live needs a label')
        if (s.live.inputs != null && (typeof s.live.inputs !== 'object' || Array.isArray(s.live.inputs))) {
          err('live.inputs must be an object of numbers')
        } else if (s.live.inputs) {
          for (const [k, v] of Object.entries(s.live.inputs)) {
            if (typeof v !== 'number') err(`live.inputs.${k} must be a number`)
          }
        }
        if (s.live.max != null && (typeof s.live.max !== 'number' || s.live.max <= 0)) {
          err('live.max must be > 0')
        }
      }
      break
    case 'hotspot':
      if (!Array.isArray(s.series) || !s.series.length) err('hotspot needs series[]')
      else if (!s.series.some((p: Json) => p.anomaly === true)) err('hotspot needs ≥1 point with anomaly:true')
      break
    case 'explainer':
      if (!Array.isArray(s.steps) || !s.steps.length) err('explainer needs steps[]')
      else s.steps.forEach((st: Json, i: number) => {
        if (!st.title || !st.body) err(`steps[${i}] needs title and body`)
        checkRichField(st.body, `steps[${i}].body`, err)
        if (st.viz != null) checkVizSpec(st.viz, `steps[${i}].viz`, err)
      })
      if (!s.recap) err('explainer needs a recap')
      checkRichField(s.recap, 'recap', err)
      break
    case 'lab':
      if (!SIM_MODELS.has(s.model)) err(`unknown sim model "${s.model}"`)
      if (!s.briefing) err('lab needs a briefing')
      if (!s.debrief) err('lab needs a debrief')
      if (!Array.isArray(s.goals) || !s.goals.length) err('lab needs goals[]')
      else s.goals.forEach((g: Json, i: number) => {
        if (!g.metric || typeof g.metric !== 'string') err(`goals[${i}] needs a metric`)
        if (!LAB_OPS.has(g.op)) err(`goals[${i}].op "${g.op}" not one of < <= > >=`)
        if (typeof g.value !== 'number') err(`goals[${i}].value must be a number`)
        if (!g.label) err(`goals[${i}] needs a label`)
      })
      if (s.params != null && (typeof s.params !== 'object' || Array.isArray(s.params))) err('params must be an object of numbers')
      else if (s.params) {
        for (const [k, v] of Object.entries(s.params)) {
          if (typeof v !== 'number') err(`params.${k} must be a number`)
        }
      }
      if (s.holdSeconds != null && (typeof s.holdSeconds !== 'number' || s.holdSeconds <= 0)) err('holdSeconds must be > 0')
      break
    case 'blueprint': {
      if (!s.briefing) err('blueprint needs a briefing')
      if (!s.debrief) err('blueprint needs a debrief')
      const partIds = new Set<string>()
      if (!Array.isArray(s.parts) || !s.parts.length) err('blueprint needs parts[]')
      else s.parts.forEach((p: Json, i: number) => {
        if (!p.id || !p.label) err(`parts[${i}] needs id and label`)
        if (partIds.has(p.id)) err(`parts[${i}].id "${p.id}" duplicated`)
        partIds.add(p.id)
        if (p.max != null && (typeof p.max !== 'number' || p.max < 1)) err(`parts[${i}].max must be ≥ 1`)
      })
      if (!Array.isArray(s.rules) || !s.rules.length) err('blueprint needs rules[]')
      else s.rules.forEach((r: Json, i: number) => {
        if (!BLUEPRINT_RULES.has(r.rule)) { err(`rules[${i}].rule "${r.rule}" unknown`); return }
        if (!r.label) err(`rules[${i}] needs a label`)
        const refs: string[] =
          r.rule === 'minCount' || r.rule === 'maxCount' ? [r.part]
          : r.rule === 'connected' || r.rule === 'noDirect' ? [r.a, r.b]
          : [r.from, r.to]
        for (const ref of refs) {
          if (!partIds.has(ref)) err(`rules[${i}] references unknown part "${ref}"`)
        }
        if ((r.rule === 'minCount' || r.rule === 'maxCount') && typeof r.count !== 'number') {
          err(`rules[${i}].count must be a number`)
        }
      })
      break
    }
  }
  return issues
}
