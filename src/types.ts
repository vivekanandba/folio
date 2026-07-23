export type SessionKind =
  | 'quiz'
  | 'classify'
  | 'detective'
  | 'calculator'
  | 'audit'
  | 'decision'
  | 'sequence'
  | 'estimate'
  | 'hotspot'
  | 'explainer'

export interface CatalogPackRef {
  id: string
  path: string
}

export interface Catalog {
  packs: CatalogPackRef[]
}

export interface FolioPackMeta {
  id: string
  title: string
  subject: string
  /** Broad umbrella for landing-page grouping (e.g. "Finance", "Software"). Falls back to a subject-derived label. */
  category?: string
  type: 'magazine' | 'course' | 'book' | 'notes'
  source: string
  summary: string
  tags: string[]
  concepts: string[]
  sessions: string[]
}

export interface QuizQuestion {
  prompt: string
  choices: string[]
  answerIndex: number
  explanation: string
}

export interface QuizSession {
  id: string
  kind: 'quiz'
  title: string
  conceptIds: string[]
  intro?: string
  questions: QuizQuestion[]
}

export interface ClassifyCard {
  id: string
  text: string
  bucketId: string
}

export interface ClassifyBucket {
  id: string
  label: string
  hint?: string
  /** Visual accent: warm | cool | neutral */
  tone?: 'warm' | 'cool' | 'neutral'
}

export interface ClassifySession {
  id: string
  kind: 'classify'
  title: string
  conceptIds: string[]
  intro?: string
  buckets: ClassifyBucket[]
  cards: ClassifyCard[]
  debrief: string
}

export interface DetectiveFact {
  label: string
  value: string
}

export interface AllocationSegment {
  label: string
  pct: number
  /** Fact index (1-based) after which this segment appears/updates */
  revealAfter: number
  color?: string
}

export interface DetectiveSession {
  id: string
  kind: 'detective'
  title: string
  conceptIds: string[]
  intro?: string
  facts: DetectiveFact[]
  /** Optional live allocation chart that builds as clues appear */
  composition?: AllocationSegment[]
  question: string
  choices: string[]
  answerIndex: number
  debrief: string
}

export interface CalculatorHolding {
  name: string
  fundWeight: number
  indexWeight: number
}

export interface CalculatorSession {
  id: string
  kind: 'calculator'
  title: string
  conceptIds: string[]
  intro?: string
  holdings: CalculatorHolding[]
  judgmentPrompt: string
  judgmentChoices: string[]
  judgmentAnswerIndex: number
  debrief: string
}

export interface AuditPillar {
  id: string
  label: string
  prompt: string
  actions: string[]
}

export interface AuditSession {
  id: string
  kind: 'audit'
  title: string
  conceptIds: string[]
  intro?: string
  pillars: AuditPillar[]
  debrief: string
}

export interface DecisionNode {
  id: string
  text?: string
  choices?: { label: string; next: string; note?: string }[]
  ending?: { principle: string; debrief: string; score: number }
}

export interface DecisionSession {
  id: string
  kind: 'decision'
  title: string
  conceptIds: string[]
  intro?: string
  startId: string
  nodes: DecisionNode[]
}

export interface SequenceStep {
  id: string
  text: string
}

export interface SequenceSession {
  id: string
  kind: 'sequence'
  title: string
  conceptIds: string[]
  intro?: string
  prompt: string
  /** Authored in the CORRECT order; shuffled at mount. */
  steps: SequenceStep[]
  debrief: string
}

export interface EstimateSession {
  id: string
  kind: 'estimate'
  title: string
  conceptIds: string[]
  intro?: string
  prompt: string
  unit?: string
  min: number
  max: number
  step?: number
  /** The true value. */
  answer: number
  /** Fraction of the range counted as correct; default 0.1. */
  tolerance?: number
  debrief: string
}

export interface HotspotPoint {
  label: string
  value: number
  anomaly?: boolean
}

export interface HotspotSession {
  id: string
  kind: 'hotspot'
  title: string
  conceptIds: string[]
  intro?: string
  prompt: string
  /** ≥1 point must have anomaly:true. */
  series: HotspotPoint[]
  debrief: string
}

/** A guided teaching walkthrough (learn, not test). `body`/`recap` are markdown;
 * `viz` is an optional inline widget spec (see src/widgets.ts). */
export interface ExplainerStep {
  title: string
  body: string
  viz?: unknown
}

export interface ExplainerSession {
  id: string
  kind: 'explainer'
  title: string
  conceptIds: string[]
  intro?: string
  steps: ExplainerStep[]
  recap: string
}

export type Session =
  | QuizSession
  | ClassifySession
  | DetectiveSession
  | CalculatorSession
  | AuditSession
  | DecisionSession
  | SequenceSession
  | EstimateSession
  | HotspotSession
  | ExplainerSession

export interface SessionResult {
  packId: string
  sessionId: string
  kind: SessionKind
  score: number
  maxScore: number
  completedAt: string
}

export const PROGRESS_VERSION = 2

export type ReviewSource = 'session' | 'flashcard'

/** SM-2 grade, 0 (blackout) .. 5 (perfect). */
export type Grade = 0 | 1 | 2 | 3 | 4 | 5

/** Spaced-repetition state for one concept (keyed `${packId}::${conceptId}`). */
export interface ConceptSrsState {
  packId: string
  conceptId: string
  ease: number // EF, starts 2.5, floor 1.3
  intervalDays: number
  reps: number // consecutive successful reps
  lapses: number
  due: string // ISO date yyyy-mm-dd
  lastReviewedAt: string // ISO datetime, '' if never
  mastery: number // 0..1 kind-weighted EMA of normalized grades
  reviewCount: number
  learnedAt?: string // ISO datetime the concept's explainer/page was marked read
}

/** One review event (session completion or flashcard round). Append-only, capped. */
export interface Attempt {
  id: string
  packId: string
  conceptIds: string[]
  source: ReviewSource
  ref: string // sessionId or concept id
  kind?: SessionKind
  normalized: number // 0..1
  grade: Grade
  at: string // ISO datetime
}

/** Derived on demand from quiz questions / concept notes — never persisted. */
export interface Flashcard {
  id: string
  packId: string
  conceptId: string
  front: string
  back: string
  origin: 'quiz' | 'note'
}

/** Legacy v1 store (no version field). */
export interface ProgressStore {
  sessions: Record<string, SessionResult>
  lastPackId?: string
}

export interface ProgressStoreV2 {
  version: 2
  sessions: Record<string, SessionResult>
  concepts: Record<string, ConceptSrsState>
  attempts: Attempt[]
  daily: Record<string, number> // yyyy-mm-dd -> reviews done that day
  lastPackId?: string
}
