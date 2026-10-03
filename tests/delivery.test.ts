// The delivery path: the scripts that build and check what ships, the
// contract the app fetches at runtime, and the hygiene of the repo's own
// records.
//
// Application coverage says nothing about whether software ships (CON-COV-001).
// folio's unit suite reached 86% while the linter's refusal had never been
// exercised, the preview builder's output was never inspected by anything but
// a browser, and two spec files sat truncated to zero bytes in main. This file
// tests the layer that moves content from the repo to a reader.

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createReadStream, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)
const ROOT = new URL('..', import.meta.url).pathname
const CONTENT = join(ROOT, 'public/content')

const run = async (args: string[]) => {
  try {
    const { stdout } = await execFileP(process.execPath, ['--experimental-strip-types', ...args], {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    })
    return { code: 0, out: stdout }
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string }
    return { code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

/* ------------------------------------------------------- the linter gate --- */

test('the linter passes the real content', async () => {
  const { code, out } = await run([join(ROOT, 'tools/lint/cli.ts')])
  assert.equal(code, 0, `linter should pass shipped content:\n${out}`)
  assert.match(out, /Content OK/)
})

test('the linter REFUSES malformed content, with a message naming the file', async () => {
  // A gate only ever run against good input has never been watched fail.
  const dir = mkdtempSync(join(tmpdir(), 'folio-lint-'))
  try {
    const pack = join(dir, 'packs/broken')
    mkdirSync(join(pack, 'sessions'), { recursive: true })
    mkdirSync(join(pack, 'concepts'), { recursive: true })
    writeFileSync(join(dir, 'catalog.json'), JSON.stringify({ packs: [{ id: 'broken', path: 'packs/broken' }] }))
    writeFileSync(join(pack, 'folio.json'), JSON.stringify({
      id: 'broken', title: 'Broken', concepts: ['ghost'], sessions: ['01-bad.json'],
    }))
    // Two deliberate defects: a concept with no file, and a quiz whose
    // answerIndex points past the end of its choices.
    writeFileSync(join(pack, 'sessions/01-bad.json'), JSON.stringify({
      id: 'bad', kind: 'quiz', title: 'Bad', conceptIds: [],
      questions: [{ prompt: 'q', choices: ['a', 'b'], answerIndex: 9 }],
    }))
    const { code, out } = await run([join(ROOT, 'tools/lint/cli.ts'), '--content', dir])
    assert.equal(code, 1, `linter must exit 1 on malformed content:\n${out}`)
    assert.match(out, /ghost/, 'the missing concept should be named')
    assert.match(out, /answerIndex/, 'the out-of-range answer should be named')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

/* ---------------------------------------------------- the preview builder --- */

test('the preview build emits runnable JS with every vite-ism patched', async () => {
  const { code, out } = await run([join(ROOT, 'tools/preview/build.mjs')])
  assert.equal(code, 0, `preview build should succeed:\n${out}`)

  const srcDir = join(ROOT, '.preview/src')
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (full.endsWith('.js')) files.push(full)
    }
  }
  walk(srcDir)
  assert.ok(files.length >= 40, `expected the whole module graph, got ${files.length}`)

  for (const file of files) {
    const code_ = readFileSync(file, 'utf8')
    const rel = file.slice(srcDir.length + 1)
    // The three vite-isms must all be gone, or the module graph dies in the
    // browser and every page renders blank — a bug class folio has shipped.
    assert.ok(!code_.includes('import.meta.env'), `${rel}: import.meta.env survived`)
    assert.ok(!code_.includes('import.meta.glob'), `${rel}: import.meta.glob survived`)
    assert.ok(!/^import\s+'\.\/style\.css'/m.test(code_), `${rel}: css import survived`)
    // Extensionless relative specifiers are the respell bug that 404'd routes.
    const bad = [...code_.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)]
      .map((m) => m[1])
      .filter((spec) => !/\.(js|css|svg|png|json)$/.test(spec))
    assert.deepEqual(bad, [], `${rel}: unrespelled specifiers ${bad.join(', ')}`)
  }
})

test('every emitted preview module actually parses', async () => {
  // Type-stripping can emit something syntactically broken; the browser finds
  // out at runtime, which is exactly when nobody is watching.
  const srcDir = join(ROOT, '.preview/src')
  const files: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else if (full.endsWith('.js')) files.push(full)
    }
  }
  walk(srcDir)
  const failures: string[] = []
  for (const file of files) {
    const res = await execFileP(process.execPath, ['--check', file]).then(
      () => null,
      (err: { stderr?: string }) => `${file.slice(srcDir.length + 1)}: ${(err.stderr ?? '').split('\n')[1] ?? 'syntax error'}`,
    )
    if (res) failures.push(res)
  }
  assert.deepEqual(failures, [], `modules failed to parse:\n${failures.join('\n')}`)
})

/* ------------------------------------------------ external dependencies --- */

test('the app reaches only the external origins we have accepted', () => {
  // NOT "no external URLs" — that would be a lie. style.css imports Google
  // Fonts at runtime, which is a real availability and privacy dependency and
  // the reason the offline experience falls back to system fonts. The gate is
  // that the SET does not grow without someone deciding it should.
  const ACCEPTED = new Set(['https://fonts.googleapis.com', 'https://fonts.gstatic.com'])
  const sources = ['index.html', 'src/style.css', 'public/sw.js', 'public/manifest.webmanifest']
  const found = new Set<string>()
  for (const rel of sources) {
    const text = readFileSync(join(ROOT, rel), 'utf8')
    for (const m of text.matchAll(/https?:\/\/[^\s"')]+/g)) {
      // data: URIs and SVG namespaces are not network dependencies.
      if (m[0].includes('www.w3.org')) continue
      found.add(new URL(m[0]).origin)
    }
  }
  const unexpected = [...found].filter((o) => !ACCEPTED.has(o))
  assert.deepEqual(unexpected, [], `new external origin(s): ${unexpected.join(', ')} — add deliberately or remove`)
})

test('the service worker leaves cross-origin requests alone', () => {
  // Caching Google Fonts would quietly make the SW responsible for a third
  // party's availability. It declines on purpose; assert the decline.
  const sw = readFileSync(join(ROOT, 'public/sw.js'), 'utf8')
  assert.match(sw, /self\.addEventListener\(\s*'fetch'/, 'the SW must handle fetch (installability requires it)')
  assert.match(sw, /url\.origin\s*!==\s*self\.location\.origin/, 'cross-origin requests must be skipped')
  assert.match(sw, /VERSION\s*=/, 'the cache name must be versioned so activate can drop old ones')
})

/* ------------------------------------------- the contract, served as HTTP --- */

test('every pack loads over HTTP exactly as the app asks for it', async () => {
  // Linting the disk proves the files are correct. It does not prove they are
  // REACHABLE: a case-mismatched filename or a pack directory missing from the
  // deployed output lints clean and 404s in a browser. Assert from the reader's
  // side (CON-COV-003).
  const MIME: Record<string, string> = {
    '.json': 'application/json', '.md': 'text/markdown', '.html': 'text/html',
  }
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    const file = join(ROOT, 'public', path)
    if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end('no'); return }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((r) => server.listen(8139, '127.0.0.1', () => r()))
  try {
    const base = 'http://127.0.0.1:8139/content'
    const catalog = await (await fetch(`${base}/catalog.json`)).json() as { packs: { id: string; path: string }[] }
    assert.ok(catalog.packs.length >= 13, 'the catalog should serve every pack')

    let concepts = 0
    let sessions = 0
    for (const ref of catalog.packs) {
      const metaRes = await fetch(`${base}/${ref.path}/folio.json`)
      assert.ok(metaRes.ok, `${ref.id}: folio.json is not reachable (${metaRes.status})`)
      const meta = await metaRes.json() as { concepts: string[]; sessions: string[] }

      for (const slug of meta.concepts) {
        const res = await fetch(`${base}/${ref.path}/concepts/${slug}.md`)
        assert.ok(res.ok, `${ref.id}/${slug}.md unreachable (${res.status})`)
        const body = await res.text()
        assert.ok(body.trim().length > 0, `${ref.id}/${slug}.md served empty`)
        concepts += 1
      }
      for (const file of meta.sessions) {
        const res = await fetch(`${base}/${ref.path}/sessions/${file}`)
        assert.ok(res.ok, `${ref.id}/${file} unreachable (${res.status})`)
        const data = await res.json() as { kind?: string; id?: string }
        assert.ok(data.kind && data.id, `${ref.id}/${file} served without kind/id`)
        sessions += 1
      }
    }
    assert.ok(concepts >= 60 && sessions >= 170, `served ${concepts} concepts / ${sessions} sessions`)
  } finally {
    server.close()
  }
})

/* --------------------------------------------------------- repo records --- */

test('no spec file is empty, and each has a title', () => {
  // This is the gate that was missing: specs/010 and specs/013 tasks.md sat at
  // zero bytes in main through three PRs because nothing asserted otherwise.
  const specsDir = join(ROOT, 'specs')
  const offenders: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) { walk(full); continue }
      if (!entry.endsWith('.md')) continue
      const text = readFileSync(full, 'utf8')
      const rel = full.slice(specsDir.length + 1)
      if (!text.trim()) offenders.push(`${rel}: empty`)
      else if (!/^#\s+\S/m.test(text)) offenders.push(`${rel}: no '# ' title`)
    }
  }
  walk(specsDir)
  assert.deepEqual(offenders, [], `spec files in a bad state:\n${offenders.join('\n')}`)
})

test('a feature spec is either not started, or fully furnished', () => {
  // Not "every directory has all three": spec 001 is deliberately spec-only,
  // drafted and then blocked on source notes that do not exist yet. Writing
  // the spec and stopping is the correct state for blocked work.
  //
  // The defect worth catching is the HALF-furnished directory — a plan with no
  // tasks, or tasks with no plan — which means someone started and dropped it.
  const specsDir = join(ROOT, 'specs')
  const problems: string[] = []
  for (const entry of readdirSync(specsDir)) {
    if (!/^\d{3}-/.test(entry)) continue
    const has = (f: string) => existsSync(join(specsDir, entry, f))
    if (!has('spec.md')) problems.push(`${entry}: no spec.md`)
    if (has('plan.md') !== has('tasks.md')) {
      problems.push(`${entry}: has ${has('plan.md') ? 'plan' : 'tasks'} but not the other`)
    }
  }
  assert.deepEqual(problems, [], `feature specs in a half-state:\n${problems.join('\n')}`)
})
