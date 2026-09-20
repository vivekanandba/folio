// Every source file must at least LOAD — and must appear in the coverage report.
//
// Why this exists: `node --test --experimental-test-coverage` only reports files
// that some test imported. Before this file, six files were imported and the
// report said 87.65%, while 42 of 47 source files had never executed at all.
// A number that cannot see 79% of the tree is not a measurement, it is a
// reassurance (CON-VER-005). Importing everything makes the denominator the
// whole source tree, so the reported figure is the real one.
//
// It also catches, cheaply, the class of defect that shipped twice already: a
// module that throws at import time (the dead module graph behind a blank page).

import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
installDomStub()

const SRC = new URL('../src/', import.meta.url).pathname

/**
 * Files excluded from the import sweep, each with the reason it cannot load
 * outside a browser. Keep this list short and argued — an entry here is a hole
 * in the measurement, so it must be earned, never used to flatter the number
 * (CON-COV-002). Everything excluded here is covered by the browser e2e suite.
 */
const EXCLUDED: Record<string, string> = {
  'main.ts': 'app entrypoint — boots the router and mounts the SPA at import time; exercised by the e2e suite',
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.ts')) out.push(full)
  }
  return out
}

const files = walk(SRC).sort()

test('the source tree is discovered (guards against an empty sweep)', () => {
  // A sweep that silently finds nothing would report perfect coverage of nothing.
  assert.ok(files.length >= 40, `expected the full src tree, found ${files.length} files`)
})

test('every source file imports cleanly', async () => {
  const failures: string[] = []
  for (const file of files) {
    const rel = relative(SRC, file)
    if (rel in EXCLUDED) continue
    try {
      await import(pathToFileURL(file).href)
    } catch (err) {
      failures.push(`${rel}: ${(err as Error).message}`)
    }
  }
  assert.deepEqual(failures, [], `modules failed to import:\n${failures.join('\n')}`)
})

test('every exclusion states its reason', () => {
  for (const [file, reason] of Object.entries(EXCLUDED)) {
    assert.ok(reason.length > 20, `${file} needs a real reason, got "${reason}"`)
    assert.ok(files.some((f) => relative(SRC, f) === file), `${file} is excluded but no longer exists`)
  }
})
