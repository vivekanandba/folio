/** Minimal markdown → HTML for concept cards (headings, lists, bold, paragraphs). */
export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inList = false

  const flushList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  const safeHref = (url: string): string | null => {
    const u = url.trim()
    if (/^(javascript|data|vbscript):/i.test(u)) return null
    if (/^https?:\/\//i.test(u) || u.startsWith('/') || u.startsWith('#') || u.startsWith('mailto:')) return u
    if (!u.includes(':')) return u // relative path
    return null
  }

  const inline = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text: string, url: string) => {
        const href = safeHref(url)
        if (!href) return m
        // Escape quotes so a URL can't break out of the href="" attribute.
        const safe = href.replace(/"/g, '%22').replace(/'/g, '%27')
        return `<a href="${safe}" rel="noopener">${text}</a>`
      })
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')

  for (const line of lines) {
    if (/^### /.test(line)) {
      flushList()
      html.push(`<h3>${inline(line.slice(4))}</h3>`)
    } else if (/^## /.test(line)) {
      flushList()
      html.push(`<h2>${inline(line.slice(3))}</h2>`)
    } else if (/^# /.test(line)) {
      flushList()
      html.push(`<h1>${inline(line.slice(2))}</h1>`)
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inline(line.slice(2))}</li>`)
    } else if (/^\|/.test(line)) {
      flushList()
      // skip simple tables as preformatted rows
      if (!/^\|[-| ]+\|$/.test(line)) {
        const cells = line
          .split('|')
          .slice(1, -1)
          .map((c) => `<td>${inline(c.trim())}</td>`)
          .join('')
        html.push(`<tr>${cells}</tr>`)
      }
    } else if (line.trim() === '') {
      flushList()
    } else if (line.startsWith('> ')) {
      flushList()
      html.push(`<blockquote>${inline(line.slice(2))}</blockquote>`)
    } else {
      flushList()
      html.push(`<p>${inline(line)}</p>`)
    }
  }
  flushList()

  // Wrap consecutive <tr> in table
  return html
    .join('\n')
    .replace(/(<tr>[\s\S]*?<\/tr>\n?)+/g, (block) => `<table>${block}</table>`)
}
