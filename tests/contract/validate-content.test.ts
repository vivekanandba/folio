import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { validatePackDir, validateAllPacks } from '../../scripts/validate-content'

describe('content contract', () => {
  it('session id must match filename stem (real pack)', () => {
    const pack = join(process.cwd(), 'public/content/packs/finance-mfi-2026-07')
    const issues = validatePackDir(pack)
    const idMismatches = issues.filter((i) =>
      i.message.includes('must match filename'),
    )
    expect(idMismatches).toEqual([])
  })

  it('MFI pack validates green', () => {
    const issues = validateAllPacks(join(process.cwd(), 'public/content'))
    const errors = issues.filter((i) => i.level === 'error')
    expect(errors).toEqual([])
  })

  it('rejects session whose id mismatches filename', () => {
    const fixture = join(process.cwd(), 'tests/fixtures/bad-id-pack')
    const issues = validatePackDir(fixture)
    expect(issues.some((i) => i.message.includes('must match filename'))).toBe(
      true,
    )
  })
})
