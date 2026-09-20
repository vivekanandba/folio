// Let `node:test` import the app's own source files.
//
// src/ is written for vite: specifiers are extensionless ('./dom'), and three
// vite-only constructs appear (style.css import, import.meta.env.BASE_URL,
// import.meta.glob). Node resolves none of that, which is why every renderer
// and page was invisible to the test runner — and therefore to coverage.
//
// These hooks close that gap without touching src/: resolve extensionless
// specifiers to .ts, and load .ts sources through the SAME vite-ism patch the
// preview builder uses. The file URL is preserved, so V8 attributes coverage
// to the real src/*.ts file, and `strip` mode keeps line numbers intact so the
// line numbers in the coverage report mean what they say.
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { patchViteIsms } from '../../tools/preview/vite-isms.mjs'

let installed = false

export function installModuleHooks() {
  if (installed) return
  installed = true
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith('.') && !/\.(ts|js|mjs|cjs|css|json|svg|png)$/.test(specifier)) {
        const parent = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd()
        const abs = resolvePath(parent, specifier)
        const candidate = existsSync(`${abs}.ts`)
          ? `${abs}.ts`
          : existsSync(join(abs, 'index.ts'))
            ? join(abs, 'index.ts')
            : null
        if (candidate) return { url: pathToFileURL(candidate).href, shortCircuit: true }
      }
      return nextResolve(specifier, context)
    },
    load(url, context, nextLoad) {
      if (url.endsWith('.ts') && url.includes('/src/')) {
        const file = fileURLToPath(url)
        const patched = patchViteIsms(readFileSync(file, 'utf8'), file, '.ts')
        return {
          format: 'module',
          source: stripTypeScriptTypes(patched, { mode: 'strip' }),
          shortCircuit: true,
        }
      }
      return nextLoad(url, context)
    },
  })
}
