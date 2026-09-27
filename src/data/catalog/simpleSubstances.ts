/**
 * Простые вещества в каталоге (металлы, C, Si, P, S, Xe …) — карточки по реакциям учебников 7–11.
 * Модель: кристаллическая решётка из src/chemistry/data/crystalData.ts, где она есть (Na, Mg, Al, Fe, Cu, Zn, Pb, C, Si);
 * фосфор и сера — молекулы P₄ и S₈ из каталога; остальные — атом элемента.
 * Классы и страницы — scripts/textbook-inventory/gen-simple-substances.mts → simpleSubstances.generated.ts.
 */
import { CRYSTAL_DATA, type CrystalDatum, type LatticeType } from '../../chemistry/data/crystalData'
import { compoundById } from '../compounds'
import { BOOK_SIMPLE_SUBSTANCE_ROWS, type BookSimpleSubstanceRow } from './simpleSubstances.generated'

export type SimpleSubstance = BookSimpleSubstanceRow

export const BOOK_SIMPLE_SUBSTANCES: readonly SimpleSubstance[] = BOOK_SIMPLE_SUBSTANCE_ROWS

/** Элемент → решётка простого вещества в crystalData (углерод — графит, стандартное состояние). */
const CRYSTAL_BY_SYMBOL: Readonly<Record<string, string>> = {
  C: 'graphite',
  Na: 'na_metal',
  Mg: 'mg_metal',
  Al: 'al_metal',
  Si: 'si',
  Fe: 'fe_metal',
  Cu: 'cu_metal',
  Zn: 'zn_metal',
  Pb: 'pb_metal',
}

/** Простые вещества-молекулы: модель берётся из карточки каталога (белый фосфор P₄, ромбическая сера S₈). */
const MOLECULE_BY_SYMBOL: Readonly<Record<string, string>> = { P: 'tb_p4', S: 'tb_s8' }

export type SimpleModelAtom = { el: string; pos: readonly [number, number, number] }
export type SimpleModel = {
  kind: 'crystal' | 'molecule' | 'atom'
  crystalId?: string
  moleculeId?: string
  atoms: readonly SimpleModelAtom[]
  bonds: readonly { a: number; b: number; order?: 1 | 2 | 3 }[]
}

/** Базис конвенциональной ячейки, если в crystalData он не записан (ОЦК, ГЦК, ГПУ, алмаз). */
function basisFor(c: CrystalDatum): readonly (readonly [number, number, number])[] {
  if (c.basis?.length) return c.basis.map((b) => b.frac)
  const t: Partial<Record<LatticeType, readonly (readonly [number, number, number])[]>> = {
    'ОЦК': [[0, 0, 0], [0.5, 0.5, 0.5]],
    'ГЦК': [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]],
    'ГПУ': [[1 / 3, 2 / 3, 0.25], [2 / 3, 1 / 3, 0.75]],
    'примитивная кубическая': [[0, 0, 0]],
  }
  return t[c.latticeType] ?? [[0, 0, 0]]
}

function isHexagonal(c: CrystalDatum): boolean {
  return c.setting === 'hexagonal' || c.latticeType === 'ГПУ' || (c.latticeType === 'гексагональная' && c.cellPm.c != null)
}

/** Ячейка «как на рисунке в учебнике»: все узлы внутри и на гранях/рёбрах/вершинах, связи — ближайшие соседи. Å. */
function cellModel(c: CrystalDatum): { atoms: SimpleModelAtom[]; bonds: { a: number; b: number }[] } {
  const a = c.cellPm.a / 100
  const b = (c.cellPm.b ?? c.cellPm.a) / 100
  const cc = (c.cellPm.c ?? c.cellPm.a) / 100
  const hex = isHexagonal(c)
  const el = c.formula.replace(/[₀-₉]/g, '')
  const eps = 1e-6
  const seen = new Set<string>()
  const atoms: SimpleModelAtom[] = []
  for (const f of basisFor(c)) {
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const x = f[0] + i
      const y = f[1] + j
      const z = f[2] + k
      if (x < -eps || y < -eps || z < -eps || x > 1 + eps || y > 1 + eps || z > 1 + eps) continue
      const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`
      if (seen.has(key)) continue
      seen.add(key)
      const pos: [number, number, number] = hex ? [a * (x - y / 2), a * (y * Math.sqrt(3)) / 2, cc * z] : [a * x, b * y, cc * z]
      atoms.push({ el, pos })
    }
  }
  // центр ячейки — в начало координат
  const cx = atoms.reduce((s, p) => s + p.pos[0], 0) / atoms.length
  const cy = atoms.reduce((s, p) => s + p.pos[1], 0) / atoms.length
  const cz = atoms.reduce((s, p) => s + p.pos[2], 0) / atoms.length
  const centered = atoms.map((p) => ({ el: p.el, pos: [p.pos[0] - cx, p.pos[1] - cy, p.pos[2] - cz] as [number, number, number] }))
  const d = (p: SimpleModelAtom, q: SimpleModelAtom) => Math.hypot(p.pos[0] - q.pos[0], p.pos[1] - q.pos[1], p.pos[2] - q.pos[2])
  let min = Infinity
  for (let i = 0; i < centered.length; i++) for (let j = i + 1; j < centered.length; j++) min = Math.min(min, d(centered[i]!, centered[j]!))
  const bonds: { a: number; b: number }[] = []
  for (let i = 0; i < centered.length; i++) for (let j = i + 1; j < centered.length; j++) {
    if (d(centered[i]!, centered[j]!) <= min * 1.05) bonds.push({ a: i, b: j })
  }
  return { atoms: centered, bonds }
}

const modelCache = new Map<string, SimpleModel>()

/** 3D-модель карточки простого вещества (кэшируется: одинаковый массив атомов для превью). */
export function simpleSubstanceModel(symbol: string): SimpleModel {
  const hit = modelCache.get(symbol)
  if (hit) return hit
  let model: SimpleModel
  const crystal = CRYSTAL_BY_SYMBOL[symbol] ? CRYSTAL_DATA[CRYSTAL_BY_SYMBOL[symbol]!] : undefined
  const molecule = MOLECULE_BY_SYMBOL[symbol] ? compoundById[MOLECULE_BY_SYMBOL[symbol]!] : undefined
  if (crystal) {
    model = { kind: 'crystal', crystalId: crystal.id, ...cellModel(crystal) }
  } else if (molecule?.atoms?.length) {
    model = {
      kind: 'molecule',
      moleculeId: molecule.id,
      atoms: molecule.atoms.map((x) => ({ el: x.symbol, pos: [x.pos[0], x.pos[1], x.pos[2]] as [number, number, number] })),
      bonds: molecule.bonds.map(([a, b]) => ({ a, b })),
    }
  } else {
    model = { kind: 'atom', atoms: [{ el: symbol, pos: [0, 0, 0] }], bonds: [] }
  }
  modelCache.set(symbol, model)
  return model
}

/** Решётка простого вещества из crystalData (null — модели решётки нет). */
export function simpleSubstanceCrystal(symbol: string): CrystalDatum | null {
  const id = CRYSTAL_BY_SYMBOL[symbol]
  return id ? (CRYSTAL_DATA[id] ?? null) : null
}

export function simpleSubstanceGrades(s: SimpleSubstance): readonly (7 | 8 | 9 | 10 | 11)[] {
  return s.grades
}

/** Первая страница учебника для порядка «как в книге»: в выбранном классе или самая ранняя. */
export function simpleSubstanceFirstPage(s: SimpleSubstance, grade: 7 | 8 | 9 | 10 | 11 | 'all'): number | null {
  if (grade !== 'all') return s.firstPage[grade] ?? null
  const g = s.grades[0]
  return g != null ? (s.firstPage[g] ?? null) : null
}
