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
  'salt-purify': ['salt-dish', 'stir-rod', 'filter', 'beaker-mix', 'beaker-filtrate', 'spirit-lamp', 'dish-rod', 'lamp-cap'],
  nh3: ['ppe', 'pestle', 'mortar', 'reactor-tube', 'collect-tube', 'spirit-lamp', 'waft', 'litmus', 'hcl-rod'],
  halogens: ['ppe', 'cl-water', 'br-water', 'starch', 'rack'],
  'water-oxides': ['ppe', 'spatula', 'bottle-water', 'bottle-soda', 'phenolphthalein', 'litmus', 'rack'],
  co2: ['ppe', 'marble', 'bottle-hcl', 'stopper', 'outlet', 'tube-lime', 'litmus'],
  'metals-acids': ['ppe', 'mg', 'bottle-h2so4', 'match', 'zn', 'bottle-hcl', 'cu', 'rack'],
} as const satisfies Record<LabExperimentId, readonly string[]>

/** Сколько секунд длится анимация действия шага (шаг s: прогресс p идёт от s к s + 1). */
export const RIG_STEP_SECONDS: Readonly<Record<LabExperimentId, readonly number[]>> = {
  baso4: [1.4, 1.8, 3.2, 5.5],
  'ch4-burn': [1.2, 2.4, 4.2, 4.6, 1.4],
  'zn-hcl': [1.4, 2.6, 2.2, 6],
  'h2-practical': [2.6, 2.2, 1.8, 4.2, 2.2, 2.8, 4.2],
  'salt-purify': [2.6, 3.4, 2.4, 2, 6.5, 3, 2.6, 7.5, 1.8],
  nh3: [1.6, 3, 2.6, 2.8, 2.2, 5.5, 2.4, 3, 4.8],
  halogens: [1.6, 3.6, 3.6, 3.6, 3.2, 3.4, 2.4],
  'water-oxides': [1.6, 2.6, 4.6, 3.2, 2.8, 3.2, 3, 3, 2.4],
  co2: [1.6, 2.4, 3.2, 2.6, 4.2, 4.6, 3.6, 3.2, 5],
  'metals-acids': [1.6, 2.2, 4.2, 3.2, 2.2, 4.4, 2.2, 3.8, 2.4],
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
  // Kimyo 7, § 1.6 — на столе
  'salt-purify': [
    // часовое стекло с солью — к стакану с водой, соль высыпается
    drag([-0.52, 0.02, 0.17], [-0.36, 0.15, 0.06], 0.5),
    // провести по палочке — она мешает раствор по кругу
    swipe([-0.36, 0.02, 0.19], [-0.24, 0.02, 0.19], 0.5),
    tap,
    // конус фильтра — в воронку на кольце
    drag([-0.18, 0.02, 0.19], [-0.02, 0.24, -0.12], 0.55),
    // стакан с мутным раствором — к воронке, наклон, струя по палочке
    drag([-0.36, 0.05, 0.06], [-0.08, 0.27, -0.12], 0.35),
    // стакан с фильтратом — к фарфоровой чашке
    drag([-0.02, 0.05, -0.12], [0.3, 0.22, -0.06], 0.4),
    // снять колпачок спиртовки вправо (дальше — спичка)
    swipe([0.34, 0.07, -0.06], [0.45, 0.07, -0.06], 0.35),
    // палочкой мешать раствор в чашке
    swipe([0.16, 0.01, 0.12], [0.28, 0.01, 0.12], 0.3),
    // колпачок — на пламя
    drag([0.415, 0.02, -0.05], [0.34, 0.11, -0.06], 0.6),
  ],
  // Kimyo 8, ПР 3 — в вытяжном шкафу (локальные координаты внутри HOOD_WORK_SIZE)
  nh3: [
    tap,
    // растереть пестиком
    swipe([0.03, 0.07, 0.15], [0.11, 0.07, 0.15], 0.5),
    // ступку — к пробирке в штативе
    drag([0.06, 0.03, 0.15], [0.16, 0.23, -0.14], 0.45),
    // пробирку — в лапку штатива (пробка с трубкой, наклон)
    drag([0.16, 0.1, -0.14], [-0.3, 0.15, -0.06], 0.6),
    // сухую пробирку — вверх дном на трубку
    drag([0.24, 0.1, -0.14], [-0.17, 0.3, -0.06], 0.6),
    // снять колпачок спиртовки
    swipe([-0.3, 0.06, -0.06], [-0.19, 0.06, -0.06], 0.35),
    // помахать рукой к себе
    swipe([-0.12, 0.25, -0.02], [-0.06, 0.2, 0.14], 0.6),
    // влажную красную лакмусовую бумажку — к отверстию
    drag([0.18, 0.02, 0.17], [-0.17, 0.225, -0.06], 0.6),
    // палочку с HCl — к отверстию
    drag([0.36, 0.17, -0.06], [-0.15, 0.225, -0.06], 0.6),
  ],
  // Kimyo 8, ЛР 5 — в вытяжном шкафу
  halogens: [
    tap,
    drag([-0.3, 0.12, 0.13], [-0.15, 0.22, -0.08], 0.5),
    drag([-0.3, 0.12, 0.13], [-0.05, 0.22, -0.08], 0.5),
    drag([-0.12, 0.12, 0.13], [0.05, 0.22, -0.08], 0.5),
    drag([-0.12, 0.12, 0.13], [0.15, 0.22, -0.08], 0.5),
    drag([0.06, 0.12, 0.13], [-0.05, 0.22, -0.08], 0.5),
    tap,
  ],
  // Kimyo 7, § 6.5 — на столе: пробирки 1 CaO, 2 минеральная вода, 3 дистиллированная вода
  'water-oxides': [
    tap,
    // шпатель с CaO — к пробирке 1
    drag([-0.3, 0.02, 0.15], [-0.08, 0.2, -0.06], 0.5),
    // склянку с водой — к пробирке 1, наклон
    drag([-0.46, 0.06, -0.06], [-0.08, 0.22, -0.06], 0.42),
    drag([-0.46, 0.06, 0.12], [0, 0.22, -0.06], 0.42),
    drag([-0.46, 0.06, -0.06], [0.08, 0.22, -0.06], 0.42),
    // пипетки-капельницы — к пробиркам
    drag([0.24, 0.12, 0.13], [-0.08, 0.22, -0.06], 0.5),
    drag([0.34, 0.12, 0.13], [0, 0.22, -0.06], 0.5),
    drag([0.34, 0.12, 0.13], [0.08, 0.22, -0.06], 0.5),
    tap,
  ],
  // Kimyo 9, ПР 1 — на столе: пробирка-реактор в лапке штатива, газоотводная трубка с резиновым шлангом
  co2: [
    tap,
    drag([-0.48, 0.02, 0.15], [-0.3, 0.3, -0.06], 0.5),
    drag([-0.16, 0.06, 0.16], [-0.3, 0.3, -0.06], 0.42),
    drag([-0.02, 0.02, 0.17], [-0.3, 0.27, -0.06], 0.6),
    // конец трубки — вниз, в известковую воду
    drag([-0.1, 0.27, -0.06], [-0.1, 0.1, -0.06], 0.6),
    tap,
    // конец трубки — в дистиллированную воду
    drag([-0.1, 0.14, -0.06], [0.02, 0.08, -0.06], 0.6),
    drag([0.3, 0.12, 0.12], [0.02, 0.22, -0.06], 0.5),
    // конец трубки — в NaOH с фенолфталеином
    drag([0.02, 0.2, -0.06], [0.14, 0.08, -0.06], 0.6),
  ],
  // Kimyo 7, § 5.6 — на столе: пробирки 1 Mg, 2 Zn, 3 Cu
  'metals-acids': [
    tap,
    drag([-0.42, 0.02, 0.16], [-0.08, 0.2, -0.06], 0.5),
    drag([-0.45, 0.06, -0.1], [-0.08, 0.22, -0.06], 0.42),
    // горящую спичку — к отверстию пробирки 1
    drag([0.08, 0.02, 0.2], [-0.08, 0.18, -0.06], 0.5),
    drag([-0.27, 0.02, 0.19], [0, 0.2, -0.06], 0.5),
    drag([0.3, 0.06, -0.08], [0, 0.22, -0.06], 0.42),
    drag([0.22, 0.02, 0.18], [0.08, 0.2, -0.06], 0.5),
    drag([0.3, 0.06, -0.08], [0.08, 0.22, -0.06], 0.42),
    tap,
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
  'salt-purify': [
    { from: 0.45, to: 0.95, point: [-0.36, 0.06, 0.06], dist: 0.3 },
    { from: 4.35, to: 4.95, point: [-0.02, 0.17, -0.12], dist: 0.36 },
    { from: 7.2, to: 7.95, point: [0.34, 0.15, -0.06], dist: 0.3 },
  ],
  nh3: [
    { from: 5.4, to: 5.95, point: [-0.25, 0.16, -0.06], dist: 0.42 },
    { from: 7.45, to: 7.98, point: [-0.17, 0.24, -0.06], dist: 0.3 },
    { from: 8.4, to: 8.98, point: [-0.16, 0.26, -0.06], dist: 0.36 },
  ],
  halogens: [
    { from: 1.5, to: 1.97, point: [-0.15, 0.09, -0.08], dist: 0.3 },
    { from: 2.5, to: 2.97, point: [-0.05, 0.09, -0.08], dist: 0.3 },
    { from: 3.5, to: 3.97, point: [0.05, 0.09, -0.08], dist: 0.3 },
    { from: 5.5, to: 5.97, point: [-0.05, 0.09, -0.08], dist: 0.28 },
  ],
  'water-oxides': [
    { from: 2.45, to: 2.97, point: [-0.08, 0.12, -0.06], dist: 0.34 },
    { from: 5.4, to: 5.97, point: [-0.08, 0.08, -0.06], dist: 0.3 },
    { from: 6.4, to: 6.97, point: [0, 0.08, -0.06], dist: 0.3 },
    { from: 8.1, to: 8.97, point: [0, 0.1, -0.06], dist: 0.42 },
  ],
  co2: [
    { from: 2.45, to: 2.97, point: [-0.3, 0.14, -0.06], dist: 0.34 },
    { from: 4.4, to: 4.97, point: [-0.1, 0.06, -0.06], dist: 0.3 },
    { from: 5.2, to: 5.95, point: [-0.1, 0.06, -0.06], dist: 0.3 },
    { from: 7.4, to: 7.97, point: [0.02, 0.06, -0.06], dist: 0.3 },
    { from: 8.3, to: 8.97, point: [0.14, 0.06, -0.06], dist: 0.3 },
  ],
  'metals-acids': [
    { from: 2.45, to: 2.97, point: [-0.08, 0.07, -0.06], dist: 0.3 },
    { from: 3.45, to: 3.85, point: [-0.08, 0.17, -0.06], dist: 0.32 },
    { from: 5.45, to: 5.97, point: [0, 0.06, -0.06], dist: 0.28 },
    { from: 7.45, to: 7.97, point: [0.08, 0.06, -0.06], dist: 0.28 },
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
  'salt-purify': [
    { at: 1.7, pos: [-0.3, 0.12, 0.06], text: L('соль растворилась, песок — нет', 'the salt dissolved, the sand did not', 'tuz eridi, qum erimadi') },
    { at: 4.6, pos: [0.04, 0.1, -0.12], text: L('прозрачный фильтрат', 'clear filtrate', 'tiniq filtrat') },
    { at: 4.85, pos: [0.04, 0.27, -0.12], text: L('песок остался на фильтре', 'the sand stays on the filter', 'qum filtrda qoldi') },
    { at: 7.65, pos: [0.4, 0.2, -0.06], text: L('кристаллы NaCl', 'NaCl crystals', 'NaCl kristallari') },
  ],
  nh3: [
    { at: 5.7, pos: [-0.1, 0.36, -0.06], text: L('NH₃↑ — бесцветный газ', 'NH₃↑, a colourless gas', 'NH₃↑ — rangsiz gaz') },
    { at: 5.85, pos: [-0.2, 0.1, 0], text: L('капли воды у отверстия', 'water droplets at the mouth', 'og‘izda suv tomchilari') },
    { at: 7.6, pos: [-0.1, 0.2, -0.04], text: L('лакмус синеет — щелочь', 'litmus turns blue: alkaline', 'lakmus ko‘karadi — ishqor') },
    { at: 8.6, pos: [-0.08, 0.3, -0.04], text: L('белый дым NH₄Cl', 'white smoke of NH₄Cl', 'NH₄Cl oq tutuni') },
  ],
  halogens: [
    { at: 1.7, pos: [-0.15, 0.2, -0.04], text: L('Br₂ — жёлто-оранжевый', 'Br₂: yellow-orange', 'Br₂ — sariq-to‘q sariq') },
    { at: 2.7, pos: [-0.05, 0.2, -0.04], text: L('I₂ — жёлто-бурый', 'I₂: yellowish-brown', 'I₂ — sarg‘ish-qo‘ng‘ir') },
    { at: 3.7, pos: [0.05, 0.2, -0.04], text: L('I₂ — бурый', 'I₂: brown', 'I₂ — qo‘ng‘ir') },
    { at: 4.7, pos: [0.15, 0.2, -0.04], text: L('без изменений', 'no change', 'o‘zgarishsiz') },
    { at: 5.7, pos: [-0.05, 0.2, -0.04], text: L('синий: крахмал + I₂', 'blue: starch + I₂', 'ko‘k: kraxmal + I₂') },
    { at: 6.6, pos: [0, 0.27, -0.08], text: L('Cl₂ > Br₂ > I₂', 'Cl₂ > Br₂ > I₂ (activity)', 'Cl₂ > Br₂ > I₂ (faollik)') },
  ],
  'water-oxides': [
    { at: 2.6, pos: [-0.03, 0.23, -0.06], text: L('пар — выделяется тепло', 'steam: heat is released', 'bug‘ — issiqlik ajraladi') },
    { at: 2.85, pos: [-0.15, 0.08, -0.03], text: L('Ca(OH)₂ — белый мутный раствор', 'Ca(OH)₂: white cloudy liquid', 'Ca(OH)₂ — oq loyqa eritma') },
    { at: 3.6, pos: [0.05, 0.15, -0.06], text: L('пузырьки CO₂', 'CO₂ bubbles', 'CO₂ pufakchalari') },
    { at: 5.7, pos: [-0.12, 0.05, -0.02], text: L('фенолфталеин — малиновый', 'phenolphthalein: crimson', 'fenolftalein — to‘q pushti') },
    { at: 6.7, pos: [0, 0.05, -0.02], text: L('лакмус — красный: кислота', 'litmus red: acid', 'lakmus qizil: kislota') },
    { at: 7.7, pos: [0.12, 0.05, -0.02], text: L('лакмус — фиолетовый: вода', 'litmus violet: water', 'lakmus binafsha: suv') },
  ],
  co2: [
    { at: 2.6, pos: [-0.23, 0.2, -0.06], text: L('CO₂↑ — мрамор «вскипает»', 'CO₂↑: the marble fizzes', 'CO₂↑ — marmar «qaynaydi»') },
    { at: 4.7, pos: [-0.04, 0.1, -0.03], text: L('муть CaCO₃↓', 'milky CaCO₃↓', 'CaCO₃↓ loyqasi') },
    { at: 5.75, pos: [-0.04, 0.1, -0.03], text: L('муть исчезла — Ca(HCO₃)₂', 'clear again: Ca(HCO₃)₂', 'loyqa yo‘qoldi — Ca(HCO₃)₂') },
    { at: 7.7, pos: [0.07, 0.1, -0.03], text: L('лакмус краснеет — H₂CO₃', 'litmus turns red: H₂CO₃', 'lakmus qizaradi — H₂CO₃') },
    { at: 8.8, pos: [0.19, 0.1, -0.03], text: L('окраска исчезает', 'the colour fades', 'rang yo‘qoladi') },
  ],
  'metals-acids': [
    { at: 2.65, pos: [-0.03, 0.19, -0.06], text: L('H₂↑ — бурно', 'H₂↑: vigorously', 'H₂↑ — shiddatli') },
    { at: 3.55, pos: [-0.08, 0.23, -0.06], text: L('хлопок — это водород', 'a pop: it is hydrogen', 'qarsillash — bu vodorod') },
    { at: 5.7, pos: [0.05, 0.19, -0.06], text: L('пузырьки на цинке', 'bubbles on the zinc', 'ruxda pufakchalar') },
    { at: 7.7, pos: [0.13, 0.12, -0.06], text: L('изменений нет', 'no change', 'o‘zgarish yo‘q') },
    { at: 8.5, pos: [0, 0.27, -0.06], text: L('Mg > Zn > (H₂) > Cu', 'activity: Mg > Zn > (H₂) > Cu', 'faollik: Mg > Zn > (H₂) > Cu') },
  ],
}
