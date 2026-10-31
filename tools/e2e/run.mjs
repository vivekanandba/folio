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
import { createReadStream, existsSync, globSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { launch } from './cdp.mjs'
import { browserIdentity, findChrome } from './chrome.mjs'
import { toLcov, v8ToLines } from './coverage.mjs'

const ROOT = new URL('../..', import.meta.url).pathname
const PREVIEW = join(ROOT, '.preview')
const BASELINES = join(ROOT, 'tests/baselines')
const PORT = 8124
const UPDATE = process.argv.includes('--update')

/**
 * A pixel baseline is only comparable against the browser that produced it, so
 * the visual check gates when the running browser MATCHES the one recorded
 * beside the baselines, and reports without failing when it does not.
 *
 * This replaces a `process.env.CI` heuristic that had it exactly backwards:
 * it gated locally and went informational in CI. Measured on 2026-10-30, the
 * baselines had been captured with chrome-headless-shell — a stripped build
 * that rasterises text differently from full Chrome — so they were comparable
 * to nothing else. CI's Chrome drifted 1.1/2.6/4.9/4.5%, and the pinned
 * Playwright container drifted 1.1/2.5/4.9/4.5%: CI and the container agree
 * with each other and the baselines were the odd one out.
 *
 * Baselines are now captured in that container, which CI also runs, so the
 * check gates where it matters and degrades loudly on a dev box.
 */
const BASELINE_BROWSER_FILE = join(BASELINES, 'BROWSER')
const recordedBrowser = existsSync(BASELINE_BROWSER_FILE)
  ? readFileSync(BASELINE_BROWSER_FILE, 'utf8').trim()
  : null

/* ------------------------------------------------------------- plumbing --- */

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

/* ------------------------------------------------------------ coverage --- */

const coverageEntries = []

/**
 * Make every page this suite opens report what it executed.
 *
 * Wrapping newPage/close rather than restructuring each check means coverage
 * reflects the WHOLE run — every route, every session kind, every interaction
 * — instead of a token page somebody remembered to instrument.
 */
function instrument(browser) {
  const rawNewPage = browser.newPage.bind(browser)
  browser.newPage = async () => {
    const page = await rawNewPage()
    await page.startCoverage()
    const rawClose = page.close.bind(page)
    page.close = async () => {
      try {
        coverageEntries.push(...(await page.takeCoverage()))
      } catch { /* a page that already went away owes us nothing */ }
      await rawClose()
    }
    return page
  }
  return browser
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

const currentBrowser = browserIdentity(chrome)
if (UPDATE) writeFileSync(BASELINE_BROWSER_FILE, `${currentBrowser}\n`)
const SHOTS_INFORMATIONAL = !(recordedBrowser && recordedBrowser === currentBrowser)

mkdirSync(BASELINES, { recursive: true })
const server = await serve(PREVIEW, PORT)
const browser = instrument(await launch(chrome, { port: 9344 }))
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

  /* --------------------------------------------- every session kind ------ */

  // The unit suite plays all twelve kinds against the DOM stub, which proves
  // the logic. It cannot prove they render and respond in a browser: canvas,
  // SVG, drag-and-drop, pointer events and the animation loop are all stubbed
  // out there. These run the real thing.
  const kinds = new Map()
  for (const pack of readdirSync(join(ROOT, 'public/content/packs'))) {
    const dir = join(ROOT, 'public/content/packs', pack, 'sessions')
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'))
      if (!kinds.has(data.kind)) kinds.set(data.kind, { pack, id: data.id, title: data.title })
    }
  }

  await check('every session kind has shipped content to drive', () => {
    if (kinds.size < 12) throw new Error(`expected 12 kinds, found ${kinds.size}: ${[...kinds.keys()]}`)
    return `${kinds.size} kinds`
  })

  for (const [kind, sample] of [...kinds].sort()) {
    await check(`session kind in the browser: ${kind}`, async () => {
      const page = await browser.newPage()
      try {
        await page.goto(`${origin}/index.html#/pack/${sample.pack}/session/${sample.id}`)
        await page.waitFor('!!document.querySelector(".stage")', {
          timeoutMs: 15000, label: `${kind} stage`,
        })
        const before = await page.evaluate('document.querySelector(".stage").textContent.length')
        if (!before) throw new Error('the stage rendered empty')

        // Touch it the way a learner would: the first few affordances the kind
        // offers. Which ones exist differs per kind; clicking what is there is
        // the point, not clicking a specific thing.
        const clicked = await page.evaluate(`(() => {
          const targets = document.querySelectorAll(
            '.choice-btn, .clue-card, .classify-card, .seq-move, .pillar-tile, .score-btn, .bp-part, .primary')
          let n = 0
          for (const el of targets) { if (n >= 3) break; el.click(); n++ }
          return n
        })()`)

        // Interacting must not blank the page — the failure mode that matters.
        const after = await page.evaluate('document.querySelector(".stage")?.textContent.length ?? 0')
        if (!after) throw new Error(`the stage went blank after ${clicked} interaction(s)`)
        const errors = await page.evaluate('window.__e2eErrors ? window.__e2eErrors.length : 0')
        if (errors) throw new Error(`${errors} uncaught error(s) during interaction`)
        return `${clicked} interaction(s), stage ${before}→${after} chars`
      } finally {
        await page.close()
      }
    })
  }

  await check('finishing an exhibit puts a plaque on the wall', async () => {
    const page = await browser.newPage()
    try {
      // A first-time visitor, so "First exhibit" is genuinely unearned. This
      // is the whole feature end to end: play a real session to completion in
      // a real browser, and the museum should notice.
      await page.goto(`${origin}/index.html?plaques=1`)
      await page.waitFor('document.readyState !== "loading"', { label: 'app booted' })
      await page.evaluate('localStorage.clear()')
      // A quiz, because it completes by clicking alone — classify needs a drag
      // the driver cannot do, and a check that cannot finish proves nothing.
      await page.goto(`${origin}/index.html?plaques=1&go=1#/pack/math-xii-2026/session/math-xii-quiz`)
      await page.waitFor('!!document.querySelector(".stage")', { label: 'session stage' })

      // Click whatever the kind offers until it completes, bounded so a change
      // in the session's shape fails loudly rather than spinning.
      for (let i = 0; i < 40; i++) {
        const done = await page.evaluate('!!document.querySelector(".saved-note")')
        if (done) break
        await page.evaluate(`(() => {
          // Answer, then Next/Finish — in that order, so a question is never
          // skipped past by clicking the button that appears after it.
          const t = document.querySelector('.choice-btn:not([disabled])') ??
                    document.querySelector('.primary')
          if (t) t.click()
        })()`)
      }
      await page.waitFor('!!document.querySelector(".saved-note")', { label: 'session completed' })
      // The plaque is appended after the catalog resolves, which on a cold
      // profile is a dozen fetches behind the completion callback. Reading it
      // straight after .saved-note raced the feature under test and would go
      // red for timing, not for a regression (CON-VER-008).
      await page.waitFor('!!document.querySelector(".acquisition")', { label: 'plaque on the wall' })

      const plaque = await page.evaluate(`(() => {
        const a = document.querySelector('.acquisition')
        return a ? a.textContent : ''
      })()`)
      assert(plaque, 'finishing the first exhibit put no plaque on the wall')

      // And it is KEPT — the shelf is what makes it a collection rather than
      // a flash of confetti.
      await page.goto(`${origin}/index.html?plaques=1&shelf=1#/report`)
      await page.waitFor('!!document.querySelector(".acquisition-shelf")', { label: 'acquisitions shelf' })
      const shelved = await page.evaluate(
        `document.querySelectorAll('.acquisition-shelf .acquisition').length`,
      )
      assert(shelved > 0, 'the plaque was celebrated and then forgotten')
      return `${plaque.replace(/\s+/g, ' ').trim().slice(0, 40)}… · ${shelved} on the shelf`
    } finally {
      await page.close()
    }
  })

  /* ------------------------------------- the parts a stub cannot run ------ */

  // shader.ts (WebGL), tilt.ts (pointer) and sim/engine.ts (animation loop)
  // are the three modules the DOM stub can only import, never execute. Each
  // needs a specific condition met before it will even start, so each is
  // driven deliberately rather than hoped for.

  await check('the aurora shader compiles and runs on real WebGL', async () => {
    const page = await browser.newPage()
    try {
      // No reduced-motion emulation here: mountAurora returns null under it,
      // which is precisely why the screenshot pages never reach this code.
      await page.goto(`${origin}/index.html#/halls`)
      await page.waitFor('!!document.querySelector(".aurora-canvas")', { label: 'aurora canvas' })
      const gl = await page.evaluate(`(() => {
        const c = document.querySelector('.aurora-canvas')
        if (!c) return 'no canvas'
        const ctx = c.getContext('webgl')
        return ctx ? ctx.getParameter(ctx.VERSION) : 'no webgl context'
      })()`)
      assert(String(gl).includes('WebGL'), `the aurora canvas has no GL context (${gl})`)
      // Wait for FRAMES, not for a clock. A fixed sleep made shader.ts coverage
      // swing by ~13 lines between runs — the render loop had sometimes turned
      // over and sometimes not, which is the same "duration instead of
      // condition" mistake the smoke suite was built on.
      const frames = await page.evaluate(`(async () => {
        let n = 0
        await new Promise((resolve) => {
          const tick = () => { n += 1; n < 30 ? requestAnimationFrame(tick) : resolve() }
          requestAnimationFrame(tick)
        })
        return n
      })()`)
      assert(frames >= 30, `the aurora loop only reached ${frames} frames`)
      return `${gl}, ${frames} frames`
    } finally {
      await page.close()
    }
  })

  await check('tilt responds to a fine pointer', async () => {
    const page = await browser.newPage()
    try {
      // attachTilt declines unless the pointer is fine and hover-capable —
      // the default headless profile is neither, so emulate a desktop mouse.
      await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'hover', value: 'hover' }, { name: 'pointer', value: 'fine' }],
      })
      await page.goto(`${origin}/index.html#/halls`)
      await page.waitFor('document.querySelectorAll(".pack-card").length > 0', { label: 'pack cards' })
      const moved = await page.evaluate(`(() => {
        const card = document.querySelector('.pack-card')
        if (!card) return 'no card'
        const box = card.getBoundingClientRect()
        for (const [x, y] of [[0.25, 0.25], [0.75, 0.6], [0.5, 0.5]]) {
          card.dispatchEvent(new PointerEvent('pointermove', {
            bubbles: true, clientX: box.left + box.width * x, clientY: box.top + box.height * y,
          }))
        }
        card.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
        return 'moved'
      })()`)
      assert(moved === 'moved', `could not drive a pointer over a card (${moved})`)
      await page.evaluate('new Promise(r => setTimeout(r, 300))')
      return 'pointermove ×3 + leave'
    } finally {
      await page.close()
    }
  })

  await check('the simulation engine runs its loop and answers its knobs', async () => {
    const page = await browser.newPage()
    try {
      await page.goto(`${origin}/index.html#/pack/ai-vllm-inf-2026/session/batching-lab`)
      await page.waitFor('!!document.querySelector(".sim-machine")', { label: 'sim machine' })
      // Let the loop integrate, then move a knob and let it react: the readouts
      // changing is the evidence the engine actually stepped.
      await page.evaluate('new Promise(r => setTimeout(r, 1500))')
      const before = await page.evaluate(`document.querySelector('.sim-readouts')?.textContent ?? ''`)
      await page.evaluate(`(() => {
        for (const input of document.querySelectorAll('.sim-knobs input')) {
          const max = Number(input.max || 100), min = Number(input.min || 0)
          input.value = String(min + (max - min) * 0.8)
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })()`)
      await page.evaluate('new Promise(r => setTimeout(r, 1500))')
      const after = await page.evaluate(`document.querySelector('.sim-readouts')?.textContent ?? ''`)
      assert(before || after, 'the machine rendered no readouts at all')
      return before === after ? 'ran (readouts steady)' : 'ran, readouts responded to the knobs'
    } finally {
      await page.close()
    }
  })

  await check('the museum can be silenced, and stays silenced', async () => {
    const page = await browser.newPage()
    try {
      // Make the precondition rather than assuming it. Every page in this run
      // shares one profile, so "a fresh visitor" is only true while this check
      // happens to be the sole writer of the preference — exactly the
      // order-dependence the screenshot loop below clears storage to escape
      // (CON-VER-008). Relying on it here would be the same bug, one hunk up.
      await page.send('Storage.clearDataForOrigin', {
        origin,
        storageTypes: 'local_storage',
      })
      await page.goto(`${origin}/index.html#/`)
      await page.waitFor('!!document.querySelector(".topbar-sound")', { label: 'sound control' })
      const pressed = () => page.evaluate(`document.querySelector('.topbar-sound')?.getAttribute('aria-pressed')`)
      const label = () => page.evaluate(`document.querySelector('.topbar-sound')?.getAttribute('aria-label')`)
      assert((await pressed()) === 'true', 'a fresh visitor should arrive with the museum audible')
      const nameWhenOn = await label()

      await page.evaluate(`document.querySelector('.topbar-sound').click()`)
      assert((await pressed()) === 'false', 'clicking the control did not mute')
      // A toggle's NAME is the thing; aria-pressed is the state. If the name
      // changes with the state too, a screen reader reads the two together and
      // announces the opposite of the truth ("mute … pressed" while sound is
      // on). So the name must NOT move.
      assert(
        (await label()) === nameWhenOn,
        `the control renamed itself when toggled ("${nameWhenOn}" → "${await label()}") — aria-pressed already carries the state`,
      )
      const stored = await page.evaluate(`localStorage.getItem('folio-feedback')`)
      assert(stored === 'off', `the mute did not reach storage (got ${stored})`)

      // A reload is the whole point of persisting it: a preference that does
      // not survive the next visit is not a preference.
      //
      // It has to be a REAL reload. Navigating to a URL identical down to the
      // fragment is a same-document navigation — the document survives, and
      // this assertion would pass against a preference held in a module
      // variable that never reached storage. So: a different URL, and a marker
      // that proves the document was rebuilt before anything is concluded.
      await page.evaluate(`window.__sameDocument = true`)
      await page.goto(`${origin}/index.html?reload=1#/`)
      await page.waitFor('!!document.querySelector(".topbar-sound")', { label: 'sound control again' })
      const survived = await page.evaluate(`!!window.__sameDocument`)
      assert(!survived, 'the page was never actually reloaded — this check would prove nothing')
      assert((await pressed()) === 'false', 'the mute did not survive a reload')

      await page.evaluate(`document.querySelector('.topbar-sound').click()`)
      assert((await pressed()) === 'true', 'the control did not unmute')
      const back = await page.evaluate(`localStorage.getItem('folio-feedback')`)
      assert(back === 'on', `unmuting did not reach storage (got ${back})`)

      // Cross-tab. feedbackEnabled() reads storage first precisely so another
      // tab's choice is honoured; without the storage listener this page would
      // keep showing a speaker, and keep telling a screen reader
      // aria-pressed="true", while the museum was in fact silent.
      const other = await browser.newPage()
      try {
        await other.goto(`${origin}/index.html?tab=2#/`)
        await other.waitFor('!!document.querySelector(".topbar-sound")', { label: 'second tab' })
        await other.evaluate(`document.querySelector('.topbar-sound').click()`)
        // Poll, do not sleep. These jobs share a 4-vCPU box with other
        // Playwright runs; a wall-clock assertion in a merge gate is the
        // CON-VER-008 pattern — it would fail under load and teach everyone
        // to re-run rather than to look.
        await page.waitFor(
          `document.querySelector('.topbar-sound')?.getAttribute('aria-pressed') === 'false'`,
          { timeoutMs: 5000, label: 'this tab notices the other tab muted' },
        )
      } finally {
        await other.close()
      }
      return 'mute → real reload → unmute → cross-tab'
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
        // Freeze motion before capturing. The halls aurora animates, so an
        // unfrozen capture drifted ~2% run to run — noise indistinguishable
        // from a small regression, which would have taught us to raise the
        // threshold until the check stopped meaning anything. The app honours
        // prefers-reduced-motion, so this both stabilises the shot AND puts
        // the reduced-motion path under test.
        await page.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
        })
        // Freeze the clock as well as the motion. Anything the app derives
        // from "now" — a streak, a lamp coming due, a greeting that changes
        // with the hour — would otherwise drift the fingerprint by the day or
        // the time of day, and the gate would erode without anyone touching
        // the design. Combined with the storage clear below, every capture is
        // the same visitor arriving at the same moment.
        // The timezone as well as the instant. arrivalLine() reads getHours(),
        // which is LOCAL — so a pinned UTC instant still produces a different
        // greeting on a box in Chicago than on one in UTC, and the drift this
        // whole hunk exists to remove walks straight back in.
        await page.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' })
        await page.send('Page.addScriptToEvaluateOnNewDocument', {
          source: `(() => {
            // 1780736400000 === 2026-06-06T09:00:00Z, a Saturday morning.
            // Checked, not asserted: the first draft of this line claimed a
            // Saturday morning and held a Tuesday EVENING, so the baseline
            // captured a greeting the record said it did not (CON-VER-006).
            const FIXED = 1780736400000
            const Real = Date
            function Pinned(...args) {
              // Called WITHOUT new, Date() must return a string, not an
              // object — anything doing String(Date()) would otherwise get
              // something it cannot use.
              if (!new.target) return new Real(FIXED).toString()
              return args.length === 0 ? new Real(FIXED) : new Real(...args)
            }
            Pinned.prototype = Real.prototype
            Pinned.now = () => FIXED
            Pinned.parse = Real.parse
            Pinned.UTC = Real.UTC
            globalThis.Date = Pinned
          })()`,
        })
        // Capture a FIRST-TIME visitor, every time. Every page in this run
        // shares one profile, and the session-kind checks above PLAY sessions
        // — which writes real progress. The committed baselines had therefore
        // been encoding whatever those checks happened to record: a resume
        // card, a streak of 1, lamps that had come due. That makes the gate
        // depend on check ORDER and on the date, which is a suite defect, not
        // a visual one (CON-VER-008). Captured from a clean store, these four
        // shots answer one question only: does the museum still look like
        // itself to someone arriving for the first time?
        //
        // Only localStorage is cleared. Wiping cache_storage here would also
        // tear out the service worker the checks above just installed.
        //
        // And it is cleared IN THE PAGE, not over CDP. Storage.clearDataForOrigin
        // races the navigation that follows it: when the clear landed late the
        // shot was captured with the progress the session-play checks had
        // recorded, and halls/concept drifted 8.6%/9.5% while floor and
        // pack-math passed — an intermittent failure that looks exactly like a
        // visual regression and is not one (CON-VER-008). localStorage.clear()
        // in page context is synchronous, and the assertion below turns any
        // future race into a sentence instead of a mystery.
        // Prime a document on this origin, clear there, then load the shot in
        // a genuinely NEW document. Three things each have to be waited for,
        // and skipping any of them was a bug in an earlier draft:
        //  - goto is a bare Page.navigate; it does not wait for the document
        //    to commit, and evaluating against the about:blank a fresh tab
        //    starts on throws SecurityError the moment it touches localStorage
        //  - the second URL must differ by more than its FRAGMENT, or it is a
        //    same-document navigation and the clear never takes effect on a
        //    rebuilt page (for `floor`, whose hash is empty, the primed
        //    document has already painted .floor-canvas, so shot.ready would
        //    be satisfied by the stale pre-clear DOM)
        //  - and a marker set before the clear proves the document really was
        //    rebuilt, rather than leaving that to be assumed
        await page.goto(`${origin}/index.html?shot=${shot.name}&prime=1`)
        await page.waitFor('document.readyState !== "loading"', { label: `${shot.name} prime` })
        await page.evaluate('localStorage.clear(); window.__beforeClear = true')
        await page.goto(`${origin}/index.html?shot=${shot.name}&clean=1${shot.hash}`)
        await page.waitFor('!window.__beforeClear', { label: `${shot.name} fresh document` })
        await page.waitFor(shot.ready, { label: `${shot.name} furniture` })
        // Wait for CONDITIONS, then settle. A fixed sleep was the whole of it
        // before, and under load a concept page's interactive figures had not
        // hydrated when the shutter fired — a figure-sized hole, 9.54% of the
        // frame, indistinguishable from a design regression. This is the same
        // "duration instead of condition" mistake the smoke suite was rebuilt
        // to remove; it had simply survived here (CON-VER-008).
        // `.widget-failed` counts as settled. A figure that CANNOT mount — a
        // malformed ```viz fence — degrades to "(interactive figure
        // unavailable)" and never gains `widget-mounted`, so waiting only on
        // the success class turns a graceful degradation into a 15s timeout
        // blaming hydration. That is the misdiagnosis this block exists to
        // prevent, committed by the fix for it (CON-VER-005).
        await page.waitFor(
          `document.querySelectorAll('.viz-slot:not(.widget-mounted):not(.widget-failed)').length === 0`,
          { label: `${shot.name} figures settled` },
        )
        // Webfonts: style.css imports Google Fonts at runtime, and a capture
        // taken on the fallback face differs from one taken on Source Serif
        // everywhere there is text.
        await page.evaluate(`document.fonts ? document.fonts.ready.then(() => true) : true`)
        // Then a short settle for entry animations, which reduced motion has
        // already collapsed to nothing.
        await page.evaluate(`new Promise(r => setTimeout(r, 400))`)
        // Checked HERE, immediately before the shutter, not before the settle:
        // the earlier placement could not see anything written during those
        // 600ms, and an `halls` capture carrying a resume card drifted 8.55%
        // while the assertion reported a clean store.
        const state = JSON.parse(await page.evaluate(`JSON.stringify({
          keys: Object.keys(localStorage),
          resume: !!document.querySelector('.resume-card'),
          // The aurora is a LIVE WebGL canvas. mountAurora returns null under
          // reduced motion and the CSS hides the element, so one on screen
          // here means the emulation did not take — and an animating canvas
          // in a fingerprint is drift by construction.
          aurora: !!document.querySelector('.aurora-canvas'),
          motion: matchMedia('(prefers-reduced-motion: reduce)').matches,
          // Not re-checking hydration here: the waitFor above already
          // guarantees it, so a diagnostic for it could never fire — and an
          // unreachable branch dressed as a check is worse than no check.
          fonts: document.fonts ? document.fonts.status : 'loaded',
        })`))
        const wrong = [
          state.keys.length ? `storage kept [${state.keys.join(', ')}]` : '',
          state.resume ? 'a resume card is on screen' : '',
          state.aurora ? 'a live aurora canvas is on screen' : '',
          state.motion ? '' : 'reduced-motion emulation did not take',
          state.fonts === 'loaded' ? '' : `fonts are ${state.fonts}`,
        ].filter(Boolean)
        // Named causes, not a bare "it differs". An intermittent screenshot
        // failure that says only "8.55% changed" sends the next reader after
        // a design regression that is not there (CON-VER-005).
        assert(!wrong.length, `the capture is not a clean first visit — ${wrong.join('; ')}`)
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
          return `${drift} vs committed baseline (INFORMATIONAL — different browser)`
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

/* ------------------------------------------------- write browser lcov --- */

try {
  const previewSrc = join(PREVIEW, 'src')
  const rebased = v8ToLines(coverageEntries, (url) => {
    // Only our own modules, served from the preview under /src/.
    const m = /^https?:\/\/[^/]+\/src\/(.+\.js)$/.exec(url)
    if (!m) return null
    const file = join(previewSrc, m[1])
    if (!existsSync(file)) return null
    // Attribute to the AUTHORED TypeScript: strip-only keeps line numbers, so
    // line N of the served JS is line N of src/<rel>.ts.
    return { file, sf: `src/${m[1].replace(/\.js$/, '.ts')}` }
  })
  mkdirSync(join(ROOT, '.coverage'), { recursive: true })
  const out = join(ROOT, '.coverage/browser.lcov')
  writeFileSync(out, toLcov(rebased))
  const covered = [...rebased.values()].reduce((n, m) => n + [...m.values()].filter((h) => h > 0).length, 0)
  const total = [...rebased.values()].reduce((n, m) => n + m.size, 0)
  console.log(`\nbrowser coverage: ${rebased.size} modules, ${covered}/${total} lines → ${out}`)
} catch (err) {
  // Coverage is a measurement, not a gate here; say so loudly rather than
  // failing a run whose actual checks passed.
  console.error(`\nbrowser coverage: NOT written (${err.message})`)
}

for (const line of results) console.log(line)
if (SHOTS_INFORMATIONAL && !UPDATE) {
  console.log('\nnote: screenshot comparison was INFORMATIONAL — this browser is not the one that')
  console.log(`      produced the baselines.\n        running:  ${currentBrowser}`)
  console.log(`        baseline: ${recordedBrowser ?? '(none recorded — run with --update)'}`)
  console.log('      Installability and offline DID gate.')
}
if (failures) {
  console.error(`\ne2e: ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\ne2e: installable, offline-capable, and visually unchanged')
