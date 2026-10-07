/**
 * Задача-опыт: расчётная задача учебника Kimyo, которую ученик решает в 3D-лаборатории как настоящий опыт.
 *
 * Сценарий: условие (как в книге) → подготовка и защита → действия руками с приборами (весы, мензурка, газ над
 * водой, термометр, фильтр и сушка) → журнал измерений → расчёт с подстановкой ИЗМЕРЕННЫХ чисел → сверка трёх чисел
 * «Измерено / Расчёт по вашим измерениям / Учебник» с объяснением разницы → вопросы по опыту → прогресс.
 *
 * Каждая попытка — своё зерно случайности: показания приборов «живые» (погрешность, потери), но воспроизводимые.
 */
import type { LabExperimentDef, LabGear, LabLang, LabTaskId, LabText } from '../../components/lab3d/labContract'
import type { LabItemId } from '../../components/lab3d/labEvents'
import type { RigFocus, RigGesture, RigLabel } from '../../components/lab3d/experiments/rigTargets'
import type { InstrumentId, TaskRng, UnitId } from '../../components/lab3d/measure/instruments'
import type { LabParticleStory, LabQuizQuestion } from '../labWorks/labExperiments'

export type LabTaskType =
  | 'moles'
  | 'stoich-mass'
  | 'stoich-gas'
  | 'solution-w'
  | 'crystal-hydrate'
  | 'precipitate'
  | 'excess'
  | 'mixture'

/** Измеренные (и вычисленные из измерений) величины одной попытки: ключ → число. */
export type LabTaskValues = Readonly<Record<string, number>>

export interface LabTaskStep {
  readonly id: string
  /** Цель шага в установке (Target name="…"). */
  readonly target: string
  /** Жест и его траектория в локальных координатах установки (как в rigTargets.ts). */
  readonly gesture: RigGesture
  /** Длительность анимации действия (с). */
  readonly seconds: number
  readonly instruction: LabText
  /** Что видно после действия. */
  readonly observation: LabText
  /** Как сделать это руками (крупно на доске). */
  readonly how: LabText
  /** Предмет со стеллажа/из шкафа (сцена подсвечивает его). */
  readonly need?: LabItemId
  /** Учитель: что происходит на уровне частиц или почему так делают (1–2 предложения, без ответа задачи). */
  readonly teacher: LabText
  /** Типичная ошибка на этом шаге (учитель предупреждает). */
  readonly mistake?: LabText
}

export interface LabTaskMeasurement {
  /** Ключ в LabTaskValues. */
  readonly key: string
  /** Обозначение, одинаковое на всех языках: «m(Zn)», «V(H₂)», «t». */
  readonly label: string
  readonly what: LabText
  readonly instrument: InstrumentId
  /** Показание известно, когда выполнен шаг с этим индексом. */
  readonly afterStep: number
  /** Не прочитано с прибора, а вычислено из показаний (разность масс и т. п.). */
  readonly derived?: boolean
}

export interface LabTaskAnswer {
  readonly key: string
  /** Обозначение: «n(Zn)», «V(H₂)», «w(H₂O)». */
  readonly label: string
  readonly what: LabText
  readonly unit: LabText
  /** Ответ учебника (в масштабе задачи; для «·10²³» — мантисса). */
  readonly book: number
  readonly decimals: number
  /** Тот же ответ из ваших измерений (с пересчётом на масштаб задачи). */
  readonly fromRun: (v: LabTaskValues) => number
  /** Множитель-степень, если ответ вводят мантиссой: N = __ · 10²³. */
  readonly exponent?: number
}

export interface LabTaskCompare {
  readonly label: LabText
  readonly unit: UnitId | '%'
  readonly decimals: number
  /** Что показали приборы (масштаб опыта). */
  readonly measured: (v: LabTaskValues) => number
  /** Расчёт по уравнению из взятых (измеренных) количеств (масштаб опыта). */
  readonly predicted: (v: LabTaskValues) => number
  /** Ответ учебника, пересчитанный на масштаб опыта. */
  readonly book: number
  /** Погрешность метода, % (насколько честно может разойтись измерение с расчётом). */
  readonly tolerancePct: number
}

export interface LabTask {
  readonly id: LabTaskId
  readonly grade: 7 | 8 | 9
  /** Страница в учебнике (печатный номер). */
  readonly page: number
  /** «Kimyo 7 · с. 62, задание 6». */
  readonly source: LabText
  readonly bookKind: 'task' | 'example' | 'labwork'
  readonly title: LabText
  /** Условие — как в учебнике (опечатки исправлены, см. bookNote). */
  readonly statement: LabText
  /** Уравнение реакции (или формула расчёта у физического явления). */
  readonly equation: string
  readonly kind: LabExperimentDef['kind']
  readonly type: LabTaskType
  readonly difficulty: 1 | 2 | 3
  readonly answers: readonly LabTaskAnswer[]
  /** Во сколько раз опыт на столе меньше задачи (1 — как в задаче). */
  readonly labScale: { readonly factor: number; readonly note: LabText }
  readonly instruments: readonly InstrumentId[]
  readonly equipment: readonly LabText[]
  readonly safety: readonly LabText[]
  readonly gear?: readonly LabGear[]
  readonly place?: 'bench' | 'hood'
  readonly steps: readonly LabTaskStep[]
  readonly focus: readonly RigFocus[]
  readonly labels: readonly RigLabel[]
  readonly measurements: readonly LabTaskMeasurement[]
  /** Показания приборов этой попытки (детерминированно от зерна). */
  readonly simulate: (rng: TaskRng) => LabTaskValues
  /** «Дано» с измеренными числами. */
  readonly given: (v: LabTaskValues, lang: LabLang) => readonly string[]
  /** Ход решения с подстановкой измеренных чисел (последняя строка — ответ). */
  readonly solution: (v: LabTaskValues, lang: LabLang) => readonly string[]
  readonly compare: readonly LabTaskCompare[]
  /** Почему измерение не совпадает с учебником точно (по этой задаче). */
  readonly reconcile: LabText
  /** Ошибка или опечатка в книге (если есть). */
  readonly bookNote?: LabText
  readonly conclusion: LabText
  readonly story: LabParticleStory
  /** Три вопроса по опыту: id — 'sign' (что наблюдали), 'type' (приём/тип), 'product' (что получилось). */
  readonly quiz: readonly LabQuizQuestion[]
  readonly sideEquations?: readonly string[]
}

export const L = (ru: string, en: string, uz: string): LabText => ({ ru, en, uz })
/** Выбрать строку по языку (для строк с числами). */
export const tr = (lang: LabLang, ru: string, en: string, uz: string): string => (lang === 'ru' ? ru : lang === 'en' ? en : uz)
