// A minimal Chrome DevTools Protocol client — zero dependencies.
//
// Why this exists: the smoke suite used `--dump-dom --virtual-time-budget=N`,
// which dumps the DOM when a VIRTUAL clock expires. The app's own timers and
// animation frames burn that clock in well under a real second, so Chrome
// would sometimes dump a half-loaded page and the harness would report "page
// did not boot". Measured: a failing run finished in 1566ms having served 49
// requests, while the passing run took 2030ms and served 63 — the "slow" run
// was the healthy one. A flaky harness is worse than no harness, because its
// failures get dismissed as noise (which is exactly what happened, twice).
//
// The fix is to stop timing and start waiting for a condition: navigate, then
// poll a real expression in the page until it is true or a wall-clock timeout
// expires. Node 22 ships a global WebSocket and fetch, so this needs nothing
// from npm — which Article I requires and the offline box enforces.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { availableParallelism, loadavg, tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** A sleep that cannot keep the process alive — for the losing side of a race. */
const idle = (ms) => new Promise((r) => setTimeout(r, ms).unref())

/**
 * Stop Chrome and delete its profile, in that order and for real. One
 * implementation for both callers: the failed launch used to delete straight
 * after SIGKILL and could replace "the endpoint never came up" with an
 * ENOTEMPTY stack trace.
 *
 * Waiting for EXIT matters because Chrome's child processes keep writing the
 * disk cache after the parent is signalled; the old fixed 150ms lost that
 * race under load (specs/015-delight task 18c). The timers are unref'd: a
 * Promise.race does not cancel its loser, and a plain one held a passing run
 * open for the full 5s × load after Chrome had already gone.
 */
async function teardown(proc, profile) {
  const exited = proc.exitCode !== null || proc.signalCode !== null
    ? Promise.resolve()
    : new Promise((r) => proc.once('exit', r))
  proc.kill('SIGTERM')
  await Promise.race([exited, idle(5000 * timeoutScale())])
  proc.kill('SIGKILL')
  await Promise.race([exited, idle(2000)])
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch (err) {
    // A leftover temp profile is litter, not a failed check: say so and let
    // the run's own verdict stand.
    console.warn(`cdp: could not remove ${profile} (${err.code ?? err.message}); left for the OS`)
  }
}

/**
 * How much longer than its base a deadline should be on THIS box, right now.
 *
 * Every deadline in this harness detects a hang; none is a timing assertion.
 * A fixed 15s made them assertions anyway: on the fleet's 4-vCPU VM, with
 * other repos' Playwright jobs at load ~10, a healthy page took longer than
 * 15s to mount and the gate went red on code that was fine (specs/015-delight
 * task 18c — reproduced at load ~40: the lab stage, the floor canvas). By the
 * fleet's rule that is a suite defect, not noise (CON-VER-008).
 *
 * So the deadline stretches with the one-minute load per core, read when the
 * wait STARTS, never below its base and capped at 8× so a genuine hang still
 * ends. E2E_TIMEOUT_SCALE overrides it, for a reader who wants to rule load
 * out. The factor is printed in every timeout, so a red log says which.
 */
export function timeoutScale() {
  const forced = Number(process.env.E2E_TIMEOUT_SCALE)
  if (forced > 0) return forced
  const perCore = loadavg()[0] / Math.max(1, availableParallelism())
  return Math.min(8, Math.max(1, perCore))
}

/** Launch headless Chrome with the DevTools endpoint open. */
export async function launch(chromePath, { timeoutMs = 20000 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'folio-e2e-'))
  const proc = spawn(
    chromePath,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-dev-shm-usage',
      // Port 0, and read back the one Chrome chose. A fixed port was worse
      // than a collision: a second run polling it found the FIRST run's
      // Chrome answering /json/version and drove that browser instead
      // (specs/015-delight task 18c). DevToolsActivePort is written into this
      // run's own profile, so it can only ever name this run's browser.
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  // DRAIN stderr. It was piped and never read: a pipe holds ~64KB, and once
  // full, any Chrome process that writes a log line blocks on the write. A
  // quiet e2e run already writes ~31KB, half of it. This was suspected for
  // specs/015-delight task 18d and then measured NOT to be that cause (no run
  // came near 64KB) — it is fixed because it is a latent hang, and the tail
  // it keeps is what finally explained 18d.
  const stderr = { bytes: 0, tail: [] }
  proc.stderr.setEncoding('utf8')
  proc.stderr.on('data', (chunk) => {
    stderr.bytes += Buffer.byteLength(chunk)
    for (const line of chunk.split('\n')) {
      if (!line.trim()) continue
      stderr.tail.push(line)
      if (stderr.tail.length > 40) stderr.tail.shift()
      if (/crash|network service/i.test(line)) console.error(`chrome: ${line}`)
    }
  })

  const deadline = Date.now() + timeoutMs * timeoutScale()
  let version = null
  let port = 0
  while (Date.now() < deadline) {
    try {
      port ||= Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]) || 0
      if (!port) throw new Error('no port yet')
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) {
        version = await res.json()
        break
      }
    } catch {
      /* not up yet */
    }
    await sleep(100)
  }
  if (!version) {
    await teardown(proc, profile)
    throw new Error(port
      ? `chrome devtools endpoint never came up on :${port}`
      : 'chrome never wrote DevToolsActivePort — it did not start, or could not open a debugging port')
  }

  return {
    port,
    /** How much Chrome has written to stderr, and its last lines. */
    stderr,
    async newPage() {
      return newPage(port)
    },
    async close() {
      try {
        await fetch(`http://127.0.0.1:${port}/json/close`).catch(() => {})
      } finally {
        await teardown(proc, profile)
        if (process.env.E2E_CHROME_STDERR) console.error(`chrome stderr: ${stderr.bytes} bytes`)
      }
    },
  }
}

/** Open a fresh tab and attach to it. */
async function newPage(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
  const target = await res.json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('devtools socket failed')), { once: true })
  })

  let nextId = 1
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    const entry = pending.get(msg.id)
    if (!entry) return
    pending.delete(msg.id)
    if (msg.error) entry.reject(new Error(`${msg.error.message} (${entry.method})`))
    else entry.resolve(msg.result)
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve, reject, method })
      ws.send(JSON.stringify({ id, method, params }))
    })

  // Collect uncaught errors and unhandled rejections from EVERY document this
  // page loads, before any page script runs.
  //
  // run.mjs asserts `window.__e2eErrors` is empty, and nothing ever created
  // it: reads, and zero writes. ONE of those reads predates this change —
  // the session-kind check, which had been reporting "no uncaught errors" for
  // all twelve kinds, in CI, for weeks while comparing 0 against 0. The rest
  // were added alongside this collector: three more through uncaughtErrors()
  // and one inlined into the ledger check, which needs its snapshot taken in
  // the same evaluate as the write it polls for.
  //
  // Deliberately not carrying a COUNT any more. This comment has now been
  // wrong twice in opposite directions: first it said all four reads had been
  // live for weeks (overstating a real incident fourfold), then the corrected
  // version said "four reads" and went stale the moment a fifth was added.
  // A number that must be hand-maintained to stay true, in a file arguing
  // that a misdescribing record is worse than none (CON-VER-005), is a
  // liability; `grep -c '__e2eErrors' tools/e2e/run.mjs` is not.
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__e2eErrors = []
      window.addEventListener('error', (e) => {
        // Prefer the message, fall back to the ERROR, and only then to the
        // event — String(event) is "[object ErrorEvent]", which tells the
        // next reader nothing, in a collector whose whole job is a legible
        // failure.
        var m = (e && e.message) || (e && e.error && (e.error.stack || e.error.message))
        window.__e2eErrors.push(String(m || (e && e.type) || e))
      })
      window.addEventListener('unhandledrejection', (e) => {
        window.__e2eErrors.push('unhandled rejection: ' + String((e && e.reason) || e))
      })
    `,
  })

  const page = {
    send,
    /** Evaluate an expression in the page and return its JSON value. */
    async evaluate(expression) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'evaluate threw')
      return result.value
    },
    async goto(url) {
      await send('Page.enable')
      await send('Page.navigate', { url })
    },
    /**
     * Poll `expression` until it is truthy. This is the whole point of the
     * client: readiness is a condition, not a duration.
     */
    async waitFor(expression, { timeoutMs = 15000, intervalMs = 100, label = expression } = {}) {
      const scale = timeoutScale()
      const budget = Math.round(timeoutMs * scale)
      const deadline = Date.now() + budget
      let lastErr = null
      while (Date.now() < deadline) {
        try {
          // Return the VALUE, not `true`. Truthiness is unchanged for every
          // caller that just waits, but a caller that needs the state it
          // polled for can now take it from the same evaluate that observed
          // it — rather than asking again afterwards, on a page that may
          // have navigated in between.
          const value = await page.evaluate(expression)
          if (value) return value
          lastErr = null
        } catch (err) {
          lastErr = err
        }
        await sleep(intervalMs)
      }
      const how = scale > 1 ? ` (${timeoutMs}ms × load ${scale.toFixed(1)})` : ''
      throw new Error(`timed out after ${budget}ms${how} waiting for: ${label}${lastErr ? ` (${lastErr.message})` : ''}`)
    },
    async content() {
      return page.evaluate('document.documentElement.outerHTML')
    },
    /** Click the first element matching a selector, in page context. */
    async click(selector) {
      const ok = await page.evaluate(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true })()`,
      )
      if (!ok) throw new Error(`no element matched ${selector}`)
    },
    /**
     * Start collecting V8 precise coverage for this page.
     *
     * This is the only honest way to measure the code a DOM stub cannot run:
     * WebGL in shader.ts, the animation loop in sim/engine.ts, pointer
     * handling in tilt.ts. Must be called before navigating, or the scripts
     * that run during load are missed.
     */
    async startCoverage() {
      await send('Profiler.enable')
      await send('Profiler.startPreciseCoverage', { callCount: false, detailed: true })
    },
    /** Raw V8 coverage entries: [{ url, functions: [{ ranges }] }]. */
    async takeCoverage() {
      const { result } = await send('Profiler.takePreciseCoverage')
      await send('Profiler.stopPreciseCoverage').catch(() => {})
      return result
    },

    /** Full-page PNG, base64. */
    async screenshot({ fullPage = false } = {}) {
      const params = { format: 'png' }
      if (fullPage) params.captureBeyondViewport = true
      const { data } = await send('Page.captureScreenshot', params)
      return Buffer.from(data, 'base64')
    },
    async close() {
      try {
        ws.close()
      } catch {
        /* already gone */
      }
      await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {})
    },
  }
  return page
}
