/**
 * ATOMLAB Cinema kit — ЧАСТИЦЫ: цвет, радиус, запись в пулы.
 *
 * Единственная дверь сцены к размерам частиц. Радиус берётся для КОНКРЕТНОЙ
 * частицы, а не «для элемента»:
 *   • нейтральный металл  → металлический радиус (Na⁰ 186 пм);
 *   • неметалл в молекуле → ковалентный радиус   (Cl⁰ 99 пм);
 *   • ион                 → ионный радиус Shannon, КЧ 6 (Na⁺ 102, Cl⁻ 181 пм).
 *
 * Отсюда школьный вывод, который ученик обязан УВИДЕТЬ:
 * катион МЕНЬШЕ своего атома (Na 186 → 102 пм, почти вдвое),
 * анион БОЛЬШЕ своего атома (Cl 99 → 181 пм), и Cl⁻ примерно в 1,8 раза
 * крупнее Na⁺. Ни одного числа руками — всё из src/chemistry/data.
 *
 * Цвета — CPK (ATOMIC_DATA.cpk): H белый, C тёмно-серый, N синий, O красный,
 * Cl жёлто-зелёный, S жёлтый, Na фиолетовый, Mg светло-зелёный, Ca тёмно-зелёный,
 * Fe оранжево-коричневый, Zn сине-серый.
 */
import type * as THREE from 'three'
import { ATOMIC_DATA, bondLengthPm, radiusForSpecies, type BondKey, type ElementSymbol } from '../../../../chemistry/data'
import { ang, pmToAngstrom } from '../../core/atoms'
import { writeHexLinear, writeVec3, type AtomPool, type BondPool } from '../../core/pools'

/**
 * Доля настоящего радиуса, которую рисуем шаром (стандартный приём ball-and-stick):
 * при 1.0 шары соприкасаются и связи не видно. Доля ОДНА на все частицы сцены,
 * поэтому отношения размеров (Cl⁻ / Na⁺ = 1,78) остаются честными.
 */
export const SPECIES_SCALE = 0.72

/** Радиус частицы в ПИКОМЕТРАХ — для подписей и тестов. */
export function speciesRadiusPm(symbol: ElementSymbol, charge = 0): number {
  return radiusForSpecies(symbol, charge)
}

/** Радиус частицы в МИРОВЫХ ЕДИНИЦАХ сцены. */
export function speciesRadius(symbol: ElementSymbol, charge = 0, scale = SPECIES_SCALE): number {
  return ang(pmToAngstrom(radiusForSpecies(symbol, charge))) * scale
}

/** Цвет CPK элемента, 0xRRGGBB. */
export function cpkHex(symbol: ElementSymbol): number {
  return ATOMIC_DATA[symbol].cpk
}

/** Длина связи в мировых единицах (ключ из bondData: 'Cl-Cl', 'O=O', 'C-H', …). */
export function bondLength(key: BondKey): number {
  return ang(pmToAngstrom(bondLengthPm(key)))
}

/** Расстояние в мировых единицах из пикометров (параметр ячейки, d(Na⁺–Cl⁻) и т. п.). */
export function pmToScene(pm: number): number {
  return ang(pmToAngstrom(pm))
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴' }

/** Подпись частицы: ('Na', 1) → «Na⁺», ('O', −2) → «O²⁻», ('Cl', 0) → «Cl». */
export function speciesLabel(symbol: ElementSymbol, charge = 0): string {
  if (charge === 0) return symbol
  const n = Math.abs(charge)
  const digits = n === 1 ? '' : String(n).split('').map((d) => SUP[d] ?? d).join('')
  return `${symbol}${digits}${charge > 0 ? '⁺' : '⁻'}`
}

/** Подпись степени окисления над атомом: 0 → «0», +1 → «+1», −1 → «−1» (настоящий минус). */
export function oxidationLabel(charge: number): string {
  if (charge === 0) return '0'
  return charge > 0 ? `+${charge}` : `−${Math.abs(charge)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Запись в пулы инстансов (структура массивов, без аллокаций в кадре)
// ─────────────────────────────────────────────────────────────────────────────

export type AtomWrite = {
  pos: THREE.Vector3
  radius: number
  /** 0xRRGGBB, обычно cpkHex(symbol) */
  colorHex: number
  /** −1…+1 — окраска кромки: «+» тёплая, «−» холодная */
  charge?: number
  /** 0…1 — собственное свечение */
  emissive?: number
  opacity?: number
}

export function writeAtom(pool: AtomPool, i: number, a: AtomWrite): void {
  writeVec3(pool.position, i, a.pos.x, a.pos.y, a.pos.z)
  pool.radius[i] = a.radius
  pool.charge[i] = a.charge ?? 0
  pool.emissive[i] = a.emissive ?? 0.08
  pool.opacity[i] = a.opacity ?? 1
  writeHexLinear(pool.color, i, a.colorHex)
}

export type BondWrite = {
  a: THREE.Vector3
  b: THREE.Vector3
  radius: number
  colorA: number
  colorB: number
  /** 1, 1.5, 2, 3 */
  order?: number
  opacity?: number
  /** 0…1 — волна образования связи */
  form?: number
  /** 0…1 — натяжение перед разрывом */
  stress?: number
  /** 0…1 — истончение перед разрывом */
  thinning?: number
  /** −1…+1 — характер разрыва: 0 — гомолиз (пара делится поровну) */
  split?: number
  /** −1…+1 — смещение электронной плотности (полярность связи) */
  polarity?: number
}

export function writeBond(pool: BondPool, i: number, b: BondWrite): void {
  writeVec3(pool.a, i, b.a.x, b.a.y, b.a.z)
  writeVec3(pool.b, i, b.b.x, b.b.y, b.b.z)
  pool.radius[i] = b.radius
  writeHexLinear(pool.colorA, i, b.colorA)
  writeHexLinear(pool.colorB, i, b.colorB)
  pool.order[i] = b.order ?? 1
  pool.opacity[i] = b.opacity ?? 1
  pool.form[i] = b.form ?? 1
  pool.stress[i] = b.stress ?? 0
  pool.thinning[i] = b.thinning ?? 0
  pool.split[i] = b.split ?? 0
  pool.polarity[i] = b.polarity ?? 0
  writeVec3(pool.piNormal, i, 0, 0, 0)
}

/** Завершает кадр пула: сколько слотов рисовать и «данные поменялись». */
export function commitPool(pool: { count: number; version: number }, count: number): void {
  pool.count = count
  pool.version++
}

// ─────────────────────────────────────────────────────────────────────────────
// Проверка для тестов сцен
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Физика размера иона: катион меньше атома, анион больше. Тест сцены зовёт это
 * для каждой пары «атом → ион», которую показывает, и падает на выдумке.
 */
export function assertIonSizeOrder(symbol: ElementSymbol, charge: number): void {
  const atom = speciesRadiusPm(symbol, 0)
  const ion = speciesRadiusPm(symbol, charge)
  if (charge > 0 && !(ion < atom)) {
    throw new Error(`[cpkAtoms] катион ${speciesLabel(symbol, charge)} (${ion} пм) обязан быть МЕНЬШЕ атома ${symbol} (${atom} пм)`)
  }
  if (charge < 0 && !(ion > atom)) {
    throw new Error(`[cpkAtoms] анион ${speciesLabel(symbol, charge)} (${ion} пм) обязан быть БОЛЬШЕ атома ${symbol} (${atom} пм)`)
  }
}
