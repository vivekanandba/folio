// AI authoring pipeline. Turns a source document into a schema-valid Folio pack.
//   node --experimental-strip-types tools/authoring/cli.ts --source article.md --pack-id my-pack
// Requires @anthropic-ai/sdk and Anthropic credentials (env or `ant auth login`).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintPack, type LintIssue } from '../lint/referential.ts'
import { emitStructured, emitText, MODELS } from './anthropic.ts'
import { ingest } from './ingest.ts'
import { CONCEPT_SYSTEM, PLAN_SYSTEM, sessionSystem } from './prompts.ts'
import { PLAN_SCHEMA, SESSION_SCHEMAS } from './schema.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Args {
  source: string
  packId: string
  subject?: string
  type?: string
  kinds?: string[]
  dryRun: boolean
}

function parseArgs(argv: string[]): Args {
  const a: any = { dryRun: false }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const val = argv[i + 1]
    if (flag === '--source') (a.source = val), i++
    else if (flag === '--pack-id') (a.packId = val), i++
    else if (flag === '--subject') (a.subject = val), i++
    else if (flag === '--type') (a.type = val), i++
    else if (flag === '--kinds') (a.kinds = val.split(',')), i++
    else if (flag === '--dry-run') a.dryRun = true
  }
  if (!a.source || !a.packId) {
    console.error('Usage: --source <file|url|-> --pack-id <id> [--subject s] [--type magazine] [--kinds quiz,detective] [--dry-run]')
    process.exit(1)
  }
  return a as Args
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const packPath = `packs/${args.packId}`

  console.log('• Ingesting source…')
  const source = await ingest(args.source)

  console.log('• Planning pack (opus)…')
  const plan = await emitStructured<any>({
    model: MODELS.plan,
    system: PLAN_SYSTEM,
    user: `Source material:\n\n${source.slice(0, 60000)}`,
    toolName: 'pack_plan',
    schema: PLAN_SCHEMA,
  })
  if (args.subject) plan.subject = args.subject
  if (args.type) plan.type = args.type
  let sessionSpread = plan.sessions as any[]
  if (args.kinds) sessionSpread = sessionSpread.filter((s) => args.kinds!.includes(s.kind))

  console.log(`• Writing ${plan.concepts.length} concept notes (opus)…`)
  const concepts: { slug: string; md: string }[] = []
  for (const c of plan.concepts) {
    const md = await emitText({
      model: MODELS.concept,
      system: CONCEPT_SYSTEM,
      user: `Concept: ${c.title}\nKey points:\n${c.keyPoints.map((k: string) => `- ${k}`).join('\n')}\n\nSource excerpt:\n${source.slice(0, 40000)}`,
    })
    concepts.push({ slug: c.slug, md })
  }

  console.log(`• Authoring ${sessionSpread.length} sessions (sonnet)…`)
  const conceptSlugs = plan.concepts.map((c: any) => c.slug)
  const sessions: { file: string; data: any }[] = []
  let n = 1
  for (const planned of sessionSpread) {
    const schema = SESSION_SCHEMAS[planned.kind]
    if (!schema) {
      console.warn(`  skipping unknown kind ${planned.kind}`)
      continue
    }
    const data = await emitStructured<any>({
      model: MODELS.session,
      system: sessionSystem(planned.kind),
      user: `Pack concepts (use only these slugs for conceptIds): ${conceptSlugs.join(', ')}\n\nPlanned session — kind: ${planned.kind}, title: ${planned.title}, reinforces: ${planned.conceptIds.join(', ')}\n\nSource excerpt:\n${source.slice(0, 40000)}`,
      toolName: `${planned.kind}_session`,
      schema,
    })
    data.kind = planned.kind
    const file = `${String(n).padStart(2, '0')}-${data.id}.json`
    sessions.push({ file, data })
    n++
  }

  const meta = {
    id: args.packId,
    title: plan.title,
    subject: plan.subject,
    type: plan.type,
    source: `AI-assisted paraphrase of provided source material. Personal study notes; not professional advice.`,
    summary: plan.summary,
    tags: plan.tags,
    concepts: concepts.map((c) => c.slug),
    sessions: sessions.map((s) => s.file),
  }

  // Validate before writing anything.
  const issues: LintIssue[] = lintPack({
    packId: args.packId,
    meta,
    conceptSlugs: concepts.map((c) => c.slug),
    sessionFiles: sessions.map((s) => s.file),
    sessions,
  })
  const errors = issues.filter((i) => i.level === 'error')
  for (const i of issues) console.log(`  ${i.level === 'error' ? 'ERROR' : 'warn '} ${i.message}`)
  if (errors.length) {
    console.error(`\n✗ ${errors.length} validation error(s) — not writing. Re-run to regenerate.`)
    process.exit(1)
  }

  if (args.dryRun) {
    console.log('\n(dry run) Would write:')
    console.log(`  content/${packPath}/folio.json`)
    concepts.forEach((c) => console.log(`  content/${packPath}/concepts/${c.slug}.md`))
    sessions.forEach((s) => console.log(`  content/${packPath}/sessions/${s.file}`))
    return
  }

  // Write pack files.
  const base = join(root, 'public', 'content', packPath)
  mkdirSync(join(base, 'concepts'), { recursive: true })
  mkdirSync(join(base, 'sessions'), { recursive: true })
  writeFileSync(join(base, 'folio.json'), JSON.stringify(meta, null, 2) + '\n')
  for (const c of concepts) writeFileSync(join(base, 'concepts', `${c.slug}.md`), c.md.trim() + '\n')
  for (const s of sessions) writeFileSync(join(base, 'sessions', s.file), JSON.stringify(s.data, null, 2) + '\n')

  // Register in catalog.
  const catalogPath = join(root, 'public', 'content', 'catalog.json')
  const catalog = existsSync(catalogPath) ? JSON.parse(readFileSync(catalogPath, 'utf8')) : { packs: [] }
  if (!catalog.packs.some((p: any) => p.id === args.packId)) {
    catalog.packs.push({ id: args.packId, path: packPath })
    writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
  }

  console.log(`\n✓ Wrote pack "${args.packId}" (${concepts.length} concepts, ${sessions.length} sessions). Run \`npm run lint:content\` to double-check.`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
