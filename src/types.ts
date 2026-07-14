export type SessionKind =
  | 'quiz'
  | 'classify'
  | 'detective'
  | 'lab'
  | 'calculator'
  | 'audit'
  | 'decision'

export type NormalizedKind = Exclude<SessionKind, 'calculator'>

export interface CatalogPackRef {
  id: string
  path: string
}

export interface Catalog {
  packs: CatalogPackRef[]
}

export interface FolioCurriculum {
  sheet?: string
  concepts: string[]
  sessions: string[]
}

export interface FolioPackMeta {
  schemaVersion: 2
  id: string
  title: string
  subject: string
  type: 'magazine' | 'course' | 'book' | 'notes'
  source: string
  summary: string
  tags: string[]
  curriculum: FolioCurriculum
  practiceNone?: string[]
  /** @deprecated prefer curriculum */
  concepts?: string[]
  /** @deprecated prefer curriculum */
  sessions?: string[]
}

export interface ConceptMeta {
  id: string
  title: string
  summary?: string
  relatedSessions: string[]
  body: string
}

export interface DebriefBlock {
  summary: string
  principle?: string
}

export interface SessionBase {
  schemaVersion: 2
  id: string
  title: string
  conceptIds: string[]
  estimatedMinutes?: number
  intro?: string
  debrief?: string | DebriefBlock
}

export interface QuizQuestion {
  prompt: string
  choices: string[]
  answerIndex: number
  explanation: string
}

export interface QuizSession extends SessionBase {
  kind: 'quiz'
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
  tone?: 'warm' | 'cool' | 'neutral'
}

export interface ClassifySession extends SessionBase {
  kind: 'classify'
  buckets: ClassifyBucket[]
  cards: ClassifyCard[]
  round2?: ClassifyCard[]
}

export interface DetectiveFact {
  label: string
  value: string
}

export interface AllocationSegment {
  label: string
  pct: number
  revealAfter: number
  color?: string
}

export interface DetectiveSession extends SessionBase {
  kind: 'detective'
  facts: DetectiveFact[]
  composition?: AllocationSegment[]
  /** Behaviour labels shown beside the visual */
  diagnoses?: { id: string; label: string; correct?: boolean }[]
  /** Legacy MCQ fields (migrated to diagnoses when absent) */
  question?: string
  choices?: string[]
  answerIndex?: number
}

export interface LabInput {
  id: string
  label: string
  value: number
  indexValue?: number
  min?: number
  max?: number
  step?: number
}

export interface LabSession extends SessionBase {
  kind: 'lab' | 'calculator'
  formulaId?: string
  inputs?: LabInput[]
  constraints?: { sumTo?: number; epsilon?: number }
  passBand?: { metric: string; min: number; max: number }
  transferCheck?: {
    prompt: string
    choices: string[]
    answerIndex: number
  }
  /** Legacy calculator fields */
  holdings?: { name: string; fundWeight: number; indexWeight: number }[]
  judgmentPrompt?: string
  judgmentChoices?: string[]
  judgmentAnswerIndex?: number
}

export interface AuditRemediation {
  conceptId?: string
  sessionId?: string
  label?: string
}

export interface AuditPillar {
  id: string
  label: string
  prompt: string
  actions: string[]
  remediation?: AuditRemediation[]
}

export interface AuditSession extends SessionBase {
  kind: 'audit'
  pillars: AuditPillar[]
}

export interface DecisionChoice {
  label: string
  next: string
  note?: string
  scoreDelta?: number
}

export interface DecisionNode {
  id: string
  text?: string
  choices?: DecisionChoice[]
  ending?: { principle: string; debrief: string; score?: number }
}

export interface DecisionSession extends SessionBase {
  kind: 'decision'
  startId: string
  nodes: DecisionNode[]
  maxScore?: number
}

export type Session =
  | QuizSession
  | ClassifySession
  | DetectiveSession
  | LabSession
  | AuditSession
  | DecisionSession

export interface SheetBlock {
  id: string
  title: string
  body: string
  sessionId?: string
  conceptId?: string
}

export interface SheetDoc {
  title: string
  claim: string
  blocks: SheetBlock[]
  diagram?: {
    type: 'flow'
    nodes: { id: string; label: string }[]
    edges: { from: string; to: string }[]
  }
}

export interface SessionAttempt {
  at: string
  score: number
  maxScore: number
}

export interface SessionProgress {
  attempts: SessionAttempt[]
  bestScore: number
  bestMax: number
  completedAt?: string
  reflectionOnly?: boolean
}

export interface ConceptProgress {
  strength: number
  lastPracticedAt?: string
}

export interface ProgressStoreV2 {
  version: 2
  lastPackId?: string
  sessions: Record<string, SessionProgress>
  concepts: Record<string, ConceptProgress>
}

/** @deprecated v1 shape retained for migration tests */
export interface SessionResult {
  packId: string
  sessionId: string
  kind: SessionKind
  score: number
  maxScore: number
  completedAt: string
}

/** @deprecated */
export interface ProgressStore {
  sessions: Record<string, SessionResult>
  lastPackId?: string
}

export type CompleteResult = {
  score: number
  maxScore: number
  conceptDeltas?: Record<string, number>
  pathNotes?: string[]
  reflectionOnly?: boolean
}
