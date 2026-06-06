import type { MessageKey } from '../i18n/messagesRu'
import type { LearnChapter, LearnGrade, LearnGradeId, LearnSection, LearnSlide } from '../types/learn'
import { g7BookSectionSeeds } from './g7BookCurriculum'
import { topicSceneVisualId } from '../learn/learnTopicScenes'
import { sectionVisualOverride, totemCatalogVisualId } from './learnVisualMap'

function sectionVisual(gradeId: LearnGradeId, chapterId: string, sectionId: string): string {
  return topicSceneVisualId({ gradeId, chapterId, id: sectionId })
}

type SectionSeed = {
  id: string
  kpNumber: number
  titleKey: MessageKey
  estimatedMin?: number
  defaultVisualId?: string
  slides?: readonly LearnSlide[]
  taskCategoryId?: string
  /** Без poster/slide-картинок — только теория, 3D, checkpoint (для § по оглавлению учебника). */
  contentMode?: 'outline'
}

function slideTheory(
  prefix: string,
  n: number,
  visualId?: string,
  rich = n === 0 || n === 3,
): LearnSlide {
  const base = `${prefix}.slide${n}` as const
  return {
    id: `sl${n}`,
    type: 'theory',
    titleKey: `${base}.title` as MessageKey,
    bodyKey: `${base}.body` as MessageKey,
    visualId,
    ...(rich
      ? {
          bulletsKey: `${base}.bullets` as MessageKey,
          calloutKey: `${base}.callout` as MessageKey,
          ...(n === 0 ? { diagramKey: `${base}.diagram` as MessageKey } : {}),
        }
      : {}),
  }
}

function slideExample(prefix: string, n: number, visualId?: string): LearnSlide {
  return {
    id: `sl${n}`,
    type: 'example',
    titleKey: `${prefix}.slide${n}.title` as MessageKey,
    bodyKey: `${prefix}.slide${n}.body` as MessageKey,
    visualId,
    bulletsKey: `${prefix}.slide${n}.bullets` as MessageKey,
  }
}

function slide3d(prefix: string, n: number, visualId: string): LearnSlide {
  return {
    id: `sl${n}`,
    type: 'interactive3d',
    visualId,
    captionKey: `${prefix}.slide${n}.caption` as MessageKey,
  }
}

function slideCheckpoint(prefix: string, n: number, choices: number, correct: number): LearnSlide {
  const choiceKeys = Array.from(
    { length: choices },
    (_, i) => `${prefix}.slide${n}.c${i}` as MessageKey,
  )
  return {
    id: `sl${n}`,
    type: 'checkpoint',
    questionKey: `${prefix}.slide${n}.q` as MessageKey,
    choiceKeys,
    correctIndex: correct,
  }
}

function slidePractice(taskCategoryId: string): LearnSlide {
  return { id: 'sl_practice', type: 'practice', taskCategoryId }
}

function slideLab(bodyKey: MessageKey): LearnSlide {
  return { id: 'sl_lab', type: 'labInvite', bodyKey }
}

function slideVisual(
  id: string,
  prefix: string,
  n: number,
  topicId: string,
  file: 'poster' | 's02' | 's03' | 's04',
  kenBurns: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' = 'zoom-in',
): LearnSlide {
  const base = `${prefix}.slide${n}` as const
  const image =
    file === 'poster'
      ? `/learn/posters/${topicId}.png`
      : `/learn/slides/${topicId}/${file}.jpg`
  return {
    id,
    type: 'visual',
    titleKey: `${base}.title` as MessageKey,
    bodyKey: `${base}.body` as MessageKey,
    image,
    kenBurns,
  }
}

/** Стандартный набор слайдов для полного § (7–9 класс): картинки + 3D + теория. */
function fullSectionSlides(
  i18nPrefix: string,
  visualId: string,
  opts?: { taskId?: string; correctIndex?: number },
): LearnSlide[] {
  const correct = opts?.correctIndex ?? 1
  const topicId = visualId.startsWith('topic_') ? visualId : visualId
  const slides: LearnSlide[] = [
    slideVisual('slv0', i18nPrefix, 0, topicId, 'poster', 'zoom-in'),
    slideTheory(i18nPrefix, 0, visualId),
    slideVisual('slv1', i18nPrefix, 1, topicId, 's02', 'pan-right'),
    slideExample(i18nPrefix, 1, visualId),
    slide3d(i18nPrefix, 2, visualId),
    slideVisual('slv2', i18nPrefix, 3, topicId, 's03', 'zoom-out'),
    slideTheory(i18nPrefix, 3, visualId),
    slideCheckpoint(i18nPrefix, 4, 4, correct),
  ]
  if (opts?.taskId) slides.push(slidePractice(opts.taskId))
  slides.push(slideVisual('slv3', i18nPrefix, 5, topicId, 's04', 'pan-left'))
  slides.push(slideLab(`${i18nPrefix}.slide5.body` as MessageKey))
  return slides
}

function sectionI18nPrefix(titleKey: MessageKey): string {
  return titleKey.replace(/\.title$/, '')
}

function defaultSectionSlides(
  titleKey: MessageKey,
  visualId: string,
  taskCategoryId?: string,
): LearnSlide[] {
  const prefix = sectionI18nPrefix(titleKey)
  return fullSectionSlides(prefix, visualId, {
    taskId: taskCategoryId,
    correctIndex: 1,
  })
}

function compactSectionSlides(
  titleKey: MessageKey,
  visualId: string,
  taskCategoryId?: string,
): LearnSlide[] {
  const prefix = sectionI18nPrefix(titleKey)
  const slides: LearnSlide[] = [
    slideTheory(prefix, 0, visualId, true),
    slide3d(prefix, 2, visualId),
    slideCheckpoint(prefix, 4, 4, 1),
  ]
  if (taskCategoryId) slides.push(slidePractice(taskCategoryId))
  slides.push(slideLab(`${prefix}.slide5.body` as MessageKey))
  return slides
}

function resolveSectionVisualId(
  gradeId: LearnGradeId,
  chapterId: string,
  sectionId: string,
  totemCompoundId: string,
  seedVisualId?: string,
): string {
  if (seedVisualId) return seedVisualId
  const pathId = `${gradeId}-${chapterId}-${sectionId}`
  const override = sectionVisualOverride(pathId)
  if (override) return override
  const totem = totemCatalogVisualId(totemCompoundId)
  if (totem) return totem
  return sectionVisual(gradeId, chapterId, sectionId)
}

function buildSection(
  gradeId: LearnGradeId,
  chapterId: string,
  order: number,
  seed: SectionSeed,
  totemCompoundId: string,
): LearnSection {
  const visualId = resolveSectionVisualId(gradeId, chapterId, seed.id, totemCompoundId, seed.defaultVisualId)
  const slides =
    seed.slides ??
    (seed.contentMode === 'outline'
      ? compactSectionSlides(seed.titleKey, visualId, seed.taskCategoryId)
      : defaultSectionSlides(seed.titleKey, visualId, seed.taskCategoryId))
  return {
    id: seed.id,
    chapterId,
    gradeId,
    order,
    kpNumber: seed.kpNumber,
    titleKey: seed.titleKey,
    estimatedMin: seed.estimatedMin ?? 12,
    defaultVisualId: visualId,
    slides,
    taskCategoryId: seed.taskCategoryId,
  }
}

function buildChapter(
  gradeId: LearnGradeId,
  id: string,
  order: number,
  titleKey: MessageKey,
  summaryKey: MessageKey,
  totemCompoundId: string,
  sectionSeeds: SectionSeed[],
): LearnChapter {
  return {
    id,
    gradeId,
    order,
    titleKey,
    summaryKey,
    totemCompoundId,
    sections: sectionSeeds.map((s, i) => buildSection(gradeId, id, i + 1, s, totemCompoundId)),
  }
}

// --- 7 класс: I–II bob (полный пилот) ---

const g7c1Sections: SectionSeed[] = [
  {
    id: 's01',
    kpNumber: 1,
    titleKey: 'learn.g7.c1.s01.title',
    slides: fullSectionSlides('learn.g7.c1.s01', sectionVisual('g7', 'c1', 's01'), { correctIndex: 1 }),
  },
  {
    id: 's02',
    kpNumber: 2,
    titleKey: 'learn.g7.c1.s02.title',
    slides: fullSectionSlides('learn.g7.c1.s02', sectionVisual('g7', 'c1', 's02'), { correctIndex: 1 }),
  },
  {
    id: 's03',
    kpNumber: 3,
    titleKey: 'learn.g7.c1.s03.title',
    slides: fullSectionSlides('learn.g7.c1.s03', sectionVisual('g7', 'c1', 's03'), { correctIndex: 1 }),
  },
  {
    id: 's04',
    kpNumber: 4,
    titleKey: 'learn.g7.c1.s04.title',
    slides: fullSectionSlides('learn.g7.c1.s04', sectionVisual('g7', 'c1', 's04'), { correctIndex: 1, taskId: 'solutions' }),
  },
  {
    id: 's05',
    kpNumber: 5,
    titleKey: 'learn.g7.c1.s05.title',
    slides: fullSectionSlides('learn.g7.c1.s05', sectionVisual('g7', 'c1', 's05'), { correctIndex: 1, taskId: 'solutions' }),
  },
  {
    id: 's06',
    kpNumber: 6,
    titleKey: 'learn.g7.c1.s06.title',
    slides: fullSectionSlides('learn.g7.c1.s06', sectionVisual('g7', 'c1', 's06'), { correctIndex: 1 }),
  },
  {
    id: 's07',
    kpNumber: 7,
    titleKey: 'learn.g7.c1.s07.title',
    slides: fullSectionSlides('learn.g7.c1.s07', sectionVisual('g7', 'c1', 's07'), { correctIndex: 1 }),
  },
  {
    id: 's08',
    kpNumber: 8,
    titleKey: 'learn.g7.c1.s08.title',
    slides: fullSectionSlides('learn.g7.c1.s08', sectionVisual('g7', 'c1', 's08'), { correctIndex: 1 }),
  },
  {
    id: 's09',
    kpNumber: 9,
    titleKey: 'learn.g7.c1.s09.title',
    slides: fullSectionSlides('learn.g7.c1.s09', sectionVisual('g7', 'c1', 's09'), { correctIndex: 1 }),
  },
  {
    id: 's10',
    kpNumber: 10,
    titleKey: 'learn.g7.c1.s10.title',
    slides: fullSectionSlides('learn.g7.c1.s10', sectionVisual('g7', 'c1', 's10'), { correctIndex: 1, taskId: 'solutions' }),
  },
]

const g7c2FullSections: SectionSeed[] = [
  {
    id: 's01',
    kpNumber: 1,
    titleKey: 'learn.g7.c2.s01.title',
    slides: fullSectionSlides('learn.g7.c2.s01', sectionVisual('g7', 'c2', 's01'), { correctIndex: 1 }),
  },
  {
    id: 's02',
    kpNumber: 2,
    titleKey: 'learn.g7.c2.s02.title',
    slides: fullSectionSlides('learn.g7.c2.s02', sectionVisual('g7', 'c2', 's02'), { correctIndex: 1 }),
  },
  {
    id: 's03',
    kpNumber: 3,
    titleKey: 'learn.g7.c2.s03.title',
    slides: fullSectionSlides('learn.g7.c2.s03', sectionVisual('g7', 'c2', 's03'), { correctIndex: 1 }),
  },
  {
    id: 's04',
    kpNumber: 4,
    titleKey: 'learn.g7.c2.s04.title',
    slides: fullSectionSlides('learn.g7.c2.s04', sectionVisual('g7', 'c2', 's04'), { correctIndex: 1, taskId: 'stoichiometry' }),
  },
  {
    id: 's05',
    kpNumber: 5,
    titleKey: 'learn.g7.c2.s05.title',
    slides: fullSectionSlides('learn.g7.c2.s05', sectionVisual('g7', 'c2', 's05'), { correctIndex: 1 }),
  },
  {
    id: 's06',
    kpNumber: 6,
    titleKey: 'learn.g7.c2.s06.title',
    slides: fullSectionSlides('learn.g7.c2.s06', sectionVisual('g7', 'c2', 's06'), { correctIndex: 1, taskId: 'stoichiometry' }),
  },
]

const g7c2Sections: SectionSeed[] = [
  ...g7c2FullSections,
  ...outlineSections('g7', 'c2', g7BookSectionSeeds(2, { taskBySec: { 8: 'stoichiometry', 9: 'stoichiometry', 11: 'stoichiometry' } }).slice(6)),
]

const g7c3Sections = outlineSections('g7', 'c3', g7BookSectionSeeds(3))

const g7c4Sections = outlineSections('g7', 'c4', g7BookSectionSeeds(4))

const g7c5Sections = outlineSections('g7', 'c5', g7BookSectionSeeds(5))

const g7c6Sections = outlineSections('g7', 'c6', g7BookSectionSeeds(6, { taskBySec: { 8: 'solutions' } }))

const g7c7Sections = outlineSections('g7', 'c7', g7BookSectionSeeds(7))

const g7c8Sections = outlineSections('g7', 'c8', g7BookSectionSeeds(8))

function outlineSections(
  _gradeId: LearnGradeId,
  _chapterId: string,
  items: { id: string; kp: number; titleKey: MessageKey; taskCategoryId?: string }[],
): SectionSeed[] {
  return items.map((it) => ({
    id: it.id,
    kpNumber: it.kp,
    titleKey: it.titleKey,
    taskCategoryId: it.taskCategoryId,
    contentMode: 'outline' as const,
  }))
}

const g8c1Sections = outlineSections('g8', 'c1', [
  { id: 's01', kp: 1, titleKey: 'learn.g8.c1.s01.title' },
  { id: 's02', kp: 2, titleKey: 'learn.g8.c1.s02.title' },
  { id: 's03', kp: 3, titleKey: 'learn.g8.c1.s03.title' },
  { id: 's04', kp: 4, titleKey: 'learn.g8.c1.s04.title' },
  { id: 's05', kp: 5, titleKey: 'learn.g8.c1.s05.title' },
  { id: 's06', kp: 6, titleKey: 'learn.g8.c1.s06.title' },
  { id: 's07', kp: 7, titleKey: 'learn.g8.c1.s07.title' },
])

const g8c2Sections = outlineSections('g8', 'c2', [
  { id: 's01', kp: 3, titleKey: 'learn.g8.c2.s01.title' },
  { id: 's02', kp: 4, titleKey: 'learn.g8.c2.s02.title' },
  { id: 's03', kp: 5, titleKey: 'learn.g8.c2.s03.title' },
  { id: 's04', kp: 6, titleKey: 'learn.g8.c2.s04.title' },
  { id: 's05', kp: 7, titleKey: 'learn.g8.c2.s05.title' },
  { id: 's06', kp: 8, titleKey: 'learn.g8.c2.s06.title' },
  { id: 's07', kp: 9, titleKey: 'learn.g8.c2.s07.title' },
  { id: 's08', kp: 10, titleKey: 'learn.g8.c2.s08.title' },
  { id: 's09', kp: 11, titleKey: 'learn.g8.c2.s09.title' },
  { id: 's10', kp: 12, titleKey: 'learn.g8.c2.s10.title' },
  { id: 's11', kp: 13, titleKey: 'learn.g8.c2.s11.title' },
])

const g8c3Sections = outlineSections('g8', 'c3', [
  { id: 's14', kp: 14, titleKey: 'learn.g8.c3.s14.title' },
  { id: 's15', kp: 15, titleKey: 'learn.g8.c3.s15.title' },
  { id: 's16', kp: 16, titleKey: 'learn.g8.c3.s16.title' },
  { id: 's17', kp: 17, titleKey: 'learn.g8.c3.s17.title' },
  { id: 's18', kp: 18, titleKey: 'learn.g8.c3.s18.title' },
  { id: 's19', kp: 19, titleKey: 'learn.g8.c3.s19.title' },
  { id: 's20', kp: 20, titleKey: 'learn.g8.c3.s20.title' },
  { id: 's21', kp: 21, titleKey: 'learn.g8.c3.s21.title' },
])

const g8c4Sections = outlineSections('g8', 'c4', [
  { id: 's21', kp: 21, titleKey: 'learn.g8.c4.s21.title' },
  { id: 's22', kp: 22, titleKey: 'learn.g8.c4.s22.title' },
  { id: 's23', kp: 23, titleKey: 'learn.g8.c4.s23.title' },
  { id: 's24', kp: 24, titleKey: 'learn.g8.c4.s24.title' },
  { id: 's25', kp: 25, titleKey: 'learn.g8.c4.s25.title' },
  { id: 's26', kp: 26, titleKey: 'learn.g8.c4.s26.title' },
  { id: 's27', kp: 27, titleKey: 'learn.g8.c4.s27.title' },
  { id: 's28', kp: 28, titleKey: 'learn.g8.c4.s28.title' },
  { id: 's29', kp: 29, titleKey: 'learn.g8.c4.s29.title' },
  { id: 's30', kp: 30, titleKey: 'learn.g8.c4.s30.title' },
  { id: 's31', kp: 31, titleKey: 'learn.g8.c4.s31.title' },
])

const g8c5Sections = outlineSections('g8', 'c5', [
  { id: 's01', kp: 32, titleKey: 'learn.g8.c5.s01.title' },
  { id: 's02', kp: 33, titleKey: 'learn.g8.c5.s02.title' },
  { id: 's03', kp: 34, titleKey: 'learn.g8.c5.s03.title' },
  { id: 's04', kp: 35, titleKey: 'learn.g8.c5.s04.title', taskCategoryId: 'stoichiometry' },
  { id: 's05', kp: 36, titleKey: 'learn.g8.c5.s05.title', taskCategoryId: 'stoichiometry' },
])

const g9c1Sections = outlineSections('g9', 'c1', [
  { id: 's01', kp: 1, titleKey: 'learn.g9.c1.s01.title' },
  { id: 's02', kp: 2, titleKey: 'learn.g9.c1.s02.title' },
  { id: 's03', kp: 3, titleKey: 'learn.g9.c1.s03.title' },
  { id: 's04', kp: 4, titleKey: 'learn.g9.c1.s04.title' },
  { id: 's05', kp: 5, titleKey: 'learn.g9.c1.s05.title' },
  { id: 's06', kp: 6, titleKey: 'learn.g9.c1.s06.title' },
])

const g9c2Sections = outlineSections('g9', 'c2', [
  { id: 's01', kp: 1, titleKey: 'learn.g9.c2.s01.title' },
  { id: 's02', kp: 2, titleKey: 'learn.g9.c2.s02.title' },
  { id: 's03', kp: 3, titleKey: 'learn.g9.c2.s03.title' },
  { id: 's04', kp: 4, titleKey: 'learn.g9.c2.s04.title' },
  { id: 's05', kp: 5, titleKey: 'learn.g9.c2.s05.title' },
  { id: 's06', kp: 6, titleKey: 'learn.g9.c2.s06.title' },
  { id: 's07', kp: 7, titleKey: 'learn.g9.c2.s07.title' },
  { id: 's08', kp: 8, titleKey: 'learn.g9.c2.s08.title' },
])

const g9c3Sections = outlineSections('g9', 'c3', [
  { id: 's01', kp: 1, titleKey: 'learn.g9.c3.s01.title' },
  { id: 's02', kp: 2, titleKey: 'learn.g9.c3.s02.title' },
  { id: 's03', kp: 3, titleKey: 'learn.g9.c3.s03.title' },
  { id: 's04', kp: 4, titleKey: 'learn.g9.c3.s04.title' },
  { id: 's05', kp: 5, titleKey: 'learn.g9.c3.s05.title' },
  { id: 's06', kp: 6, titleKey: 'learn.g9.c3.s06.title' },
  { id: 's07', kp: 7, titleKey: 'learn.g9.c3.s07.title' },
  { id: 's08', kp: 8, titleKey: 'learn.g9.c3.s08.title' },
  { id: 's09', kp: 9, titleKey: 'learn.g9.c3.s09.title' },
  { id: 's10', kp: 10, titleKey: 'learn.g9.c3.s10.title' },
])

const g9c4Sections = outlineSections('g9', 'c4', [
  { id: 's01', kp: 1, titleKey: 'learn.g9.c4.s01.title' },
  { id: 's02', kp: 2, titleKey: 'learn.g9.c4.s02.title' },
  { id: 's03', kp: 3, titleKey: 'learn.g9.c4.s03.title' },
  { id: 's04', kp: 4, titleKey: 'learn.g9.c4.s04.title' },
  { id: 's05', kp: 5, titleKey: 'learn.g9.c4.s05.title' },
  { id: 's06', kp: 6, titleKey: 'learn.g9.c4.s06.title' },
  { id: 's07', kp: 7, titleKey: 'learn.g9.c4.s07.title' },
  { id: 's08', kp: 8, titleKey: 'learn.g9.c4.s08.title' },
  { id: 's09', kp: 9, titleKey: 'learn.g9.c4.s09.title' },
  { id: 's10', kp: 10, titleKey: 'learn.g9.c4.s10.title' },
  { id: 's11', kp: 11, titleKey: 'learn.g9.c4.s11.title' },
  { id: 's12', kp: 12, titleKey: 'learn.g9.c4.s12.title' },
  { id: 's13', kp: 13, titleKey: 'learn.g9.c4.s13.title' },
  { id: 's14', kp: 14, titleKey: 'learn.g9.c4.s14.title' },
  { id: 's15', kp: 15, titleKey: 'learn.g9.c4.s15.title' },
])

const g9c5Sections = outlineSections('g9', 'c5', [
  { id: 's01', kp: 1, titleKey: 'learn.g9.c5.s01.title' },
  { id: 's02', kp: 2, titleKey: 'learn.g9.c5.s02.title' },
  { id: 's03', kp: 3, titleKey: 'learn.g9.c5.s03.title' },
  { id: 's04', kp: 4, titleKey: 'learn.g9.c5.s04.title' },
])

const g9c6Sections = outlineSections('g9', 'c6', [
  { id: 's01', kp: 43, titleKey: 'learn.g9.c6.s01.title' },
  { id: 's02', kp: 44, titleKey: 'learn.g9.c6.s02.title' },
  { id: 's03', kp: 45, titleKey: 'learn.g9.c6.s03.title' },
  { id: 's04', kp: 46, titleKey: 'learn.g9.c6.s04.title' },
  { id: 's05', kp: 47, titleKey: 'learn.g9.c6.s05.title' },
  { id: 's06', kp: 48, titleKey: 'learn.g9.c6.s06.title' },
])

const g9c7Sections = outlineSections('g9', 'c7', [
  { id: 's01', kp: 49, titleKey: 'learn.g9.c7.s01.title', taskCategoryId: 'oge_prep' },
  { id: 's02', kp: 50, titleKey: 'learn.g9.c7.s02.title', taskCategoryId: 'oge_prep' },
  { id: 's03', kp: 51, titleKey: 'learn.g9.c7.s03.title', taskCategoryId: 'oge_prep' },
  { id: 's04', kp: 52, titleKey: 'learn.g9.c7.s04.title', taskCategoryId: 'oge_prep' },
  { id: 's05', kp: 53, titleKey: 'learn.g9.c7.s05.title', taskCategoryId: 'oge_prep' },
])

export const LEARN_GRADES: readonly LearnGrade[] = [
  {
    id: 'g7',
    order: 1,
    titleKey: 'learn.g7.title',
    textbookRefKey: 'learn.g7.textbook',
    chapters: [
      buildChapter('g7', 'c1', 1, 'learn.g7.c1.title', 'learn.g7.c1.summary', 'h2o', g7c1Sections),
      buildChapter('g7', 'c2', 2, 'learn.g7.c2.title', 'learn.g7.c2.summary', 'h2o', g7c2Sections),
      buildChapter('g7', 'c3', 3, 'learn.g7.c3.title', 'learn.g7.c3.summary', 'nacl', g7c3Sections),
      buildChapter('g7', 'c4', 4, 'learn.g7.c4.title', 'learn.g7.c4.summary', 'co2', g7c4Sections),
      buildChapter('g7', 'c5', 5, 'learn.g7.c5.title', 'learn.g7.c5.summary', 'h2o', g7c5Sections),
      buildChapter('g7', 'c6', 6, 'learn.g7.c6.title', 'learn.g7.c6.summary', 'h2o', g7c6Sections),
      buildChapter('g7', 'c7', 7, 'learn.g7.c7.title', 'learn.g7.c7.summary', 'nacl', g7c7Sections),
      buildChapter('g7', 'c8', 8, 'learn.g7.c8.title', 'learn.g7.c8.summary', 'fe2o3', g7c8Sections),
    ],
  },
  {
    id: 'g8',
    order: 2,
    titleKey: 'learn.g8.title',
    textbookRefKey: 'learn.g8.textbook',
    chapters: [
      buildChapter('g8', 'c1', 1, 'learn.g8.c1.title', 'learn.g8.c1.summary', 'h2o', g8c1Sections),
      buildChapter('g8', 'c2', 2, 'learn.g8.c2.title', 'learn.g8.c2.summary', 'nacl', g8c2Sections),
      buildChapter('g8', 'c3', 3, 'learn.g8.c3.title', 'learn.g8.c3.summary', 'h2o', g8c3Sections),
      buildChapter('g8', 'c4', 4, 'learn.g8.c4.title', 'learn.g8.c4.summary', 'hcl', g8c4Sections),
      buildChapter('g8', 'c5', 5, 'learn.g8.c5.title', 'learn.g8.c5.summary', 'nacl', g8c5Sections),
    ],
  },
  {
    id: 'g9',
    order: 3,
    titleKey: 'learn.g9.title',
    textbookRefKey: 'learn.g9.textbook',
    chapters: [
      buildChapter('g9', 'c1', 1, 'learn.g9.c1.title', 'learn.g9.c1.summary', 'fe2o3', g9c1Sections),
      buildChapter('g9', 'c2', 2, 'learn.g9.c2.title', 'learn.g9.c2.summary', 'al2o3', g9c2Sections),
      buildChapter('g9', 'c3', 3, 'learn.g9.c3.title', 'learn.g9.c3.summary', 'nacl', g9c3Sections),
      buildChapter('g9', 'c4', 4, 'learn.g9.c4.title', 'learn.g9.c4.summary', 'nacl', g9c4Sections),
      buildChapter('g9', 'c5', 5, 'learn.g9.c5.title', 'learn.g9.c5.summary', 'h2so4', g9c5Sections),
      buildChapter('g9', 'c6', 6, 'learn.g9.c6.title', 'learn.g9.c6.summary', 'nacl', g9c6Sections),
      buildChapter('g9', 'c7', 7, 'learn.g9.c7.title', 'learn.g9.c7.summary', 'h2so4', g9c7Sections),
    ],
  },
]

export function learnGradeById(id: string): LearnGrade | undefined {
  return LEARN_GRADES.find((g) => g.id === id)
}

export function learnChapterById(gradeId: string, chapterId: string): LearnChapter | undefined {
  return learnGradeById(gradeId)?.chapters.find((c) => c.id === chapterId)
}

export function learnSectionById(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): LearnSection | undefined {
  return learnChapterById(gradeId, chapterId)?.sections.find((s) => s.id === sectionId)
}

export function learnSectionPathId(section: LearnSection): string {
  return `${section.gradeId}-${section.chapterId}-${section.id}`
}

export function learnTotalSectionCount(): number {
  return LEARN_GRADES.reduce(
    (acc, g) => acc + g.chapters.reduce((a, c) => a + c.sections.length, 0),
    0,
  )
}

export function learnAllSections(): LearnSection[] {
  const out: LearnSection[] = []
  for (const g of LEARN_GRADES) {
    for (const c of g.chapters) {
      out.push(...c.sections)
    }
  }
  return out
}

/** Следующий § в том же классе (для learning path). */
export function learnNextSection(
  gradeId: string,
  chapterId: string,
  sectionId: string,
): { gradeId: string; chapterId: string; sectionId: string } | null {
  const grade = learnGradeById(gradeId)
  if (!grade) return null
  const flat: { chapterId: string; sectionId: string }[] = []
  for (const ch of grade.chapters) {
    for (const s of ch.sections) {
      flat.push({ chapterId: ch.id, sectionId: s.id })
    }
  }
  const i = flat.findIndex((x) => x.chapterId === chapterId && x.sectionId === sectionId)
  if (i < 0 || i >= flat.length - 1) return null
  const next = flat[i + 1]!
  return { gradeId, chapterId: next.chapterId, sectionId: next.sectionId }
}
