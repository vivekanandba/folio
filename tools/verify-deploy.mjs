#!/usr/bin/env node
// Assert the LIVE site is serving the build we just made.
//
// A deploy that exits 0 having shipped nothing is the documented failure mode
// (CON-VER-003): the job succeeds, the artifact uploads, and the old bundle
// keeps serving. Nothing in folio has ever checked the outcome rather than the
// command — this session verified the PWA icons by hand, which is exactly the
// kind of check that should not depend on someone remembering.
//
//   node tools/verify-deploy.mjs <url> [dist-dir]
//   node tools/verify-deploy.mjs <url> --expect index-ABC.js,index-DEF.css
//
// Compares the hashed asset names in the local build against those the live
// page actually references. Hashes change whenever content changes, so a stale
// deploy shows up as a mismatch. `--expect` takes the names directly, for the
// deploy job, which has the build's output but not its dist/.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const URL_ = process.argv[2]
const DIST = process.argv[3] ?? join(new URL('..', import.meta.url).pathname, 'dist')

if (!URL_) {
  console.error('usage: verify-deploy.mjs <url> [dist-dir]')
  process.exit(2)
}

const assetNames = (html) =>
  new Set([...html.matchAll(/\/assets\/([A-Za-z0-9._-]+)/g)].map((m) => m[1]))

const expectFlag = process.argv.indexOf('--expect')
let expected
if (expectFlag !== -1) {
  expected = new Set((process.argv[expectFlag + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean))
} else {
  const indexFile = join(DIST, 'index.html')
  if (!existsSync(indexFile)) {
    console.error(`verify-deploy: no local build at ${DIST} to compare against (or pass --expect)`)
    process.exit(2)
  }
  expected = assetNames(readFileSync(indexFile, 'utf8'))
}
if (!expected.size) {
  console.error('verify-deploy: no hashed asset names to compare — nothing would be verified')
  process.exit(2)
}

/** Pages can serve a stale copy for a few seconds after the deploy reports done. */
async function fetchWithRetry(url, { attempts = 6, delayMs = 10000 } = {}) {
  let last
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } })
      if (res.ok) return await res.text()
      last = `HTTP ${res.status}`
    } catch (err) {
      last = err.message
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, delayMs))
  }
  throw new Error(`could not fetch ${url}: ${last}`)
}

const problems = []

const liveHtml = await fetchWithRetry(URL_)
const live = assetNames(liveHtml)

const missing = [...expected].filter((name) => !live.has(name))
if (missing.length) {
  problems.push(
    `the live page does not reference ${missing.join(', ')} — it is serving an older build`,
  )
}

// The PWA surface must survive deployment too: these are separate files that
// the build can emit and a deploy can still fail to publish.
const origin = new global.URL(URL_)
const basePath = origin.pathname.endsWith('/') ? origin.pathname : `${origin.pathname}/`
for (const asset of ['manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
  const res = await fetch(new global.URL(`${basePath}${asset}`, origin.origin), { cache: 'no-store' })
  if (!res.ok) problems.push(`${asset} is not served (${res.status})`)
}

// And the content the museum is made of.
const catalogRes = await fetch(new global.URL(`${basePath}content/catalog.json`, origin.origin), { cache: 'no-store' })
if (!catalogRes.ok) {
  problems.push(`content/catalog.json is not served (${catalogRes.status})`)
} else {
  const catalog = await catalogRes.json()
  console.log(`  live catalog: ${catalog.packs?.length ?? 0} packs`)
}

if (problems.length) {
  console.error(`\nverify-deploy: ${problems.length} problem(s) at ${URL_}`)
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`verify-deploy: ${URL_} is serving this build (${expected.size} asset(s) matched)`)
