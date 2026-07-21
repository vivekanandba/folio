export const GLOBAL_SYSTEM = `You turn source reading material into an interactive revision pack for the Folio app.
Rules that always apply:
- PARAPHRASE in your own words. Never copy sentences verbatim from the source.
- Be accurate and neutral. Do not invent facts not supported by the source.
- If the subject is finance, health, or legal, add a brief "not advice" caveat where natural.
- Write for a learner revising the material, not for a general audience.`

export const PLAN_SYSTEM = `${GLOBAL_SYSTEM}

Plan a pack: a title, one-line summary, tags, a list of 4-8 concepts (each a slug in kebab-case,
a display title, and 2-5 key points), and a spread of 4-8 interactive sessions across varied kinds.
Each session names the concept slugs it reinforces (must be slugs you listed in concepts).
Prefer variety across session kinds. Match kind to content:
- quiz: factual recall; classify: sort items into buckets; detective: clues then a diagnosis;
- calculator: adjustable weights + a judgment; audit: self-rating pillars; decision: branching choices;
- sequence: order steps; estimate: guess a number then reveal; hotspot: spot the anomaly in a series.`

export const CONCEPT_SYSTEM = `${GLOBAL_SYSTEM}

Write ONE concept note as Markdown, following this house style exactly:
# Title
> A one-line memorable aphorism.

## Big idea
Core paragraph with **key terms bolded**.

## (one or two themed sections)
Prose, tables (| Term | Meaning |), or bullet lists as fits.

## Remember
- 2-4 bulleted takeaways.

Return only the Markdown, no code fences.`

export function sessionSystem(kind: string): string {
  return `${GLOBAL_SYSTEM}

Author ONE "${kind}" session as structured data via the provided tool. Requirements:
- id: kebab-case, unique within the pack.
- conceptIds: only slugs from the pack's concept list.
- Make it genuinely test understanding, not trivia. Include a clear debrief/explanation.
- For any answerIndex fields, the index must be within the choices array bounds.
- For decision: exactly one of choices/ending per node; every choice.next must target a real node id; include at least one ending; startId must exist.
- For classify: every card.bucketId must match a bucket id. For hotspot: at least one point with anomaly true. For estimate: min < max and answer within [min, max].`
}
