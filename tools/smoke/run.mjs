// Boot smoke — the class of bug unit tests can't see.
//
// Builds the dependency-free preview, serves it, drives headless Chromium
// over the key routes, and asserts each page actually BOOTED with its key
// furniture present. This is the net for blank-page regressions: the halls
// aurora feedback loop, the dead preview module graph, the focus-ring bands —
// all shipped invisible to lint/tsc/unit tests.
//
// Runs identically on the offline dev box (playwright-cached chromium) and
// in CI (preinstalled google-chrome). Zero npm dependencies.
//
//   node tools/smoke/run.mjs        (or: npm run smoke)

import { execFile, execFileSync, execSync } from 'node:child_process'
import { createReadStream, existsSync, globSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { promisify } from 'node:util'

// The static server lives in THIS process: chromium must be spawned async or
// the blocked event loop can never answer it (a deadlock we shipped first).
const execFileP = promisify(execFile)

const ROOT = new URL('../..', import.meta.url).pathname
const PREVIEW = join(ROOT, '.preview')
const PORT = 8123

/* ------------------------------------------------------------ browser --- */

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
    try {
      return execSync(`command -v ${name}`, { encoding: 'utf8' }).trim() || null
    } catch { /* keep looking */ }
  }
  const cached = globSync(
    join(process.env.HOME ?? '', '.cache/ms-playwright/chromium_headless_shell-*/chrome-*/chrome-headless-shell'),
  ).sort()
  return cached.at(-1) ?? null
}

/* ------------------------------------------------------------- server --- */

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.md': 'text/markdown', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}

function serve(dir, port) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = join(dir, path === '/' ? 'index.html' : path)
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) { res.writeHead(404); res.end('nope'); return }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)))
}

/* -------------------------------------------------------------- checks --- */

/** Each route asserts the page BOOTED (not blank) + its key furniture. */
const CHECKS = [
  {
    name: 'floor (home) boots with the constellation',
    hash: '#/',
    assert: (dom) => {
      mustMatch(dom, /class="floor-canvas"/, 'floor canvas present')
      mustMatch(dom, /The Folio Museum/, 'title present')
      mustMatch(dom, /floor-strip/, 'due strip present')
    },
  },
  {
    name: 'halls page boots, aurora canvas height is sane',
    hash: '#/halls',
    assert: (dom) => {
      mustMatch(dom, /class="pack-card cinematic"/, 'pack cards render')
      mustMatch(dom, /class="today-panel"/, 'today panel renders')
      // The PR #29 bug class: an in-flow aurora canvas grows without bound.
      const m = dom.match(/class="aurora-canvas"[^>]*height="(\d+)"/)
      if (m && Number(m[1]) > 700) {
        throw new Error(`aurora canvas height ${m[1]}px — layout feedback loop is back`)
      }
    },
  },
  {
    name: 'concept page boots with live machines',
    hash: '#/pack/sysarch-lss-2026/concept/quality-attributes',
    assert: (dom) => {
      mustMatch(dom, /Exhibit/, 'plaque present')
      mustMatch(dom, /class="sim-machine"/, 'sim embeds mounted')
      mustMatch(dom, /class="learn-path"/, 'learn rail present')
    },
  },
  {
    name: 'pack page lists sessions',
    hash: '#/pack/finance-mfi-2026-07',
    assert: (dom) => {
      const cards = dom.match(/session-card-link/g)?.length ?? 0
      if (cards < 10) throw new Error(`only ${cards} session cards rendered`)
    },
  },
  {
    name: 'SDD pack concept page boots',
    hash: '#/pack/ai-sdd-2026/concept/feature-cycle',
    assert: (dom) => {
      mustMatch(dom, /Exhibit/, 'plaque present')
      mustMatch(dom, /plan\.md/, 'concept content rendered')
      mustMatch(dom, /class="learn-path"/, 'learn rail present')
    },
  },
  {
    name: 'curator report boots',
    hash: '#/report',
    assert: (dom) => {
      mustMatch(dom, /Your museum, measured|Curator/, 'report heading present')
      mustMatch(dom, /The ledger/, 'ledger present')
    },
  },
]

function mustMatch(dom, re, label) {
  if (!re.test(dom)) throw new Error(`missing: ${label} (${re})`)
}

/* ---------------------------------------------------------------- main --- */

console.log('building preview…')
execFileSync(process.execPath, ['--experimental-strip-types', join(ROOT, 'tools/preview/build.mjs')], {
  stdio: 'inherit',
})

const chrome = findChrome()
if (!chrome) {
  console.error('smoke: no Chromium found (set CHROME_BIN)')
  process.exit(2)
}
console.log(`chromium: ${chrome}`)

const server = await serve(PREVIEW, PORT)
let failures = 0
try {
  for (const check of CHECKS) {
    const url = `http://127.0.0.1:${PORT}/index.html${check.hash}`
    let dom = ''
    try {
      const { stdout } = await execFileP(chrome, [
        '--headless', '--disable-gpu', '--no-sandbox', '--dump-dom',
        '--window-size=1280,900', '--virtual-time-budget=9000', '--timeout=12000', url,
      ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 45000 })
      dom = stdout
    } catch (e) {
      failures++
      console.error(`✗ ${check.name}: chromium failed (${e.message})`)
      continue
    }
    if (dom.length < 2000) {
      failures++
      console.error(`✗ ${check.name}: page did not boot (DOM ${dom.length} bytes)`)
      continue
    }
    try {
      check.assert(dom)
      console.log(`✓ ${check.name}`)
    } catch (e) {
      failures++
      console.error(`✗ ${check.name}: ${e.message}`)
    }
  }
} finally {
  server.close()
}

if (failures) {
  console.error(`\nsmoke: ${failures} route(s) failed`)
  process.exit(1)
}
console.log('\nsmoke: all routes boot clean')
