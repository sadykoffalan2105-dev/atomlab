/**
 * ATOMLAB Cinema — пулы экземпляров (structure of arrays).
 *
 * Сцена раз в кадр пишет сюда состояние мира, инстансные рендереры
 * (InstancedAtoms, InstancedBonds, OrbitalLobes) читают и заливают в GPU одним
 * буфером на пул — один draw call на тип объектов, без React-ререндеров.
 *
 * Правила пула:
 *   • ёмкость фиксирована при создании, аллокаций в кадре нет;
 *   • `count` — сколько первых слотов рисовать; остальные игнорируются;
 *   • `version` увеличивает писатель, когда меняются данные (рендерер может
 *     пропустить заливку, если версия та же);
 *   • цвета — линейный RGB 0..1 (не hex), позиции — в системе рига сцены.
 */

export type AtomPool = {
  capacity: number
  count: number
  version: number
  /** xyz × capacity */
  position: Float32Array
  /** видимый радиус, мировые единицы */
  radius: Float32Array
  /** rgb × capacity, линейный цвет элемента (CPK) */
  color: Float32Array
  /** 0..1 — собственное свечение (ядро/энергия), >1 уходит в bloom */
  emissive: Float32Array
  /** −1..1 — частичный/формальный заряд: окраска кромки (− холодная, + тёплая) */
  charge: Float32Array
  /** 0..1 */
  opacity: Float32Array
  /**
   * xyzw × capacity — поверхность по типу вещества (kit/materials.ts):
   * x metalness 0..1, y roughness 0..1, z anisotropy 0..1, w rimSoftness 0..1
   * (w ≥ 2 — «газ»: прозрачность смешиванием, rimSoftness = w − 2).
   * (0, 0, 0, 0) — прежний «стеклянный» материал атома без изменений.
   */
  surface: Float32Array
}

export type BondPool = {
  capacity: number
  count: number
  version: number
  /** xyz × capacity — центр атома A */
  a: Float32Array
  /** xyz × capacity — центр атома B */
  b: Float32Array
  /** радиус жгута одинарной связи */
  radius: Float32Array
  /** rgb × capacity — цвет половины у A и у B (обычно CPK атомов) */
  colorA: Float32Array
  colorB: Float32Array
  /** 1, 1.5, 2, 3 — дробная часть рисуется пунктирной полосой (делокализация) */
  order: Float32Array
  /** xyz × capacity — нормаль плоскости π-связи; (0,0,0) — рендерер выбирает сам (к камере) */
  piNormal: Float32Array
  /** −1..1 — смещение электронной плотности: −1 к A, +1 к B (полярность) */
  polarity: Float32Array
  /** 0..1 */
  opacity: Float32Array
  /** 0..1 — волна образования (0 только возникла, 1 установилась) */
  form: Float32Array
  /** 0..1 — натяжение перед разрывом */
  stress: Float32Array
  /** 0..1 — истончение перед разрывом */
  thinning: Float32Array
  /** −1..1 — характер разрыва: −1 пара уходит к A, 0 поровну (гомолиз), +1 к B */
  split: Float32Array
  /**
   * Стиль пунктира: 0 — штрих дробной кратности ползёт по связи (делокализация),
   * 1 — штрих неподвижен (водородная связь: это не поток электронов, а притяжение).
   */
  dashStatic: Float32Array
}

/** Вид орбитального лепестка. */
export const LobeKind = {
  /** p-орбиталь: два лепестка вдоль ±axis с противоположными знаками */
  p: 0,
  /** гибридная неподелённая пара: большой лепесток вдоль +axis и малый назад */
  lonePair: 1,
} as const
export type LobeKindId = (typeof LobeKind)[keyof typeof LobeKind]

export type LobePool = {
  capacity: number
  count: number
  version: number
  /** xyz × capacity — центр атомной орбитали (ядро атома) */
  center: Float32Array
  /** xyz × capacity — единичное направление оси орбитали */
  axis: Float32Array
  /** характерный размер лепестка, мировые единицы (при |coef| = 1) */
  size: Float32Array
  /** знаковый коэффициент ЛКАО: знак → цвет фазы, |coef| → размер/яркость */
  coef: Float32Array
  /** 0..1 */
  opacity: Float32Array
  /** LobeKind */
  kind: Float32Array
  /** 0..1 — заселённость орбитали (1 = пара, 0.5 = один электрон, 0 = пустая: контур) */
  occupancy: Float32Array
}

export function createAtomPool(capacity: number): AtomPool {
  return {
    capacity,
    count: 0,
    version: 0,
    position: new Float32Array(capacity * 3),
    radius: new Float32Array(capacity),
    color: new Float32Array(capacity * 3),
    emissive: new Float32Array(capacity),
    charge: new Float32Array(capacity),
    opacity: new Float32Array(capacity).fill(1),
    surface: new Float32Array(capacity * 4),
  }
}

export function createBondPool(capacity: number): BondPool {
  return {
    capacity,
    count: 0,
    version: 0,
    a: new Float32Array(capacity * 3),
    b: new Float32Array(capacity * 3),
    radius: new Float32Array(capacity).fill(0.04),
    colorA: new Float32Array(capacity * 3),
    colorB: new Float32Array(capacity * 3),
    order: new Float32Array(capacity).fill(1),
    piNormal: new Float32Array(capacity * 3),
    polarity: new Float32Array(capacity),
    opacity: new Float32Array(capacity).fill(1),
    form: new Float32Array(capacity).fill(1),
    stress: new Float32Array(capacity),
    thinning: new Float32Array(capacity),
    split: new Float32Array(capacity),
    dashStatic: new Float32Array(capacity),
  }
}

export function createLobePool(capacity: number): LobePool {
  return {
    capacity,
    count: 0,
    version: 0,
    center: new Float32Array(capacity * 3),
    axis: new Float32Array(capacity * 3),
    size: new Float32Array(capacity).fill(0.3),
    coef: new Float32Array(capacity).fill(1),
    opacity: new Float32Array(capacity).fill(1),
    kind: new Float32Array(capacity),
    occupancy: new Float32Array(capacity).fill(1),
  }
}

/** hex 0xRRGGBB (sRGB) → линейный RGB в массив по смещению i*3. */
export function writeHexLinear(out: Float32Array, i: number, hex: number): void {
  const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  out[i * 3] = toLinear(((hex >> 16) & 255) / 255)
  out[i * 3 + 1] = toLinear(((hex >> 8) & 255) / 255)
  out[i * 3 + 2] = toLinear((hex & 255) / 255)
}

export function writeVec3(out: Float32Array, i: number, x: number, y: number, z: number): void {
  out[i * 3] = x
  out[i * 3 + 1] = y
  out[i * 3 + 2] = z
}
