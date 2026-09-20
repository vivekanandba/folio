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
//
// Readiness is a CONDITION, not a duration. This suite used to dump the DOM
// when `--virtual-time-budget` expired, but that budget runs on a virtual
// clock the app's own timers burn through, so Chrome sometimes dumped a
// half-loaded page and the run was reported as "page did not boot". Measured
// on 2026-09-20: the failing run finished in 1566ms having served 49 requests;
// the passing run took 2030ms and served 63. The faster run was the broken
// one. Each check now names the furniture it waits for, via CDP.

import { execFileSync, execSync } from 'node:child_process'
import { createReadStream, existsSync, globSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { launch } from '../e2e/cdp.mjs'

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
    ready: "!!document.querySelector('.floor-canvas') && !!document.querySelector('.floor-strip')",
    hash: '#/',
    assert: (dom) => {
      mustMatch(dom, /class="floor-canvas"/, 'floor canvas present')
      mustMatch(dom, /The Folio Museum/, 'title present')
      mustMatch(dom, /floor-strip/, 'due strip present')
    },
  },
  {
    name: 'halls page boots, aurora canvas height is sane',
    ready: "document.querySelectorAll('.pack-card').length > 0 && !!document.querySelector('.today-panel')",
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
    ready: "!!document.querySelector('.sim-machine') && !!document.querySelector('.learn-path')",
    hash: '#/pack/sysarch-lss-2026/concept/quality-attributes',
    assert: (dom) => {
      mustMatch(dom, /Exhibit/, 'plaque present')
      mustMatch(dom, /class="sim-machine"/, 'sim embeds mounted')
      mustMatch(dom, /class="learn-path"/, 'learn rail present')
    },
  },
  {
    name: 'pack page lists sessions',
    ready: "document.querySelectorAll('.session-card-link').length >= 10",
    hash: '#/pack/finance-mfi-2026-07',
    assert: (dom) => {
      const cards = dom.match(/session-card-link/g)?.length ?? 0
      if (cards < 10) throw new Error(`only ${cards} session cards rendered`)
    },
  },
  {
    name: 'SDD pack concept page boots',
    ready: "!!document.querySelector('.learn-path') && document.body.textContent.includes('plan.md')",
    hash: '#/pack/ai-sdd-2026/concept/feature-cycle',
    assert: (dom) => {
      mustMatch(dom, /Exhibit/, 'plaque present')
      mustMatch(dom, /plan\.md/, 'concept content rendered')
      mustMatch(dom, /class="learn-path"/, 'learn rail present')
    },
  },
  {
    name: 'curator report boots',
    ready: "document.body.textContent.includes('The ledger')",
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
const browser = await launch(chrome)
let failures = 0
try {
  for (const check of CHECKS) {
    const url = `http://127.0.0.1:${PORT}/index.html${check.hash}`
    const page = await browser.newPage()
    try {
      await page.goto(url)
      // Wait for the furniture this route is defined by — never for a clock.
      await page.waitFor(check.ready, { timeoutMs: 15000, label: `${check.name} furniture` })
      check.assert(await page.content())
      console.log(`✓ ${check.name}`)
    } catch (e) {
      failures++
      console.error(`✗ ${check.name}: ${e.message}`)
    } finally {
      await page.close()
    }
  }
} finally {
  await browser.close()
  server.close()
}

if (failures) {
  console.error(`\nsmoke: ${failures} route(s) failed`)
  process.exit(1)
}
console.log('\nsmoke: all routes boot clean')
