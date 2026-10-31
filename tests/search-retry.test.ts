// A failed index build must not be remembered as the answer.
//
// buildIndex() memoises its promise so the catalog is walked once. It used to
// memoise a REJECTED promise too, which made one transient fetch failure
// permanent: every later Ctrl-K awaited the same dead promise, so the palette
// opened on a blank list with no message, for the rest of the session, with
// nothing short of a reload to clear it.
//
// Its own file because the memo lives for the life of the process — a suite
// that has already built the index successfully cannot make the first build
// fail (CON-VER-008: a test whose outcome depends on what ran before it is a
// defect in the suite, so it does not get to depend on that).

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
installDomStub()

const PUBLIC = new URL('../public/', import.meta.url).pathname
let failing = true

globalThis.fetch = (async (input: string | URL) => {
  if (failing) throw new Error('offline')
  const path = String(input).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').split('?')[0]
  try {
    const body = readFileSync(join(PUBLIC, path), 'utf8')
    return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body } as Response
  } catch {
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' } as Response
  }
}) as typeof fetch

const { buildIndex } = await import('../src/search.ts')

test('a failed index build is not cached, so the next attempt can succeed', async () => {
  // First build, with the network down.
  await assert.rejects(buildIndex(), 'a build that cannot fetch rejects rather than resolving empty')

  // The network comes back. THIS is the assertion that matters: before the
  // fix, the rejected promise was still in the memo and this rejected too.
  failing = false
  const docs = await buildIndex()
  assert.ok(docs.length > 0, 'a retry after the failure builds a real index')

  // And the success IS memoised — the same array, not a second walk.
  assert.equal(await buildIndex(), docs, 'a successful build is built once and reused')
})
