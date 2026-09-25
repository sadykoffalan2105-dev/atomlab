/**
 * Школьная схема электронных слоёв (энергетических уровней) атома и иона — как в учебнике
 * Kimyo 8 («Строение электронных слоёв атомов»): Na +11 )2 )8 )1, Cl⁻ +17 )2 )8 )8.
 *
 * Правило школы для Z ≤ 20: слои заполняются по 2, 8, 8, 2 (K и Ca начинают четвёртый слой).
 * Для d-металлов школьных реакций (Fe, Cu, Zn…) числа берутся из электронной конфигурации:
 * Fe [Ar] 3d⁶ 4s² → 2, 8, 14, 2. Проверка против поля configuration ядра — scripts/test-electron-levels.mts.
 *
 * Ион: катион теряет электроны с ВНЕШНЕГО слоя (опустевший слой исчезает — «обнажается» следующий,
 * Kimyo 8), анион добавляет их на внешний слой. Fe³⁺: 2, 8, 14, 2 → 2, 8, 13 ([Ar] 3d⁵).
 */

/** d-металлы школьных реакций: слои по конфигурации основного состояния. */
const D_METAL_LEVELS: Readonly<Record<number, readonly number[]>> = {
  24: [2, 8, 13, 1], // Cr [Ar] 3d⁵ 4s¹
  25: [2, 8, 13, 2], // Mn [Ar] 3d⁵ 4s²
  26: [2, 8, 14, 2], // Fe [Ar] 3d⁶ 4s²
  27: [2, 8, 15, 2], // Co [Ar] 3d⁷ 4s²
  28: [2, 8, 16, 2], // Ni [Ar] 3d⁸ 4s²
  29: [2, 8, 18, 1], // Cu [Ar] 3d¹⁰ 4s¹
  30: [2, 8, 18, 2], // Zn [Ar] 3d¹⁰ 4s²
}

const SCHOOL_CAPS = [2, 8, 8, 2] as const

/** Электронные слои нейтрального атома (порядковый номер z). */
export function atomLevels(z: number): number[] {
  if (!Number.isInteger(z) || z < 1) throw new Error(`electronLevels: неверный z = ${z}`)
  const d = D_METAL_LEVELS[z]
  if (d) return [...d]
  if (z > 20) throw new Error(`electronLevels: схема слоёв для z = ${z} не задана (школьные реакции — до Ca и d-металлы Cr…Zn)`)
  const out: number[] = []
  let left = z
  for (const cap of SCHOOL_CAPS) {
    if (left <= 0) break
    const n = Math.min(cap, left)
    out.push(n)
    left -= n
  }
  return out
}

/** Электронные слои частицы с зарядом charge (+1 — отдан один электрон, −1 — принят один). */
export function particleLevels(z: number, charge = 0): number[] {
  const levels = atomLevels(z)
  if (charge > 0) {
    let give = charge
    while (give > 0) {
      const last = levels.length - 1
      if (last < 0) throw new Error(`electronLevels: у z = ${z} нет ${charge} электронов`)
      const take = Math.min(give, levels[last]!)
      levels[last] = levels[last]! - take
      give -= take
      if (levels[last] === 0) levels.pop()
    }
  } else if (charge < 0) {
    levels[levels.length - 1] = levels[levels.length - 1]! - charge
  }
  return levels
}

/** Число электронов на внешнем слое частицы (0 — у H⁺ слоёв не осталось). */
export function outerElectrons(z: number, charge = 0): number {
  const l = particleLevels(z, charge)
  return l.length > 0 ? l[l.length - 1]! : 0
}

/** Школьная запись слоёв: «2, 8, 1». */
export function levelsText(z: number, charge = 0): string {
  return particleLevels(z, charge).join(', ')
}
