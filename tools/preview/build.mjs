#!/usr/bin/env node
// Offline preview build — no vite, no node_modules. Strips TypeScript types
// with Node 22's built-in transform, rewrites import specifiers to browser
// module paths, patches the two vite-isms (style.css import, BASE_URL), and
// assembles a static .preview/ dir servable with `python3 -m http.server`.
//
//   node --experimental-strip-types tools/preview/build.mjs [--out DIR]
//   python3 -m http.server 8077 -d .preview
//
// --out exists so that two consumers never share one directory. They used to:
// the unit suite rebuilt .preview/ (rm -rf, then write) while the e2e was
// SERVING it, and the browser got a 404 manifest and an index.html with no
// links — read as an e2e "load sensitivity" defect for weeks (specs/015-delight
// task 18c). The unit suite, the e2e and the smoke now each build privately.
//
// This is a LAYOUT/BEHAVIOUR preview, not the production build: no minify,
// no bundling, no font downloads (offline box falls back to system fonts).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { patchViteIsms } from './vite-isms.mjs'

const ROOT = new URL('../..', import.meta.url).pathname
const DEFAULT_OUT = join(ROOT, '.preview')

/**
 * Where to build. The directory is DELETED first, so where may be any path at
 * all only by construction, not by a caller remembering (CON-PROC-006): the
 * repo's own .preview/, or a folio-preview-* directory directly inside the
 * system temp dir — what mkdtemp hands the consumers. Anything else is
 * refused before anything is touched.
 */
function previewOut(argv) {
  const i = argv.indexOf('--out')
  if (i === -1) return DEFAULT_OUT
  const want = argv[i + 1] ? resolve(argv[i + 1]) : ''
  const tmpOk = dirname(want) === resolve(tmpdir()) && basename(want).startsWith('folio-preview-')
  if (want !== DEFAULT_OUT && !tmpOk) {
    throw new Error(`refusing to build into ${want || '(nothing)'}: --out must be .preview/ or ${join(tmpdir(), 'folio-preview-*')}, because the build deletes it first`)
  }
  return want
}

let OUT
try {
  OUT = previewOut(process.argv.slice(2))
} catch (err) {
  console.error(`preview: ${err.message}`)
  process.exit(2)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(join(OUT, 'src'), { recursive: true })

// 1. public/ assets (content packs, favicon, icons) at the server root
cpSync(join(ROOT, 'public'), OUT, { recursive: true })

// 2. transpile src/**/*.ts → .preview/src/**/*.js
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = join(dir, d.name)
  return d.isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : []
})
for (const file of walk(join(ROOT, 'src'))) {
  // The vite-ism patch is shared with the test loader hook so the two cannot
  // drift — see tools/preview/vite-isms.mjs.
  let code = patchViteIsms(readFileSync(file, 'utf8'), file, '.js')
  code = stripTypeScriptTypes(code, { mode: 'strip' })
  // relative specifiers → explicit browser paths: './x' → './x.js',
  // directory imports './sessions' → './sessions/index.js'. Covers both
  // `from './x'` and bare side-effect `import './x'` forms. Explicit '.ts'
  // extensions (allowed by allowImportingTsExtensions, used by pure modules
  // that must run under plain node) are respelled to the transpiled '.js'.
  const respell = (m, a, spec, z) => {
    if (/\.(js|css|svg|png)$/.test(spec)) return m
    const clean = spec.replace(/\.ts$/, '')
    const abs = resolve(dirname(file), clean)
    return existsSync(join(abs, 'index.ts')) ? `${a}${clean}/index.js${z}` : `${a}${clean}.js${z}`
  }
  code = code.replace(/(from\s+['"])(\.\.?\/[^'"]+)(['"])/g, respell)
  code = code.replace(/(^import\s+['"])(\.\.?\/[^'"]+)(['"])/gm, respell)
  const dest = join(OUT, 'src', relative(join(ROOT, 'src'), file)).replace(/\.ts$/, '.js')
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, code)
}

// 3. stylesheet + patched index.html
cpSync(join(ROOT, 'src/style.css'), join(OUT, 'src/style.css'))
const html = readFileSync(join(ROOT, 'index.html'), 'utf8')
  .replace('<script type="module" src="/src/main.ts"></script>',
    '<link rel="stylesheet" href="/src/style.css" />\n    <script type="module" src="/src/main.js"></script>')
writeFileSync(join(OUT, 'index.html'), html)

console.log(`preview built → ${relative(process.cwd(), OUT)}`)
