/**
 * Органика v2 — уроки страницы #/organic поверх программы organicCurriculum.ts (id уроков те же: на них 310 ссылок учебника).
 * Здесь: молекулы урока (все 329 молекул реестра распределены по урокам), режимы, задания Конструктора,
 * формулы для галереи изомеров, реакции урока (сгенерированы из ссылок учебника и параграфов).
 */
import type { ConstructorTask } from '../../components/organicV2/contracts'
import { ISOMER_CHALLENGES } from '../researchLab/researchLabData'
import {
  ORGANIC_CURRICULUM,
  ORGANIC_CURRICULUM_BY_ID,
  type OrganicLesson,
} from './organicCurriculum'
import { ORGANIC_LESSON_REACTIONS } from './organicLessonReactions.gen'
import { organicMoleculeById } from './organicMoleculeRegistry'

/** Режимы страницы v2. */
export type OV2Mode = 'molecule' | 'constructor' | 'isomers' | 'synthesis' | 'reactions' | 'name'
export const OV2_MODES: readonly OV2Mode[] = ['molecule', 'constructor', 'isomers', 'synthesis', 'reactions', 'name']

/**
 * Молекулы, добавленные в уроки v2 (раньше 81 молекула реестра не была ни в одном уроке, а уроки
 * «Строение», «Галогенпроизводные», «Азот», «Промышленность» были почти пустыми).
 */
export const LESSON_EXTRA_MOLECULES: Readonly<Record<string, readonly string[]>> = {
  // гл. I: sp³ → sp² → sp (метан, этилен, ацетилен, бензол), функциональные группы на простых примерах
  'intro-structure': [
    'methane', 'ethane', 'propane', 'ethylene', 'acetylene', 'benzene', 'cyclopropane', 'cyclohexane',
    'methanol', 'ethanol', 'formaldehyde', 'acetic-acid', 'methylamine', 'chloromethane',
  ],
  isomers: ['tetraethylmethane', 'dimethyldibutylmethane', 'cis-but-2-ene', 'trans-but-2-ene', 'but-2-ene'],
  'reaction-types': ['chloroethane', 'ethylene', 'ethanol', '1-2-dichloroethane', 'chloromethane'],
  nomenclature: ['3-chloro-3-methylpentane', '4-ethyl-5-5-6-trimethylhept-2-yne', '3-5-dimethylhexa-1-3-diene'],
  alkanes: ['n-octane', 'n-nonane', 'n-decane'],
  cycloalkanes: ['adamantane', '1-2-dimethylcyclopentane', 'cyclodecane'],
  alkadienes: ['penta-1-3-diene', '3-5-dimethylhexa-1-3-diene', 'beta-carotene'],
  alkynes: ['vinylacetylene', '4-ethyl-5-5-6-trimethylhept-2-yne'],
  arenes: ['divinylbenzene', 'benzenesulfonic-acid'],
  halo: [
    'chloromethane', 'dichloromethane', 'chloroform', 'tetrachloromethane', 'bromomethane', 'iodoform', 'chloroethane',
    '1-2-dichloroethane', '1-chloropropane', '2-chloropropane', '1-chlorobutane', '2-chlorobutane', '1-iodobutane',
    '3-chloro-3-methylpentane', 'vinyl-chloride', 'chloroprene', 'chlorobenzene', 'benzyl-chloride',
    'hexachlorocyclohexane',
  ],
  'sources-oil': [
    'n-octane', 'n-nonane', 'n-decane', 'n-undecane', 'n-dodecane', 'n-tridecane', 'n-tetradecane', 'n-hexadecane',
    'n-octadecane', 'n-nonadecane', 'n-tricosane', 'n-pentacosane', 'n-octacosane', 'n-dotriacontane',
    'n-pentatriacontane', 'n-octatriacontane',
  ],
  alcohols: ['cyclohexanol', '3-phenylpropanol', 'cinnamyl-alcohol', 'ethyl-nitrate', 'ethyl-hydrogen-sulfate'],
  polyols: ['pentaerythritol', 'nitroglycerin'],
  phenols: ['eugenol', 'guaiacol', 'phenolphthalein', 'salicylic-acid'],
  ethers: ['propyl-butyl-ether'],
  ketones: ['cyclohexanone', 'acetophenone', 'benzophenone', 'diacetyl', 'acetylacetone'],
  acids: [
    '3-methylbutanoic-acid', 'pivalic-acid', 'oxalic-acid', 'succinic-acid', 'adipic-acid', 'malic-acid',
    'citric-acid', 'levulinic-acid', 'salicylic-acid', 'aspirin', 'ascorbic-acid',
  ],
  esters: ['propyl-formate', 'pentyl-acetate', 'acetic-anhydride', 'aspirin'],
  fats: ['dioleoyl-stearoyl-glycerol', 'stearopalmitolein', 'distearopalmitin'],
  carbohydrates: ['glucose-pyranose', 'fructose'],
  disaccharides: ['sucrose'],
  nitrogen: [
    'methylamine', 'aniline', 'nitrobenzene', '2-4-6-trinitrotoluene', 'pentanamide', 'urea', 'glycine',
    'acrylonitrile', 'pyridine', 'pyrrole', 'hexamine', 'adrenaline',
  ],
  'industry-env': [
    'propene', 'vinyl-chloride', 'butadiene', 'isoprene', 'chloroprene', 'acrylonitrile', 'terephthalic-acid',
    'ethylene-glycol', 'adipic-acid', 'urea', 'methanol', 'acetic-acid', 'n-octane', 'isobutane',
  ],
}

/** Новые цели уроков, которые были почти пустыми (RU/EN/UZ). */
export const LESSON_GOALS_V2: Readonly<Record<string, readonly [string, string, string]>> = {
  'intro-structure': [
    'Углерод четырёхвалентен: метан — тетраэдр sp³ (109,5°), этилен — плоскость sp² (120°), ацетилен — линия sp (180°). Покрути молекулы, включи слой «гибридизация» и собери их в Конструкторе — водород дорисуется сам.',
    'Carbon is tetravalent: methane is an sp³ tetrahedron (109.5°), ethylene an sp² plane (120°), acetylene an sp line (180°). Rotate them, turn on the hybridization layer and build them in the Constructor — hydrogens are added automatically.',
    'Uglerod toʻrt valentli: metan — sp³ tetraedr (109,5°), etilen — sp² tekislik (120°), atsetilen — sp chiziq (180°). Molekulalarni aylantiring, «gibridlanish» qatlamini yoqing va Konstruktorda yigʻing — vodorod oʻzi qoʻshiladi.',
  ],
  halo: [
    'Галогенпроизводные: от хлорметана до хлороформа и винилхлорида. Как атом галогена попадает в молекулу (замещение, присоединение HCl) и что из него получают.',
    'Haloalkanes: from chloromethane to chloroform and vinyl chloride. How a halogen atom enters a molecule (substitution, HCl addition) and what is made from it.',
    'Galogenli hosilalar: xlormetandan xloroform va vinilxloridgacha. Galogen atomi molekulaga qanday kiradi (oʻrin olish, HCl birikishi) va undan nima olinadi.',
  ],
  nitrogen: [
    'Азотсодержащие вещества: нитробензол → анилин (реакция Зинина), амины, мочевина, глицин, пиридин и пиррол. Найди атом N и посмотри, как меняется его окружение.',
    'Nitrogen compounds: nitrobenzene → aniline (Zinin reaction), amines, urea, glycine, pyridine and pyrrole. Find the N atom and see how its surroundings change.',
    'Azotli moddalar: nitrobenzol → anilin (Zinin reaksiyasi), aminlar, mochevina, glitsin, piridin va pirrol. N atomini toping va uning atrofi qanday oʻzgarishini koʻring.',
  ],
  'industry-env': [
    'Из чего делают пластмассы и каучуки: мономеры (этилен, пропилен, винилхлорид, бутадиен, стирол) и полимеризация; крекинг нефти; терефталевая кислота и этиленгликоль для бутылок ПЭТ.',
    'What plastics and rubbers are made from: monomers (ethylene, propylene, vinyl chloride, butadiene, styrene) and polymerization; oil cracking; terephthalic acid and ethylene glycol for PET bottles.',
    'Plastmassa va kauchuk nimadan olinadi: monomerlar (etilen, propilen, vinilxlorid, butadiyen, stirol) va polimerlanish; neft krekingi; PET butilkalari uchun tereftal kislota va etilenglikol.',
  ],
}

/** Слишком крупные для «собери по названию» (жиры, сахара в циклической форме, полиены, длинные цепи). */
const MAX_BUILD_HEAVY = 18

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
/** «C₅H₁₂» → «C5H12» */
export const asciiFormula = (f: string): string => f.replace(/[₀-₉]/g, (d) => SUB[d] ?? d)

/** Число тяжёлых атомов по брутто-формуле (C5H12O → 6). */
export function heavyAtomCount(formula: string): number {
  let n = 0
  for (const m of asciiFormula(formula).matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (m[1] === 'H') continue
    n += m[2] ? Number(m[2]) : 1
  }
  return n
}

/**
 * Порядок молекул «от простого к сложному, как в учебнике» там, где задания и добавленные молекулы шли вперемешку:
 * перечисленные id — первыми и в этом порядке, остальные молекулы урока — следом в прежнем порядке.
 */
export const LESSON_MOLECULE_ORDER: Readonly<Record<string, readonly string[]>> = {
  // § 1.6: замещение (метан → хлорметан, этан → хлорэтан), присоединение, элиминирование, изомеризация, конденсация
  'reaction-types': [
    'methane', 'chloromethane', 'ethane', 'chloroethane', 'ethylene', 'ethanol', '1-2-dichloroethane', 'propane', 'propene',
    'n-pentane', 'isopentane', 'acetaldehyde', '3-hydroxybutanal', 'ethylene-glycol', 'terephthalic-acid',
  ],
  // сначала простые названия (метан … ацетон), потом разветвлённые алканы, кратные связи, группы; цистеин — последним
  nomenclature: [
    'methane', 'ethylene', 'ethanol', 'acetaldehyde', 'acetone', 'isobutane', '2-methylpentane', '2-2-dimethylbutane',
    '2-3-dimethylbutane', 'isobutylene', 'butadiene', 'butan-2-ol', 'butanone', 'propanoic-acid', '3-chloro-3-methylpentane',
    '4-bromomethylheptane', '3-5-dimethylhexa-1-3-diene', '4-ethyl-5-5-6-trimethylhept-2-yne', 'cysteine',
  ],
  // бутадиен-1,3 — главный; пентадиен-1,3 рядом со своими цис/транс-формами; β-каротин — последним
  alkadienes: [
    'butadiene', 'propadiene', 'buta-1-2-diene', 'penta-1-2-diene', 'penta-1-3-diene', 'cis-penta-1-3-diene',
    'trans-penta-1-3-diene', 'penta-1-4-diene', 'hexa-1-5-diene', 'isoprene', '3-methylbuta-1-2-diene',
    '3-methylhexa-1-5-diene', '3-5-dimethylhexa-1-3-diene', 'but-2-yne', 'chloroprene', '1-4-dibromobut-2-ene',
    '3-4-dibromobut-1-ene', 'n-butane', 'ethanol', 'styrene', 'beta-carotene',
  ],
  // газ (C1–C4) → модели практического занятия (разветвлённые, циклы, алкены, алкины) → длинные алканы нефти по длине цепи
  'sources-oil': [
    'methane', 'ethane', 'propane', 'n-butane', 'isobutane', 'neopentane', '2-3-dimethylhexane', 'cyclobutane',
    'cyclopentane', 'but-2-ene', '2-methylbut-1-ene', '2-methylbut-2-ene', '2-methylpent-2-ene', '3-3-dimethylbut-1-ene',
    '3-3-dimethylpent-1-ene', '3-4-dimethylpent-1-ene', 'acetylene', 'propyne', '3-3-dimethylbut-1-yne',
    '1-2-dichloroethane',
  ],
  // все формы глюкозы подряд, затем фруктоза, рибоза, триозы; продукты реакций — в конце
  carbohydrates: [
    'glucose-open', 'alpha-glucopyranose', 'glucose-pyranose', 'fructose-open', 'fructofuranose', 'fructose', 'ribose',
    'glyceraldehyde', 'dihydroxyacetone',
  ],
  // по цели урока: метиламин, нитробензол → анилин (Зинин), мочевина, глицин, пиррол и пиридин; крупные — в конце
  nitrogen: [
    'methylamine', 'nitrobenzene', 'aniline', 'urea', 'glycine', 'pyrrole', 'pyridine', 'acrylonitrile', 'pentanamide',
    '2-4-6-trinitrotoluene', 'hexamine', 'adrenaline',
  ],
  // мономеры пластмасс и каучуков → крекинг → сырьё ПЭТ и капрона → прочие продукты
  'industry-env': [
    'ethylene', 'propene', 'vinyl-chloride', 'butadiene', 'isoprene', 'chloroprene', 'styrene', 'acrylonitrile',
    'n-octane', 'isobutane', 'terephthalic-acid', 'ethylene-glycol', 'adipic-acid', 'urea', 'methanol', 'ethanol',
    'acetic-acid', 'benzene',
  ],
  // бутен-2 → его цис- и транс-формы — после структурных изомеров алканов
  isomers: [
    'n-butane', 'isobutane', 'n-pentane', 'isopentane', 'neopentane', 'n-hexane', '2-methylpentane', '3-methylpentane',
    '2-2-dimethylbutane', '2-3-dimethylbutane', 'n-heptane', '2-methylhexane', '3-methylhexane', '2-2-dimethylpentane',
    '2-3-dimethylpentane', '2-4-dimethylpentane', '3-3-dimethylpentane', '3-ethylpentane', '2-2-3-trimethylbutane',
    'dimethyldibutylmethane', 'tetraethylmethane', 'but-2-ene', 'cis-but-2-ene', 'trans-but-2-ene',
  ],
  // гомологический ряд до декана, затем разветвлённые, галогенпроизводные метана, алкен из задачи
  alkanes: [
    'methane', 'ethane', 'propane', 'n-butane', 'isobutane', 'n-pentane', 'isopentane', 'n-octane', 'n-nonane', 'n-decane',
    '2-methylhexane', 'isooctane', '3-methyl-4-ethylhexane', '2-3-5-trimethylhexane',
    'chloromethane', 'dichloromethane', 'chloroform', 'tetrachloromethane', '2-3-dimethylbut-2-ene',
  ],
  // § 3.16: глицерин и жирные кислоты → простейший жир → тристеарин и другие триглицериды
  fats: [
    'glycerol', 'butanoic-acid', 'hexanoic-acid', 'palmitic-acid', 'margaric-acid', 'stearic-acid', 'palmitoleic-acid',
    'oleic-acid', 'linoleic-acid', 'linolenic-acid', 'triacetin', 'tripalmitin', 'tristearin', 'triolein',
    'distearopalmitin', 'stearopalmitolein', 'dioleoyl-stearoyl-glycerol',
  ],
  // моносахариды-звенья → дисахариды → фрагменты полисахаридов → продукты реакций
  disaccharides: [
    'alpha-glucopyranose', 'fructofuranose', 'sucrose', 'sucrose-structure', 'maltose', 'lactose',
    'amylose-fragment', 'amylopectin-fragment', 'cellulose-fragment', 'glucose-open', 'gluconic-acid',
  ],
}

export function lessonMoleculeIds(lesson: OrganicLesson): string[] {
  const all: string[] = []
  for (const id of [...lesson.challengeIds, ...(LESSON_EXTRA_MOLECULES[lesson.id] ?? [])]) {
    if (organicMoleculeById[id] && !all.includes(id)) all.push(id)
  }
  const order = LESSON_MOLECULE_ORDER[lesson.id]
  if (!order) return all
  const first = order.filter((id) => all.includes(id))
  return [...first, ...all.filter((id) => !first.includes(id))]
}

export function lessonGoalV2(lesson: OrganicLesson, locale: string): string | undefined {
  const g = LESSON_GOALS_V2[lesson.id]
  if (!g) return undefined
  return locale === 'en' ? g[1] : locale === 'uz' ? g[2] : g[0]
}

/** Первый урок, где есть молекула (как раньше — по порядку программы). */
export function lessonForMoleculeV2(molId: string): OrganicLesson | undefined {
  return ORGANIC_CURRICULUM.find((l) => lessonMoleculeIds(l).includes(molId))
}

export function lessonReactionIds(lesson: OrganicLesson): readonly string[] {
  return ORGANIC_LESSON_REACTIONS[lesson.id] ?? []
}

export function lessonForReaction(rxId: string): OrganicLesson | undefined {
  return ORGANIC_CURRICULUM.find((l) => lessonReactionIds(l).includes(rxId))
}

export interface LessonIsomerSet {
  /** брутто-формула Хилла ASCII (как OV2Molecule.formula) */
  readonly formula: string
  /** id реестра — верные изомеры из старых заданий ISOMER_CHALLENGES */
  readonly expected: readonly string[]
}

/** Формулы урока для «Изомеров» и «найди все изомеры»: старые задания + формулы, повторяющиеся среди молекул урока. */
export function lessonIsomerSets(lesson: OrganicLesson, formulaOf: (id: string) => string | undefined): LessonIsomerSet[] {
  const out = new Map<string, Set<string>>()
  for (const chId of lesson.isomerChallengeIds) {
    const ch = ISOMER_CHALLENGES.find((c) => c.id === chId)
    if (!ch) continue
    // «C₇H₁₆ · C5», «C₄H₈ · цикл» — уточнение задания после брутто-формулы
    const f = asciiFormula(ch.formula.trim().split(/\s/)[0] ?? '')
    const set = out.get(f) ?? new Set<string>()
    for (const c of ch.candidates) if (c.correct && organicMoleculeById[c.id] && formulaOf(c.id) === f) set.add(c.id)
    out.set(f, set)
  }
  const count = new Map<string, string[]>()
  for (const id of lessonMoleculeIds(lesson)) {
    const f = formulaOf(id)
    if (f) count.set(f, [...(count.get(f) ?? []), id])
  }
  for (const [f, ids] of count) {
    if (ids.length < 2) continue
    const set = out.get(f) ?? new Set<string>()
    ids.forEach((id) => set.add(id))
    out.set(f, set)
  }
  return [...out].map(([formula, s]) => ({ formula, expected: [...s] }))
}

/** Задания Конструктора урока: собрать молекулы урока по названию + найти изомеры формул урока + свободная сборка. */
export function lessonConstructorTasks(lesson: OrganicLesson, isomerSets: readonly LessonIsomerSet[]): ConstructorTask[] {
  const build: ConstructorTask[] = lessonMoleculeIds(lesson)
    .filter((id) => heavyAtomCount(organicMoleculeById[id]!.formula) <= MAX_BUILD_HEAVY)
    .filter((id) => !['glucose-pyranose', 'fructose', 'sucrose', 'triacetin'].includes(id))
    .map((id) => ({ kind: 'build', targetId: id }))
  const iso: ConstructorTask[] = isomerSets
    .filter((s) => heavyAtomCount(s.formula) <= 8)
    .map((s) => ({ kind: 'isomers', formula: s.formula, expected: s.expected }))
  return [...build, ...iso, { kind: 'free' }]
}

/** Ключ задания в URL: free | build:<id> | iso:<формула>. */
export function taskKey(t: ConstructorTask): string {
  if (t.kind === 'build') return `build:${t.targetId}`
  if (t.kind === 'isomers') return `iso:${t.formula}`
  return 'free'
}

export function lessonHasNameV2(lesson: OrganicLesson): boolean {
  return Boolean(lesson.nomenclatureQuizId)
}

/** Режимы урока (пустые скрываются). */
export function lessonModesV2(lesson: OrganicLesson, isomerSets: readonly LessonIsomerSet[]): OV2Mode[] {
  const out: OV2Mode[] = ['molecule', 'constructor']
  if (isomerSets.length > 0) out.push('isomers')
  out.push('synthesis')
  if (lessonReactionIds(lesson).length > 0) out.push('reactions')
  if (lessonHasNameV2(lesson)) out.push('name')
  return out
}

export { ORGANIC_CURRICULUM, ORGANIC_CURRICULUM_BY_ID }
