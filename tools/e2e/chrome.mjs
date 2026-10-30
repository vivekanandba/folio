// Finding a browser, and saying which one it is.
//
// Three tools needed this and each carried its own copy, which is how the
// search order quietly diverged. One copy now, and it also reports the
// browser's identity — because a screenshot baseline is only comparable
// against the browser that produced it.
import { execFileSync, execSync } from 'node:child_process'
import { existsSync, globSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Search order, most explicit first:
 *   CHROME_BIN, a system Chrome, the Playwright CONTAINER image, this box's
 *   Playwright cache.
 *
 * The container entry matters: CI runs the visual suite inside a pinned
 * Playwright image so the pixels are comparable, and that image installs its
 * browser under /ms-playwright rather than on PATH or in ~/.cache.
 */
export function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
    try {
      const found = execSync(`command -v ${name}`, { encoding: 'utf8' }).trim()
      if (found) return found
    } catch { /* keep looking */ }
  }
  const container = globSync('/ms-playwright/chromium*/chrome-linux*/chrome').sort()
  if (container.length) return container.at(-1)
  return globSync(
    join(process.env.HOME ?? '', '.cache/ms-playwright/chromium_headless_shell-*/chrome-*/chrome-headless-shell'),
  ).sort().at(-1) ?? null
}

/**
 * The browser's own version string, e.g. "Google Chrome for Testing 151.0.7922.34".
 *
 * Note the binaries differ even at one version: chrome-headless-shell is a
 * stripped build and rasterises text differently from full Chrome, which is
 * exactly how a set of baselines ended up comparable to nothing else.
 */
export function browserVersion(chromePath) {
  try {
    return execFileSync(chromePath, ['--version'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

/** Version plus which binary produced it — headless shell vs full Chrome. */
export function browserIdentity(chromePath) {
  const build = /headless[-_]shell/.test(chromePath) ? 'headless-shell' : 'chrome'
  return `${browserVersion(chromePath)} (${build})`
}
