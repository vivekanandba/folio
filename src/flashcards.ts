import { loadConcept, loadSession } from './content'
import type { Flashcard, QuizSession } from './types'

const MAX_BACK = 280

function stripInline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function clip(s: string): string {
  return s.length > MAX_BACK ? s.slice(0, MAX_BACK - 1).trimEnd() + '…' : s
}

/** Turn a concept's markdown note into recall cards: the "big idea" blockquote + each ## section. */
export function cardsFromNotes(md: string, packId: string, conceptId: string): Flashcard[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const cards: Flashcard[] = []

  const h1 = lines.find((l) => /^# /.test(l))
  const title = h1 ? stripInline(h1.slice(2)) : conceptId

  const bq = lines.find((l) => l.startsWith('> '))
  if (bq) {
    cards.push({
      id: `${conceptId}::idea`,
      packId,
      conceptId,
      front: `Recall the core idea — ${title}`,
      back: clip(stripInline(bq.slice(2))),
      origin: 'note',
    })
  }

  let i = 0
  while (i < lines.length) {
    const m = /^## (.+)/.exec(lines[i])
    if (!m) {
      i += 1
      continue
    }
    const heading = stripInline(m[1])
    const body: string[] = []
    i += 1
    while (i < lines.length && !/^#/.test(lines[i])) {
      const raw = lines[i].trim()
      if (raw) {
        if (raw.startsWith('|')) {
          if (!/^\|[-| ]+\|$/.test(raw)) {
            body.push(raw.split('|').slice(1, -1).map((c) => stripInline(c.trim())).join(' — '))
          }
        } else if (/^[-*] /.test(raw)) {
          body.push('• ' + stripInline(raw.slice(2)))
        } else {
          body.push(stripInline(raw))
        }
      }
      i += 1
    }
    const back = body.join(' ')
    if (back && heading.toLowerCase() !== 'remember') {
      cards.push({
        id: `${conceptId}::${heading}`,
        packId,
        conceptId,
        front: `${title} — ${heading}`,
        back: clip(back),
        origin: 'note',
      })
    }
  }
  return cards
}

/** Every quiz question becomes a card: prompt → correct answer + explanation. */
export function cardsFromQuiz(session: QuizSession, packId: string, conceptId: string): Flashcard[] {
  return session.questions.map((q, i) => ({
    id: `${session.id}::q${i}`,
    packId,
    conceptId,
    front: q.prompt,
    back: clip(`${q.choices[q.answerIndex]} — ${q.explanation}`),
    origin: 'quiz' as const,
  }))
}

/** Assemble every derivable card for one concept. Ephemeral — grades roll up to the concept. */
export async function deriveFlashcards(
  packPath: string,
  packId: string,
  conceptId: string,
  sessionFiles: string[],
): Promise<Flashcard[]> {
  const cards: Flashcard[] = []
  try {
    cards.push(...cardsFromNotes(await loadConcept(packPath, conceptId), packId, conceptId))
  } catch {
    // concept note missing — fall back to quiz-only cards
  }
  const sessions = await Promise.all(
    sessionFiles.map((f) => loadSession(packPath, f).catch(() => null)),
  )
  for (const s of sessions) {
    if (s && s.kind === 'quiz' && s.conceptIds.includes(conceptId)) {
      cards.push(...cardsFromQuiz(s, packId, conceptId))
    }
  }
  return cards
}
