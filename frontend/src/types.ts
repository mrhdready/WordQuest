export type Role = 'Owner' | 'Guardian' | 'Learner'

export interface AuthUser {
  id: string
  displayName: string
  role: Role
  tenantId: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
  user: AuthUser
}

export interface LearnerTile {
  id: string
  displayName: string
  avatarKey: string
}

export interface Learner {
  id: string
  displayName: string
  avatarKey: string
  dailyNewLimit: number
  speed: 'Relaxed' | 'Normal' | 'Fast'
  soundEnabled: boolean
  hasPin: boolean
}

export interface VocabularySet {
  id: string
  title: string
  description: string | null
  sourceLanguage: string
  targetLanguage: string
  entryCount: number
}

export interface VocabularyEntry {
  id: string
  sourceText: string
  targetText: string
  targetAlternatives: string[]
  sourceAlternatives: string[]
  partOfSpeech: string
  emoji: string | null
  exampleSource: string | null
  exampleTarget: string | null
  position: number
}

export interface SessionItem {
  itemId: string
  cardId: string
  prompt: string
  promptType: 'text' | 'audio'
  expectedAnswerType: 'text' | 'choice'
  choices: string[] | null
  emoji: string | null
  exampleSentence: string | null
  isRetry: boolean
}

export interface SessionView {
  sessionId: string
  gameKey: string
  totalItems: number
  items: SessionItem[]
}

export type Grade = 'Again' | 'Hard' | 'Good' | 'Easy'

export interface AnswerResult {
  correct: boolean
  grade: Grade
  correctAnswer: string
  message: string | null
  hadTypo: boolean
  xpAwarded: number
  coinsAwarded: number
  retryItem: SessionItem | null
}

export interface SessionSummary {
  sessionId: string
  answered: number
  correct: number
  xpAwarded: number
  coinsAwarded: number
  totalXp: number
  level: number
  levelProgress: number
  xpToNextLevel: number
  coins: number
  streak: number
  streakSaverUsed: boolean
  leveledUp: boolean
}

export interface LearnerOverview {
  learnerId: string
  displayName: string
  xp: number
  level: number
  levelProgress: number
  xpToNextLevel: number
  coins: number
  streak: number
  dueToday: number
  newRemainingToday: number
  cardsMastered: number
  cardsTotal: number
}

export type TrafficLightStatus = 'green' | 'yellow' | 'red' | 'new'

export interface TrafficLightRow {
  entryId: string
  sourceText: string
  targetText: string
  status: TrafficLightStatus
  lapses: number
  worstEase: number
}

export interface ImportRow {
  lineNumber: number
  source: string
  target: string
  emoji: string | null
  problem: string | null
}

export interface ImportPreview {
  delimiter: string
  hadHeader: boolean
  validCount: number
  problemCount: number
  rows: ImportRow[]
}
