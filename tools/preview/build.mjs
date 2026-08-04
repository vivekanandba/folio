#!/usr/bin/env node
// Offline preview build — no vite, no node_modules. Strips TypeScript types
// with Node 22's built-in transform, rewrites import specifiers to browser
// module paths, patches the two vite-isms (style.css import, BASE_URL), and
// assembles a static .preview/ dir servable with `python3 -m http.server`.
//
//   node --experimental-strip-types tools/preview/build.mjs
//   python3 -m http.server 8077 -d .preview
//
// This is a LAYOUT/BEHAVIOUR preview, not the production build: no minify,
// no bundling, no font downloads (offline box falls back to system fonts).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'

const ROOT = new URL('../..', import.meta.url).pathname
const OUT = join(ROOT, '.preview')

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
  let code = readFileSync(file, 'utf8')
  code = code.replace(/^import\s+'\.\/style\.css'\s*$/m, '// style.css loaded via <link>')
  code = code.replace(/import\.meta\.env\.BASE_URL/g, "'/'")
  // vite-only: import.meta.glob('./*.ts', { eager: true }) → static side-effect imports
  code = code.replace(/import\.meta\.glob\(\s*'\.\/\*\.ts'[^)]*\)/g, () => {
    const siblings = readdirSync(dirname(file))
      .filter((n) => n.endsWith('.ts') && n !== 'index.ts')
      .map((n) => `import './${n.replace(/\.ts$/, '.js')}'`)
    return `void 0\n${siblings.join('\n')}`
  })
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
