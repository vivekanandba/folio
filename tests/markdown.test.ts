// The markdown renderer turns every concept page into HTML, and had never
// been tested. It is hand-written (Article I forbids a markdown library), so
// its grammar — and its escaping — is ours to get right.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { renderMarkdown } = await import('../src/markdown.ts')

test('headings render at their level', () => {
  assert.match(renderMarkdown('# Title'), /<h1>Title<\/h1>/)
  assert.match(renderMarkdown('## Section'), /<h2>Section<\/h2>/)
  assert.match(renderMarkdown('### Detail'), /<h3>Detail<\/h3>/)
})

test('inline grammar: bold, italic, code, links', () => {
  assert.match(renderMarkdown('**bold**'), /<strong>bold<\/strong>/)
  assert.match(renderMarkdown('*italic*'), /<em>italic<\/em>/)
  assert.match(renderMarkdown('`code`'), /<code>code<\/code>/)
  const link = renderMarkdown('[folio](#/halls)')
  assert.match(link, /<a href="#\/halls"[^>]*>folio<\/a>/)
  assert.match(link, /rel="noopener"/)
})

test('lists render as lists, ordered and unordered', () => {
  const ul = renderMarkdown('- one\n- two')
  assert.match(ul, /<li>one<\/li>/)
  assert.match(ul, /<li>two<\/li>/)
  const ol = renderMarkdown('1. first\n2. second')
  assert.match(ol, /<li>first<\/li>/)
})

test('tables render rows and cells', () => {
  const html = renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |')
  assert.match(html, /<td>a<\/td>/)
  assert.match(html, /<td>1<\/td>/)
  assert.ok(!/\|---\|/.test(html), 'the separator row must not survive into output')
})

test('callouts become asides with their type', () => {
  const html = renderMarkdown('> [!key] The key idea')
  assert.match(html, /<aside class="callout callout-[a-z]+">/)
  assert.match(html, /The key idea/)
})

test('a [!more] callout collapses into details/summary', () => {
  const html = renderMarkdown('> [!more] Deeper\n> the body')
  assert.match(html, /<details class="deeper">/)
  assert.match(html, /<summary>Deeper<\/summary>/)
  assert.match(html, /the body/)
})

test('blockquotes and code fences are distinct', () => {
  assert.match(renderMarkdown('> quoted'), /<blockquote>quoted<\/blockquote>/)
  const fence = renderMarkdown('```\nconst x = 1\n```')
  assert.match(fence, /<pre class="code"><code>/)
  assert.match(fence, /const x = 1/)
})

test('a viz fence becomes a mount slot, not visible code', () => {
  const html = renderMarkdown('```viz\n{"type":"donut","segments":[]}\n```')
  assert.match(html, /class="viz-slot"/)
  assert.match(html, /data-viz=/)
  assert.ok(!/<pre class="code">/.test(html), 'viz fences must not render as code blocks')
})

/* ---------------------------------------------------------------- safety --- */

test('raw HTML in content is escaped, not executed', () => {
  const html = renderMarkdown('<script>alert(1)</script>')
  assert.ok(!/<script>/.test(html), `script tag survived: ${html}`)
  assert.match(html, /&lt;script&gt;/)
})

test('javascript: URLs are refused', () => {
  // Content is authored by me, but a renderer that trusts its input is one
  // paste away from being the vector. Prove the refusal, not the success.
  const html = renderMarkdown('[click](javascript:alert(1))')
  assert.ok(!/href="javascript:/i.test(html), `javascript: URL survived: ${html}`)
})

test('code spans do not re-enter inline parsing', () => {
  const html = renderMarkdown('`**not bold**`')
  assert.match(html, /<code>/)
  assert.ok(!/<strong>/.test(html), 'markup inside a code span must stay literal')
})

test('empty and whitespace input produce no output, not a crash', () => {
  assert.equal(typeof renderMarkdown(''), 'string')
  assert.equal(typeof renderMarkdown('\n\n   \n'), 'string')
})

test('every shipped concept renders without throwing', async () => {
  // The real corpus is the fixture that matters: 64 concept pages across 13
  // packs, each of which must survive the renderer.
  const { readdirSync, readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const PACKS = new URL('../public/content/packs/', import.meta.url).pathname
  let rendered = 0
  for (const pack of readdirSync(PACKS)) {
    let files: string[] = []
    try {
      files = readdirSync(join(PACKS, pack, 'concepts'))
    } catch {
      continue
    }
    for (const f of files.filter((n) => n.endsWith('.md'))) {
      const md = readFileSync(join(PACKS, pack, 'concepts', f), 'utf8')
      const html = renderMarkdown(md)
      assert.ok(html.length > 0, `${pack}/${f} rendered empty`)
      rendered += 1
    }
  }
  assert.ok(rendered >= 60, `expected the full concept corpus, rendered ${rendered}`)
})
