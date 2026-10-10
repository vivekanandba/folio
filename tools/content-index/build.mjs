#!/usr/bin/env node
// Precompute the constellation's wires.
//
// The museum floor draws a line between two concepts when one links to the
// other. To find those links it was fetching EVERY concept's full markdown —
// 73 files and ~500 KB on the home page, to render 46 line segments. The cost
// grew with every pack added, and it was paid on the page a phone opens first.
//
// Those links cannot change between deploys, so they are computed here instead
// and shipped as one small file.
//
//   node tools/content-index/build.mjs           regenerate
//   node tools/content-index/build.mjs --check   fail if the committed file is stale
//
// The index is COMMITTED rather than generated at build time so the dev server
// and the offline preview serve it without a build step. That makes staleness
// the risk, which --check exists to remove — it runs in the test suite, so an
// index that no longer matches the content fails before it ships.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname
const CONTENT = join(ROOT, 'public/content')
const OUT = join(CONTENT, 'index.json')

/** Same shape the floor matched against concept prose. */
const LINK_RE = /#\/pack\/([a-z0-9-]+)\/concept\/([a-z0-9-]+)/g

export function buildIndex() {
  const catalog = JSON.parse(readFileSync(join(CONTENT, 'catalog.json'), 'utf8'))

  /** Every concept that exists, so a link to a deleted one is not emitted. */
  const known = new Set()
  const packs = []
  for (const ref of catalog.packs) {
    const meta = JSON.parse(readFileSync(join(CONTENT, ref.path, 'folio.json'), 'utf8'))
    packs.push({ ref, meta })
    for (const cid of meta.concepts) known.add(`${meta.id}::${cid}`)
  }

  const edges = new Set()
  for (const { ref, meta } of packs) {
    for (const cid of meta.concepts) {
      const file = join(CONTENT, ref.path, 'concepts', `${cid}.md`)
      if (!existsSync(file)) continue
      const md = readFileSync(file, 'utf8')
      const from = `${meta.id}::${cid}`
      for (const m of md.matchAll(LINK_RE)) {
        const to = `${m[1]}::${m[2]}`
        if (to === from || !known.has(to)) continue
        // Undirected: the floor draws one wire, not two.
        edges.add([from, to].sort().join('|'))
      }
    }
  }

  return {
    // No timestamp: the index must be a pure function of the content, or
    // --check could never tell staleness from the clock moving.
    version: 1,
    edges: [...edges].sort().map((k) => k.split('|')),
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const index = buildIndex()
  const text = `${JSON.stringify(index, null, 2)}\n`

  if (process.argv.includes('--check')) {
    const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
    if (current !== text) {
      console.error('content-index: public/content/index.json is stale — run `npm run content:index`')
      process.exit(1)
    }
    console.log(`content-index: up to date (${index.edges.length} edges)`)
  } else {
    writeFileSync(OUT, text)
    console.log(`content-index: wrote ${index.edges.length} edges → public/content/index.json`)
  }
}
