// Content linter. Zero external deps — run with Node 22's native type stripping:
//   node --experimental-strip-types tools/lint/cli.ts
// Walks public/content, validates catalog + every pack, exits 1 on any error.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lintCatalog, lintPack, type LintIssue, type PackInput } from './referential.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const contentDir = join(root, 'public', 'content')

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
