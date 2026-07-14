/**
 * Content contract validator. Run via: npm run validate
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import matter from 'gray-matter'
import { listLabFormulas } from '../src/labs/registry'

export type ValidationIssue = {
  level: 'error' | 'warn'
  message: string
  file?: string
}

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..')

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function schemaPath(name: string): string {
  return join(repoRoot, 'schemas', name)
}

export function validatePackDir(packDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const folioPath = join(packDir, 'folio.json')
  if (!existsSync(folioPath)) {
    return [{ level: 'error', message: 'missing folio.json', file: folioPath }]
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const validatePack = ajv.compile(loadJson(schemaPath('folio.pack.schema.json')) as object)
  const validateSessionBase = ajv.compile(
    loadJson(schemaPath('session.base.schema.json')) as object,
  )

  const folio = loadJson(folioPath) as Record<string, unknown>
  if (!validatePack(folio)) {
    for (const err of validatePack.errors ?? []) {
      issues.push({
        level: 'error',
        message: `folio.json ${err.instancePath} ${err.message}`,
        file: folioPath,
      })
    }
  }

  const curriculum = folio.curriculum as {
    concepts: string[]
    sessions: string[]
    sheet?: string
  } | undefined
  if (!curriculum) {
    issues.push({ level: 'error', message: 'folio.json missing curriculum', file: folioPath })
    return issues
  }

  const practiceNone = new Set((folio.practiceNone as string[] | undefined) ?? [])
  const conceptsDir = join(packDir, 'concepts')
  const sessionsDir = join(packDir, 'sessions')
  const conceptIds = new Set(curriculum.concepts)

  for (const cid of curriculum.concepts) {
    const md = join(conceptsDir, `${cid}.md`)
    if (!existsSync(md)) {
      issues.push({ level: 'error', message: `missing concept file ${cid}.md`, file: md })
      continue
    }
    const parsed = matter(readFileSync(md, 'utf8'))
    if (!parsed.data.title) {
      issues.push({
        level: 'error',
        message: `concept ${cid} missing frontmatter title`,
        file: md,
      })
    }
  }

  const practiced = new Set<string>()
  for (const sid of curriculum.sessions) {
    const file = join(sessionsDir, `${sid}.json`)
    if (!existsSync(file)) {
      issues.push({ level: 'error', message: `missing session ${sid}.json`, file })
      continue
    }
    const session = loadJson(file) as Record<string, unknown>
    if (!validateSessionBase(session)) {
      for (const err of validateSessionBase.errors ?? []) {
        issues.push({
          level: 'error',
          message: `${sid}.json ${err.instancePath} ${err.message}`,
          file,
        })
      }
    }
    if (session.id !== sid) {
      issues.push({
        level: 'error',
        message: `session id "${String(session.id)}" must match filename stem "${sid}"`,
        file,
      })
    }
    const kind = session.kind as string
    if (kind === 'lab' && session.formulaId) {
      const formulaId = session.formulaId as string
      if (!listLabFormulas().includes(formulaId)) {
        issues.push({
          level: 'error',
          message: `unknown lab formulaId ${formulaId}`,
          file,
        })
      }
    }
    if (kind === 'decision') {
      const nodes = session.nodes as {
        id: string
        choices?: { next: string }[]
      }[]
      const ids = new Set(nodes.map((n) => n.id))
      for (const n of nodes) {
        for (const c of n.choices ?? []) {
          if (!ids.has(c.next)) {
            issues.push({
              level: 'error',
              message: `decision ${sid}: missing next node ${c.next}`,
              file,
            })
          }
        }
      }
    }
    for (const cid of (session.conceptIds as string[]) ?? []) {
      practiced.add(cid)
      if (!conceptIds.has(cid)) {
        issues.push({
          level: 'error',
          message: `session ${sid} references unknown concept ${cid}`,
          file,
        })
      }
    }
  }

  for (const cid of curriculum.concepts) {
    if (!practiced.has(cid) && !practiceNone.has(cid)) {
      issues.push({
        level: 'error',
        message: `concept ${cid} has no practicing session (add session or practiceNone)`,
      })
    }
  }

  if (curriculum.sheet) {
    const sheetPath = join(packDir, curriculum.sheet)
    if (!existsSync(sheetPath)) {
      issues.push({
        level: 'error',
        message: `missing sheet ${curriculum.sheet}`,
        file: sheetPath,
      })
    } else {
      const validateSheet = ajv.compile(
        loadJson(schemaPath('sheet.schema.json')) as object,
      )
      const sheet = loadJson(sheetPath)
      if (!validateSheet(sheet)) {
        for (const err of validateSheet.errors ?? []) {
          issues.push({
            level: 'error',
            message: `sheet ${err.instancePath} ${err.message}`,
            file: sheetPath,
          })
        }
      }
    }
  }

  return issues
}

export function validateAllPacks(contentRoot: string): ValidationIssue[] {
  const packsRoot = join(contentRoot, 'packs')
  const issues: ValidationIssue[] = []
  if (!existsSync(packsRoot)) {
    return [{ level: 'error', message: `no packs at ${packsRoot}` }]
  }
  for (const name of readdirSync(packsRoot)) {
    issues.push(...validatePackDir(join(packsRoot, name)))
  }
  return issues
}

function main() {
  const root = join(repoRoot, 'public/content')
  const issues = validateAllPacks(root)
  const errors = issues.filter((i) => i.level === 'error')
  for (const i of issues) {
    console.log(`${i.level.toUpperCase()}: ${i.message}${i.file ? ` (${i.file})` : ''}`)
  }
  if (errors.length) {
    console.error(`\n${errors.length} error(s)`)
    process.exit(1)
  }
  console.log('OK: content contract valid')
}

const entry = process.argv[1] ?? ''
if (entry.includes('validate-content')) {
  main()
}
