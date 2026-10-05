/**
 * Адаптер органики v2 → старый OrganicGraph: готовые координаты RDKit (ETKDGv3 + MMFF94) из компактного
 * molecules3d.json, без раскладки и релаксации в браузере. id атомов `${элемент}_${номер}`, связей `b_${номер}` —
 * стабильные (номер = индекс атома в molecules.json, начиная с 1).
 */
import type { OrganicAtom, OrganicBond, OrganicElement, OrganicGraph } from '../../../chemistry/organic/organicGraph'
import MOL3D from '../../organicV2/molecules3d.json'

/** Компактная запись: el — символы через запятую, p — x,y,z подряд (Å, 2 знака), b — a,b,кратность подряд. */
type Compact3D = { readonly el: string; readonly p: readonly number[]; readonly b: readonly number[] }

const DATA = MOL3D as unknown as Readonly<Record<string, Compact3D>>
const DEFAULT_MAX: Partial<Record<string, number>> = { N: 3, S: 2 }

export function hasOrganicV2Geometry(id: string): boolean {
  return id in DATA
}

/** Граф молекулы реестра из данных v2 (новый объект при каждом вызове — реестр кэширует сам). */
export function organicV2Graph(id: string): OrganicGraph | null {
  const r = DATA[id]
  if (!r) return null
  const els = r.el.split(',')
  const used = new Array<number>(els.length).fill(0)
  const bonds: OrganicBond[] = []
  for (let k = 0; k * 3 < r.b.length; k++) {
    const a = r.b[k * 3]!
    const b = r.b[k * 3 + 1]!
    const o = r.b[k * 3 + 2]! as 1 | 2 | 3
    used[a]! += o
    used[b]! += o
    bonds.push({ id: `b_${k + 1}`, a: `${els[a]}_${a + 1}`, b: `${els[b]}_${b + 1}`, order: o })
  }
  const atoms: OrganicAtom[] = els.map((el, i) => {
    const atom: OrganicAtom = {
      id: `${el}_${i + 1}`,
      element: el as OrganicElement,
      pos: [r.p[i * 3]!, r.p[i * 3 + 1]!, r.p[i * 3 + 2]!],
    }
    // особая валентность, как в старом графе: N⁺ — 4, S(VI) — 6, O⁻ — 1 (все H в графе явные)
    const max = DEFAULT_MAX[el]
    if ((max !== undefined && used[i]! > max) || (el === 'O' && used[i] === 1)) atom.valence = used[i]
    return atom
  })
  return { atoms, bonds }
}
