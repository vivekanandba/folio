export type SessionKind =
  | 'quiz'
  | 'classify'
  | 'detective'
  | 'calculator'
  | 'audit'
  | 'decision'

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
  text: string
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

export type Session =
  | QuizSession
  | ClassifySession
  | DetectiveSession
  | CalculatorSession
  | AuditSession
  | DecisionSession

export interface SessionResult {
  packId: string
  sessionId: string
  kind: SessionKind
  score: number
  maxScore: number
  completedAt: string
}

export interface ProgressStore {
  sessions: Record<string, SessionResult>
  lastPackId?: string
}
