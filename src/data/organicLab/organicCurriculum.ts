/**
 * Учебная программа органической лаборатории по Kimyo 10.
 * Модули (~уроки): смотреть / собрать / уравнение / изомеры / название.
 */
import type { OrganicClassId } from '../researchLab/organicBuildCatalog'
import { G10_G11_EDU_EQUATIONS } from '../researchLab/g10g11Equations'
import { organicMoleculeById } from './organicMoleculeRegistry'

export type OrganicLessonMode = 'view' | 'build' | 'equation' | 'isomer' | 'name'

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
  /** Задания ISOMER_CHALLENGES (пустой = режим изомеров скрыт) */
  isomerChallengeIds: readonly string[]
  /** ID квиза NOMENCLATURE_QUIZZES (нет = режим названия скрыт) */
  nomenclatureQuizId?: string
  /** Молекула по умолчанию при входе в урок */
  defaultMolId: string
}

function L(
  partial: Omit<OrganicLesson, 'titleEn' | 'titleUz' | 'goalEn' | 'goalUz' | 'isomerChallengeIds'> & {
    titleEn?: string
    titleUz?: string
    goalEn?: string
    goalUz?: string
    isomerChallengeIds?: readonly string[]
  },
): OrganicLesson {
  return {
    ...partial,
    titleEn: partial.titleEn ?? partial.titleRu,
    titleUz: partial.titleUz ?? partial.titleRu,
    goalEn: partial.goalEn ?? partial.goalRu,
    goalUz: partial.goalUz ?? partial.goalRu,
    isomerChallengeIds: partial.isomerChallengeIds ?? [],
  }
}

const VIEW_ONLY = new Set(['glucose-pyranose', 'fructose', 'sucrose', 'triacetin'])

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
    id: 'isomers',
    chapter: 1,
    titleRu: 'Изомерия',
    titleEn: 'Isomerism',
    titleUz: 'Izomeriya',
    goalRu: 'Найти все структурные изомеры пентана и отличить спирт от эфира.',
    goalEn: 'Find all pentane isomers and tell alcohol from ether.',
    goalUz: 'Pentanning barcha izomerlarini toping; spirtni efirdan ajrating.',
    classId: 'alkane',
    challengeIds: ['n-butane', 'isobutane', 'n-pentane', 'isopentane', 'neopentane'],
    equationIds: ['g10-alkane-isomer'],
    isomerChallengeIds: ['c5h12', 'c4h10o'],
    defaultMolId: 'n-pentane',
  }),
  L({
    id: 'nomenclature',
    chapter: 1,
    titleRu: 'Номенклатура',
    titleEn: 'Nomenclature',
    titleUz: 'Nomenklatura',
    goalRu: 'Выбрать верный суффикс и название простых молекул.',
    goalEn: 'Pick the right suffix and name for simple molecules.',
    goalUz: 'Toʻgʻri suffiks va oddiy molekula nomini tanlang.',
    classId: 'all',
    challengeIds: ['methane', 'ethylene', 'ethanol', 'acetaldehyde', 'acetone'],
    equationIds: [],
    nomenclatureQuizId: 'basics-suffix',
    defaultMolId: 'methane',
  }),
  L({
    id: 'alkanes',
    chapter: 2,
    titleRu: 'Алканы',
    titleEn: 'Alkanes',
    titleUz: 'Alkanlar',
    goalRu: 'Собрать алканы и уравнять реакции галогенирования и горения.',
    goalEn: 'Build alkanes and balance halogenation and combustion equations.',
    goalUz: 'Alkanlarni yigʻing; galogenlash va yonish tenglamalarini tenglashtiring.',
    classId: 'alkane',
    challengeIds: ['methane', 'ethane', 'propane', 'n-butane', 'isobutane', 'n-pentane', 'isopentane'],
    equationIds: [
      'g10-alkane-ch4-cl2',
      'g10-alkane-ch4-burn',
      'g10-alkane-c2h6-burn',
      'g10-alkane-wurtz',
      'g10-alkane-isomer',
    ],
    isomerChallengeIds: ['c5h12', 'c6h14'],
    defaultMolId: 'methane',
  }),
  L({
    id: 'cycloalkanes',
    chapter: 2,
    titleRu: 'Циклоалканы',
    titleEn: 'Cycloalkanes',
    titleUz: 'Tsikloalkanlar',
    goalRu: 'Собрать кольцо и уравнять горение циклогексана.',
    goalEn: 'Build a ring and balance cyclohexane combustion.',
    goalUz: 'Halqa yigʻing; tsiklogeksan yonishini tenglashtiring.',
    classId: 'cycloalkane',
    challengeIds: ['cyclopropane', 'cyclopentane', 'cyclohexane'],
    equationIds: ['g10-cyclo-burn'],
    defaultMolId: 'cyclohexane',
  }),
  L({
    id: 'alkenes',
    chapter: 2,
    titleRu: 'Алкены',
    titleEn: 'Alkenes',
    titleUz: 'Alkenlar',
    goalRu: 'Собрать двойную связь и уравнения присоединения этилена.',
    goalEn: 'Build a double bond and ethylene addition equations.',
    goalUz: 'Qoʻsh bogʻ yigʻing; etilen qoʻshilish tenglamalarini bajaring.',
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
    goalEn: 'See conjugated double bonds and a polymerization equation.',
    goalUz: 'Konʼyugatsiyalangan qoʻsh bogʻlar va polimerlanish tenglamasini koʻring.',
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
    goalEn: 'Build a triple bond and acetylene equations.',
    goalUz: 'Uchli bogʻ yigʻing; atsetilen tenglamalarini bajaring.',
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
    goalEn: 'Build a benzene ring and substitution equations.',
    goalUz: 'Benzol halqasini yigʻing; oʻrinbosarlik tenglamalarini bajaring.',
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
    goalEn: 'Build chloromethane / chloroethane; practice an SN2 equation.',
    goalUz: 'Xlorometan / xloroetan yigʻing; SN2 tenglamasini bajaring.',
    classId: 'halo',
    challengeIds: ['chloromethane', 'chloroethane'],
    equationIds: ['g10-halo-sn2', 'g10-alkane-ch4-cl2'],
    defaultMolId: 'chloromethane',
  }),
  L({
    id: 'sources-oil',
    chapter: 2,
    titleRu: 'Нефть, газ и уголь',
    titleEn: 'Oil, gas and coal',
    titleUz: 'Neft, gaz va koʻmir',
    goalRu: 'Связать природные источники с крекингом и коксованием.',
    goalEn: 'Link natural sources to cracking and coking equations.',
    goalUz: 'Tabiiy manbalarni kreking va koksash tenglamalari bilan bogʻlang.',
    classId: 'all',
    challengeIds: ['methane', 'ethylene', 'benzene', 'propane'],
    equationIds: ['g10-alkane-cracking', 'g10-oil-cracking', 'g10-coal-coke', 'g10-alkene-pe'],
    defaultMolId: 'methane',
  }),
  L({
    id: 'alcohols',
    chapter: 3,
    titleRu: 'Спирты',
    titleEn: 'Alcohols',
    titleUz: 'Spirtlar',
    goalRu: 'Собрать спирты с группой –OH и уравнения реакций.',
    goalEn: 'Build alcohols with –OH and balance their reaction equations.',
    goalUz: '–OH guruhli spirtlarni yigʻing; reaksiya tenglamalarini tenglashtiring.',
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
    goalRu: 'Сравнить этиленгликоль и глицерин; уравнение нитрования глицерина.',
    goalEn: 'Compare ethylene glycol and glycerol; balance glycerol nitration.',
    goalUz: 'Etilenglikol va glitserinni solishtiring; glitserin nitratlashini tenglashtiring.',
    classId: 'polyol',
    challengeIds: ['ethylene-glycol', 'glycerol'],
    equationIds: ['g10-polyol-hno3'],
    defaultMolId: 'glycerol',
  }),
  L({
    id: 'phenols',
    chapter: 3,
    titleRu: 'Фенолы',
    titleEn: 'Phenols',
    titleUz: 'Fenollar',
    goalRu: 'Увидеть фенольный гидроксил на арене.',
    goalEn: 'See the phenolic hydroxyl on an arene.',
    goalUz: 'Aren ustidagi fenol gidroksilini koʻring.',
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
    goalRu: 'Собрать эфирную связь C–O–C; отличить от спирта.',
    goalEn: 'Build the C–O–C ether link; tell it apart from an alcohol.',
    goalUz: 'C–O–C efir bogʻini yigʻing; spirtdan ajrating.',
    classId: 'ether',
    challengeIds: ['dimethyl-ether', 'diethyl-ether'],
    equationIds: ['g10-ether-etoh'],
    isomerChallengeIds: ['c4h10o'],
    defaultMolId: 'diethyl-ether',
  }),
  L({
    id: 'aldehydes',
    chapter: 3,
    titleRu: 'Альдегиды',
    titleEn: 'Aldehydes',
    titleUz: 'Aldegidlar',
    goalRu: 'Собрать карбонильную группу альдегида.',
    goalEn: 'Build an aldehyde carbonyl group.',
    goalUz: 'Aldegid karbonil guruhini yigʻing.',
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
    goalRu: 'Собрать ацетон и уравнять гидрирование.',
    goalEn: 'Build acetone and balance its hydrogenation.',
    goalUz: 'Atseton yigʻing; gidrogenlashni tenglashtiring.',
    classId: 'ketone',
    challengeIds: ['acetone'],
    equationIds: ['g10-ketone-h2'],
    defaultMolId: 'acetone',
  }),
  L({
    id: 'acids',
    chapter: 3,
    titleRu: 'Карбоновые кислоты',
    titleEn: 'Carboxylic acids',
    titleUz: 'Karbon kislotalar',
    goalRu: 'Собрать карбоксильную группу и уравнение нейтрализации.',
    goalEn: 'Build a carboxyl group and a neutralization equation.',
    goalUz: 'Karboksil guruhini yigʻing; neytrallash tenglamasini bajaring.',
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
    goalEn: 'Build ethyl acetate; practice Fischer and hydrolysis equations.',
    goalUz: 'Etilatsetat yigʻing; Fisher va gidroliz tenglamalarini bajaring.',
    classId: 'ester',
    challengeIds: ['ethyl-acetate'],
    equationIds: ['g10-ester-fischer', 'g10-ester-hydrolysis', 'g10-ester-sapon'],
    defaultMolId: 'ethyl-acetate',
  }),
  L({
    id: 'fats',
    chapter: 3,
    titleRu: 'Жиры и мыло',
    titleEn: 'Fats and soap',
    titleUz: 'Yogʻlar va sovun',
    goalRu: 'Осмотреть модель триглицерида и уравнять омыление.',
    goalEn: 'Inspect a triglyceride model and balance saponification.',
    goalUz: 'Triglisertid modelini koʻring; sovunlashni tenglashtiring.',
    classId: 'ester',
    challengeIds: ['triacetin', 'glycerol', 'ethyl-acetate'],
    equationIds: ['g10-fat-sapon', 'g10-ester-sapon'],
    defaultMolId: 'triacetin',
  }),
  L({
    id: 'carbohydrates',
    chapter: 3,
    titleRu: 'Моносахариды',
    titleEn: 'Monosaccharides',
    titleUz: 'Monosaxaridlar',
    goalRu: 'Сравнить глюкозу и фруктозу; уравнения брожения и окисления.',
    goalEn: 'Compare glucose and fructose; fermentation and oxidation equations.',
    goalUz: 'Glyukoza va fruktozani solishtiring; fermentatsiya va oksidlanish tenglamalari.',
    classId: 'carb',
    challengeIds: ['glucose-open', 'glucose-pyranose', 'fructose'],
    equationIds: ['g10-carb-ferment', 'g10-carb-burn'],
    defaultMolId: 'glucose-pyranose',
  }),
  L({
    id: 'disaccharides',
    chapter: 3,
    titleRu: 'Ди- и полисахариды',
    titleEn: 'Di- and polysaccharides',
    titleUz: 'Di- va polisaxaridlar',
    goalRu: 'Увидеть сахарозу и уравнение гидролиза (путь к крахмалу и целлюлозе).',
    goalEn: 'See sucrose and its hydrolysis (path to starch and cellulose).',
    goalUz: 'Saxarozani va gidroliz tenglamasini koʻring (kraxmal va tsellyuloza yoʻli).',
    classId: 'carb',
    challengeIds: ['sucrose', 'glucose-pyranose', 'fructose'],
    equationIds: ['g10-carb-sucrose'],
    defaultMolId: 'sucrose',
  }),
  L({
    id: 'nitrogen',
    chapter: 3,
    titleRu: 'Азотсодержащие',
    titleEn: 'Nitrogen compounds',
    titleUz: 'Azotli birikmalar',
    goalRu: 'Собрать метиламин и анилин.',
    goalEn: 'Build methylamine and aniline.',
    goalUz: 'Metilamin va anilinni yigʻing.',
    classId: 'nitrogen',
    challengeIds: ['methylamine', 'aniline'],
    equationIds: ['g10-amine-nh3-rx', 'g10-nitro-aniline'],
    defaultMolId: 'aniline',
  }),
  L({
    id: 'industry-env',
    chapter: 4,
    titleRu: 'Промышленность и отходы',
    titleEn: 'Industry and waste',
    titleUz: 'Sanoat va chiqindilar',
    goalRu: 'Связать полимеры и переработку с уравнениями крекинга и полиэтилена.',
    goalEn: 'Link polymers and recycling to cracking and polyethylene equations.',
    goalUz: 'Polimerlar va qayta ishlashni kreking va polietilen tenglamalari bilan bogʻlang.',
    classId: 'all',
    challengeIds: ['ethylene', 'styrene', 'benzene', 'ethanol'],
    equationIds: ['g10-alkene-pe', 'g10-styrene-poly', 'g10-alkane-cracking'],
    defaultMolId: 'ethylene',
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
    ru: 'IV. Промышленность и среда',
    en: 'IV. Industry and environment',
    uz: 'IV. Sanoat va muhit',
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
 */
export function resolveOrganicLessonFromLearn(
  chapter: number,
  section?: number,
): OrganicLesson {
  const ch = Math.min(4, Math.max(1, Math.floor(chapter))) as 1 | 2 | 3 | 4
  const s = section != null && Number.isFinite(section) ? Math.floor(section) : undefined

  if (ch === 1) {
    if (s == null) return ORGANIC_CURRICULUM_BY_ID['intro-structure']!
    if (s <= 3) return ORGANIC_CURRICULUM_BY_ID['intro-structure']!
    if (s <= 4) return ORGANIC_CURRICULUM_BY_ID['isomers']!
    if (s <= 8) return ORGANIC_CURRICULUM_BY_ID['nomenclature']!
    return ORGANIC_CURRICULUM_BY_ID['intro-structure']!
  }

  if (ch === 2) {
    if (s == null) return ORGANIC_CURRICULUM_BY_ID['alkanes']!
    if (s <= 4) return ORGANIC_CURRICULUM_BY_ID['alkanes']!
    if (s <= 6) return ORGANIC_CURRICULUM_BY_ID['cycloalkanes']!
    if (s <= 9) return ORGANIC_CURRICULUM_BY_ID['alkenes']!
    if (s <= 12) return ORGANIC_CURRICULUM_BY_ID['alkadienes']!
    if (s <= 14) return ORGANIC_CURRICULUM_BY_ID['alkynes']!
    if (s <= 17) return ORGANIC_CURRICULUM_BY_ID['arenes']!
    return ORGANIC_CURRICULUM_BY_ID['sources-oil']!
  }

  if (ch === 3) {
    if (s == null) return ORGANIC_CURRICULUM_BY_ID['alcohols']!
    if (s <= 2) return ORGANIC_CURRICULUM_BY_ID['alcohols']!
    if (s <= 5) return ORGANIC_CURRICULUM_BY_ID['polyols']!
    if (s <= 7) return ORGANIC_CURRICULUM_BY_ID['phenols']!
    if (s <= 8) return ORGANIC_CURRICULUM_BY_ID['ethers']!
    if (s <= 10) return ORGANIC_CURRICULUM_BY_ID['aldehydes']!
    if (s <= 11) return ORGANIC_CURRICULUM_BY_ID['ketones']!
    if (s <= 13) return ORGANIC_CURRICULUM_BY_ID['acids']!
    if (s <= 15) return ORGANIC_CURRICULUM_BY_ID['esters']!
    if (s <= 17) return ORGANIC_CURRICULUM_BY_ID['fats']!
    if (s <= 18) return ORGANIC_CURRICULUM_BY_ID['carbohydrates']!
    if (s <= 21) return ORGANIC_CURRICULUM_BY_ID['disaccharides']!
    return ORGANIC_CURRICULUM_BY_ID['nitrogen']!
  }

  return ORGANIC_CURRICULUM_BY_ID['industry-env']!
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
  return lesson.challengeIds.some((id) => !VIEW_ONLY.has(id) && organicMoleculeById[id]?.challengeId)
}

export function lessonHasEquation(lesson: OrganicLesson): boolean {
  return lesson.equationIds.length > 0
}

export function lessonHasIsomer(lesson: OrganicLesson): boolean {
  return lesson.isomerChallengeIds.length > 0
}

export function lessonHasName(lesson: OrganicLesson): boolean {
  return Boolean(lesson.nomenclatureQuizId)
}
