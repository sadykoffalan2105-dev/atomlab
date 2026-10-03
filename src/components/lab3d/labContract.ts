/**
 * Контракт новой 3D-лаборатории (светлая, реалистичная, без VR-очков: мышь и касание; маршрут /vr-lab).
 *
 * Делится на две части, которые собираются независимо:
 *  • сцена (src/components/lab3d/scene/**, src/pages/Lab3DPage.tsx) — комната, свет, мебель, вытяжка, раковина,
 *    шкафы с посудой, электронная доска (сенсорная), камера и управление, оболочка интерфейса;
 *  • опыты (src/components/lab3d/experiments/**, src/data/labWorks/**) — интерактивные установки на рабочем месте
 *    стола и содержимое доски (шаги, наблюдения, уравнения, выводы).
 *
 * Единицы — метры, ось Y вверх, ученик смотрит в −Z (к доске).
 */
import * as THREE from 'three'

/** Высота столешницы рабочего стола (м). */
export const BENCH_TOP_Y = 0.9
/** Центр рабочего места на столе: здесь стоит установка опыта (ExperimentRig рисуется относительно этой точки). */
export const WORK_AREA_CENTER = new THREE.Vector3(0, BENCH_TOP_Y, 0)
/** Размер рабочего места (м): ширина по X, глубина по Z. Установка не выходит за него. */
export const WORK_AREA_SIZE = { w: 1.3, d: 0.6 } as const
/**
 * Рабочее место в вытяжном шкафу (опыты с аммиаком, хлором и бромом — по ТБ только под тягой): центр на столешнице
 * вытяжки и размер. Установка опыта с place: 'hood' рисуется относительно этой точки и не выходит за размер.
 */
export const HOOD_WORK_CENTER = new THREE.Vector3(-2.05, BENCH_TOP_Y, -0.86)
export const HOOD_WORK_SIZE = { w: 0.95, d: 0.5 } as const

/** Средства защиты ученика. */
export type LabGear = 'goggles' | 'gloves' | 'coat'

/** Электронная доска: центр и размер экрана (м), смотрит в +Z. */
export const BOARD_CENTER = new THREE.Vector3(0, 1.62, -1.15)
export const BOARD_SIZE = { w: 1.9, h: 1.07 } as const
/** Разрешение HTML-содержимого доски (CSS px), которое рисуется на экране доски (drei <Html transform>). */
export const BOARD_PX = { w: 1280, h: 720 } as const

export type LabLang = 'ru' | 'en' | 'uz'
export type LabText = Readonly<Record<LabLang, string>>

export type LabExperimentId = 'baso4' | 'ch4-burn' | 'zn-hcl' | 'h2-practical'

export interface LabExperimentDef {
  readonly id: LabExperimentId
  /** «§ 2.12 Обмен» / «Практическое занятие § 5.2». */
  readonly source: LabText
  readonly title: LabText
  /** Уравнение (Unicode-индексы), как в учебнике. */
  readonly equation: string
  /** Тип реакции для цветной метки: обмен / горение / замещение. */
  readonly kind: 'exchange' | 'combustion' | 'substitution'
  /** Класс и страница учебника Kimyo. */
  readonly grade: 7 | 8 | 9
  readonly page: number
  readonly steps: readonly LabStepDef[]
  /** Оборудование и вещества (для списка на доске). */
  readonly equipment: readonly LabText[]
  readonly safety: readonly LabText[]
  readonly conclusion: LabText
  /** Где ставится установка: на рабочее место стола (по умолчанию) или в вытяжной шкаф. */
  readonly place?: 'bench' | 'hood'
  /** Какие средства защиты нужно надеть перед опытом (сцена даёт их надеть; опыт ждёт события 'safety'). */
  readonly gear?: readonly LabGear[]
}

export interface LabStepDef {
  readonly id: string
  /** Что сделать ученику (коротко, повелительно). */
  readonly instruction: LabText
  /** Что он должен увидеть после действия. */
  readonly observation?: LabText
  /** Объект установки, по которому нужно нажать/который нужно перетащить (подсвечивается). */
  readonly target?: string
}

/** Состояние опыта, общее для сцены и доски. */
export interface LabRunState {
  readonly experimentId: LabExperimentId
  /** Индекс текущего шага (steps.length — опыт завершён). */
  readonly step: number
}

export interface ExperimentRigProps {
  readonly experimentId: LabExperimentId
  readonly step: number
  /** Ученик выполнил действие текущего шага — перейти к следующему. */
  readonly onAdvance: () => void
  /** Качество: low — телефон/слабая видеокарта (меньше частиц, без преломления). */
  readonly quality: 'low' | 'high'
  readonly lang: LabLang
}

export interface BoardPanelProps {
  readonly experimentId: LabExperimentId
  readonly step: number
  readonly lang: LabLang
  readonly onSelectExperiment: (id: LabExperimentId) => void
  readonly onStep: (step: number) => void
}

/** Общие материалы — одинаковый вид посуды и мебели в обеих частях. */
export const LAB_COLORS = {
  wall: '#eef2f6',
  floor: '#d9dee5',
  benchTop: '#f4f6f8',
  benchBody: '#e3e8ee',
  metal: '#b9c2cc',
  accent: '#2f7cf6',
  wood: '#c8a27a',
} as const

export function labGlassMaterial(quality: 'low' | 'high'): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: 0.04,
    metalness: 0,
    transmission: quality === 'high' ? 1 : 0,
    transparent: true,
    opacity: quality === 'high' ? 1 : 0.28,
    thickness: 0.004,
    ior: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

export function labLiquidMaterial(color: THREE.ColorRepresentation, opacity = 0.72): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transparent: true, opacity, clearcoat: 0.6, depthWrite: false })
}
