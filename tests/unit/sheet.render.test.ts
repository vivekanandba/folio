import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SheetDoc } from '../../src/types'
import { renderSheet } from '../../src/pages/sheet'

describe('sheet — Phase 3', () => {
  it('renders Jul 2026 sheet blocks with session links', () => {
    const raw = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          'public/content/packs/finance-mfi-2026-07/sheet.json',
        ),
        'utf8',
      ),
    ) as SheetDoc
    const node = renderSheet(raw, 'finance-mfi-2026-07')
    expect(node.textContent).toContain('The freedom you paid for')
    expect(node.querySelectorAll('a[href*="session"]').length).toBeGreaterThan(0)
  })
})
