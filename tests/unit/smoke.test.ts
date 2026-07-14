import { describe, expect, it } from 'vitest'

describe('harness smoke', () => {
  it('runs in happy-dom', () => {
    const el = document.createElement('div')
    el.textContent = 'folio'
    expect(el.textContent).toBe('folio')
  })
})
