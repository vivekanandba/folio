import { readFileSync } from 'node:fs'

/** Read source material from a file path, a URL, or '-' for stdin. */
export async function ingest(source: string): Promise<string> {
  if (source === '-') return readFileSync(0, 'utf8') // stdin
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source)
    if (!res.ok) throw new Error(`Failed to fetch ${source}: ${res.status}`)
    const html = await res.text()
    // crude tag strip — good enough for article text
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return readFileSync(source, 'utf8')
}
