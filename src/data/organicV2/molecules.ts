/**
 * Органика v2 — загрузчик полных данных молекул (molecules.json: 3D, 2D, гибридизация, заряды, CIP, E/Z, группы).
 * Файл большой, поэтому грузится динамическим import — отдельным чанком, только там, где он нужен.
 * Синхронная компактная геометрия для старого интерфейса (каталог, реактор, учитель) — в molecules3d.json
 * (см. src/data/organicLab/geometries/v2Geometry.ts).
 */
import type { OV2Molecule } from './types'

let cache: Readonly<Record<string, OV2Molecule>> | null = null
let pending: Promise<Readonly<Record<string, OV2Molecule>>> | null = null

export function loadOrganicV2Molecules(): Promise<Readonly<Record<string, OV2Molecule>>> {
  if (cache) return Promise.resolve(cache)
  pending ??= import('./molecules.json').then((mod) => {
    cache = mod.default as unknown as Readonly<Record<string, OV2Molecule>>
    return cache
  })
  return pending
}

/** Молекула v2, если данные уже загружены (иначе undefined — вызовите loadOrganicV2Molecules). */
export function organicV2MoleculeSync(id: string): OV2Molecule | undefined {
  return cache?.[id]
}
