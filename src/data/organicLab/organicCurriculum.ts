/**
 * Учебная программа органической лаборатории по Kimyo 10.
 * Модули (~уроки), не 1:1 с каждым § — практика смотреть / собрать / уравнение.
 */
import type { OrganicClassId } from '../researchLab/organicBuildCatalog'
import { G10_G11_EDU_EQUATIONS } from '../researchLab/g10g11Equations'
import { organicMoleculeById } from './organicMoleculeRegistry'

export type OrganicLessonMode = 'view' | 'build' | 'equation'

export type OrganicLesson = {
  id: string
  /** Глава Kimyo 10 (1–4) */
  chapter: 1 | 2 | 3 | 4
  titleRu: string
  titleEn: string
  titleUz: string
  goalRu: string
  goalEn: string
  goalUz: string
  /** Основной класс для чипов молекул */
  classId: OrganicClassId | 'all'
  /** ID из organicBuildCatalog / organicMoleculeRegistry */
  challengeIds: readonly string[]
  /** Уравнения g10 из g10g11Equations (пустой = режим уравнения скрыт) */
  equationIds: readonly string[]
  /** Молекула по умолчанию при входе в урок */
  defaultMolId: string
}

function L(
  partial: Omit<OrganicLesson, 'titleEn' | 'titleUz' | 'goalEn' | 'goalUz'> & {
    titleEn?: string
    titleUz?: string
    goalEn?: string
    goalUz?: string
  },
): OrganicLesson {
  return {
    ...partial,
    titleEn: partial.titleEn ?? partial.titleRu,
    titleUz: partial.titleUz ?? partial.titleRu,
    goalEn: partial.goalEn ?? partial.goalRu,
    goalUz: partial.goalUz ?? partial.goalRu,
  }
}

export const ORGANIC_CURRICULUM: readonly OrganicLesson[] = [
  L({
    id: 'intro-structure',
    chapter: 1,
    titleRu: 'Строение и первые молекулы',
    titleEn: 'Structure and first molecules',
    titleUz: 'Tuzilish va birinchi molekulalar',
    goalRu: 'Увидеть метан и этан в 3D, понять валентность углерода.',
    goalEn: 'See methane and ethane in 3D; understand carbon valence.',
    goalUz: 'Metan va etanni 3D da koʻring; uglerod valentligini tushuning.',
    classId: 'alkane',
    challengeIds: ['methane', 'ethane'],
    equationIds: [],
    defaultMolId: 'methane',
  }),
  L({
    id: 'alkanes',
    chapter: 2,
    titleRu: 'Алканы',
    titleEn: 'Alkanes',
    titleUz: 'Alkanlar',
    goalRu: 'Собрать алканы и уравнять реакции галогенирования и горения.',
    classId: 'alkane',
    challengeIds: ['methane', 'ethane', 'propane', 'n-butane', 'isobutane'],
    equationIds: [
      'g10-alkane-ch4-cl2',
      'g10-alkane-ch4-burn',
      'g10-alkane-c2h6-burn',
      'g10-alkane-wurtz',
    ],
    defaultMolId: 'methane',
  }),
  L({
    id: 'cycloalkanes',
    chapter: 2,
    titleRu: 'Циклоалканы',
    titleEn: 'Cycloalkanes',
    titleUz: 'Tsikloalkanlar',
    goalRu: 'Собрать кольцо и сравнить с цепными алканами.',
    classId: 'cycloalkane',
    challengeIds: ['cyclopropane', 'cyclopentane', 'cyclohexane'],
    equationIds: [],
    defaultMolId: 'cyclohexane',
  }),
  L({
    id: 'alkenes',
    chapter: 2,
    titleRu: 'Алкены',
    titleEn: 'Alkenes',
    titleUz: 'Alkenlar',
    goalRu: 'Собрать двойную связь и уравнения присоединения этилена.',
    classId: 'alkene',
    challengeIds: ['ethylene', 'propene'],
    equationIds: [
      'g10-alkene-c2h4-br2',
      'g10-alkene-c2h4-h2',
      'g10-alkene-c2h4-h2o',
      'g10-alkene-markovnikov',
    ],
    defaultMolId: 'ethylene',
  }),
  L({
    id: 'alkadienes',
    chapter: 2,
    titleRu: 'Алкадиены и каучук',
    titleEn: 'Alkadienes and rubber',
    titleUz: 'Alkadiyenlar va kauchuk',
    goalRu: 'Увидеть сопряжённые двойные связи и уравнение полимеризации.',
    classId: 'alkadiene',
    challengeIds: ['butadiene', 'isoprene'],
    equationIds: ['g10-diene-rubber'],
    defaultMolId: 'butadiene',
  }),
  L({
    id: 'alkynes',
    chapter: 2,
    titleRu: 'Алкины',
    titleEn: 'Alkynes',
    titleUz: 'Alkinlar',
    goalRu: 'Собрать тройную связь и уравнения ацетилена.',
    classId: 'alkyne',
    challengeIds: ['acetylene', 'propyne'],
    equationIds: ['g10-alkyne-carbide', 'g10-alkyne-h2', 'g10-alkyne-kucherov'],
    defaultMolId: 'acetylene',
  }),
  L({
    id: 'arenes',
    chapter: 2,
    titleRu: 'Арены',
    titleEn: 'Arenes',
    titleUz: 'Arenlar',
    goalRu: 'Собрать бензольное кольцо и уравнения замещения.',
    classId: 'arene',
    challengeIds: ['benzene', 'toluene', 'styrene'],
    equationIds: ['g10-arene-br2', 'g10-arene-hno3', 'g10-arene-friedel', 'g10-styrene-poly'],
    defaultMolId: 'benzene',
  }),
  L({
    id: 'halo',
    chapter: 2,
    titleRu: 'Галогенпроизводные',
    titleEn: 'Haloalkanes',
    titleUz: 'Galogenli birikmalar',
    goalRu: 'Собрать хлорметан / хлорэтан; уравнение SN2.',
    classId: 'halo',
    challengeIds: ['chloromethane', 'chloroethane'],
    equationIds: ['g10-halo-sn2', 'g10-alkane-ch4-cl2'],
    defaultMolId: 'chloromethane',
  }),
  L({
    id: 'alcohols',
    chapter: 3,
    titleRu: 'Спирты',
    titleEn: 'Alcohols',
    titleUz: 'Spirtlar',
    goalRu: 'Собрать спирты с группой –OH и уравнения реакций.',
    classId: 'alcohol',
    challengeIds: ['methanol', 'ethanol', 'propanol'],
    equationIds: ['g10-alcohol-meoh', 'g10-alcohol-na', 'g10-alcohol-hbr', 'g10-alkene-dehydration'],
    defaultMolId: 'ethanol',
  }),
  L({
    id: 'polyols',
    chapter: 3,
    titleRu: 'Многоатомные спирты',
    titleEn: 'Polyols',
    titleUz: 'Koʻp atomli spirtlar',
    goalRu: 'Сравнить этиленгликоль и глицерин в 3D.',
    classId: 'polyol',
    challengeIds: ['ethylene-glycol', 'glycerol'],
    equationIds: [],
    defaultMolId: 'glycerol',
  }),
  L({
    id: 'phenols',
    chapter: 3,
    titleRu: 'Фенолы',
    titleEn: 'Phenols',
    titleUz: 'Fenollar',
    goalRu: 'Увидеть фенольный гидроксил на арене.',
    classId: 'phenol',
    challengeIds: ['phenol'],
    equationIds: ['g10-phenol-naoh'],
    defaultMolId: 'phenol',
  }),
  L({
    id: 'ethers',
    chapter: 3,
    titleRu: 'Простые эфиры',
    titleEn: 'Ethers',
    titleUz: 'Oddiy efirlar',
    goalRu: 'Собрать эфирную связь C–O–C.',
    classId: 'ether',
    challengeIds: ['dimethyl-ether', 'diethyl-ether'],
    equationIds: ['g10-ether-etoh'],
    defaultMolId: 'diethyl-ether',
  }),
  L({
    id: 'aldehydes',
    chapter: 3,
    titleRu: 'Альдегиды',
    titleEn: 'Aldehydes',
    titleUz: 'Aldegidlar',
    goalRu: 'Собрать карбонильную группу альдегида.',
    classId: 'aldehyde',
    challengeIds: ['formaldehyde', 'acetaldehyde'],
    equationIds: ['g10-ald-ox', 'g10-ald-silver'],
    defaultMolId: 'acetaldehyde',
  }),
  L({
    id: 'ketones',
    chapter: 3,
    titleRu: 'Кетоны',
    titleEn: 'Ketones',
    titleUz: 'Ketonlar',
    goalRu: 'Собрать ацетон и отличить от альдегида.',
    classId: 'ketone',
    challengeIds: ['acetone'],
    equationIds: [],
    defaultMolId: 'acetone',
  }),
  L({
    id: 'acids',
    chapter: 3,
    titleRu: 'Карбоновые кислоты',
    titleEn: 'Carboxylic acids',
    titleUz: 'Karbon kislotalar',
    goalRu: 'Собрать карбоксильную группу и уравнение нейтрализации.',
    classId: 'acid',
    challengeIds: ['formic-acid', 'acetic-acid'],
    equationIds: ['g10-acid-naoh'],
    defaultMolId: 'acetic-acid',
  }),
  L({
    id: 'esters',
    chapter: 3,
    titleRu: 'Сложные эфиры',
    titleEn: 'Esters',
    titleUz: 'Murakkab efirlar',
    goalRu: 'Собрать этилацетат; уравнения Фишера и гидролиза.',
    classId: 'ester',
    challengeIds: ['ethyl-acetate'],
    equationIds: ['g10-ester-fischer', 'g10-ester-hydrolysis', 'g10-ester-sapon'],
    defaultMolId: 'ethyl-acetate',
  }),
  L({
    id: 'carbohydrates',
    chapter: 3,
    titleRu: 'Углеводы',
    titleEn: 'Carbohydrates',
    titleUz: 'Uglevodlar',
    goalRu: 'Осмотреть глюкозу и уравнения брожения / горения.',
    classId: 'carb',
    challengeIds: ['glucose-open', 'glucose-pyranose'],
    equationIds: ['g10-carb-ferment', 'g10-carb-burn', 'g10-carb-sucrose'],
    defaultMolId: 'glucose-pyranose',
  }),
  L({
    id: 'nitrogen',
    chapter: 3,
    titleRu: 'Азотсодержащие',
    titleEn: 'Nitrogen compounds',
    titleUz: 'Azotli birikmalar',
    goalRu: 'Собрать метиламин и анилин.',
    classId: 'nitrogen',
    challengeIds: ['methylamine', 'aniline'],
    equationIds: ['g10-amine-nh3-rx', 'g10-nitro-aniline'],
    defaultMolId: 'aniline',
  }),
  L({
    id: 'sources-overview',
    chapter: 4,
    titleRu: 'Источники и обзор',
    titleEn: 'Sources and overview',
    titleUz: 'Manbalar va koʻrib chiqish',
    goalRu: 'Повторить ключевые молекулы углеводородов из природного газа и нефти.',
    classId: 'all',
    challengeIds: ['methane', 'ethylene', 'benzene', 'ethanol'],
    equationIds: ['g10-alkane-cracking', 'g10-alkene-pe'],
    defaultMolId: 'methane',
  }),
]

export const ORGANIC_CURRICULUM_BY_ID: Readonly<Record<string, OrganicLesson>> = Object.fromEntries(
  ORGANIC_CURRICULUM.map((l) => [l.id, l]),
)

export const ORGANIC_CHAPTER_LABELS: Record<
  1 | 2 | 3 | 4,
  { ru: string; en: string; uz: string }
> = {
  1: {
    ru: 'I. Теория строения',
    en: 'I. Structure theory',
    uz: 'I. Tuzilish nazariyasi',
  },
  2: {
    ru: 'II. Углеводороды',
    en: 'II. Hydrocarbons',
    uz: 'II. Uglevodorodlar',
  },
  3: {
    ru: 'III. Кислород- и N-соединения',
    en: 'III. O- and N-compounds',
    uz: 'III. O- va N-birikmalar',
  },
  4: {
    ru: 'IV. Обзор',
    en: 'IV. Overview',
    uz: 'IV. Koʻrib chiqish',
  },
}

export function pickLessonTitle(lesson: OrganicLesson, locale: string): string {
  if (locale === 'en') return lesson.titleEn
  if (locale === 'uz') return lesson.titleUz
  return lesson.titleRu
}

export function pickLessonGoal(lesson: OrganicLesson, locale: string): string {
  if (locale === 'en') return lesson.goalEn
  if (locale === 'uz') return lesson.goalUz
  return lesson.goalRu
}

export function pickChapterLabel(chapter: 1 | 2 | 3 | 4, locale: string): string {
  const Lbl = ORGANIC_CHAPTER_LABELS[chapter]
  if (locale === 'en') return Lbl.en
  if (locale === 'uz') return Lbl.uz
  return Lbl.ru
}

export function lessonsByChapter(chapter: 1 | 2 | 3 | 4): OrganicLesson[] {
  return ORGANIC_CURRICULUM.filter((l) => l.chapter === chapter)
}

/** Урок по ID challenge / mol (первая подходящая запись программы). */
export function lessonForMoleculeId(molId: string): OrganicLesson | undefined {
  return ORGANIC_CURRICULUM.find((l) => l.challengeIds.includes(molId))
}

export function lessonForChallengeId(challengeId: string): OrganicLesson | undefined {
  return lessonForMoleculeId(challengeId)
}

/**
 * Маппинг Learn g10 chapter (+ опционально section) → ближайший урок лаборатории.
 * Не 1:1 с каждым § — chapter-level с грубой секционной эвристикой.
 */
export function resolveOrganicLessonFromLearn(
  chapter: number,
  section?: number,
): OrganicLesson {
  const ch = Math.min(4, Math.max(1, Math.floor(chapter))) as 1 | 2 | 3 | 4
  const s = section != null && Number.isFinite(section) ? Math.floor(section) : undefined

  if (ch === 1) return ORGANIC_CURRICULUM_BY_ID['intro-structure']!

  if (ch === 2) {
    if (s == null) return ORGANIC_CURRICULUM_BY_ID['alkanes']!
    if (s <= 4) return ORGANIC_CURRICULUM_BY_ID['alkanes']!
    if (s <= 6) return ORGANIC_CURRICULUM_BY_ID['cycloalkanes']!
    if (s <= 9) return ORGANIC_CURRICULUM_BY_ID['alkenes']!
    if (s <= 12) return ORGANIC_CURRICULUM_BY_ID['alkadienes']!
    if (s <= 14) return ORGANIC_CURRICULUM_BY_ID['alkynes']!
    if (s <= 17) return ORGANIC_CURRICULUM_BY_ID['arenes']!
    return ORGANIC_CURRICULUM_BY_ID['sources-overview']!
  }

  if (ch === 3) {
    if (s == null) return ORGANIC_CURRICULUM_BY_ID['alcohols']!
    if (s <= 4) return ORGANIC_CURRICULUM_BY_ID['alcohols']!
    if (s <= 6) return ORGANIC_CURRICULUM_BY_ID['polyols']!
    if (s <= 8) return ORGANIC_CURRICULUM_BY_ID['phenols']!
    if (s <= 10) return ORGANIC_CURRICULUM_BY_ID['ethers']!
    if (s <= 12) return ORGANIC_CURRICULUM_BY_ID['aldehydes']!
    if (s <= 14) return ORGANIC_CURRICULUM_BY_ID['ketones']!
    if (s <= 16) return ORGANIC_CURRICULUM_BY_ID['acids']!
    if (s <= 18) return ORGANIC_CURRICULUM_BY_ID['esters']!
    if (s <= 22) return ORGANIC_CURRICULUM_BY_ID['carbohydrates']!
    return ORGANIC_CURRICULUM_BY_ID['nitrogen']!
  }

  return ORGANIC_CURRICULUM_BY_ID['sources-overview']!
}

/** Валидные equationIds урока (отфильтровать устаревшие). */
export function equationsForLesson(lesson: OrganicLesson) {
  const set = new Set(lesson.equationIds)
  return G10_G11_EDU_EQUATIONS.filter((e) => set.has(e.id))
}

export function defaultMolForLesson(lesson: OrganicLesson): string {
  if (organicMoleculeById[lesson.defaultMolId]) return lesson.defaultMolId
  for (const id of lesson.challengeIds) {
    if (organicMoleculeById[id]) return id
  }
  return 'methane'
}

export function lessonHasBuild(lesson: OrganicLesson): boolean {
  return lesson.challengeIds.some((id) => id !== 'glucose-pyranose' && id !== 'fructose' && id !== 'sucrose')
}

export function lessonHasEquation(lesson: OrganicLesson): boolean {
  return lesson.equationIds.length > 0
}
