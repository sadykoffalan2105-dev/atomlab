/**
 * Контракт «мозга v2» между DIALOG (dialogState/dialogResolve/dialogPlan, chat.ts) и SOURCES (intent/retrieve).
 * Общие типы — только здесь; оба агента импортируют отсюда и не правят файл после первого коммита.
 */
import type { Candidate } from './hybrid.ts'
import type { Lang } from './normalize.ts'
import type { RetrieveContext, RetrievalResult } from './retrieve.ts'

export type Scope = 'school' | 'broad' | 'offtopic'
export type QuestionKind =
  | 'definition' | 'why' | 'howto_obtain' | 'compare' | 'properties' | 'uses' | 'who_history'
  | 'calc' | 'homework' | 'test_style' | 'chitchat' | 'broad' | 'repeat' | 'confirm' | 'general'
export type LengthClass = 'tiny' | 'short' | 'normal' | 'long'
export type GradeId = 'g7' | 'g8' | 'g9' | 'g10' | 'g11'
export type FollowUp = 'none' | 'why' | 'example' | 'simpler' | 'more' | 'repeat' | 'switch_entity' | 'switch_grade' | 'confirm' | 'deictic'
export type Profile = 'laptop' | 'gpu'

/** Самодостаточный вопрос: что на самом деле спросил ученик с учётом истории. */
export type StandaloneQuery = {
  /** вопрос на языке ученика, понятный без истории */
  text: string
  lang: Lang
  /** тема ПО-РУССКИ (учебники русские): «валентность»; null — не определена */
  topic: string | null
  /** сущности как в тексте/ASCII-формулы: ['Na', 'серная кислота'] */
  entities: string[]
  /** класс для поиска: явный из реплики > история > контекст урока */
  grade: GradeId | null
  scope: Scope
  kind: QuestionKind
  lengthClass: LengthClass
  followUp: FollowUp
  resolvedBy: 'none' | 'rules' | 'llm'
  /** реплика ученика дословно */
  original: string
}

export type DialogState = {
  topic: string | null
  entities: string[]
  lastStandalone: string | null
  /** первое + последнее предложение последнего ответа учителя, ≤ 240 симв. */
  lastAnswer: string | null
  grade: GradeId | null
  lengthPref: LengthClass | null
  /** сжатая история (правила; на gpu — модель), ≤ 220 симв. */
  summary: string | null
  turns: number
  lastKind: QuestionKind | null
}

export type SourceKind = 'textbook_grade' | 'textbook_other' | 'atomlab' | 'journal' | 'encyclopedia' | 'index'
export type RankedFragment = Candidate & { sourceKind: SourceKind; gradeDelta: number | null; tier: 1 | 2 | 3 | 4 }

export type RetrieveOptions = {
  query: StandaloneQuery
  ctx: RetrieveContext
  profile: Profile
  /** бюджет символов и число фрагментов, которые DIALOG положит в подсказку */
  budgetChars: number
  maxItems: number
}

export type RetrievalResultV2 = Omit<RetrievalResult, 'items'> & {
  items: RankedFragment[]
  scopeUsed: Scope
  schoolHit: boolean
  encyclopediaUsed: boolean
  tiers: Partial<Record<SourceKind, number>>
}

export type AnswerPlan = {
  lengthClass: LengthClass
  words: [number, number]
  numPredict: number
  structure: string
  useHistory: number
  historyChars: number
  knowledgeChars: number
  knowledgeItems: number
  dialogBlock: string
  verify: boolean
}
