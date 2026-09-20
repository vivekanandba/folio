// The three vite-only constructs in src/, patched so a source file can run
// under plain Node.
//
// Shared deliberately by the offline preview builder AND the test loader hook.
// Two independent copies of this transform would drift, and the moment they
// drift the two readers of the same source disagree — which is exactly the
// boundary defect CON-COV-003 is about. One copy, exercised from both sides.
import { readdirSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * @param {string} code  raw TypeScript source
 * @param {string} file  absolute path of that source (locates the glob siblings)
 * @param {string} ext   extension for expanded sibling imports:
 *                       '.js' for the transpiled preview, '.ts' for Node.
 */
export function patchViteIsms(code, file, ext) {
  code = code.replace(/^import\s+'\.\/style\.css'\s*$/m, '// style.css loaded via <link>')
  code = code.replace(/import\.meta\.env\.BASE_URL/g, "'/'")
  // vite-only: import.meta.glob('./*.ts', { eager: true }) → static side-effect imports
  code = code.replace(/import\.meta\.glob\(\s*'\.\/\*\.ts'[^)]*\)/g, () => {
    const siblings = readdirSync(dirname(file))
      .filter((n) => n.endsWith('.ts') && n !== 'index.ts')
      .map((n) => `import './${n.replace(/\.ts$/, ext)}'`)
    return `void 0\n${siblings.join('\n')}`
  })
  return code
}
