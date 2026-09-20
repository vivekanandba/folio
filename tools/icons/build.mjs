#!/usr/bin/env node
// Generate the PWA raster icons from favicon.svg.
//
// Why this exists: Chrome on Android will not offer "Install app" unless the
// manifest points at a raster icon of at least 192px (SVG is accepted for the
// tab favicon, but not for the install prompt). Folio shipped an SVG-only icon
// set, so the app was never installable on a phone no matter how correct the
// service worker was.
//
// No image library is available (Article I; the box is offline), so the
// renderer IS the browser: headless Chrome draws the SVG at the target size and
// we capture the pixels. That keeps one source of truth — favicon.svg — instead
// of hand-maintained binaries that drift from the brand.
//
//   node tools/icons/build.mjs
//
// Outputs public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png.
import { execSync } from 'node:child_process'
import { existsSync, globSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from '../e2e/cdp.mjs'

const ROOT = new URL('../..', import.meta.url).pathname
const PUBLIC = join(ROOT, 'public')
const BRAND_BG = '#141210'

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

/**
 * `scale` is the fraction of the canvas the artwork occupies. Maskable icons
 * are cropped to a circle of 80% diameter by Android launchers, so the mark
 * sits at 60% on a full-bleed background — anything in the outer band may be
 * cut, and a logo that survives the crop beats one that fills the square.
 */
function page(svg, size, { scale = 1, background = 'transparent' } = {}) {
  const inner = Math.round(size * scale)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:${background};}
    .wrap{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;}
    svg{width:${inner}px;height:${inner}px;display:block;}
  </style></head><body><div class="wrap">${svg}</div></body></html>`
}

const chrome = findChrome()
if (!chrome) {
  console.error('icons: no Chromium found (set CHROME_BIN)')
  process.exit(2)
}

const svg = readFileSync(join(PUBLIC, 'favicon.svg'), 'utf8')

const TARGETS = [
  { file: 'icon-192.png', size: 192, opts: {} },
  { file: 'icon-512.png', size: 512, opts: {} },
  // Full-bleed background + inset mark, so a circular mask never clips the "F".
  { file: 'icon-maskable-512.png', size: 512, opts: { scale: 0.6, background: BRAND_BG } },
]

const browser = await launch(chrome, { port: 9355 })
try {
  for (const { file, size, opts } of TARGETS) {
    const tab = await browser.newPage()
    try {
      await tab.send('Emulation.setDeviceMetricsOverride', {
        width: size,
        height: size,
        deviceScaleFactor: 1,
        mobile: false,
      })
      const html = page(svg, size, opts)
      await tab.goto(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      await tab.waitFor('document.readyState === "complete"', { timeoutMs: 10000, label: `${file} render` })
      const png = await tab.screenshot()
      writeFileSync(join(PUBLIC, file), png)
      console.log(`✓ ${file} (${size}×${size}, ${png.length} bytes)`)
    } finally {
      await tab.close()
    }
  }
} finally {
  await browser.close()
}
