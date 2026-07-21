/** Minimal markdown → HTML for concept pages. Supports headings, ordered/unordered
 * lists, tables, bold, inline code, links, blockquotes, fenced code, callouts,
 * collapsible "go deeper" blocks, and an inline interactive-figure passthrough
 * (```viz fences → a .viz-slot the page mounts). Escape-first, no HTML executed. */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function safeHref(url: string): string | null {
  const u = url.trim()
  if (/^(javascript|data|vbscript):/i.test(u)) return null
  if (/^https?:\/\//i.test(u) || u.startsWith('/') || u.startsWith('#') || u.startsWith('mailto:')) return u
  if (!u.includes(':')) return u // relative path
  return null
}

/** Inline formatting for a single line of text (links, bold, inline code). */
function inline(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text: string, url: string) => {
      const href = safeHref(url)
      if (!href) return m
      const safe = href.replace(/"/g, '%22').replace(/'/g, '%27')
      return `<a href="${safe}" rel="noopener">${text}</a>`
    })
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic: require a non-space right after the opening `*` so spaced `a * b`
    // multiplication is left alone while `*word*` still italicises.
    .replace(/\*(\S[^*]*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

const CALLOUTS: Record<string, { cls: string; label: string }> = {
  note: { cls: 'note', label: 'Note' },
  tip: { cls: 'tip', label: 'Tip' },
  warn: { cls: 'warn', label: 'Watch out' },
  key: { cls: 'key', label: 'Key idea' },
}

function renderBlocks(lines: string[]): string {
  const html: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let i = 0

  const closeList = () => {
    if (listType) {
      html.push(listType === 'ul' ? '</ul>' : '</ol>')
      listType = null
    }
  }

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code / ```viz interactive-figure passthrough
    const fence = /^```(\w+)?\s*$/.exec(line)
    if (fence) {
      closeList()
      const lang = fence[1] ?? ''
      const body: string[] = []
      i += 1
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i])
        i += 1
      }
      i += 1 // skip closing fence
      const content = body.join('\n')
      if (lang === 'viz') {
        html.push(`<div class="viz-slot" data-viz="${escapeHtml(content)}"></div>`)
      } else {
        html.push(`<pre class="code"><code>${escapeHtml(content)}</code></pre>`)
      }
      continue
    }

    // Callout / collapsible: "> [!type] ..." with following "> " body lines
    const co = /^>\s*\[!(\w+)\]\s*(.*)$/.exec(line)
    if (co) {
      closeList()
      const type = co[1].toLowerCase()
      const first = co[2]
      const bodyLines: string[] = []
      i += 1
      while (i < lines.length && /^>\s?/.test(lines[i]) && !/^>\s*\[!/.test(lines[i])) {
        bodyLines.push(lines[i].replace(/^>\s?/, ''))
        i += 1
      }
      if (type === 'more' || type === 'details') {
        const summary = first.trim() || 'Go deeper'
        html.push(
          `<details class="deeper"><summary>${inline(summary)}</summary>${renderBlocks(bodyLines)}</details>`,
        )
      } else {
        const c = CALLOUTS[type] ?? CALLOUTS.note
        const inner = renderBlocks(first ? [first, ...bodyLines] : bodyLines)
        html.push(`<aside class="callout callout-${c.cls}"><p class="callout-label">${c.label}</p>${inner}</aside>`)
      }
      continue
    }

    // Plain blockquote
    if (/^> /.test(line)) {
      closeList()
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`)
      i += 1
      continue
    }

    // Headings
    if (/^### /.test(line)) {
      closeList()
      html.push(`<h3>${inline(line.slice(4))}</h3>`)
      i += 1
      continue
    }
    if (/^## /.test(line)) {
      closeList()
      html.push(`<h2>${inline(line.slice(3))}</h2>`)
      i += 1
      continue
    }
    if (/^# /.test(line)) {
      closeList()
      html.push(`<h1>${inline(line.slice(2))}</h1>`)
      i += 1
      continue
    }

    // Ordered list
    const ol = /^\d+\.\s+(.*)$/.exec(line)
    if (ol) {
      if (listType !== 'ol') {
        closeList()
        html.push('<ol>')
        listType = 'ol'
      }
      html.push(`<li>${inline(ol[1])}</li>`)
      i += 1
      continue
    }

    // Unordered list
    if (/^[-*] /.test(line)) {
      if (listType !== 'ul') {
        closeList()
        html.push('<ul>')
        listType = 'ul'
      }
      html.push(`<li>${inline(line.slice(2))}</li>`)
      i += 1
      continue
    }

    // Table row
    if (/^\|/.test(line)) {
      closeList()
      if (!/^\|[-| ]+\|$/.test(line)) {
        const cells = line
          .split('|')
          .slice(1, -1)
          .map((c) => `<td>${inline(c.trim())}</td>`)
          .join('')
        html.push(`<tr>${cells}</tr>`)
      }
      i += 1
      continue
    }

    // Blank line
    if (line.trim() === '') {
      closeList()
      i += 1
      continue
    }

    // Paragraph
    closeList()
    html.push(`<p>${inline(line)}</p>`)
    i += 1
  }
  closeList()
  return html.join('\n')
}

export function renderMarkdown(md: string): string {
  const body = renderBlocks(md.replace(/\r\n/g, '\n').split('\n'))
  // Wrap consecutive <tr> rows in a <table> (done once at the top level).
  return body.replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, (block) => `<table>${block}</table>`)
}
