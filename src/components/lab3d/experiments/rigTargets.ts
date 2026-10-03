/**
 * Цели шагов (LabStepDef.target), которые есть в каждой установке. Установка подсвечивает и делает
 * нажимаемым объект с этим именем; тест проверяет, что шаги опытов ссылаются только на них.
 *
 * Здесь же — «геометрия» действий руками (локальные координаты установки: начало — WORK_AREA_CENTER, верх стола y = 0):
 *  • RIG_GESTURES — жест шага: нажать / перетащить предмет / провести (чиркнуть, повернуть, наклонить);
 *    у перетаскивания — откуда и куда (траектория призрачной руки и «магнит» у цели) и какую часть шага ведёт палец;
 *  • RIG_FOCUS — когда и куда камере наехать крупным планом (событие 'focus' шины labEvents);
 *  • RIG_LABELS — стеклянные 3D-подписи наблюдений у места события (исчезают через 3 с).
 */
import type { LabExperimentId, LabText } from '../labContract'

type V3 = readonly [number, number, number]

export const RIG_TARGETS = {
  baso4: ['tube-bacl2', 'tube-h2so4'],
  'ch4-burn': ['match', 'gas-valve', 'beaker-dry', 'beaker-lime'],
  'zn-hcl': ['zn-granule', 'bottle-hcl', 'tube-acid'],
  'h2-practical': ['bottle-hcl', 'zn-granule', 'stopper', 'collect-tube', 'spirit-lamp', 'glass-plate'],
} as const satisfies Record<LabExperimentId, readonly string[]>

/** Сколько секунд длится анимация действия шага (шаг s: прогресс p идёт от s к s + 1). */
export const RIG_STEP_SECONDS: Readonly<Record<LabExperimentId, readonly number[]>> = {
  baso4: [1.4, 1.8, 3.2, 5.5],
  'ch4-burn': [1.2, 2.4, 4.2, 4.6, 1.4],
  'zn-hcl': [1.4, 2.6, 2.2, 6],
  'h2-practical': [2.6, 2.2, 1.8, 4.2, 2.2, 2.8, 4.2],
}

/**
 * Жест шага. 'tap' — нажать на предмет. 'drag' — взять предмет и перенести (предмет идёт за пальцем по своей
 * траектории), 'swipe' — провести по предмету (чиркнуть спичкой, повернуть кран, наклонить пробирку).
 * from → to — примерная траектория (м): важны направление и длина; палец ведёт долю шага до `lead`,
 * если отпустить дальше половины пути (или в «магните» у цели) — действие засчитано и доигрывается само.
 */
export type RigGesture =
  | { readonly kind: 'tap' }
  | { readonly kind: 'drag' | 'swipe'; readonly from: V3; readonly to: V3; readonly lead: number }

const tap: RigGesture = { kind: 'tap' }
const drag = (from: V3, to: V3, lead: number): RigGesture => ({ kind: 'drag', from, to, lead })
const swipe = (from: V3, to: V3, lead: number): RigGesture => ({ kind: 'swipe', from, to, lead })

export const RIG_GESTURES: Readonly<Record<LabExperimentId, readonly RigGesture[]>> = {
  baso4: [
    tap,
    // взять пробирку с H₂SO₄ и поднести горлышком к пробирке с BaCl₂
    drag([0.03, 0.09, 0], [-0.028, 0.2, 0], 0.95),
    // наклонить — льётся струя
    swipe([-0.028, 0.2, 0], [-0.1, 0.16, 0], 0.32),
    // вернуть пустую пробирку в штатив
    drag([-0.028, 0.15, 0], [0.03, 0.06, 0], 0.7),
  ],
  'ch4-burn': [
    // чиркнуть спичкой о коробок
    swipe([-0.3, 0.035, 0.17], [-0.17, 0.035, 0.17], 0.6),
    // повернуть кран — газ, спичку к горелке
    swipe([0.3, 0.07, -0.2], [0.3, 0.07, -0.08], 0.55),
    // холодный сухой стакан — над пламенем
    drag([-0.2, 0.04, -0.1], [0, 0.25, 0.02], 0.45),
    // стакан с известковой водой — над пламенем
    drag([0.2, 0.04, -0.1], [0, 0.25, 0.02], 0.45),
    // закрыть кран
    swipe([0.3, 0.07, -0.08], [0.3, 0.07, -0.2], 0.7),
  ],
  'zn-hcl': [
    tap,
    // склянку с кислотой — к пробирке, наклонить
    drag([-0.26, 0.06, -0.02], [0, 0.22, 0], 0.42),
    // гранулу цинка — над пробиркой, отпустить
    drag([0.22, 0.01, 0.08], [0, 0.2, 0], 0.5),
    tap,
  ],
  'h2-practical': [
    drag([0, 0.06, 0.17], [-0.3, 0.24, -0.05], 0.42),
    drag([-0.17, 0.01, 0.17], [-0.3, 0.24, -0.05], 0.48),
    drag([-0.06, 0.045, -0.2], [-0.3, 0.2, -0.05], 0.9),
    // пустую пробирку перевернуть над концом трубки
    drag([0.1, 0.09, -0.2], [-0.17, 0.3, -0.05], 0.62),
    // снять колпачок спиртовки (дальше — спичка)
    swipe([0.3, 0.09, 0.06], [0.3, 0.17, 0.06], 0.4),
    // пробирку с водородом — отверстием к пламени
    drag([-0.17, 0.3, -0.05], [0.3, 0.16, 0.06], 0.48),
    // холодное стекло — над пламенем водорода
    drag([0.18, 0.01, 0.2], [-0.17, 0.2, -0.05], 0.8),
  ],
}

/** Крупный план: когда прогресс p проходит from — камера наезжает на point (с расстояния dist), на to — обратно. */
export interface RigFocus {
  readonly from: number
  readonly to: number
  readonly point: V3
  readonly dist: number
}

export const RIG_FOCUS: Readonly<Record<LabExperimentId, readonly RigFocus[]>> = {
  baso4: [
    { from: 2.2, to: 2.98, point: [-0.03, 0.08, 0], dist: 0.32 },
    { from: 3.35, to: 3.97, point: [-0.03, 0.04, 0], dist: 0.3 },
  ],
  'ch4-burn': [
    { from: 1.45, to: 1.97, point: [0, 0.17, 0.02], dist: 0.42 },
    { from: 2.42, to: 2.85, point: [0, 0.24, 0.02], dist: 0.36 },
    { from: 3.42, to: 3.85, point: [0, 0.24, 0.02], dist: 0.36 },
  ],
  'zn-hcl': [{ from: 2.5, to: 2.97, point: [0, 0.07, 0], dist: 0.3 }, { from: 3.15, to: 3.95, point: [0, 0.05, 0], dist: 0.28 }],
  'h2-practical': [
    { from: 1.55, to: 1.98, point: [-0.3, 0.1, -0.05], dist: 0.34 },
    { from: 3.6, to: 3.99, point: [-0.17, 0.27, -0.05], dist: 0.36 },
    { from: 5.4, to: 5.85, point: [0.3, 0.13, 0.06], dist: 0.34 },
    { from: 6.6, to: 6.98, point: [-0.17, 0.2, -0.05], dist: 0.34 },
  ],
}

/** Подпись наблюдения у места события: появляется, когда прогресс проходит at (только вперёд). */
export interface RigLabel {
  readonly at: number
  readonly pos: V3
  readonly text: LabText
}

const L = (ru: string, en: string, uz: string): LabText => ({ ru, en, uz })

export const RIG_LABELS: Readonly<Record<LabExperimentId, readonly RigLabel[]>> = {
  baso4: [
    { at: 2.42, pos: [-0.075, 0.11, 0.03], text: L('белый осадок BaSO₄↓', 'white precipitate BaSO₄↓', 'oq cho‘kma BaSO₄↓') },
    { at: 3.6, pos: [-0.08, 0.06, 0.03], text: L('над осадком — раствор HCl', 'HCl solution above the solid', 'cho‘kma ustida — HCl eritmasi') },
  ],
  'ch4-burn': [
    { at: 1.6, pos: [0.07, 0.22, 0.02], text: L('голубое пламя, тепло Q', 'blue flame, heat Q', 'ko‘k alanga, issiqlik Q') },
    { at: 2.6, pos: [0.08, 0.3, 0.02], text: L('капли воды H₂O', 'water droplets H₂O', 'suv tomchilari H₂O') },
    { at: 3.62, pos: [0.08, 0.3, 0.02], text: L('известковая вода мутнеет — CO₂', 'limewater turns milky — CO₂', 'ohakli suv loyqalanadi — CO₂') },
  ],
  'zn-hcl': [
    { at: 2.8, pos: [0.05, 0.19, 0], text: L('газ H₂↑', 'gas H₂↑', 'gaz H₂↑') },
    { at: 3.55, pos: [0.055, 0.05, 0], text: L('цинк растворяется', 'zinc dissolves', 'rux eriydi') },
  ],
  'h2-practical': [
    { at: 1.7, pos: [-0.25, 0.25, -0.05], text: L('газ H₂↑', 'gas H₂↑', 'gaz H₂↑') },
    { at: 3.7, pos: [-0.1, 0.36, -0.05], text: L('H₂ вытесняет воздух', 'H₂ pushes out the air', 'H₂ havoni siqib chiqaradi') },
    { at: 5.52, pos: [0.3, 0.24, 0.06], text: L('глухой хлопок — водород чистый', 'dull pop — the hydrogen is pure', 'bo‘g‘iq qarsillash — vodorod toza') },
    { at: 6.85, pos: [-0.08, 0.27, -0.05], text: L('капли воды', 'water droplets', 'suv tomchilari') },
  ],
}
