// What the palette shows when the index cannot be built.
//
// Its own file, and not appended to search-retry.test.ts, because
// buildIndex() memoises its promise for the life of the process: once any
// test in a file has built the index successfully, no later test in that
// file can make a palette see a failure. Appending it there made it fail for
// exactly that reason — the palette resolved from the memo and never reached
// the branch under test. A test whose outcome depends on what ran before it
// is a defect in the suite (CON-VER-008), so it gets a process of its own.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { installDomStub } from './support/dom-stub.ts'
import { installModuleHooks } from './support/module-hooks.mjs'

installModuleHooks()
const { document } = installDomStub()

// Nothing is reachable: every build fails.
globalThis.fetch = (async () => {
  throw new Error('offline')
}) as typeof fetch

const { initPalette } = await import('../src/palette.ts')

type El = {
  textContent: string
  value: string
  querySelector: (s: string) => El | null
  dispatchEvent: (e: unknown) => void
}

test('a palette opened on a failed index says so, and keeps saying so as you type', async () => {
  const palette = initPalette()
  const dialogs = document.querySelectorAll('.cmdk')
  const dialog = dialogs[dialogs.length - 1] as unknown as El

  await palette.open()

  const list = dialog.querySelector('.cmdk-list')!
  assert.match(
    list.textContent,
    /could not be loaded/,
    'a palette whose index failed explains itself instead of showing an empty list',
  )

  // THE POINT. The input listener is still live while that message is on
  // screen, and render() used to replace it with "No matches" on the first
  // keystroke — landing the reader in the blank-looking list the message
  // exists to prevent.
  const input = dialog.querySelector('.cmdk-input')!
  input.value = 'a'
  input.dispatchEvent({ type: 'input', target: input })
  await new Promise((r) => setTimeout(r, 20))

  assert.match(list.textContent, /could not be loaded/, 'and typing does not erase it')
  assert.doesNotMatch(list.textContent, /No matches/, 'it is not downgraded to "No matches"')
})
