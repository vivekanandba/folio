import { describe, expect, it } from 'vitest'
import { parseConceptMarkdown } from '../../src/content'
import { nextIncompleteSession } from '../../src/progress'

describe('pack curriculum — specs/PACK_UI.md', () => {
  it('scenario-concept-titles from frontmatter', () => {
    const c = parseConceptMarkdown(
      'flexi-cap-vs-multi-cap',
      `---
title: Flexi-cap vs multi-cap
summary: Labels sell a promise.
relatedSessions: [label-detective]
---

Body here.
`,
    )
    expect(c.title).toBe('Flexi-cap vs multi-cap')
    expect(c.summary).toContain('Labels')
  })

  it('scenario-continue picks first incomplete', () => {
    localStorage.clear()
    expect(nextIncompleteSession('p', ['label-detective', 'sebi-fork'])).toBe(
      'label-detective',
    )
  })
})
