#!/usr/bin/env node
// Assert the built output is the thing we think we are shipping.
//
// The unit suite and the content linter both run against the REPO. Nothing ran
// against `dist/` — the only artifact a reader ever receives. The failures this
// catches are the ones that cannot happen locally and cannot be seen in a diff:
// a base path that is right in dev and wrong on Pages, an asset referenced but
// not emitted, a PWA icon that exists in public/ but never made it across.
//
//   node tools/verify-build.mjs [dist-dir] [--base /folio/]
//
// Runs in CI after `npm run pages:build`. Exits 1 with the specific failure.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : join(new URL('..', import.meta.url).pathname, 'dist')
const baseFlag = process.argv.indexOf('--base')
const BASE = baseFlag !== -1 ? process.argv[baseFlag + 1] : '/folio/'

/** External origins the app is allowed to reach. Mirrors tests/delivery.test.ts. */
const ACCEPTED_ORIGINS = new Set(['https://fonts.googleapis.com', 'https://fonts.gstatic.com'])

const problems = []
const check = (cond, msg) => { if (!cond) problems.push(msg) }

if (!existsSync(DIST)) {
  console.error(`verify-build: no dist at ${DIST} — run the build first`)
  process.exit(2)
}

const indexPath = join(DIST, 'index.html')
check(existsSync(indexPath), 'dist/index.html is missing')
const html = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : ''

/* ---------------------------------------------------------- base path --- */

// Every absolute reference must carry the deploy base, or the page 404s its own
// assets the moment it is served from a subdirectory.
const refs = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1])
for (const ref of refs) {
  check(ref.startsWith(BASE), `index.html references ${ref}, which is outside the deploy base ${BASE}`)
}

/* ------------------------------------------------- referenced artifacts --- */

for (const ref of refs) {
  const rel = ref.slice(BASE.length)
  const file = join(DIST, rel)
  check(existsSync(file) && statSync(file).isFile(), `index.html references ${ref}, which was not emitted`)
}

/* ----------------------------------------------------------- the PWA --- */

for (const required of ['sw.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  check(existsSync(join(DIST, required)), `${required} is missing from the build — the app ships uninstallable`)
}

const manifestPath = join(DIST, 'manifest.webmanifest')
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  for (const icon of manifest.icons ?? []) {
    check(existsSync(join(DIST, icon.src)), `manifest names ${icon.src}, which is not in the build`)
  }
  check(manifest.display === 'standalone', `manifest display is "${manifest.display}", not standalone`)
}

/* ------------------------------------------------ external dependencies --- */

const external = new Set()
for (const m of html.matchAll(/https?:\/\/[^\s"')]+/g)) {
  if (m[0].includes('www.w3.org')) continue
  external.add(new URL(m[0]).origin)
}
for (const origin of external) {
  check(ACCEPTED_ORIGINS.has(origin), `built index.html reaches an unaccepted origin: ${origin}`)
}

/* ----------------------------------------------------------- content --- */

// The floor cannot draw its constellation without this, and it is generated
// rather than authored — exactly the kind of file a build can drop silently.
check(existsSync(join(DIST, 'content/index.json')), 'content/index.json did not make it into the build')

const catalogPath = join(DIST, 'content/catalog.json')
check(existsSync(catalogPath), 'content/catalog.json did not make it into the build')
if (existsSync(catalogPath)) {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  for (const pack of catalog.packs ?? []) {
    check(existsSync(join(DIST, 'content', pack.path, 'folio.json')),
      `pack ${pack.id} is in the catalog but its folio.json is not in the build`)
  }
  console.log(`  content: ${(catalog.packs ?? []).length} packs present`)
}

if (problems.length) {
  console.error(`\nverify-build: ${problems.length} problem(s) in ${DIST}`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`verify-build: ${DIST} is coherent (base ${BASE}, ${refs.length} references resolved)`)
