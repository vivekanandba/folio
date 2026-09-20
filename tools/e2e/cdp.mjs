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
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Launch headless Chrome with the DevTools endpoint open. */
export async function launch(chromePath, { port = 9333, timeoutMs = 20000 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'folio-e2e-'))
  const proc = spawn(
    chromePath,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )

  const deadline = Date.now() + timeoutMs
  let version = null
  while (Date.now() < deadline) {
    try {
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
    proc.kill('SIGKILL')
    rmSync(profile, { recursive: true, force: true })
    throw new Error(`chrome devtools endpoint never came up on :${port}`)
  }

  return {
    port,
    async newPage() {
      return newPage(port)
    },
    async close() {
      try {
        await fetch(`http://127.0.0.1:${port}/json/close`).catch(() => {})
      } finally {
        proc.kill('SIGTERM')
        await sleep(150)
        proc.kill('SIGKILL')
        rmSync(profile, { recursive: true, force: true })
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
      const deadline = Date.now() + timeoutMs
      let lastErr = null
      while (Date.now() < deadline) {
        try {
          if (await page.evaluate(expression)) return true
          lastErr = null
        } catch (err) {
          lastErr = err
        }
        await sleep(intervalMs)
      }
      throw new Error(`timed out after ${timeoutMs}ms waiting for: ${label}${lastErr ? ` (${lastErr.message})` : ''}`)
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
