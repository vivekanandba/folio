#!/usr/bin/env node
// Stamp the service worker's cache name with what the build actually contains.
//
// sw.js said `const VERSION = 'folio-sw-v1'` and a comment asking whoever
// deploys to bump it. Nobody ever did — across every deploy of this project
// the constant never changed, so the `activate` handler that deletes caches
// whose key !== VERSION has never deleted anything.
//
// The consequence is not stale content: navigations are network-first and
// assets are stale-while-revalidate, so a reader does get the new museum. It
// is that the cache GROWS WITHOUT BOUND. Every hashed bundle and every version
// of every concept from every past deploy stays on the device forever, which
// on the phone this is meant to be installed on is the user's storage.
//
//   node tools/stamp-sw.mjs [dist]           stamp dist/sw.js
//   node tools/stamp-sw.mjs [dist] --check   verify it was stamped
//
// The stamp is a digest of the built tree, so it changes exactly when the
// deployed bytes change — and is identical for identical builds, which keeps
// it a function of the content rather than of the clock.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const PLACEHOLDER = "const VERSION = 'folio-sw-v1'"
const STAMPED = /^const VERSION = 'folio-sw-[0-9a-f]{12}'$/m

const args = process.argv.slice(2)
const CHECK = args.includes('--check')
const DIST = args.find((a) => !a.startsWith('--')) ?? 'dist'

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

if (!existsSync(DIST)) {
  console.error(`stamp-sw: no build at ${DIST}`)
  process.exit(2)
}
const swPath = join(DIST, 'sw.js')
if (!existsSync(swPath)) {
  console.error(`stamp-sw: ${swPath} is missing — the service worker did not ship`)
  process.exit(1)
}
const sw = readFileSync(swPath, 'utf8')

if (CHECK) {
  if (STAMPED.test(sw)) {
    console.log(`stamp-sw: ${swPath} is stamped (${/folio-sw-([0-9a-f]{12})/.exec(sw)[1]})`)
    process.exit(0)
  }
  console.error(
    `stamp-sw: ${swPath} still carries the unstamped placeholder. ` +
    'Old caches would never be dropped — run `node tools/stamp-sw.mjs dist`.',
  )
  process.exit(1)
}

if (!sw.includes(PLACEHOLDER)) {
  // Loud on a rename rather than quietly shipping an unstamped worker.
  console.error(`stamp-sw: could not find ${PLACEHOLDER} in ${swPath} — has sw.js changed?`)
  process.exit(1)
}

// Digest every shipped byte except the worker itself (whose contents are about
// to include the digest).
const hash = createHash('sha256')
for (const file of walk(DIST).sort()) {
  if (file === swPath) continue
  hash.update(relative(DIST, file))
  hash.update(readFileSync(file))
}
const stamp = hash.digest('hex').slice(0, 12)

writeFileSync(swPath, sw.replace(PLACEHOLDER, `const VERSION = 'folio-sw-${stamp}'`))
console.log(`stamp-sw: ${swPath} → folio-sw-${stamp}`)
