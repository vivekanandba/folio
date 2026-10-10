// Content linter. Zero external deps — run with Node 22's native type stripping:
//   node --experimental-strip-types tools/lint/cli.ts
//   node --experimental-strip-types tools/lint/cli.ts --content path/to/content
// Walks public/content (or --content), validates catalog + every pack, exits 1
// on any error.
//
// --content exists so the linter's REFUSAL can be tested against deliberately
// malformed fixtures. A gate that has only ever been run against good input is
// a gate nobody has watched fail.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintCatalog, lintCrossLinks, lintPack, type LinkDoc, type LintIssue, type PackInput } from './referential.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const flagIndex = process.argv.indexOf('--content')
const contentDir = flagIndex !== -1 && process.argv[flagIndex + 1]
  ? resolve(process.argv[flagIndex + 1])
  : join(root, 'public', 'content')

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function listFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('.')) : []
}

function main(): void {
  const issues: LintIssue[] = []
  const catalogPath = join(contentDir, 'catalog.json')
  if (!existsSync(catalogPath)) {
    console.error('No content/catalog.json found')
    process.exit(1)
  }
  const catalog = readJson(catalogPath) as { packs?: { id: string; path: string }[] }
  const packs = catalog.packs ?? []

  // Which declared paths actually resolve to a folio.json.
  const resolvablePaths = packs
    .map((p) => p.path)
    .filter((path) => path && existsSync(join(contentDir, path, 'folio.json')))
  issues.push(...lintCatalog(catalog, resolvablePaths))

  for (const ref of packs) {
    const packDir = join(contentDir, ref.path)
    const metaPath = join(packDir, 'folio.json')
    if (!existsSync(metaPath)) continue // already reported by lintCatalog
    const meta = readJson(metaPath)
    const conceptSlugs = listFiles(join(packDir, 'concepts'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
    const sessionFiles = listFiles(join(packDir, 'sessions')).filter((f) => f.endsWith('.json'))
    const sessions = sessionFiles.map((file) => ({
      file,
      data: readJson(join(packDir, 'sessions', file)),
    }))
    const input: PackInput = { packId: ref.id, meta, conceptSlugs, sessionFiles, sessions }
    issues.push(...lintPack(input))
  }

  // Cross-links are a whole-registry question: a concept in one pack may link
  // into another, so this runs after every pack has been catalogued.
  const knownConcepts = new Set<string>()
  const knownSessions = new Set<string>()
  const docs: LinkDoc[] = []
  for (const ref of packs) {
    const packDir = join(contentDir, ref.path)
    if (!existsSync(join(packDir, 'folio.json'))) continue
    const meta = readJson(join(packDir, 'folio.json')) as { id: string; concepts?: string[]; sessions?: string[] }
    const packId = meta.id ?? ref.id
    for (const slug of meta.concepts ?? []) {
      knownConcepts.add(`${packId}::${slug}`)
      const file = join(packDir, 'concepts', `${slug}.md`)
      if (existsSync(file)) docs.push({ file: `${packId}/concepts/${slug}.md`, text: readFileSync(file, 'utf8') })
    }
    for (const sf of meta.sessions ?? []) {
      const file = join(packDir, 'sessions', sf)
      if (!existsSync(file)) continue
      const data = readJson(file) as { id?: string }
      if (data.id) knownSessions.add(`${packId}::${data.id}`)
      // Session prose (intros, debriefs, briefings) can carry links too.
      docs.push({ file: `${packId}/sessions/${sf}`, text: readFileSync(file, 'utf8') })
    }
  }
  issues.push(...lintCrossLinks(docs, knownConcepts, knownSessions))

  const errors = issues.filter((i) => i.level === 'error')
  const warns = issues.filter((i) => i.level === 'warn')
  for (const i of issues) {
    const tag = i.level === 'error' ? 'ERROR' : 'warn '
    console.log(`${tag}  ${i.file}: ${i.message}`)
  }
  if (!issues.length) console.log('Content OK — no issues.')
  else console.log(`\n${errors.length} error(s), ${warns.length} warning(s).`)
  process.exit(errors.length ? 1 : 0)
}

main()
