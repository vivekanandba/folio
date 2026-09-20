// Every session kind must actually render — with real shipped content.
//
// The gap this closes: 12 session renderers, ~2,000 lines, had never executed.
// Lint checks that a session's JSON is well-formed; nothing checked that the
// module given that JSON produces anything. A kind could throw on mount and
// every gate would stay green, because the only thing that ever ran the
// renderers was a human opening the page.
//
// These tests mount each kind into the hand-written DOM stub using the first
// shipped session of that kind, so the fixtures are the real museum content
// rather than hand-made objects that drift from it.

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

const { allModules, getModule } = await import('../src/sessions/registry.ts')
await import('../src/sessions/index.ts') // side-effect: every kind self-registers

const PACKS = new URL('../public/content/packs/', import.meta.url).pathname

/** Every shipped session, grouped by kind. */
function shippedSessions(): Map<string, { file: string; data: Record<string, unknown> }[]> {
  const byKind = new Map<string, { file: string; data: Record<string, unknown> }[]>()
  for (const pack of readdirSync(PACKS)) {
    const dir = join(PACKS, pack, 'sessions')
    let files: string[] = []
    try {
      files = readdirSync(dir)
    } catch {
      continue
    }
    for (const file of files.filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'))
      const list = byKind.get(data.kind) ?? []
      list.push({ file: `${pack}/sessions/${file}`, data })
      byKind.set(data.kind, list)
    }
  }
  return byKind
}

const SESSIONS = shippedSessions()

test('every registered kind has shipped content to test against', () => {
  const registered = allModules().map((m) => m.kind).sort()
  assert.ok(registered.length >= 12, `expected all kinds registered, got ${registered.length}`)
  const missing = registered.filter((k) => !SESSIONS.has(k))
  assert.deepEqual(missing, [], `kinds with no shipped session: ${missing.join(', ')}`)
})

test('every kind mounts and renders without throwing', () => {
  const failures: string[] = []
  for (const mod of allModules()) {
    const sample = SESSIONS.get(mod.kind)?.[0]
    if (!sample) continue
    const root = document.createElement('div')
    try {
      mod.mount(root as unknown as HTMLElement, sample.data as never, () => {})
      // Rendering means producing DOM, not merely not throwing.
      assert.ok(
        root.childNodes.length > 0,
        `${mod.kind} mounted but produced no DOM (${sample.file})`,
      )
      const text = root.textContent
      assert.ok(text.length > 0, `${mod.kind} produced empty text (${sample.file})`)
    } catch (err) {
      failures.push(`${mod.kind} (${sample.file}): ${(err as Error).message}`)
    }
  }
  assert.deepEqual(failures, [], `kinds failed to mount:\n${failures.join('\n')}`)
})

test('mounted sessions surface their own title', () => {
  const missing: string[] = []
  for (const mod of allModules()) {
    const sample = SESSIONS.get(mod.kind)?.[0]
    if (!sample?.data.title) continue
    const root = document.createElement('div')
    mod.mount(root as unknown as HTMLElement, sample.data as never, () => {})
    if (!root.textContent.includes(String(sample.data.title))) missing.push(mod.kind)
  }
  assert.deepEqual(missing, [], `kinds that never render their title: ${missing.join(', ')}`)
})

test('each module reports its label, blurb and icon', () => {
  for (const mod of allModules()) {
    assert.ok(mod.label && mod.label.length > 1, `${mod.kind} has no label`)
    assert.ok(mod.blurb && mod.blurb.length > 3, `${mod.kind} has no blurb`)
    const icon = mod.icon()
    assert.ok(icon, `${mod.kind} has no icon element`)
  }
})

test('validate() accepts every shipped session of its kind', () => {
  const problems: string[] = []
  for (const [kind, samples] of SESSIONS) {
    const mod = getModule(kind)
    if (!mod?.validate) continue
    for (const { file, data } of samples) {
      const conceptIds = Array.isArray(data.conceptIds) ? (data.conceptIds as string[]) : []
      const errors = mod.validate(data as never, { conceptIds })
      if (errors.length) problems.push(`${file}: ${errors.join('; ')}`)
    }
  }
  assert.deepEqual(problems, [], `shipped content rejected by its own module:\n${problems.join('\n')}`)
})

test('validate() rejects content that contradicts itself', () => {
  // A validator that never fails is not a validator (CON-PROC-005). Feed each
  // module a session of its kind with its key referential field corrupted.
  const quiz = getModule('quiz')
  assert.ok(quiz?.validate, 'quiz module should validate')
  const sample = structuredClone(SESSIONS.get('quiz')![0].data) as Record<string, never>
  const questions = sample.questions as unknown as { answerIndex: number; choices: string[] }[]
  questions[0].answerIndex = questions[0].choices.length + 5 // out of range
  const errors = quiz!.validate!(sample as never, { conceptIds: [] })
  assert.ok(errors.length > 0, 'an out-of-range answerIndex must be reported')
})
