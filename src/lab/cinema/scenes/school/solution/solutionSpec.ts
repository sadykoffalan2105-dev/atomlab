/**
 * СПЕЦИФИКАЦИЯ СЦЕНЫ «ОБМЕН В РАСТВОРЕ» (движок school/solution): химия и тексты — из научной спецификации
 * (school/specs/baso4.ts), здесь только ПОСТАНОВКА КАДРА: где стоят ионы, куда идут, когда садятся в кристалл.
 * Все координаты — пикометры в системе сцены (x вправо, y вверх, z к зрителю); время — секунды сюжета.
 *
 * Модуль без three и React: его читают модель кадра (solutionModel.ts), класс сцены и тест в Node.
 */
import { BASO4_SPEC } from '../specs/baso4'
import type { SolutionScienceSpec, SolutionStepId } from '../specs/types'

export type SV3 = readonly [number, number, number]

/** Сцена обмена в растворе: катион + анион-группа → осадок; наблюдатели остаются в растворе. */
export type SolutionSceneSpec = {
  readonly id: string
  /** id урока панели (lessons.ts) */
  readonly lesson: string
  readonly science: SolutionScienceSpec
  readonly steps: readonly { readonly id: SolutionStepId; readonly from: number; readonly to: number }[]
  /** кристалл осадка из ядра и число ячеек фрагмента, из которого берутся узлы зародыша */
  readonly crystalId: string
  readonly crystalCells: readonly [number, number, number]
  /** сколько формульных единиц в зародыше до посадки нашей пары и сколько садится после неё */
  readonly seedUnits: number
  readonly laterUnits: number
  /** стартовые места (шаг «ионы»): слева раствор соли, справа раствор кислоты */
  readonly start: {
    readonly cation: SV3
    readonly anions: readonly [SV3, SV3]
    readonly group: SV3
    readonly protons: readonly [SV3, SV3]
  }
  /** место встречи катиона и группы (конец шага «встреча»), расстояние между центрами */
  readonly meet: { readonly center: SV3; readonly gapPm: number }
  /** куда уходят наблюдатели (Cl⁻, H₃O⁺) к концу шага «встреча» */
  readonly mixed: { readonly anions: readonly [SV3, SV3]; readonly protons: readonly [SV3, SV3] }
  /** зародыш кристалла: центр и начальный поворот вокруг вертикали (рад) */
  readonly nucleus: { readonly center: SV3; readonly yaw: number; readonly yawRate: number }
  /** где наблюдатели на шаге «кристаллик» */
  readonly spectators: { readonly anions: readonly [SV3, SV3]; readonly protons: readonly [SV3, SV3] }
  /** итог: кристалл и наблюдатели */
  readonly result: {
    readonly crystal: SV3
    readonly anions: readonly [SV3, SV3]
    readonly protons: readonly [SV3, SV3]
  }
  /** откуда приходят следующие пары ионов (из остального объёма пробирки) */
  readonly laterFrom: readonly SV3[]
  /** фоновые молекулы воды (кроме ближних оболочек) */
  readonly waters: readonly SV3[]
  /** зерно детерминированного блуждания */
  readonly seed: number
}

/** Сплошная разметка времени сюжета из рекомендуемых длительностей шагов научной спецификации. */
export function solutionStepTimings(spec: SolutionScienceSpec): { id: SolutionStepId; from: number; to: number }[] {
  let t = 0
  return spec.steps.map((s) => {
    const from = t
    t = Math.round((t + s.seconds) * 1000) / 1000
    return { id: s.id, from, to: t }
  })
}

export const BASO4_SOLUTION_SPEC: SolutionSceneSpec = {
  id: 'baso4',
  lesson: 'baso4',
  science: BASO4_SPEC,
  steps: solutionStepTimings(BASO4_SPEC),
  crystalId: 'barite',
  crystalCells: [2, 2, 2],
  seedUnits: 5,
  laterUnits: 2,
  start: {
    cation: [-470, -10, 0],
    anions: [
      [-980, 430, 0],
      [-960, -440, 0],
    ],
    group: [500, -10, 0],
    protons: [
      [1000, 430, 0],
      [980, -450, 0],
    ],
  },
  meet: { center: [0, -40, 0], gapPm: 380 },
  mixed: {
    anions: [
      [-380, 600, -80],
      [420, -640, 60],
    ],
    protons: [
      [420, 640, 60],
      [-420, -660, -60],
    ],
  },
  nucleus: { center: [0, -680, 0], yaw: 0.62, yawRate: 0.05 },
  spectators: {
    anions: [
      [-900, 380, -40],
      [380, 520, 40],
    ],
    protons: [
      [-320, 560, 40],
      [940, 360, -40],
    ],
  },
  result: {
    crystal: [-560, -120, 0],
    anions: [
      [930, 420, 0],
      [930, -520, 0],
    ],
    protons: [
      [380, 360, 0],
      [400, -480, 0],
    ],
  },
  laterFrom: [
    [-1500, -1150, 0],
    [1500, -1200, 0],
  ],
  waters: [
    [-60, 620, -120],
    [160, 180, -160],
    [-150, -330, 140],
    [-1320, 60, -100],
    [1340, 0, 120],
    [-560, 760, 80],
    [620, 760, -60],
    [-620, -800, -90],
    [640, -820, 90],
    [-1300, -700, 40],
    [1300, 700, -40],
    [60, -900, 160],
  ],
  seed: 20260928,
}
