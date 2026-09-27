/**
 * 3D-модели солей, алкоголятов и комплексов органических веществ из реакций учебников 10–11 классов
 * (gen-textbook-compounds.mts → textbookCompounds.data.ts, поля atoms/bonds).
 *
 * Органическая часть строится тем же конвейером, что молекулы органической лаборатории: упрощённый SMILES →
 * скелет → H по валентности → 3D-раскладка (layoutOrganicGraph). Ионы металлов и аммония ставятся у атома O⁻
 * (C⁻) по направлению связи на расстоянии, близком к длине ионной / координационной связи.
 * Ионные пары (K⁺, Na⁺, Ca²⁺, NH₄⁺) связями не соединяются; Cu²⁺ и Fe³⁺ связаны с донорными атомами O.
 */
import { applySkeletonBonds, autoBondKitHydrogens, createFormulaKit } from '../../src/chemistry/organic/organicGraph.ts'
import { layoutOrganicGraph } from '../../src/chemistry/organic/organicLayout.ts'
import { kitOf, smilesSkeleton } from '../../src/data/researchLab/organicBuildCatalogTextbookExtra.ts'

type V = [number, number, number]
export type GeoAtom = { symbol: string; pos: V }
export type Geo = { atoms: GeoAtom[]; bonds: [number, number][] }
type Frag = Geo & { anchors: number[]; anchorFrom: number[] }

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V): V => mul(a, 1 / (Math.hypot(...a) || 1))
const dist = (a: V, b: V) => Math.hypot(...sub(a, b))

/** Поворот, переводящий единичный вектор a в единичный вектор b (формула Родрига). */
function rotator(a: V, b: V): (p: V) => V {
  const c = dot(a, b)
  let k = cross(a, b)
  let s = Math.hypot(...k)
  if (s < 1e-9) {
    if (c > 0) return (p) => p
    k = norm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]))
    s = 0
    return (p) => add(mul(k, 2 * dot(k, p)), mul(p, -1)) // 180° вокруг k
  }
  k = mul(k, 1 / s)
  return (p) => add(add(mul(p, c), mul(cross(k, p), s)), mul(k, dot(k, p) * (1 - c)))
}

/**
 * Фрагмент по SMILES. Якорь — атомы с зарядом ([O-], [C-]) или, если их нет, первый атом O (донор фенола).
 * anchorFrom — тяжёлый сосед якоря (направление «наружу» = якорь − сосед).
 */
function fragment(smiles: string): Frag {
  const sk = smilesSkeleton(smiles)
  let g = createFormulaKit(kitOf(sk))
  g = applySkeletonBonds(g, sk)
  g = autoBondKitHydrogens(g)
  g = layoutOrganicGraph(g)
  const index = new Map(g.atoms.map((a, i) => [a.id, i]))
  const atoms: GeoAtom[] = g.atoms.map((a) => ({ symbol: a.element, pos: [a.pos[0], a.pos[1], a.pos[2]] }))
  const bonds = g.bonds.map((b) => [index.get(b.a)!, index.get(b.b)!] as [number, number])
  const charged = g.atoms
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => (a.element === 'O' && a.valence === 1) || (a.element === 'C' && a.valence === 3))
  const anchors = charged.length ? charged.map((x) => x.i) : [g.atoms.findIndex((a) => a.element === 'O')]
  const heavyNeighbor = (i: number) => {
    for (const [x, y] of bonds) {
      const o = x === i ? y : y === i ? x : -1
      if (o >= 0 && atoms[o]!.symbol !== 'H') return o
    }
    return -1
  }
  return { atoms, bonds, anchors, anchorFrom: anchors.map(heavyNeighbor) }
}

/** Направление «наружу» у якоря k фрагмента. */
const outward = (f: Frag, k: number): V => norm(sub(f.atoms[f.anchors[k]!]!.pos, f.atoms[f.anchorFrom[k]!]!.pos))

function transform(f: Frag, fn: (p: V) => V): Frag {
  return { ...f, atoms: f.atoms.map((a) => ({ symbol: a.symbol, pos: fn(a.pos) })) }
}

/** Поставить фрагмент так, чтобы его якорь k оказался в точке at, а «наружу» смотрело в сторону dir. */
function place(f: Frag, k: number, at: V, dir: V): Frag {
  const r = rotator(outward(f, k), norm(dir))
  const rotated = transform(f, r)
  const shift = sub(at, rotated.atoms[rotated.anchors[k]!]!.pos)
  return transform(rotated, (p) => add(p, shift))
}

class Builder {
  atoms: GeoAtom[] = []
  bonds: [number, number][] = []
  add(f: Geo): number {
    const base = this.atoms.length
    this.atoms.push(...f.atoms.map((a) => ({ symbol: a.symbol, pos: a.pos })))
    this.bonds.push(...f.bonds.map(([a, b]) => [a + base, b + base] as [number, number]))
    return base
  }
  ion(symbol: string, pos: V): number {
    this.atoms.push({ symbol, pos })
    return this.atoms.length - 1
  }
  bond(a: number, b: number) {
    this.bonds.push([a, b])
  }
  /** Ион у якоря фрагмента (уже добавленного с base) на расстоянии d по направлению связи. */
  ionAt(symbol: string, f: Frag, base: number, k: number, d: number): number {
    return this.ion(symbol, add(this.atoms[base + f.anchors[k]!]!.pos, mul(outward(f, k), d)))
  }
  done(): Geo {
    const c = mul(this.atoms.reduce<V>((s, a) => add(s, a.pos), [0, 0, 0]), 1 / this.atoms.length)
    const r3 = (x: number) => Math.round(x * 1000) / 1000
    return {
      atoms: this.atoms.map((a) => ({ symbol: a.symbol, pos: sub(a.pos, c).map(r3) as V })),
      bonds: this.bonds,
    }
  }
}

/** Ион аммония NH₄⁺: азот с четырьмя H (тетраэдр) в точке at. */
function ammoniumAt(b: Builder, at: V) {
  const nh4 = fragment('[N+]')
  const n = nh4.atoms.findIndex((a) => a.symbol === 'N')
  const shift = sub(at, nh4.atoms[n]!.pos)
  b.add(transform(nh4, (p) => add(p, shift)))
}

/** Комплекс: ион металла M в начале координат, лиганды — донорными атомами на расстоянии d по осям dirs. */
function complex(metal: string, ligands: Frag[], dirs: V[], d: number): { b: Builder; m: number } {
  const b = new Builder()
  const m = b.ion(metal, [0, 0, 0])
  ligands.forEach((lig, i) => {
    const dir = norm(dirs[i]!)
    // якорь в точке M + d·dir, «наружу» от лиганда смотрит на металл
    const placed = place(lig, 0, mul(dir, d), mul(dir, -1))
    const base = b.add(placed)
    b.bond(m, base + placed.anchors[0]!)
  })
  return { b, m }
}

/** Отодвигать ион от остальных атомов, пока ближайший не дальше minD. */
function pushOut(b: Builder, i: number, dir: V, minD: number) {
  for (let step = 0; step < 60; step++) {
    const near = b.atoms.reduce((m, a, j) => (j === i ? m : Math.min(m, dist(a.pos, b.atoms[i]!.pos))), Infinity)
    if (near >= minD) return
    b.atoms[i] = { symbol: b.atoms[i]!.symbol, pos: add(b.atoms[i]!.pos, mul(norm(dir), 0.25)) }
  }
}

const GLUCOSE_OPEN = (o2: string, o3: string) => `O=CC(${o2})C(${o3})C(O)C(O)CO`

export const SALT_GEOMETRY: Readonly<Record<string, () => Geo>> = {
  tb_k2c2o4: () => {
    const b = new Builder()
    const f = fragment('[O-]C(=O)C(=O)[O-]')
    const base = b.add(f)
    b.ionAt('K', f, base, 0, 2.7)
    b.ionAt('K', f, base, 1, 2.7)
    return b.done()
  },
  tb_c6h5cook: () => {
    const b = new Builder()
    const f = fragment('C1=CC=CC=C1C(=O)[O-]')
    b.ionAt('K', f, b.add(f), 0, 2.7)
    return b.done()
  },
  tb_c7h7ok: () => {
    // о-крезолят: учебник, с. 126 — о-крезол среди представителей фенолов
    const b = new Builder()
    const f = fragment('CC1=CC=CC=C1[O-]')
    b.ionAt('K', f, b.add(f), 0, 2.7)
    return b.done()
  },
  tb_c2h5na: () => {
    const b = new Builder()
    const f = fragment('C[C-]')
    const base = b.add(f)
    const na = b.ionAt('Na', f, base, 0, 2.2)
    b.bond(base + f.anchors[0]!, na) // связь C–Na (металлоорганическое соединение)
    return b.done()
  },
  tb_ch3coonh4: () => {
    const b = new Builder()
    const f = fragment('CC(=O)[O-]')
    const base = b.add(f)
    ammoniumAt(b, add(b.atoms[base + f.anchors[0]!]!.pos, mul(outward(f, 0), 2.8)))
    return b.done()
  },
  tb_nh4_gluconate: () => {
    const b = new Builder()
    const f = fragment('OCC(O)C(O)C(O)C(O)C(=O)[O-]')
    const base = b.add(f)
    ammoniumAt(b, add(b.atoms[base + f.anchors[0]!]!.pos, mul(outward(f, 0), 2.8)))
    return b.done()
  },
  tb_diethyloxonium_hso4: () => {
    const b = new Builder()
    const ox = fragment('CC[O+]CC')
    const base = b.add(ox)
    const o = ox.atoms.findIndex((a, i) => a.symbol === 'O' && ox.bonds.some(([x, y]) => (x === i && ox.atoms[y]!.symbol === 'H') || (y === i && ox.atoms[x]!.symbol === 'H')))
    const hIdx = ox.bonds.map(([x, y]) => (x === o ? y : y === o ? x : -1)).find((j) => j >= 0 && ox.atoms[j]!.symbol === 'H')!
    const dir = norm(sub(b.atoms[base + hIdx]!.pos, b.atoms[base + o]!.pos))
    const hso4 = fragment('OS(=O)(=O)[O-]')
    b.add(place(hso4, 0, add(b.atoms[base + o]!.pos, mul(dir, 2.6)), mul(dir, -1)))
    return b.done()
  },
  tb_cu_glycerate: () => complex('Cu', [fragment('OCC(O)C[O-]'), fragment('OCC(O)C[O-]')], [[1, 0, 0], [-1, 0, 0]], 1.95).b.done(),
  tb_cu_glycolate: () => complex('Cu', [fragment('OCC[O-]'), fragment('OCC[O-]')], [[1, 0, 0], [-1, 0, 0]], 1.95).b.done(),
  tb_cu_glucosate: () =>
    complex('Cu', [fragment(GLUCOSE_OPEN('[O-]', 'O')), fragment(GLUCOSE_OPEN('[O-]', 'O'))], [[1, 0, 0], [-1, 0, 0]], 1.95).b.done(),
  tb_c6h10o6cu: () => {
    // запись учебника C₆H₁₀O₆Cu: Cu²⁺ связан с O соседних групп OH (C2, C3) одной молекулы глюкозы
    const b = new Builder()
    const f = fragment(GLUCOSE_OPEN('[O-]', '[O-]'))
    const base = b.add(f)
    const o1 = b.atoms[base + f.anchors[0]!]!.pos
    const o2 = b.atoms[base + f.anchors[1]!]!.pos
    const heavy = f.atoms.map((a, i) => ({ a, i })).filter(({ a }) => a.symbol !== 'H')
    const centroid = mul(heavy.reduce<V>((s, { i }) => add(s, b.atoms[base + i]!.pos), [0, 0, 0]), 1 / heavy.length)
    const mid = mul(add(o1, o2), 0.5)
    const half = dist(o1, o2) / 2
    const cu = b.ion('Cu', add(mid, mul(norm(sub(mid, centroid)), Math.sqrt(Math.max(0.3, 1.95 ** 2 - half ** 2)))))
    b.bond(cu, base + f.anchors[0]!)
    b.bond(cu, base + f.anchors[1]!)
    return b.done()
  },
  tb_ca_saccharate: () => {
    const b = new Builder()
    b.add(fragment('OCC1OC(OC2(CO)OC(CO)C(O)C2O)C(O)C(O)C1O'))
    const zMax = Math.max(...b.atoms.map((a) => a.pos[2]))
    const c = mul(b.atoms.reduce<V>((s, a) => add(s, a.pos), [0, 0, 0]), 1 / b.atoms.length)
    const ca = b.ion('Ca', [c[0], c[1], zMax + 2.6])
    b.ion('O', [c[0] + 2.2, c[1], zMax + 2.6])
    pushOut(b, ca, [0, 0, 1], 2.4)
    return b.done()
  },
  tb_fe_phenol_complex: () => {
    const dirs: V[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
    const { b } = complex('Fe', dirs.map(() => fragment('OC1=CC=CC=C1')), dirs, 2.0)
    for (const d of [[1, 1, 1], [-1, -1, 1], [1, -1, -1]] as V[]) {
      const cl = b.ion('Cl', mul(norm(d), 4.2))
      pushOut(b, cl, d, 2.8)
    }
    return b.done()
  },
}

/** Ближайшее расстояние между атомами модели (проверка перекрытий). */
export function minDistance(g: Geo): number {
  let m = Infinity
  for (let i = 0; i < g.atoms.length; i++) for (let j = i + 1; j < g.atoms.length; j++) m = Math.min(m, dist(g.atoms[i]!.pos, g.atoms[j]!.pos))
  return m
}
