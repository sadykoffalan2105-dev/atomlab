/**
 * Пулы экземпляров экрана входа — module-level кэш на весь сеанс.
 *
 * Правило проекта (см. шапку `atom/cpkAtomResources.ts`): ресурсы живут весь
 * сеанс и НЕ диспоузятся компонентами. LabScene пересоздаёт Canvas по canvasKey
 * при восстановлении мёртвого WebGL, то есть сцена монтируется заново несколько
 * раз за сеанс; диспоуз в cleanup после такого remount дал бы чёрный кадр.
 * Общая выгрузка — по `disposeCinemaCaches()` при закрытии 3D-лаборатории.
 *
 * Пулов два, а не один, хотя суммарно атомов всего 18.
 * Герой пишется каждый кадр и живёт в группе параллакса; пояс пишется ОДИН раз
 * при монтировании, а крутится поворотом родительской группы — так его данные
 * не переписываются вовсе, `version` не растёт, и невидимые хит-сферы каталога
 * едут вместе с молекулами без единой строки синхронизации. Цена — два лишних
 * draw call (4 вместо 2), выигрыш — ноль записей в кадре на 12 атомов
 * и отсутствие рассинхрона клика с картинкой.
 */
import { createAtomPool, createBondPool, type AtomPool, type BondPool } from '../../../lab/cinema/core/pools'

let heroAtoms: AtomPool | null = null
let heroBonds: BondPool | null = null
let beltAtoms: AtomPool | null = null
let beltBonds: BondPool | null = null

/**
 * Атомы героя: пул на 16 слотов — с запасом на самый большой сценарий набора
 * (аммиак, 8 атомов: N₂ + 3 H₂). Счётчик `count` переписывается при смене
 * вещества петли, сам пул живёт весь сеанс.
 */
export function getLabEntryAtomPool(): AtomPool {
  if (!heroAtoms) heroAtoms = createAtomPool(16)
  return heroAtoms
}

/** Связи героя: до 10 у аммиака (N≡N + 3 H–H + 6 N–H), запас до 12. */
export function getLabEntryBondPool(): BondPool {
  if (!heroBonds) heroBonds = createBondPool(12)
  return heroBonds
}

/** Атомы пояса: H₂O (3) + CO₂ (3) + NH₃ (4) + HCl (2) = 12, запас до 16. */
export function getLabEntryBeltAtomPool(): AtomPool {
  if (!beltAtoms) beltAtoms = createAtomPool(16)
  return beltAtoms
}

/** Связи пояса: 2 + 2 + 3 + 1 = 8, запас до 12. */
export function getLabEntryBeltBondPool(): BondPool {
  if (!beltBonds) beltBonds = createBondPool(12)
  return beltBonds
}
