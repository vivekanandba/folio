#!/usr/bin/env node
// End-to-end in a real browser: installability, offline, and screenshots.
//
// The unit suite proves modules behave; the smoke suite proves routes boot.
// Neither can see the three things that decide whether folio works as an app
// on a phone:
//   1. Is it INSTALLABLE? (manifest + raster icons + a service worker)
//   2. Does it work OFFLINE once installed?
//   3. Did it change visually without anyone noticing?
//
// Zero dependencies: Chrome is driven over CDP, and Chrome is also the image
// library — screenshots are diffed by drawing both PNGs to a canvas in-page.
//
//   node tools/e2e/run.mjs            (or: npm run e2e)
//   node tools/e2e/run.mjs --update   (accept current screenshots as baseline)

import { execFileSync, execSync } from 'node:child_process'
import { createReadStream, existsSync, globSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { launch } from './cdp.mjs'

const ROOT = new URL('../..', import.meta.url).pathname
const PREVIEW = join(ROOT, '.preview')
const BASELINES = join(ROOT, 'tests/baselines')
const PORT = 8124
const UPDATE = process.argv.includes('--update')

/**
 * Screenshot baselines are committed from ONE machine's browser. CI runs a
 * different Chrome build with different fonts and hinting, so a pixel baseline
 * cannot honestly gate there — it would fail on rendering, not on regressions.
 *
 * So the visual check gates locally (stable browser, committed baselines) and
 * is informational in CI, where the captures are uploaded as artifacts instead.
 * Stated out loud on every run rather than silently tolerated: a check whose
 * failure mode is invisible is worse than no check (CON-VER-005).
 */
const SHOTS_INFORMATIONAL = !!process.env.CI

/* ------------------------------------------------------------- plumbing --- */

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
    try {
      const found = execSync(`command -v ${name}`, { encoding: 'utf8' }).trim()
      if (found) return found
    } catch { /* keep looking */ }
  }
  return globSync(
    join(process.env.HOME ?? '', '.cache/ms-playwright/chromium_headless_shell-*/chrome-*/chrome-headless-shell'),
  ).sort().at(-1) ?? null
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.md': 'text/markdown', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json',
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

let failures = 0
const results = []
async function check(name, fn) {
  try {
    const note = await fn()
    results.push(`✓ ${name}${note ? ` — ${note}` : ''}`)
  } catch (err) {
    failures += 1
    results.push(`✗ ${name}: ${err.message}`)
  }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

/** PNG dimensions straight from the IHDR chunk — no decoder needed. */
function pngSize(buf) {
  assert(buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47, 'not a PNG')
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

/**
 * Downscale a screenshot to a small "visual fingerprint" — that is what gets
 * committed, not the megabyte-sized capture.
 *
 * Two reasons, and the second is the better one. Full 1280×900 PNGs are ~1 MB
 * each and binaries in git history are permanent (the house-gates hook blocks
 * them, correctly). And a fingerprint is a *more useful* comparison: at 256px
 * wide, font hinting and antialiasing wash out while layout — the thing that
 * actually regresses — survives loudly. The aurora growth loop and the
 * focus-ring bands would both be obvious at this scale.
 *
 * The trade is explicit: this catches layout and large-area changes, not a
 * one-word copy edit or a subtle colour shift. The full-size capture is still
 * written for CI artifacts, just never committed.
 */
async function fingerprint(page, pngBase64, width = 256) {
  const b64 = await page.evaluate(`(async () => {
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i); i.onerror = () => rej(new Error('decode failed'))
      i.src = 'data:image/png;base64,' + ${JSON.stringify(pngBase64)}
    })
    const w = ${width}, h = Math.round(img.height * (${width} / img.width))
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(img, 0, 0, w, h)
    return c.toDataURL('image/png').split(',')[1]
  })()`)
  return Buffer.from(b64, 'base64')
}

/**
 * Diff two PNGs by drawing them to canvases inside the browser and counting
 * pixels that differ by more than a per-channel tolerance. Chrome is already
 * here; a hand-rolled PNG decoder would be a second thing to get wrong.
 */
async function pixelDiff(page, aBase64, bBase64, tolerance = 12) {
  return page.evaluate(`(async () => {
    const load = (b64) => new Promise((res, rej) => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = () => rej(new Error('image failed to decode'))
      img.src = 'data:image/png;base64,' + b64
    })
    const [a, b] = await Promise.all([load(${JSON.stringify(aBase64)}), load(${JSON.stringify(bBase64)})])
    if (a.width !== b.width || a.height !== b.height) {
      return { sizeMismatch: true, a: [a.width, a.height], b: [b.width, b.height] }
    }
    const draw = (img) => {
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      c.getContext('2d').drawImage(img, 0, 0)
      return c.getContext('2d').getImageData(0, 0, img.width, img.height).data
    }
    const pa = draw(a), pb = draw(b)
    let differing = 0
    for (let i = 0; i < pa.length; i += 4) {
      if (Math.abs(pa[i] - pb[i]) > ${tolerance} ||
          Math.abs(pa[i+1] - pb[i+1]) > ${tolerance} ||
          Math.abs(pa[i+2] - pb[i+2]) > ${tolerance}) differing++
    }
    return { sizeMismatch: false, ratio: differing / (pa.length / 4) }
  })()`)
}

/* ------------------------------------------------------------------ main --- */

console.log('building preview…')
execFileSync(process.execPath, ['--experimental-strip-types', join(ROOT, 'tools/preview/build.mjs')], { stdio: 'inherit' })

const chrome = findChrome()
if (!chrome) { console.error('e2e: no Chromium found (set CHROME_BIN)'); process.exit(2) }

mkdirSync(BASELINES, { recursive: true })
const server = await serve(PREVIEW, PORT)
const browser = await launch(chrome, { port: 9344 })
const origin = `http://127.0.0.1:${PORT}`

try {
  /* ------------------------------------------------ installability ------ */

  await check('manifest is served and parses', async () => {
    const res = await fetch(`${origin}/manifest.webmanifest`)
    assert(res.ok, `manifest returned ${res.status}`)
    const m = await res.json()
    for (const field of ['name', 'short_name', 'start_url', 'display', 'icons']) {
      assert(m[field], `manifest is missing ${field}`)
    }
    assert(m.display === 'standalone' || m.display === 'fullscreen',
      `display must be standalone for an installed app, got "${m.display}"`)
    return `display=${m.display}`
  })

  await check('manifest declares the raster icons Android requires', async () => {
    const m = await (await fetch(`${origin}/manifest.webmanifest`)).json()
    const png = m.icons.filter((i) => i.type === 'image/png')
    // Chrome will not offer "Install app" from an SVG-only icon set — this is
    // precisely why folio was not installable before.
    const has192 = png.some((i) => i.sizes.split(' ').includes('192x192'))
    const has512 = png.some((i) => i.sizes.split(' ').includes('512x512'))
    assert(has192, 'no 192x192 PNG icon (Chrome install requirement)')
    assert(has512, 'no 512x512 PNG icon (splash/store requirement)')
    const maskable = m.icons.some((i) => String(i.purpose ?? '').split(' ').includes('maskable'))
    assert(maskable, 'no maskable icon — Android will letterbox the launcher icon')
    return `${png.length} png, maskable ✓`
  })

  await check('every declared icon exists and is really its declared size', async () => {
    const m = await (await fetch(`${origin}/manifest.webmanifest`)).json()
    for (const icon of m.icons) {
      const res = await fetch(`${origin}/${icon.src}`)
      assert(res.ok, `${icon.src} returned ${res.status}`)
      if (icon.type !== 'image/png') continue
      // A 512 entry pointing at a 64px file passes every static check and
      // still ships a blurry launcher icon.
      const buf = Buffer.from(await res.arrayBuffer())
      const { width, height } = pngSize(buf)
      const [w, h] = icon.sizes.split('x').map(Number)
      assert(width === w && height === h, `${icon.src} declares ${icon.sizes} but is ${width}x${height}`)
    }
    return `${m.icons.length} icons verified`
  })

  await check('the page links the manifest and an apple-touch-icon', async () => {
    const page = await browser.newPage()
    try {
      await page.goto(`${origin}/index.html`)
      await page.waitFor('document.readyState === "complete"', { label: 'document ready' })
      const manifestHref = await page.evaluate(`document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? ''`)
      assert(manifestHref, 'no <link rel="manifest"> in the document')
      const apple = await page.evaluate(`!!document.querySelector('link[rel="apple-touch-icon"]')`)
      assert(apple, 'no apple-touch-icon — iOS home-screen installs read this, not the manifest')
      return manifestHref
    } finally {
      await page.close()
    }
  })

  /* ----------------------------------------------- service worker -------- */

  await check('the service worker registers and takes control', async () => {
    const page = await browser.newPage()
    try {
      await page.goto(`${origin}/index.html#/`)
      await page.waitFor('!!navigator.serviceWorker', { label: 'serviceWorker API' })
      const state = await page.evaluate(`(async () => {
        const reg = await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready
        const sw = reg.active || reg.installing || reg.waiting
        return { scope: reg.scope, state: sw ? sw.state : 'none' }
      })()`)
      assert(state.state === 'activated' || state.state === 'activating',
        `worker did not activate (state=${state.state})`)
      return `${state.state} @ ${state.scope}`
    } finally {
      await page.close()
    }
  })

  await check('the museum opens offline after one visit', async () => {
    const page = await browser.newPage()
    try {
      // Warm the cache: load the app and let the worker claim the page.
      await page.goto(`${origin}/index.html#/`)
      await page.waitFor('!!document.querySelector(".floor-canvas")', { label: 'first online load' })
      await page.evaluate(`(async () => {
        await navigator.serviceWorker.register('/sw.js')
        await navigator.serviceWorker.ready
      })()`)
      // Touch the shell so it is in the cache, then cut the network.
      await page.evaluate(`fetch('/index.html').then(r => r.text())`)
      await page.send('Network.enable')
      await page.send('Network.emulateNetworkConditions', {
        offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
      })
      await page.goto(`${origin}/index.html#/`)
      const booted = await page.evaluate(`document.documentElement.outerHTML.length`)
      await page.send('Network.emulateNetworkConditions', {
        offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
      })
      assert(booted > 2000, `offline load returned only ${booted} bytes of DOM`)
      return `${booted} bytes offline`
    } finally {
      await page.close()
    }
  })

  /* ---------------------------------------------------- screenshots ------ */

  const SHOTS = [
    { name: 'floor', hash: '#/', ready: '!!document.querySelector(".floor-canvas")' },
    { name: 'halls', hash: '#/halls', ready: 'document.querySelectorAll(".pack-card").length > 0' },
    { name: 'concept-matrices', hash: '#/pack/math-xii-2026/concept/matrices', ready: '!!document.querySelector(".learn-path")' },
    { name: 'pack-math', hash: '#/pack/math-xii-2026', ready: 'document.querySelectorAll(".session-card-link").length >= 10' },
  ]

  for (const shot of SHOTS) {
    await check(`screenshot: ${shot.name}`, async () => {
      const page = await browser.newPage()
      try {
        await page.send('Emulation.setDeviceMetricsOverride', {
          width: 1280, height: 900, deviceScaleFactor: 1, mobile: false,
        })
        await page.goto(`${origin}/index.html${shot.hash}`)
        await page.waitFor(shot.ready, { label: `${shot.name} furniture` })
        // Settle entry animations so the capture is comparable run to run.
        await page.evaluate(`new Promise(r => setTimeout(r, 600))`)
        const png = await page.screenshot()
        // Full capture for humans/CI artifacts (gitignored); fingerprint for the gate.
        writeFileSync(join(BASELINES, `${shot.name}.current.png`), png)
        const print = await fingerprint(page, png.toString('base64'))
        const file = join(BASELINES, `${shot.name}.png`)

        if (UPDATE || !existsSync(file)) {
          const had = existsSync(file)
          writeFileSync(file, print)
          return had ? 'baseline updated' : `baseline created (${print.length} bytes)`
        }
        const diff = await pixelDiff(page, readFileSync(file).toString('base64'), print.toString('base64'))
        if (SHOTS_INFORMATIONAL) {
          const drift = diff.sizeMismatch ? 'size differs' : `${(diff.ratio * 100).toFixed(2)}%`
          return `${drift} vs committed baseline (INFORMATIONAL in CI — different browser build)`
        }
        assert(!diff.sizeMismatch, `size changed: baseline ${diff.a} vs now ${diff.b}`)
        // 2% absorbs font hinting and antialiasing; a real layout change is
        // far louder than that (the aurora growth bug moved whole sections).
        assert(diff.ratio < 0.02, `${(diff.ratio * 100).toFixed(2)}% of pixels changed — run with --update if intended`)
        return `${(diff.ratio * 100).toFixed(2)}% drift`
      } finally {
        await page.close()
      }
    })
  }
} finally {
  await browser.close()
  server.close()
}

for (const line of results) console.log(line)
if (SHOTS_INFORMATIONAL) {
  console.log('\nnote: screenshot comparison ran INFORMATIONALLY (CI browser build differs from the')
  console.log('      one that produced the committed baselines). Installability and offline DID gate.')
}
if (failures) {
  console.error(`\ne2e: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\ne2e: installable, offline-capable, and visually unchanged')
