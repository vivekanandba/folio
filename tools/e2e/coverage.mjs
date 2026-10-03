// Turn V8 browser coverage into lcov against the TypeScript sources, and
// merge lcov files.
//
// The unit suite measures src/*.ts directly. The browser executes
// .preview/src/*.js — the same code with its types stripped. Node's strip-only
// transform replaces type syntax with whitespace, so **line numbers are
// identical** between the two, which is what makes this mapping sound rather
// than approximate: line N of the served JS is line N of the authored TS.
//
// The one exception is src/sessions/index.ts, whose `import.meta.glob` is
// expanded into extra import lines by the preview builder. Its lines shift, so
// it is excluded from browser attribution — it is a six-line barrel that the
// unit suite already covers completely.
import { readFileSync } from 'node:fs'

const SHIFTED = new Set(['sessions/index.ts'])

/** Byte offset → 1-based line number, via a prefix table built once per file. */
function lineIndex(source) {
  const starts = [0]
  for (let i = 0; i < source.length; i++) if (source[i] === '\n') starts.push(i + 1)
  return (offset) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= offset) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

/**
 * V8 coverage → { 'src/x.ts': Map<line, hits> }.
 *
 * @param entries   result of Profiler.takePreciseCoverage
 * @param resolve   (url) => { file, sf } — the served .js on disk and the
 *                  repo-relative TypeScript path to attribute it to — or null
 * @param srcRoot   unused prefix kept for callers that pass one
 */
export function v8ToLines(entries, resolve) {
  const files = new Map()
  for (const entry of entries) {
    const target = resolve(entry.url)
    if (!target) continue
    const { file, sf } = target
    if (SHIFTED.has(sf.replace(/^src\//, ''))) continue

    let source
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const toLine = lineIndex(source)
    // Per-ENTRY, then merged by max. Each page is its own V8 isolate and
    // reports the same module separately; accumulating directly into the
    // shared map let a page that merely imported a module reset the lines a
    // previous page had executed — the symptom was a coverage total that did
    // not move no matter what the suite drove.
    const lines = new Map()

    // Seed every line that carries code as uncovered, so a file the browser
    // loaded but barely ran is reported honestly rather than as a few covered
    // lines out of a few.
    source.split('\n').forEach((text, i) => {
      const t = text.trim()
      if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
      lines.set(i + 1, 0)
    })

    // V8 ranges NEST: a function's outer range covers its whole body, and
    // inner ranges carve out the blocks that did not run. Applying only the
    // count>0 ranges therefore marks everything covered — the first version of
    // this reported 6113/6113 lines, which is exactly the sort of flattering
    // number this whole effort exists to stop believing.
    //
    // Apply widest-first and let narrower ranges overwrite, so a count:0 block
    // inside a function that ran correctly reads as uncovered.
    const ranges = (entry.functions ?? []).flatMap((fn) => fn.ranges ?? [])
    ranges.sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset))
    for (const range of ranges) {
      const from = toLine(range.startOffset)
      const to = toLine(Math.max(range.startOffset, range.endOffset - 1))
      for (let line = from; line <= to; line++) {
        if (lines.has(line)) lines.set(line, range.count)
      }
    }
    // A line is covered if ANY page executed it.
    const existing = files.get(sf)
    if (!existing) files.set(sf, lines)
    else for (const [line, hits] of lines) existing.set(line, Math.max(existing.get(line) ?? 0, hits))
  }
  return files
}

/** { file: Map<line,hits> } → lcov text. */
export function toLcov(files) {
  const out = []
  for (const [sf, lines] of [...files].sort()) {
    out.push('TN:', `SF:${sf}`)
    const sorted = [...lines].sort((a, b) => a[0] - b[0])
    for (const [line, hits] of sorted) out.push(`DA:${line},${hits}`)
    out.push(`LF:${sorted.length}`, `LH:${sorted.filter(([, h]) => h > 0).length}`, 'end_of_record')
  }
  return `${out.join('\n')}\n`
}

/** Parse lcov into { file: Map<line,hits> }. */
export function parseLcov(text) {
  const files = new Map()
  let current = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('SF:')) {
      current = line.slice(3)
      if (!files.has(current)) files.set(current, new Map())
    } else if (line.startsWith('DA:') && current) {
      const [n, hits] = line.slice(3).split(',').map(Number)
      const map = files.get(current)
      map.set(n, (map.get(n) ?? 0) + hits)
    } else if (line === 'end_of_record') {
      current = null
    }
  }
  return files
}

/**
 * Union of several coverage sets: a line is covered if ANY run executed it.
 *
 * Union is the right operation and worth being explicit about — a line the
 * browser runs and the unit suite cannot is still a tested line, and claiming
 * otherwise would under-report as dishonestly as double-counting would
 * over-report.
 */
export function mergeCoverage(sets) {
  const merged = new Map()
  for (const files of sets) {
    for (const [sf, lines] of files) {
      const target = merged.get(sf) ?? new Map()
      for (const [line, hits] of lines) target.set(line, (target.get(line) ?? 0) + hits)
      merged.set(sf, target)
    }
  }
  return merged
}

export function summarise(files) {
  const rows = []
  let total = 0
  let covered = 0
  for (const [sf, lines] of [...files].sort()) {
    const lf = lines.size
    const lh = [...lines.values()].filter((h) => h > 0).length
    total += lf
    covered += lh
    rows.push({ file: sf, lf, lh, pct: lf ? (lh / lf) * 100 : 100 })
  }
  return { rows, total, covered, pct: total ? (covered / total) * 100 : 100 }
}
