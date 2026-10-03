#!/usr/bin/env node
// Combined coverage: what the unit suite executed, plus what a real browser
// executed, unioned.
//
// Neither number alone is honest. The unit suite cannot run WebGL, pointer
// handling or an animation loop; the browser run does not exercise error paths
// and edge cases the unit tests reach deliberately. A line covered by either is
// a line that ran under test, so the union is the figure that means something —
// and the per-file table below shows which half did the work.
//
//   node tools/coverage-report.mjs [--min 90] [--per-file]
//
// Reads .coverage/unit.lcov and .coverage/browser.lcov; both are produced by
// `npm run coverage:all`.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergeCoverage, parseLcov, summarise } from './e2e/coverage.mjs'

const ROOT = new URL('..', import.meta.url).pathname
const COV = join(ROOT, '.coverage')
const minFlag = process.argv.indexOf('--min')
const MIN = minFlag !== -1 ? Number(process.argv[minFlag + 1]) : null
const PER_FILE = process.argv.includes('--per-file')

const read = (name) => {
  const file = join(COV, name)
  return existsSync(file) ? parseLcov(readFileSync(file, 'utf8')) : null
}

const unit = read('unit.lcov')
const browser = read('browser.lcov')

if (!unit) {
  console.error('coverage-report: .coverage/unit.lcov is missing — run `npm run coverage:all`')
  process.exit(2)
}
if (!browser) {
  // Refusing is deliberate: silently reporting unit-only coverage under a
  // "combined" heading is exactly the kind of flattering number this project
  // has already been burned by.
  console.error('coverage-report: .coverage/browser.lcov is missing — the combined figure would be unit-only')
  process.exit(2)
}

/**
 * The unit run defines the DENOMINATOR; the browser run can only promote a
 * line from uncovered to covered.
 *
 * Unioning the two raw sets was wrong and said so loudly: it reported 85.45%
 * combined against 86.05% unit-only, because the browser conversion counts any
 * non-comment line while Node counts only what V8 considers executable. A
 * "combined" figure lower than one of its inputs is a measurement bug, not a
 * finding. Node's line set is the stable, defensible denominator, so browser
 * hits are intersected into it.
 */
function promoteInto(base, extra) {
  const out = new Map()
  for (const [sf, lines] of base) {
    const add = extra.get(sf)
    const merged = new Map(lines)
    if (add) {
      for (const [line, hits] of add) {
        if (merged.has(line) && hits > 0) merged.set(line, merged.get(line) + hits)
      }
    }
    out.set(sf, merged)
  }
  return out
}

const merged = promoteInto(unit, browser)
const u = summarise(unit)
const b = summarise(browser)
const m = summarise(merged)

if (PER_FILE) {
  console.log(`${'file'.padEnd(34)}${'unit'.padStart(8)}${'browser'.padStart(9)}${'both'.padStart(8)}`)
  const unitByFile = new Map(u.rows.map((r) => [r.file, r]))
  const browserByFile = new Map(b.rows.map((r) => [r.file, r]))
  for (const row of m.rows) {
    const uu = unitByFile.get(row.file)
    const bb = browserByFile.get(row.file)
    const pct = (r) => (r ? `${r.pct.toFixed(0)}%` : '—')
    const flag = row.pct < 80 ? '  <' : ''
    console.log(
      `${row.file.padEnd(34)}${pct(uu).padStart(8)}${pct(bb).padStart(9)}${`${row.pct.toFixed(1)}%`.padStart(8)}${flag}`,
    )
  }
  console.log()
}

console.log(`unit only    : ${u.covered}/${u.total} lines (${u.pct.toFixed(2)}%)`)
console.log(`browser only : ${b.covered}/${b.total} lines (${b.pct.toFixed(2)}%)`)
console.log(`COMBINED     : ${m.covered}/${m.total} lines (${m.pct.toFixed(2)}%)`)

if (MIN !== null) {
  if (m.pct + 1e-9 < MIN) {
    console.error(`\ncoverage-report: combined ${m.pct.toFixed(2)}% is below the floor of ${MIN}%`)
    process.exit(1)
  }
  console.log(`floor ${MIN}% — met`)
}
