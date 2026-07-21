// Constrained JSON-Schema projections for strict tool use. Structured outputs reject
// numeric/length constraints, so ranges (answerIndex bounds, min<max, etc.) are NOT here —
// they are enforced afterward by tools/lint/referential.ts. Every object sets
// additionalProperties:false and lists required, as strict mode demands.

/* eslint-disable @typescript-eslint/no-explicit-any */
type JsonSchema = Record<string, any>

const str = { type: 'string' }
const strArr = { type: 'array', items: { type: 'string' } }

function obj(properties: Record<string, JsonSchema>, required: string[]): JsonSchema {
  return { type: 'object', additionalProperties: false, properties, required }
}

// --- Stage 1: pack plan ---------------------------------------------------
export const PLAN_SCHEMA = obj(
  {
    title: str,
    subject: str,
    type: { type: 'string', enum: ['magazine', 'course', 'book', 'notes'] },
    summary: str,
    tags: strArr,
    concepts: {
      type: 'array',
      items: obj({ slug: str, title: str, keyPoints: strArr }, ['slug', 'title', 'keyPoints']),
    },
    sessions: {
      type: 'array',
      items: obj(
        {
          kind: {
            type: 'string',
            enum: ['quiz', 'classify', 'detective', 'calculator', 'audit', 'decision', 'sequence', 'estimate', 'hotspot', 'explainer'],
          },
          title: str,
          conceptIds: strArr,
        },
        ['kind', 'title', 'conceptIds'],
      ),
    },
  },
  ['title', 'subject', 'type', 'summary', 'tags', 'concepts', 'sessions'],
)

// --- Stage 3: per-kind session schemas ------------------------------------
const BASE = { id: str, title: str, conceptIds: strArr, intro: str }
const BASE_REQ = ['id', 'title', 'conceptIds']

function sessionSchema(extra: Record<string, JsonSchema>, extraReq: string[]): JsonSchema {
  return obj({ ...BASE, ...extra }, [...BASE_REQ, ...extraReq])
}

export const SESSION_SCHEMAS: Record<string, JsonSchema> = {
  quiz: sessionSchema(
    {
      questions: {
        type: 'array',
        items: obj({ prompt: str, choices: strArr, answerIndex: { type: 'integer' }, explanation: str }, ['prompt', 'choices', 'answerIndex', 'explanation']),
      },
    },
    ['questions'],
  ),
  classify: sessionSchema(
    {
      buckets: {
        type: 'array',
        items: obj({ id: str, label: str, hint: str, tone: { type: 'string', enum: ['warm', 'cool', 'neutral'] } }, ['id', 'label']),
      },
      cards: { type: 'array', items: obj({ id: str, text: str, bucketId: str }, ['id', 'text', 'bucketId']) },
      debrief: str,
    },
    ['buckets', 'cards', 'debrief'],
  ),
  detective: sessionSchema(
    {
      facts: { type: 'array', items: obj({ label: str, value: str }, ['label', 'value']) },
      composition: {
        type: 'array',
        items: obj({ label: str, pct: { type: 'number' }, revealAfter: { type: 'integer' }, color: str }, ['label', 'pct', 'revealAfter']),
      },
      question: str,
      choices: strArr,
      answerIndex: { type: 'integer' },
      debrief: str,
    },
    ['facts', 'question', 'choices', 'answerIndex', 'debrief'],
  ),
  calculator: sessionSchema(
    {
      holdings: {
        type: 'array',
        items: obj({ name: str, fundWeight: { type: 'number' }, indexWeight: { type: 'number' } }, ['name', 'fundWeight', 'indexWeight']),
      },
      judgmentPrompt: str,
      judgmentChoices: strArr,
      judgmentAnswerIndex: { type: 'integer' },
      debrief: str,
    },
    ['holdings', 'judgmentPrompt', 'judgmentChoices', 'judgmentAnswerIndex', 'debrief'],
  ),
  audit: sessionSchema(
    {
      pillars: { type: 'array', items: obj({ id: str, label: str, prompt: str, actions: strArr }, ['id', 'label', 'prompt', 'actions']) },
      debrief: str,
    },
    ['pillars', 'debrief'],
  ),
  decision: sessionSchema(
    {
      startId: str,
      nodes: {
        type: 'array',
        items: obj(
          {
            id: str,
            text: str,
            choices: { type: 'array', items: obj({ label: str, next: str, note: str }, ['label', 'next']) },
            ending: obj({ principle: str, debrief: str, score: { type: 'number' } }, ['principle', 'debrief', 'score']),
          },
          ['id'],
        ),
      },
    },
    ['startId', 'nodes'],
  ),
  sequence: sessionSchema(
    {
      prompt: str,
      steps: { type: 'array', items: obj({ id: str, text: str }, ['id', 'text']) },
      debrief: str,
    },
    ['prompt', 'steps', 'debrief'],
  ),
  estimate: sessionSchema(
    {
      prompt: str,
      unit: str,
      min: { type: 'number' },
      max: { type: 'number' },
      step: { type: 'number' },
      answer: { type: 'number' },
      tolerance: { type: 'number' },
      debrief: str,
    },
    ['prompt', 'min', 'max', 'answer', 'debrief'],
  ),
  hotspot: sessionSchema(
    {
      prompt: str,
      series: { type: 'array', items: obj({ label: str, value: { type: 'number' }, anomaly: { type: 'boolean' } }, ['label', 'value']) },
      debrief: str,
    },
    ['prompt', 'series', 'debrief'],
  ),
  // AI-generated explainers omit the hand-authoring-only inline `viz` field.
  explainer: sessionSchema(
    {
      steps: { type: 'array', items: obj({ title: str, body: str }, ['title', 'body']) },
      recap: str,
    },
    ['steps', 'recap'],
  ),
}
