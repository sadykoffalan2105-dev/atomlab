import { CLO2_STEP_IDS } from './clo2/clo2Steps'
import { getClo2MechanismText, type Clo2Locale, type Clo2StepText } from './clo2/clo2MechanismText'
import type { CinemaLessonId } from './clo2/clo2StepStore'
import { CAO_STEP_IDS } from './cao/caoSteps'
import { getCaoMechanismText } from './cao/caoMechanismText'
import { CO2_STEP_IDS } from './co2/co2Steps'
import { CO2_SCHOOL_SPEC } from './co2/co2Spec'
import { CO_STEP_IDS } from './co/coSteps'
import { CO_SCHOOL_SPEC } from './co/coSpec'
import { FES_STEP_IDS } from './fes/fesSteps'
import { getFesMechanismText } from './fes/fesMechanismText'
import { H2O_STEP_IDS } from './h2o/h2oSteps'
import { getH2oMechanismText } from './h2o/h2oMechanismText'
import { SCHOOL_STEP_IDS, type SchoolLessonText } from './school/schoolSpec'
import { SOLUTION_STEP_IDS, type SchoolLocale, type SolutionMode, type SolutionScienceSpec } from './school/specs/types'
import { getLessonMode } from './lessonMode'
import { BASO4_SPEC } from './school/specs/baso4'
import { NO_SCENE_SPEC } from './no/noSpec'
import { NO2_SCENE_SPEC } from './no2/no2Spec'
import { N2O_SCENE_SPEC } from './n2o/n2oSpec'
import { N2O5_SCENE_SPEC } from './n2o5/n2o5Spec'
import { HCL_STEP_IDS } from './hcl/hclSteps'
import { getHclMechanismText } from './hcl/hclMechanismText'
import { MGO_STEP_IDS } from './mgo/mgoSteps'
import { getMgoMechanismText } from './mgo/mgoMechanismText'
import { NACL_STEP_IDS } from './nacl/naclSteps'
import { getNaclMechanismText } from './nacl/naclMechanismText'
import { NH3_STEP_IDS } from './nh3/nh3Steps'
import { getNh3MechanismText } from './nh3/nh3MechanismText'
import { SO2_STEP_IDS } from './so2/so2Steps'
import { SO2_SCHOOL_SPEC } from './so2/so2Spec'
import { SO3_STEP_IDS } from './so3/so3Steps'
import { SO3_SCHOOL_SPEC } from './so3/so3Spec'
import { ZNCL2_STEP_IDS } from './zncl2/zncl2Steps'
import { getZncl2MechanismText } from './zncl2/zncl2MechanismText'

/**
 * Уроки по шагам, известные панели механизма (Clo2MechanismPanel).
 *
 * Панель одна на все уроки: она читает clo2StepStore и по `lesson` снимка берёт
 * отсюда список шагов и тексты. Что у уроков различается (энергетика ClO₂ —
 * профиль по Эйрингу, у NaCl — лестница Борна — Габера), панель ветвит по id.
 */

export type LessonLocale = Clo2Locale

/** Общий для уроков вид текста, который читает панель. */
export type LessonMechanismText = {
  intro: { title: string; speak: string }
  steps: Readonly<Record<string, Clo2StepText>>
  legend: {
    electron: string
    pairArrow?: string
    singleArrow?: string
    water?: string
    orbitalPhase?: string
    vibration?: string
    /** школьные сцены (scenes/school): общая пара, неподелённая пара, неспаренный электрон */
    sharedPair?: string
    lonePair?: string
    unpaired?: string
    /** сцена раствора (scenes/school/solution): ион с зарядом, палочка связи внутри частицы, осадок */
    ion?: string
    stick?: string
    precipitate?: string
    /** свечение по краю шара — знак заряда (школьный режим сцены раствора) */
    charge?: string
  }
  safety: string
  energy: { title: string; axisG?: string }
  /** крупные карточки уравнений шага (школьный режим, итог: молекулярное, полное и сокращённое ионные) */
  cards?: Readonly<Record<string, readonly { label: string; formula: string }[]>>
}

/** Действие урока на шаге (кнопка в панели): «Добавить HNO₃» на шаге «осадок». */
export type LessonAction = { id: string; stepId: string; label: Readonly<Record<LessonLocale, string>> }

export type CinemaLesson = {
  id: CinemaLessonId
  stepIds: readonly string[]
  /** шаг, на котором показывать предупреждение о безопасности */
  safetyStepId: string
  /** есть ли у урока сценарий озвучки преподавателя (LabTeacherNarrator) */
  narrated: boolean
  /** Школьная сцена образования молекулы (scenes/school): без энергетики — как NaCl. */
  school?: boolean
  /** У урока два режима (школьный по умолчанию и продвинутый): переключатель в панели, lessonMode.ts. */
  modes?: boolean
  /** Действия на шагах (кнопки панели), сцена выполняет их через clo2StepStore.action. */
  actions?: readonly LessonAction[]
  getText: (locale: LessonLocale) => LessonMechanismText
}

/** Текст школьной сцены (SchoolLessonText) → вид, который читает панель урока. */
export function schoolLessonText(text: SchoolLessonText): LessonMechanismText {
  return {
    intro: text.intro,
    steps: text.steps,
    legend: {
      electron: text.legend.electron,
      sharedPair: text.legend.sharedPair,
      lonePair: text.legend.lonePair,
      unpaired: text.legend.unpaired || undefined,
    },
    safety: text.safety,
    energy: { title: '' },
  }
}

/**
 * Текст сцены «обмен в растворе» → вид панели урока. Школьный режим (по умолчанию) — тексты spec.school
 * (стандарт ОГЭ/ЕГЭ, H⁺, уравнения со знаком «=» и карточки уравнений итога); продвинутый — научные.
 */
export function solutionLessonText(spec: SolutionScienceSpec, locale: SchoolLocale, mode: SolutionMode = 'advanced'): LessonMechanismText {
  const steps: Record<string, Clo2StepText> = {}
  const school = mode === 'school' ? spec.school : undefined
  if (school) {
    for (const s of spec.steps) steps[s.id] = school.steps[s.id][locale]
    const eq = school.equations
    return {
      intro: { title: spec.intro.title[locale].replace(/→/g, '='), speak: spec.intro.speak[locale] },
      steps,
      legend: {
        electron: '',
        ion: school.legend.ion[locale],
        charge: school.legend.charge[locale],
        stick: school.legend.stick[locale],
        precipitate: school.legend.precipitate[locale],
      },
      safety: school.safety[locale],
      energy: { title: '' },
      cards: { result: [eq.molecular, eq.full, eq.short].map((c) => ({ label: c.label[locale], formula: c.formula })) },
    }
  }
  for (const s of spec.steps) steps[s.id] = s.text[locale]
  return {
    intro: { title: spec.intro.title[locale], speak: spec.intro.speak[locale] },
    steps,
    legend: {
      electron: '',
      ion: spec.legend.ion[locale],
      stick: spec.legend.sharedPair[locale],
      water: spec.legend.water[locale],
      precipitate: spec.legend.precipitate[locale],
    },
    safety: spec.safety[locale],
    energy: { title: '' },
  }
}

const LESSONS: Record<string, CinemaLesson> = {
  clo2: {
    id: 'clo2',
    stepIds: CLO2_STEP_IDS,
    safetyStepId: 'products',
    narrated: true,
    getText: (locale) => getClo2MechanismText(locale),
  },
  nacl: {
    id: 'nacl',
    stepIds: NACL_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getNaclMechanismText(locale),
  },
  co2: {
    id: 'co2',
    stepIds: CO2_STEP_IDS,
    // Горение в чистом кислороде: предупреждение — на шаге нагревания (разрыв O=O).
    safetyStepId: 'breaking',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(CO2_SCHOOL_SPEC.text[locale]),
  },
  co: {
    id: 'co',
    stepIds: CO_STEP_IDS,
    // Угарный газ ядовит: предупреждение — на итоге (газ получен).
    safetyStepId: 'result',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(CO_SCHOOL_SPEC.text[locale]),
  },
  cao: {
    id: 'cao',
    stepIds: CAO_STEP_IDS,
    safetyStepId: 'classroom',
    narrated: false,
    getText: (locale) => getCaoMechanismText(locale),
  },
  h2o: {
    id: 'h2o',
    stepIds: H2O_STEP_IDS,
    // Гремучая смесь: предупреждение — на шаге поджига.
    safetyStepId: 'breaking',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(getH2oMechanismText(locale)),
  },
  // Школьные сцены оксидов азота (scenes/school): тексты — научные спецификации specs/no*.ts, n2o*.ts.
  no: {
    id: 'no',
    stepIds: SCHOOL_STEP_IDS,
    // Оксиды азота ядовиты: предупреждение — на итоге.
    safetyStepId: 'result',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(NO_SCENE_SPEC.text[locale]),
  },
  no2: {
    id: 'no2',
    stepIds: SCHOOL_STEP_IDS,
    safetyStepId: 'result',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(NO2_SCENE_SPEC.text[locale]),
  },
  n2o: {
    id: 'n2o',
    stepIds: SCHOOL_STEP_IDS,
    // Нитрат аммония при сильном нагревании может взорваться — предупреждение на шаге нагревания.
    safetyStepId: 'breaking',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(N2O_SCENE_SPEC.text[locale]),
  },
  n2o5: {
    id: 'n2o5',
    stepIds: SCHOOL_STEP_IDS,
    // N₂O₅ и HNO₃ едкие — предупреждение сразу, на исходных веществах.
    safetyStepId: 'reactants',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(N2O5_SCENE_SPEC.text[locale]),
  },
  nh3: {
    id: 'nh3',
    stepIds: NH3_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getNh3MechanismText(locale),
  },
  so2: {
    id: 'so2',
    stepIds: SO2_STEP_IDS,
    // Сернистый газ ядовит: предупреждение — на итоге (газ получен).
    safetyStepId: 'result',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(SO2_SCHOOL_SPEC.text[locale]),
  },
  so3: {
    id: 'so3',
    stepIds: SO3_STEP_IDS,
    // SO₃ с водой даёт серную кислоту: предупреждение — на итоге.
    safetyStepId: 'result',
    narrated: false,
    school: true,
    getText: (locale) => schoolLessonText(SO3_SCHOOL_SPEC.text[locale]),
  },
  mgo: {
    id: 'mgo',
    stepIds: MGO_STEP_IDS,
    safetyStepId: 'ignition',
    narrated: false,
    getText: (locale) => getMgoMechanismText(locale),
  },
  fes: {
    id: 'fes',
    stepIds: FES_STEP_IDS,
    safetyStepId: 'heating',
    narrated: false,
    getText: (locale) => getFesMechanismText(locale),
  },
  hcl: {
    id: 'hcl',
    stepIds: HCL_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getHclMechanismText(locale),
  },
  // Школьная сцена «обмен в растворе»: BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl (Kimyo 7, с. 67; 8 кл. § 32; 9 кл. § 6).
  // Предупреждение — на первом шаге (BaCl₂ — яд, кислота едкая): опыт в пробирке.
  baso4: {
    id: 'baso4',
    stepIds: SOLUTION_STEP_IDS,
    safetyStepId: 'tubes',
    narrated: false,
    school: true,
    modes: true,
    actions: [{ id: 'nitric', stepId: 'settle', label: { ru: 'Добавить HNO₃', en: 'Add HNO₃', uz: 'HNO₃ qoʻshish' } }],
    getText: (locale) => solutionLessonText(BASO4_SPEC, locale, getLessonMode()),
  },
  zncl2: {
    id: 'zncl2',
    stepIds: ZNCL2_STEP_IDS,
    safetyStepId: 'energy',
    narrated: false,
    getText: (locale) => getZncl2MechanismText(locale),
  },
}

/**
 * Урок по id. Новая сцена добавляет сюда ОДНУ запись; пока её нет, панель
 * показывает урок ClO₂ и не падает (id урока — обычная строка, см. CinemaLessonId).
 */
export function getCinemaLesson(id: CinemaLessonId): CinemaLesson {
  return LESSONS[id] ?? LESSONS.clo2!
}

/** id шага урока по индексу (с зажимом в границы). */
export function lessonStepIdAt(lesson: CinemaLesson, index: number): string {
  const i = Math.min(Math.max(index, 0), lesson.stepIds.length - 1)
  return lesson.stepIds[i]!
}
