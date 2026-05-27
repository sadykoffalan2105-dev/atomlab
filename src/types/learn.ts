import type { MessageKey } from '../i18n/messagesRu'

/** Идентификатор тематики = id темы для связки с hubSlides и SVG-артом; `lab_invite` — общий рисунок шага «лаборатория». */
export const LEARN_TOPIC_CORE_IDS = [
  'periodicity',
  'bond_types',
  'oxides_acidic',
  'oxides_basic',
  'oxides_amphoteric',
  'acids_strong',
  'acids_weak',
  'bases_alkali',
  'salts_ionic',
  'salts_solubility',
  'gases_nitrogen',
  'gases_sulfur',
  'halogens_intro',
  'metals_activity',
  'redox_intro',
  'electrolysis_intro',
  'water_chemistry',
  'qual_analysis',
  'industrial_touch',
  'safety_lab',
] as const

export type LearnTopicCoreId = (typeof LEARN_TOPIC_CORE_IDS)[number]
export type LearnTopicArtId = LearnTopicCoreId | 'lab_invite'

export interface LearnTopicHubSlide {
  titleKey: MessageKey
  bodyKey: MessageKey
  artId: LearnTopicCoreId
  /** Вещество для общего 3D-превью слайда (каталог); не монтировать отдельный Canvas в каждой карточке. */
  previewCompoundId: string
}

/** Шаг урока: текст, вещество с 3D или приглашение в лабораторию. */
export type LearnStep =
  | { type: 'read'; titleKey?: MessageKey; bodyKey: MessageKey }
  | { type: 'highlightCompound'; titleKey?: MessageKey; bodyKey: MessageKey; compoundId: string }
  | { type: 'tryLaboratory'; titleKey?: MessageKey; bodyKey: MessageKey }

export interface LearnLesson {
  id: string
  topicId: string
  titleKey: MessageKey
  estimatedMin: number
  steps: LearnStep[]
}

/** Модификатор оформления карточки на листе обучения (без отдельного WebGL на каждой карточке). */
export type LearnVisualThemeId =
  | 'vt0'
  | 'vt1'
  | 'vt2'
  | 'vt3'
  | 'vt4'
  | 'vt5'
  | 'vt6'
  | 'vt7'
  | 'vt8'
  | 'vt9'
  | 'vt10'
  | 'vt11'

export interface LearnTopic {
  id: string
  order: number
  titleKey: MessageKey
  summaryKey: MessageKey
  /** Вещество-«тотем» для 3D в хабе темы и шага highlight в уроке. */
  totemCompoundId: string
  /** Подсказка «что попробовать» (лаборатория, каталог, запись). */
  experimentKey: MessageKey
  visualThemeId: LearnVisualThemeId
  /** Слайды «журнала» на странице темы (текст + тот же арт темы). */
  hubSlides: LearnTopicHubSlide[]
  lessons: LearnLesson[]
}

// --- UZ curriculum (grades 7–9) ---

export const LEARN_GRADE_IDS = ['g7', 'g8', 'g9'] as const
export type LearnGradeId = (typeof LEARN_GRADE_IDS)[number]

export type LearnVisualKind =
  | 'topicScene'
  | 'atom'
  | 'molecule'
  | 'element'
  | 'diatomic'
  | 'reaction'
  | 'bond'
  | 'electrolysis'
  | 'svgFallback'

export type LearnSlide =
  | {
      id: string
      type: 'theory'
      titleKey: MessageKey
      bodyKey: MessageKey
      visualId?: string
      bulletsKey?: MessageKey
      calloutKey?: MessageKey
      diagramKey?: MessageKey
    }
  | {
      id: string
      type: 'example'
      titleKey: MessageKey
      bodyKey: MessageKey
      visualId?: string
      bulletsKey?: MessageKey
      calloutKey?: MessageKey
      diagramKey?: MessageKey
    }
  | { id: string; type: 'interactive3d'; visualId: string; captionKey: MessageKey }
  | {
      id: string
      type: 'checkpoint'
      questionKey: MessageKey
      choiceKeys: readonly MessageKey[]
      correctIndex: number
    }
  | { id: string; type: 'practice'; taskCategoryId: string }
  | { id: string; type: 'labInvite'; bodyKey: MessageKey }

export interface LearnSection {
  id: string
  chapterId: string
  gradeId: LearnGradeId
  order: number
  kpNumber: number
  titleKey: MessageKey
  estimatedMin: number
  defaultVisualId?: string
  slides: readonly LearnSlide[]
  taskCategoryId?: string
}

export interface LearnChapter {
  id: string
  gradeId: LearnGradeId
  order: number
  titleKey: MessageKey
  summaryKey: MessageKey
  totemCompoundId: string
  sections: readonly LearnSection[]
}

export interface LearnGrade {
  id: LearnGradeId
  order: number
  titleKey: MessageKey
  textbookRefKey: MessageKey
  chapters: readonly LearnChapter[]
}

export type LearnVisualSpec =
  | { id: string; kind: 'topicScene'; sceneId: string }
  | { id: string; kind: 'atom'; z: number }
  | { id: string; kind: 'molecule'; compoundId: string }
  | { id: string; kind: 'element'; z: number }
  | { id: string; kind: 'diatomic'; z: number }
  | { id: string; kind: 'bond'; mode: 'ionic' | 'covalent' | 'polar'; compoundId?: string }
  | { id: string; kind: 'reaction'; leftTerms: readonly { z: number; coeff: number; diatomic?: boolean }[] }
  | { id: string; kind: 'electrolysis'; compoundId: string }
  | { id: string; kind: 'svgFallback'; artId: LearnTopicCoreId | 'lab_invite' }
