import type { FormationPlan } from '../../../../chemistry/formationPlan'
import type { FormationScript } from '../../../../chemistry/formationScripts'
import { getCrystal } from '../../../../chemistry/data/crystalData'
import { cellMatrix } from '../../../../lab/cinema/scenes/kit/lattice'
import type { SchoolHeroModel, V3 } from '../../hero/schoolHeroModel'
import { phaseRow } from './phase-data'

/**
 * Фрагмент решётки вокруг формульной единицы модели карточки («Как образуется», этап «Решётка» / «Готово»).
 * Правила — docs/plans/formation200-rules.md, раздел 1:
 *  - ионные (IB / IC / IH): 'generator' — настоящий фрагмент из CRYSTAL_DATA[latticeGen] / SYNTH: модель карточки стоит
 *    В УЗЛАХ решётки (точная подгонка, buildIonicFragment), вокруг — координационные оболочки S1 (соседи каждого иона
 *    модели — видно КЧ) и S2 (соседи соседей, тусклее); 'schema' — обобщённый фрагмент с верным соотношением ионов;
 *  - молекулярная решётка (I₂, S₈, P₄, P₄O₁₀, H₃PO₄ …): 6 копий молекулы ПОЗАДИ модели, мельче и тусклее;
 *  - полимер (CrO₃, V₂O₅, H₂SiO₃, HPO₃): соседние звенья цепи (общая вершина);
 *  - S / MP (газы, жидкости) и N (модель — сам каркас): без фрагмента.
 * Каждый атом фрагмента имеет k ∈ [0, 1] — порядок роста (S1: 0…0,45, S2: 0,55…1), dim — доля смешения цвета с фоном.
 */

/**
 * ion — знак узла (+1 катион, −1 анион; у молекулярной укладки/цепи нет), u — номер частицы фрагмента (атомы одного
 * иона/молекулы), shell — координационная оболочка (1 — соседи ионов модели, 2 — соседи соседей), dim — доля смешения
 * цвета атома с фоном (0 — полный цвет): S1 0,30, S2 0,58, копии молекул 0,55, звенья цепи 0,35.
 */
export type LatticeAtom = { el: string; pos: V3; r: number; charge: number; k: number; ion?: 1 | -1; u?: number; shell?: 1 | 2; dim: number }
export type StoryLatticeKind = 'ionic' | 'molecular' | 'chain' | 'network' | 'none'
/** Сводка фрагмента (кадр, аудит): частицы и протяжённость оболочек (от центра модели, с радиусом шара). */
export type LatticeShells = { n1: number; n2: number; ext1: number; ext2: number; extAll: number; eps: number; snapMax: number; scale: number }

/** Доли смешения цвета с фоном (FormationMoleculeView / latticeDraw). */
export const LATTICE_DIM = { s1: 0.3, s2: 0.58, molecular: 0.55, chain: 0.35 } as const
/** Радиус копии молекулы / звена цепи относительно атома модели. */
export const COPY_R = { molecular: 0.72, chain: 0.85 } as const
/** Контакт катион–анион: сосед, если d ≤ CONTACT_TOL·d_CA (корунд: 185 и 197 пм — оба соседи). */
export const CONTACT_TOL = 1.08
/** Норма касания ионов: r₁ + r₂ ≤ ION_GAP·d. */
export const ION_GAP = 0.92
const PM = 0.00285

type Tpl = { el: string; rel: V3; r: number; charge: number }[]

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const addv = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const lenv = (a: V3) => Math.hypot(a[0], a[1], a[2])
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const norm = (a: V3): V3 => {
  const l = lenv(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** Поворот, переводящий единичный u в единичный v (формула Родрига). */
function rotFromTo(u: V3, v: V3): (p: V3) => V3 {
  const c = dot(u, v)
  if (c > 1 - 1e-12) return (p) => p
  let ax = cross(u, v)
  if (lenv(ax) < 1e-9) {
    ax = Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0])
  }
  ax = norm(ax)
  const ang = Math.acos(Math.max(-1, Math.min(1, c)))
  const s = Math.sin(ang)
  const k = 1 - Math.cos(ang)
  return (p) => {
    const kx = cross(ax, p)
    const kkx = cross(ax, kx)
    return [p[0] + s * kx[0] + k * kkx[0], p[1] + s * kx[1] + k * kkx[1], p[2] + s * kx[2] + k * kkx[2]]
  }
}

function centroid(model: SchoolHeroModel, atoms: number[]): V3 {
  const c: V3 = [0, 0, 0]
  for (const a of atoms) for (let q = 0; q < 3; q++) c[q] += model.atoms[a]!.pos[q]! / atoms.length
  return c
}

function template(model: SchoolHeroModel, atoms: number[], charge: number): Tpl {
  const c = centroid(model, atoms)
  return atoms.map((a) => ({ el: model.atoms[a]!.el, rel: sub(model.atoms[a]!.pos, c), r: model.atoms[a]!.r, charge: atoms.length === 1 ? charge : 0 }))
}

type Unit = { center: V3; atoms: Omit<LatticeAtom, 'k' | 'dim'>[] }
/** Порядок роста: k по удалённости центра частицы от origin в диапазоне [k0, k1] (слоями). */
function withK(list: Unit[], origin: V3, maxAtoms: number, dim: number, k0 = 0, k1 = 1, u0 = 0, shell?: 1 | 2): LatticeAtom[] {
  const sorted = [...list].sort((a, b) => lenv(sub(a.center, origin)) - lenv(sub(b.center, origin)))
  const out: LatticeAtom[] = []
  const kept: typeof sorted = []
  let n = 0
  for (const u of sorted) {
    if (n + u.atoms.length > maxAtoms) break
    kept.push(u)
    n += u.atoms.length
  }
  const d0 = kept.length ? lenv(sub(kept[0]!.center, origin)) : 0
  const d1 = kept.length ? lenv(sub(kept[kept.length - 1]!.center, origin)) : 1
  kept.forEach((u, ui) => {
    const f = d1 - d0 < 1e-9 ? 0 : (lenv(sub(u.center, origin)) - d0) / (d1 - d0)
    const k = k0 + (k1 - k0) * f
    for (const a of u.atoms) out.push({ ...a, k, u: u0 + ui, dim, ...(shell ? { shell } : {}) })
  })
  return out
}

type Ions = { cat: { u: number; tpl: Tpl; c: V3 }[]; an: { u: number; tpl: Tpl; c: V3 }[] }
function ionsOf(plan: FormationPlan, model: SchoolHeroModel): Ions {
  const cat: Ions['cat'] = []
  const an: Ions['an'] = []
  plan.units.forEach((u, i) => {
    const sp = plan.species[u.species]!
    if (sp.charge > 0) cat.push({ u: i, tpl: template(model, u.atoms, sp.charge), c: centroid(model, u.atoms) })
    else if (sp.charge < 0) an.push({ u: i, tpl: template(model, u.atoms, sp.charge), c: centroid(model, u.atoms) })
  })
  return { cat, an }
}

/**
 * Настоящий фрагмент по структурному типу: узлы катионов — шаблон катиона модели, узлы анионов — шаблон аниона.
 * Структурные типы, которых нет в crystalData (или с параметрами вещества), — SYNTH: ячейка (3 вектора, пм), базис
 * (знак заряда + дробные координаты), skip — удаляемые узлы (вакансии слоя MX₃), range — число ячеек по осям.
 *  - антифлюорит (Na₂O, K₂O, Li₂O, Na₂S, K₂S): анионы — ГЦК, катионы — во всех 8 тетраэдрических пустотах (4 : 8);
 *  - куприт (Cu₂O, Ag₂O): O (0 0 0), (½ ½ ½); M (¼ ¼ ¼), (¼ ¾ ¾), (¾ ¼ ¾), (¾ ¾ ¼) — у M 2 соседа O, у O 4 соседа M;
 *  - CdI₂ (Mg(OH)₂, Ca(OH)₂, Fe(OH)₂, PbI₂; CdCl₂-тип приближён им же): гекс., M (0 0 0), X (⅓ ⅔ z), (⅔ ⅓ −z) — 6 : 3;
 *  - слоистая MX₃ (AlCl₃, FeCl₃, CrCl₃): CdI₂ в плоскости без каждого третьего M ((i − j) mod 3 = 0) — сотовая сетка, 6 : 2;
 *  - рутил (MnO₂; CaCl₂ — искажённый рутил): тетрагон., M (0 0 0), (½ ½ ½); X ±(u u 0), ±(½+u ½−u ½), u = 0,305 — 6 : 3.
 */
const FCC: V3[] = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]]
const TETRA: V3[] = [0.25, 0.75].flatMap((x) => [0.25, 0.75].flatMap((y) => [0.25, 0.75].map((z) => [x, y, z] as V3)))
type Cell = [V3, V3, V3]
type Synth = { cell: Cell; basis: { charge: number; frac: V3 }[]; skip?: (i: number, j: number, k: number, b: number) => boolean; range: [number, number, number]; layered?: boolean }
const cubicCell = (a: number): Cell => [[a, 0, 0], [0, a, 0], [0, 0, a]]
const hexCell = (a: number, c: number): Cell => [[a, 0, 0], [-a / 2, (a * Math.sqrt(3)) / 2, 0], [0, 0, c]]
const tetraCell = (a: number, c: number): Cell => [[a, 0, 0], [0, a, 0], [0, 0, c]]
/** z аниона слоя CdI₂ (доля c): из справочника (гидроксиды, PbI₂) или по расстоянию M–X (CdCl₂-тип, MX₃). */
const CDI2_Z: Record<string, number> = { mg_oh_2: 0.22, ca_oh_2: 0.23, fe_oh_2: 0.24, tb_croh2: 0.24, salt_pb_i: 0.27, salt_mg_cl: 0.24, salt_fe2_cl: 0.24, salt_mn_cl: 0.24 }
/** M–X, пм (CRC / справочники структур): z аниона слоя MX₃ = √(d² − a²/3) / c. */
const MX3_D: Record<string, number> = { salt_al_cl: 230, salt_fe3_cl: 238, salt_cr_cl: 235 }
function cdi2Basis(z: number): Synth['basis'] {
  return [
    { charge: 2, frac: [0, 0, 0] },
    { charge: -1, frac: [1 / 3, 2 / 3, z] },
    { charge: -1, frac: [2 / 3, 1 / 3, -z] },
  ]
}
function synthFor(gen: string, id: string): Synth | null {
  const L = phaseRow(id)?.info.lattice
  // в crystalData у сфалерита, вюрцита, CsCl и троилита нет базиса — ячейка здесь (параметры вещества из таблицы фаз)
  if (gen === 'sphalerite')
    return { cell: cubicCell(L?.a ?? 541), basis: [...FCC.map((frac) => ({ charge: 2, frac })), ...FCC.map((f) => ({ charge: -2, frac: [f[0] + 0.25, f[1] + 0.25, f[2] + 0.25] as V3 }))], range: [3, 3, 3] }
  if (gen === 'wurtzite') {
    const u = 0.38
    return {
      cell: hexCell(L?.a ?? 325, L?.c ?? 521),
      basis: [
        { charge: 2, frac: [1 / 3, 2 / 3, 0] },
        { charge: 2, frac: [2 / 3, 1 / 3, 0.5] },
        { charge: -2, frac: [1 / 3, 2 / 3, u] },
        { charge: -2, frac: [2 / 3, 1 / 3, 0.5 + u] },
      ],
      range: [5, 5, 3],
    }
  }
  if (gen === 'cscl') return { cell: cubicCell(L?.a ?? 386), basis: [{ charge: 1, frac: [0.5, 0.5, 0.5] }, { charge: -1, frac: [0, 0, 0] }], range: [4, 4, 4] }
  if (gen === 'troilite') {
    // троилит FeS — сверхструктура типа NiAs (a = √3·a₀, c = 2·c₀): берём подъячейку NiAs, Fe 6 : S 6
    const a = (L?.a ?? 597) / Math.sqrt(3)
    const c = (L?.c ?? 1174) / 2
    return {
      cell: hexCell(a, c),
      basis: [
        { charge: 2, frac: [0, 0, 0] },
        { charge: 2, frac: [0, 0, 0.5] },
        { charge: -2, frac: [1 / 3, 2 / 3, 0.25] },
        { charge: -2, frac: [2 / 3, 1 / 3, 0.75] },
      ],
      range: [4, 4, 3],
    }
  }
  if (gen === 'antifluorite') return { cell: cubicCell(555), basis: [...FCC.map((frac) => ({ charge: -2, frac })), ...TETRA.map((frac) => ({ charge: 1, frac }))], range: [2, 2, 2] }
  if (gen === 'cuprite')
    return {
      cell: cubicCell(L?.a ?? 427),
      basis: [
        { charge: -2, frac: [0, 0, 0] },
        { charge: -2, frac: [0.5, 0.5, 0.5] },
        ...([[0.25, 0.25, 0.25], [0.25, 0.75, 0.75], [0.75, 0.25, 0.75], [0.75, 0.75, 0.25]] as V3[]).map((frac) => ({ charge: 1, frac })),
      ],
      range: [3, 3, 3],
    }
  if (gen === 'cdi2') {
    const a = L?.a ?? 314
    const c = L?.c ?? 477
    return { cell: hexCell(a, c), basis: cdi2Basis(CDI2_Z[id] ?? 0.24), range: [4, 4, 3], layered: true }
  }
  if (gen === 'mx3layer') {
    const a = (L?.a ?? 600) / Math.sqrt(3)
    const c = L?.c ?? 580
    const d = MX3_D[id] ?? 235
    const z = Math.sqrt(Math.max(0, d * d - (a * a) / 3)) / c
    return { cell: hexCell(a, c), basis: cdi2Basis(z), skip: (i, j, _k, b) => b === 0 && (((i - j) % 3) + 3) % 3 === 0, range: [6, 6, 2], layered: true }
  }
  if (gen === 'rutile') {
    const a = L?.b ? (L.a! + L.b) / 2 : (L?.a ?? 440)
    const c = L?.c ?? 287
    const u = L?.b ? 0.3 : 0.305
    return {
      cell: tetraCell(a, c),
      basis: [
        { charge: 4, frac: [0, 0, 0] },
        { charge: 4, frac: [0.5, 0.5, 0.5] },
        ...([[u, u, 0], [-u, -u, 0], [0.5 + u, 0.5 - u, 0.5], [0.5 - u, 0.5 + u, 0.5]] as V3[]).map((frac) => ({ charge: -2, frac })),
      ],
      range: [3, 3, 4],
    }
  }
  return null
}
const matVec = (m: Cell, f: readonly number[]): V3 => [
  f[0]! * m[0][0] + f[1]! * m[1][0] + f[2]! * m[2][0],
  f[0]! * m[0][1] + f[1]! * m[1][1] + f[2]! * m[2][1],
  f[0]! * m[0][2] + f[1]! * m[1][2] + f[2]! * m[2][2],
]
/** Поворот вокруг единичной оси ax на угол ang (формула Родрига). */
function rotAxis(ax: V3, ang: number): (p: V3) => V3 {
  const s = Math.sin(ang)
  const k = 1 - Math.cos(ang)
  return (p) => {
    const kx = cross(ax, p)
    const kkx = cross(ax, kx)
    return [p[0] + s * kx[0] + k * kkx[0], p[1] + s * kx[1] + k * kkx[1], p[2] + s * kx[2] + k * kkx[2]]
  }
}
/** Пирит: гантель S₂ в узле аниона (½ ½ ½), (½ 0 0), (0 ½ 0), (0 0 ½) решётки типа NaCl направлена по своей диагонали куба (Pa3). */
const PYRITE_DIR: V3[] = [[1, 1, 1], [-1, 1, -1], [-1, -1, 1], [1, -1, -1]]


/** Якорь частицы — центр её тяжёлых атомов (O у OH⁻, N у NH₄⁺, середина гантели S₂): он стоит в узле решётки. */
function anchorOf(model: SchoolHeroModel, atoms: number[]): V3 {
  const heavy = atoms.filter((a) => model.atoms[a]!.el !== 'H')
  return centroid(model, heavy.length ? heavy : atoms)
}

/** Решётка генератора: ячейка (пм), базис со знаком, вакансии, слоистость, ось c. */
type Lat = { cell: Cell; basis: { cation: boolean; frac: V3 }[]; skip?: Synth['skip']; layered: boolean }
function latOf(gen: string, id: string, catEl: Set<string>): Lat | null {
  const syn = synthFor(gen, id)
  if (syn) return { cell: syn.cell, basis: syn.basis.map((b) => ({ cation: b.charge > 0, frac: b.frac })), skip: syn.skip, layered: !!syn.layered }
  const cr = getCrystal(gen)
  if (!cr?.basis?.length) return null
  const m = cellMatrix(gen)
  const cell: Cell = [[m.a[0], m.a[1], m.a[2]], [m.b[0], m.b[1], m.b[2]], [m.c[0], m.c[1], m.c[2]]]
  return {
    cell,
    basis: cr.basis.map((b) => ({ cation: b.charge != null ? b.charge > 0 : catEl.has(b.el ?? ''), frac: [b.frac[0]!, b.frac[1]!, b.frac[2]!] as V3 })),
    layered: false,
  }
}
/** Есть ли данные решётки генератора (ячейка + базис): у zncl2 и др. без базиса — нет, вещество показывается схемой. */
export function latticeDataExists(gen: string, id: string): boolean {
  return latOf(gen, id, new Set()) != null
}
/** Синтетическая «каменная соль» со стороной 2·d (схема 1 : 1 — шахматный порядок, у каждого иона 6 соседей). */
const RS_SCHEMA: Lat = {
  cell: cubicCell(2),
  basis: [...FCC.map((frac) => ({ cation: true, frac })), ...FCC.map((f) => ({ cation: false, frac: [f[0] + 0.5, f[1], f[2]] as V3 }))],
  layered: false,
}

type Site = { cation: boolean; p: V3; b: number }
/** Узлы в шаре радиуса Rb (в долях dL) вокруг катиона C (p — относительно C, пм); dL — ближайшее катион–анион. */
function sitesOf(L: Lat, rbOf: (dL: number) => number): { sites: Site[]; dL: number } | null {
  const at = (i: number, j: number, k: number, b: number): V3 => {
    const f = L.basis[b]!.frac
    return matVec(L.cell, [f[0] + i, f[1] + j, f[2] + k])
  }
  let C: V3 | null = null
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++)
        L.basis.forEach((b, bi) => {
          if (!b.cation || L.skip?.(i, j, k, bi)) return
          const p = at(i, j, k, bi)
          if (!C || lenv(p) < lenv(C) - 1e-9) C = p
        })
  if (!C) return null
  const c0: V3 = C
  let dL = Infinity
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++)
      for (let k = -2; k <= 2; k++)
        L.basis.forEach((b, bi) => {
          if (b.cation || L.skip?.(i, j, k, bi)) return
          dL = Math.min(dL, lenv(sub(at(i, j, k, bi), c0)))
        })
  if (!Number.isFinite(dL) || dL < 1e-6) return null
  const Rb = rbOf(dL)
  // число ячеек по осям: толщина ячейки вдоль оси i — V / |a_j × a_k|
  const [a, b, c] = L.cell
  const V = Math.abs(dot(a, cross(b, c)))
  const h = [V / lenv(cross(b, c)), V / lenv(cross(c, a)), V / lenv(cross(a, b))]
  const N = h.map((x) => Math.ceil(Rb / x) + 2)
  const sites: Site[] = []
  for (let i = -N[0]!; i <= N[0]!; i++)
    for (let j = -N[1]!; j <= N[1]!; j++)
      for (let k = -N[2]!; k <= N[2]!; k++)
        L.basis.forEach((bb, bi) => {
          if (L.skip?.(i, j, k, bi)) return
          const p = sub(at(i, j, k, bi), c0)
          if (lenv(p) <= Rb) sites.push({ cation: bb.cation, p, b: bi })
        })
  return { sites, dL }
}

type Part = { tpl: Tpl; c: V3; cation: boolean; atoms: number[] }
/** Диагностика (аудит): наименьшая невязка подгонки последнего вызова, доля d_CA (Infinity — подгонки не было). */
export const LATTICE_FIT_DEBUG = { minEps: Infinity }
/** nodes — узлы решётки, занятые частицами модели (атомы частицы + узел; для аудита: якорь + snap = узел). */
export type IonicFragment = { atoms: LatticeAtom[]; snap: V3[]; shells: LatticeShells; nodes: { atoms: number[]; node: V3; ion: 1 | -1 }[] }

/**
 * Фрагмент ионной решётки, в узлах которого стоит модель карточки (правила п. 2–5 спецификации «lattice»):
 *  • подгонка: узел C ↦ якорь катиона модели C0 (точно), масштаб k = d_model / d_L, R1: (A − C) ↦ (A0 − C0) (точно);
 *    свободный угол θ вокруг оси C0→A0 — 360 шагов по 1° × все анионы A на ≤ 1,02·d_L; у каждой другой частицы модели —
 *    ближайший узел её знака, невязка ε_p; max ε ≤ 1 пм — точное совпадение, ≤ 0,15·d_CA — «усадка в узлы»
 *    (latticeSnap = узел − якорь, одинаков у атомов частицы), иначе — null (схема);
 *  • оболочки: S1 — свободные узлы противоположного знака на ≤ CONTACT_TOL·d_CA от узла частицы модели (её КЧ),
 *    S2 — то же от узлов S1; частиц ≤ 60, атомов ≤ 240 (S2 обрезается по удалённости от центра модели);
 *  • радиусы: s = min(1, 0,92·d/(r_i + r_j)) по парам фрагмента, (0,92·d − r_m)/r_f по парам модель–фрагмент; r_L = s·r;
 *  • читаемость (выбор среди θ с ε ≤ ε* + 1 пм): Σ max(0, r_i + r_j − ρ_ij)² по парам на экране (поза модели)
 *    + 4·R²·(число атомов модели, закрытых более близким шаром фрагмента); при равенстве — ось c / ребро ячейки ближе
 *    к горизонтали экрана.
 */
export function buildIonicFragment(L: Lat | string, plan: FormationPlan, model: SchoolHeroModel, screenToModel: (s: V3) => V3): IonicFragment | null {
  LATTICE_FIT_DEBUG.minEps = Infinity
  const { cat, an } = ionsOf(plan, model)
  if (!cat.length || !an.length) return null
  const catEl = new Set(cat.flatMap((x) => x.tpl.map((t) => t.el)))
  const gen = typeof L === 'string' ? L : null
  const lat = typeof L === 'string' ? latOf(L, plan.compoundId, catEl) : L
  if (!lat) return null
  const mk = (x: Ions['cat'][number], cation: boolean): Part => {
    const atoms = plan.units[x.u]!.atoms
    const c = anchorOf(model, atoms)
    return { tpl: atoms.map((a, q) => ({ el: model.atoms[a]!.el, rel: sub(model.atoms[a]!.pos, c), r: model.atoms[a]!.r, charge: x.tpl[q]!.charge })), c, cation, atoms }
  }
  const parts: Part[] = [...cat.map((x) => mk(x, true)), ...an.map((x) => mk(x, false))]
  const X = norm(screenToModel([1, 0, 0]))
  const Y = norm(screenToModel([0, 1, 0]))
  const Z = norm(screenToModel([0, 0, 1]))
  const origin = centroid(model, model.atoms.map((_, i) => i))
  const Rm = Math.max(1e-3, model.radius)
  const pyrite = gen === 'nacl' && /пирит/.test(phaseRow(plan.compoundId)?.info.lattice?.type ?? '')
  const dumb = (p: Part) => (p.tpl.length === 2 && p.tpl[0]!.el === p.tpl[1]!.el ? norm(sub(p.tpl[1]!.rel, p.tpl[0]!.rel)) : null)

  type Fit = { C0: Part; A0: Part; dModel: number; k: number; sites: Site[]; R: (p: V3) => V3; eps: number }
  let bestFits: Fit[] = []
  let epsStar = Infinity
  for (const C0 of parts.filter((p) => p.cation)) {
    const A0 = parts.filter((p) => !p.cation).sort((a, b) => lenv(sub(a.c, C0.c)) - lenv(sub(b.c, C0.c)))[0]!
    const dModel = lenv(sub(A0.c, C0.c))
    if (dModel < 1e-6) continue
    let far = 0
    for (const p of parts) far = Math.max(far, lenv(sub(p.c, C0.c)))
    const got = sitesOf(lat, (dL) => Math.max(3.2 * dL, (far / dModel) * dL + 2.3 * dL))
    if (!got) continue
    const { sites, dL } = got
    const k = dModel / dL
    const mAxis = norm(sub(A0.c, C0.c))
    const others = parts.filter((p) => p !== C0)
    // кандидаты узлов частицы: тот же знак, | |s|·k − |v| | ≤ 0,16·d
    const cand = others.map((o) => {
      const v = lenv(sub(o.c, C0.c))
      return sites.filter((s) => s.cation === o.cation && Math.abs(lenv(s.p) * k - v) <= 0.16 * dModel)
    })
    const fits: { R: (p: V3) => V3; eps: number }[] = []
    for (const A of sites.filter((s) => !s.cation && lenv(s.p) <= 1.02 * dL)) {
      const R1 = rotFromTo(norm(A.p), mAxis)
      const pre = cand.map((cs) => cs.map((s) => R1(scale(s.p, k))))
      for (let st = 0; st < 360; st++) {
        const R2 = rotAxis(mAxis, (st * Math.PI) / 180)
        let eps = 0
        for (let oi = 0; oi < others.length && eps <= 0.15 * dModel; oi++) {
          const o = others[oi]!
          let e = Infinity
          for (const q of pre[oi]!) e = Math.min(e, lenv(sub(addv(C0.c, R2(q)), o.c)))
          eps = Math.max(eps, e)
        }
        LATTICE_FIT_DEBUG.minEps = Math.min(LATTICE_FIT_DEBUG.minEps, eps / dModel)
        if (eps > 0.15 * dModel) continue
        fits.push({ R: (p: V3) => R2(R1(p)), eps })
      }
    }
    for (const f of fits) {
      const fit: Fit = { C0, A0, dModel, k, sites, R: f.R, eps: f.eps }
      if (f.eps < epsStar - PM) {
        epsStar = f.eps
        bestFits = bestFits.filter((b) => b.eps <= epsStar + PM)
      }
      if (f.eps <= epsStar + PM) bestFits.push(fit)
    }
  }
  if (!bestFits.length) return null
  bestFits = bestFits.filter((b) => b.eps <= epsStar + PM)
  // не больше 120 равномерно (у K₂O все 8 × 360 углов точные)
  const stride = Math.max(1, Math.ceil(bestFits.length / 120))
  const cands = bestFits.filter((_, i) => i % stride === 0)

  type Built = { snap: Map<Part, V3>; units: (Unit & { shell: 1 | 2; ion: 1 | -1 })[]; fit: Fit }
  const build = (fit: Fit): Built => {
    const { C0, A0, k, sites, R, dModel } = fit
    const placed = sites.map((s) => addv(C0.c, R(scale(s.p, k))))
    const occ = new Set<number>()
    const snap = new Map<Part, V3>()
    const node = new Map<Part, number>()
    for (const p of [C0, ...parts.filter((q) => q !== C0)]) {
      let bi = -1
      let bd = Infinity
      placed.forEach((P, i) => {
        if (sites[i]!.cation !== p.cation || occ.has(i)) return
        const d = lenv(sub(P, p.c))
        if (d < bd) ((bd = d), (bi = i))
      })
      if (bi < 0) continue
      occ.add(bi)
      node.set(p, bi)
      snap.set(p, sub(placed[bi]!, p.c))
    }
    const lim = CONTACT_TOL * dModel
    const s1: number[] = []
    const s2: number[] = []
    const inS1 = new Set<number>()
    placed.forEach((P, i) => {
      if (occ.has(i)) return
      for (const [p, ni] of node)
        if (sites[i]!.cation !== p.cation && lenv(sub(P, placed[ni]!)) <= lim) {
          s1.push(i)
          inS1.add(i)
          return
        }
    })
    placed.forEach((P, i) => {
      if (occ.has(i) || inS1.has(i)) return
      for (const j of s1)
        if (sites[i]!.cation !== sites[j]!.cation && lenv(sub(P, placed[j]!)) <= lim) {
          s2.push(i)
          return
        }
    })
    const modelPos = model.atoms.map((a, ai) => {
      const p = parts.find((q) => q.atoms.includes(ai))
      const sv = p ? snap.get(p) : undefined
      return sv ? addv(a.pos, sv) : a.pos
    })
    const unitAt = (i: number, shell: 1 | 2) => {
      const s = sites[i]!
      const P = placed[i]!
      const T = s.cation ? C0 : A0
      let atoms: Omit<LatticeAtom, 'k' | 'dim'>[]
      const dm = dumb(T)
      const hasH = T.tpl.some((t) => t.el === 'H') && T.tpl.some((t) => t.el !== 'H')
      if (pyrite && !s.cation && dm) {
        const half = lenv(sub(T.tpl[1]!.rel, T.tpl[0]!.rel)) / 2
        const dir = norm(R(PYRITE_DIR[s.b - 4] ?? [1, 1, 1]))
        atoms = T.tpl.map((t, q) => ({ el: t.el, pos: addv(P, dir, q === 0 ? -half : half), r: t.r, charge: t.charge }))
      } else if (hasH) {
        // OH⁻ в слое: H — от катионов слоя наружу (в брусите O–H идёт вдоль оси c)
        const cs = placed.filter((q, qi) => sites[qi]!.cation !== s.cation && lenv(sub(q, P)) < 1.2 * dModel)
        const mc: V3 = [0, 0, 0]
        for (const q of cs) for (let w = 0; w < 3; w++) mc[w] += q[w]! / Math.max(1, cs.length)
        const out = cs.length ? norm(sub(P, mc)) : norm(sub(P, C0.c))
        atoms = T.tpl.map((t) => ({ el: t.el, pos: t.el === 'H' ? addv(P, out, lenv(t.rel)) : addv(P, t.rel), r: t.r, charge: t.charge }))
      } else atoms = T.tpl.map((t) => ({ el: t.el, pos: addv(P, t.rel), r: t.r, charge: t.charge }))
      // узел, атом которого лёг на атом модели (модель «как в паре», H чужой частицы) — не рисуем
      if (atoms.some((x) => modelPos.some((mp, ai) => lenv(sub(mp, x.pos)) < 0.5 * (model.atoms[ai]!.r + x.r)))) return null
      return { center: P, atoms: atoms.map((x) => ({ ...x, ion: (s.cation ? 1 : -1) as 1 | -1 })), shell, ion: (s.cation ? 1 : -1) as 1 | -1 }
    }
    const byO = (i: number) => lenv(sub(placed[i]!, origin))
    s1.sort((a, b) => byO(a) - byO(b))
    s2.sort((a, b) => byO(a) - byO(b))
    const units: Built['units'] = []
    let nAt = 0
    for (const [list, shell] of [[s1, 1], [s2, 2]] as const)
      for (const i of list) {
        if (units.length >= 60) break
        const u = unitAt(i, shell)
        if (!u || nAt + u.atoms.length > 240) continue
        units.push(u)
        nAt += u.atoms.length
      }
    return { snap, units, fit }
  }
  const modelAt = (b: Built) =>
    model.atoms.map((a, ai) => {
      const p = parts.find((q) => q.atoms.includes(ai))
      const sv = p ? b.snap.get(p) : undefined
      return { pos: sv ? addv(a.pos, sv) : a.pos, r: a.r, part: p ? parts.indexOf(p) : -1 - ai }
    })
  // Радиус фрагмента: s одинаков у всех θ (расстояния не зависят от поворота) — по первому кандидату.
  const scaleOf = (b: Built): number => {
    const M = modelAt(b)
    let s = 1
    b.units.forEach((u, ui) => {
      for (const x of u.atoms) {
        for (const m of M) {
          const d = lenv(sub(x.pos, m.pos))
          s = Math.min(s, (ION_GAP * d - m.r) / x.r)
        }
        for (let uj = ui + 1; uj < b.units.length; uj++)
          for (const y of b.units[uj]!.atoms) s = Math.min(s, (ION_GAP * lenv(sub(x.pos, y.pos))) / (x.r + y.r))
      }
    })
    return Math.max(0.3, s)
  }
  const first = build(cands[0]!)
  const sR = scaleOf(first)
  const cAxis = norm(lat.cell[2])
  const aAxis = norm(lat.cell[0])
  let best: { b: Built; score: number } | null = null
  for (const f of cands) {
    const b = f === cands[0] ? first : build(f)
    const pts: { x: number; y: number; z: number; r: number; part: number; model: boolean }[] = []
    for (const m of modelAt(b)) pts.push({ x: dot(m.pos, X), y: dot(m.pos, Y), z: dot(m.pos, Z), r: m.r, part: m.part, model: true })
    b.units.forEach((u, ui) => {
      for (const a of u.atoms) pts.push({ x: dot(a.pos, X), y: dot(a.pos, Y), z: dot(a.pos, Z), r: a.r * sR, part: 1000 + ui, model: false })
    })
    let score = 0
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++) {
        const p = pts[i]!
        const q = pts[j]!
        if (p.part === q.part || (p.model && q.model)) continue
        const o = p.r + q.r - Math.hypot(p.x - q.x, p.y - q.y)
        if (o > 0) score += o * o
      }
    let hidden = 0
    for (const p of pts) {
      if (!p.model) continue
      if (pts.some((q) => !q.model && q.z > p.z && Math.hypot(p.x - q.x, p.y - q.y) < q.r + 0.35 * p.r)) hidden++
    }
    score += 4 * Rm * Rm * hidden
    // равенство: ось c (слоистые) или ребро ячейки — ближе к горизонтали экрана
    const ax = norm(f.R(lat.layered ? cAxis : aAxis))
    score += 1e-4 * Rm * Rm * (1 - Math.abs(dot(ax, X)))
    if (!best || score < best.score - 1e-12) best = { b, score }
  }
  const B = best!.b
  const s = sR
  // частица S1, выходящая за кадр (> 2,1·R_m: длинная гантель S₂ у FeS₂, CO₃ у MgCO₃), — контекст S2 (тусклее)
  for (const u of B.units)
    if (u.shell === 1 && u.atoms.some((a) => lenv(a.pos) + a.r * s > 2.1 * Rm)) u.shell = 2
  // S1: k ∈ [0; 0,45], S2: k ∈ [0,55; 1] — по удалённости от центра модели.
  const toUnits = (sh: 1 | 2): Unit[] =>
    B.units.filter((u) => u.shell === sh).map((u) => ({ center: u.center, atoms: u.atoms.map((a) => ({ ...a, r: a.r * s })) }))
  const u1 = toUnits(1)
  const u2 = toUnits(2)
  const atoms = [...withK(u1, origin, 240, LATTICE_DIM.s1, 0, 0.45, 0, 1), ...withK(u2, origin, 240, LATTICE_DIM.s2, 0.55, 1, u1.length, 2)]
  const snap: V3[] = model.atoms.map(() => [0, 0, 0] as V3)
  for (const p of parts) {
    const sv = B.snap.get(p)
    if (sv) for (const a of p.atoms) snap[a] = [sv[0], sv[1], sv[2]]
  }
  const ext = (sh?: 1 | 2) => atoms.filter((a) => !sh || a.shell === sh).reduce((m, a) => Math.max(m, lenv(a.pos) + a.r), 0)
  const snapMax = snap.reduce((m, v) => Math.max(m, lenv(v)), 0)
  const nodes = parts.flatMap((p) => {
    const sv = B.snap.get(p)
    return sv ? [{ atoms: p.atoms, node: addv(p.c, sv), ion: (p.cation ? 1 : -1) as 1 | -1 }] : []
  })
  return { atoms, snap, shells: { n1: u1.length, n2: u2.length, ext1: ext(1), ext2: ext(2), extAll: ext(), eps: B.fit.eps, snapMax, scale: s }, nodes }
}

/**
 * Копии частицы (молекулы / формульной единицы схемы) ПОЗАДИ модели: экранные смещения (e — радиус модели)
 * (±1,55e, 0, −0,5e), (0, ±1,55e, −0,5e), (0,75e, 0,75e, −1,3e), (−0,75e, −0,75e, −1,3e); радиус rK·r, цвет — dim к фону.
 * Если шар копии налезает на модель или на уже поставленную копию (0,92·d < r₁ + r₂), смещение копии растёт ×1,05.
 */
const BEHIND: V3[] = [
  [1.55, 0, -0.5],
  [-1.55, 0, -0.5],
  [0, 1.55, -0.5],
  [0, -1.55, -0.5],
  [0.75, 0.75, -1.3],
  [-0.75, -0.75, -1.3],
]
function behindCopies(model: SchoolHeroModel, screenToModel: (s: V3) => V3, rK: number, dim: number, ionOf?: (ai: number) => 1 | -1 | undefined, minSep = 0): LatticeAtom[] {
  const origin = centroid(model, model.atoms.map((_, i) => i))
  let ext = 0
  for (const a of model.atoms) ext = Math.max(ext, lenv(sub(a.pos, origin)) + a.r)
  const placed: { pos: V3; r: number; h: boolean }[] = model.atoms.map((a) => ({ pos: a.pos, r: a.r, h: a.el === 'H' }))
  const list: Unit[] = []
  for (const o of BEHIND) {
    const off0 = screenToModel([o[0] * ext, o[1] * ext, o[2] * ext])
    let f = 1
    for (let tries = 0; tries < 30; tries++, f *= 1.05) {
      const off = scale(off0, f)
      // шары не налезают (0,92·d ≥ r₁ + r₂), тяжёлые атомы — не ближе minSep (0,47·d катион–анион у схемы ионных)
      const bad = model.atoms.some((a) =>
        placed.some((q) => {
          const d = lenv(sub(addv(a.pos, off), q.pos))
          return ION_GAP * d < q.r + rK * a.r || (a.el !== 'H' && !q.h && d < minSep)
        }),
      )
      if (!bad) break
    }
    const off = scale(off0, f)
    const atoms = model.atoms.map((a, ai) => {
      const ion = ionOf?.(ai)
      return { el: a.el, pos: addv(a.pos, off), r: rK * a.r, charge: a.charge, ...(ion ? { ion } : {}) }
    })
    for (const a of atoms) placed.push({ pos: a.pos, r: a.r, h: a.el === 'H' })
    list.push({ center: addv(origin, off), atoms })
  }
  return withK(list, origin, 400, dim)
}

/**
 * Обобщённый фрагмент: 1 : 1 из одноатомных ионов — «каменная соль» с шагом d модели (те же оболочки S1/S2, что у
 * генератора); иначе — формульные единицы целиком (верное соотношение ионов и молекул воды) копиями позади модели.
 */
function schemaFragment(plan: FormationPlan, model: SchoolHeroModel, screenToModel: (s: V3) => V3): { atoms: LatticeAtom[]; snap?: V3[]; shells?: LatticeShells; nodes?: IonicFragment['nodes'] } {
  const { cat, an } = ionsOf(plan, model)
  const catSp = new Set(cat.map((x) => plan.units[x.u]!.species))
  const anSp = new Set(an.map((x) => plan.units[x.u]!.species))
  const hasMolecules = plan.units.some((u) => plan.species[u.species]!.charge === 0)
  if (cat.length === 1 && an.length === 1 && catSp.size === 1 && anSp.size === 1 && !hasMolecules) {
    const f = buildIonicFragment(RS_SCHEMA, plan, model, screenToModel)
    // многоатомный ион длиннее шага сетки (NaAlO₂: O–Al–O) — ионы пришлось бы сильно уменьшать: тогда — формульные единицы
    // и S1 должна поместиться в кадр (≤ 2,1·R_m — CuSO₄ в «каменной соли» шире): иначе — формульные единицы позади
    if (f && f.shells.scale >= 0.7 && f.shells.ext1 <= 2.1 * model.radius) return f
  }
  const unitOf = new Map<number, number>()
  plan.units.forEach((u, i) => u.atoms.forEach((a) => unitOf.set(a, i)))
  const ionOf = (ai: number): 1 | -1 | undefined => {
    const q = plan.species[plan.units[unitOf.get(ai) ?? -1]?.species ?? -1]?.charge ?? 0
    return q > 0 ? 1 : q < 0 ? -1 : undefined
  }
  let dCA = Infinity
  model.atoms.forEach((a, i) =>
    model.atoms.forEach((b, j) => {
      if ((ionOf(i) ?? 0) > 0 && (ionOf(j) ?? 0) < 0) dCA = Math.min(dCA, lenv(sub(a.pos, b.pos)))
    }),
  )
  return { atoms: behindCopies(model, screenToModel, COPY_R.molecular, LATTICE_DIM.molecular, ionOf, Number.isFinite(dCA) ? 0.47 * dCA : 0) }
}

/**
 * Сдвиг звена цепи с общей вершиной: у единственного центрального атома (Cr, P, Si …) с атомами O — свободное направление
 * тетраэдра (против суммы направлений на O; у плоского звена — перпендикуляр к плоскости); мостиковый O звена (без H)
 * переносится туда. Из кандидатов берётся тот, при котором цепь идёт ближе всего вдоль экрана. null — звено не такое.
 */
function chainShift(model: SchoolHeroModel, X: V3, Z: V3): V3 | null {
  const centers = model.atoms.flatMap((a, i) => (/^(Cr|P|Si|V|Mn|S)$/.test(a.el) ? [i] : []))
  if (centers.length !== 1) return null
  const C = model.atoms[centers[0]!]!.pos
  const os = model.atoms.flatMap((a, i) => (a.el === 'O' ? [i] : []))
  if (os.length < 2) return null
  const hasH = (i: number) => model.bonds.some((b) => (b.a === i && model.atoms[b.b]!.el === 'H') || (b.b === i && model.atoms[b.a]!.el === 'H'))
  const us = os.map((i) => norm(sub(model.atoms[i]!.pos, C)))
  let d4: V3 = [0, 0, 0]
  for (const u of us) d4 = addv(d4, u, -1)
  if (lenv(d4) < 0.25) {
    const [a, b] = [us[0]!, us[1]!]
    d4 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  }
  d4 = norm(d4)
  const dCO = os.reduce((sum, i) => sum + lenv(sub(model.atoms[i]!.pos, C)), 0) / os.length
  const oRight = addv(C, scale(d4, dCO))
  let best: V3 | null = null
  let score = -Infinity
  for (const i of os) {
    if (hasH(i)) continue
    const T = sub(oRight, model.atoms[i]!.pos)
    const n = norm(T)
    const sc = Math.abs(dot(n, X)) - Math.abs(dot(n, Z))
    if (lenv(T) > 1e-6 && sc > score) {
      score = sc
      best = T
    }
  }
  return best
}


function copiesFragment(kind: 'molecular' | 'chain', model: SchoolHeroModel, screenToModel: (s: V3) => V3): LatticeAtom[] {
  if (kind === 'molecular') return behindCopies(model, screenToModel, COPY_R.molecular, LATTICE_DIM.molecular)
  const origin = centroid(model, model.atoms.map((_, i) => i))
  let ext = 0
  for (const a of model.atoms) ext = Math.max(ext, lenv(sub(a.pos, origin)) + a.r)
  const list: Unit[] = []
  const X = norm(screenToModel([1, 0, 0]))
  const Z = norm(screenToModel([0, 0, 1]))
  const offs: V3[] = []
  if (chainShift(model, X, Z)) {
    // Цепь тетраэдров с общими вершинами ((CrO₃)ₙ, (HPO₃)ₙ, (SiO₃)ₙ): соседнее звено сдвинуто так, что его мостиковый O
    // занимает свободную вершину тетраэдра этого звена — звенья делят один атом O, как в настоящем полимере.
    const T = chainShift(model, X, Z)!
    for (const s of [-1, 1, 2]) offs.push(scale(T, s))
  } else {
    // Ось цепи — направление наибольшей протяжённости звена (в плоскости экрана — по X, если звено «круглое»).
    let axis = X
    let best = 0
    for (const a of model.atoms)
      for (const b of model.atoms) {
        const dd = sub(b.pos, a.pos)
        const l = lenv(dd)
        if (l > best + 1e-6 && Math.abs(dot(norm(dd), Z)) < 0.6) {
          best = l
          axis = norm(dd)
        }
      }
    let span = 0
    for (const a of model.atoms) span = Math.max(span, Math.abs(dot(sub(a.pos, origin), axis)) + a.r)
    const L = 2 * span + 0.15 * ext
    // звено без общей вершины (V₂O₅ — слой) — по соседу с каждой стороны: длинный ряд уводил камеру и звено мельчало
    for (const s of [-1, 1]) offs.push(scale(axis, s * L))
  }
  for (const off of offs) {
    const center = addv(origin, off)
    list.push({ center, atoms: model.atoms.map((a) => ({ el: a.el, pos: addv(a.pos, off), r: COPY_R.chain * a.r, charge: 0 })) })
  }
  return withK(list, origin, 400, LATTICE_DIM.chain)
}

export type LatticeSource = 'generator' | 'schema' | 'model' | 'copies' | 'none'

/**
 * Хинт генератора по подписи решётки в таблице правил (formationScripts.lattice): тот же структурный тип —
 * тот же генератор (верная координация). Порядок важен: слоистая MX₃ раньше CdI₂.
 */
function hintOf(lattice: string): string | null {
  if (/типа NaCl|тип NaCl|пирит|CaC₂/.test(lattice)) return 'nacl'
  if (/типа ZnS/.test(lattice)) return 'sphalerite'
  if (/типа корунда/.test(lattice)) return 'corundum'
  if (/антифлюорит/.test(lattice)) return 'antifluorite'
  if (/куприт/.test(lattice)) return 'cuprite'
  if (/^рутил/.test(lattice)) return 'rutile'
  if (/слоистая.*(Al|Fe|Cr)³⁺ 6 : Cl⁻ 2/.test(lattice)) return 'mx3layer'
  if (/CdI₂|CdCl₂|слоистая.*6:3|OH⁻.*слои/.test(lattice)) return 'cdi2'
  return null
}

export type StoryLattice = { kind: StoryLatticeKind; atoms: LatticeAtom[]; src: LatticeSource; gen?: string; snap?: V3[]; shells?: LatticeShells; nodes?: IonicFragment['nodes'] }

/**
 * Ключ генератора ионного вещества: таблица фаз (story/phase-data.ts, структурный тип вещества) → таблица правил
 * (latticeGen) → хинт по подписи; null — смесь или нет структурного типа (схема).
 */
export function latticeGenKey(script: FormationScript | null, plan: FormationPlan): string | null {
  // смесь (KCl·NaCl — сильвинит) — не одна решётка: схема из формульных единиц сохраняет оба катиона
  const mixture = script?.routeKind === 'mixture'
  if (mixture) return null
  const hint = script?.latticeKind === 'schema' ? hintOf(script.lattice) : null
  // кальцит (CaCO₃, MgCO₃) и NaNO₃ — «искажённый тип NaCl»: катионы и группы XO₃ в узлах каменной соли
  // (в crystalData у calcite нет базиса — генератор nacl, группы CO₃/NO₃ — как в модели; в таблице фаз CAL → nacl)
  const fromScript = script?.latticeKind === 'generator' && script.latticeGen ? (script.latticeGen === 'calcite' ? 'nacl' : script.latticeGen) : null
  return phaseRow(plan.compoundId)?.gen ?? fromScript ?? hint
}

function copiesShells(atoms: LatticeAtom[], rK: number): LatticeShells {
  const ext = atoms.reduce((m, a) => Math.max(m, lenv(a.pos) + a.r), 0)
  return { n1: new Set(atoms.map((a) => a.u)).size, n2: 0, ext1: ext, ext2: 0, extAll: ext, eps: 0, snapMax: 0, scale: rK }
}

export function latticeFor(script: FormationScript | null, plan: FormationPlan, model: SchoolHeroModel, screenToModel: (s: V3) => V3): StoryLattice {
  const type = script?.type ?? (plan.mode === 'ionic' ? 'IC' : 'MP')
  const ionic = type === 'IB' || type === 'IC' || type === 'IH'
  if (type === 'N') return { kind: 'network', atoms: [], src: 'model' }
  if (ionic) {
    // Модель карточки уже кристалл (NaCl, MgO, Al₂O₃, PbO, BaSO₄): фрагмент — она сама, растёт слоями.
    if (model.kind === 'crystal') return { kind: 'ionic', atoms: [], src: 'model' }
    if (plan.mode !== 'ionic') return { kind: 'none', atoms: [], src: 'none' }
    // Генератор: таблица фаз → таблица правил → хинт по подписи (latticeGenKey); подгонка не удалась — схема.
    const genKey = latticeGenKey(script, plan)
    const gen = genKey ? buildIonicFragment(genKey, plan, model, screenToModel) : null
    if (gen && gen.atoms.length) return { kind: 'ionic', atoms: gen.atoms, src: 'generator', gen: genKey!, snap: gen.snap, shells: gen.shells, nodes: gen.nodes }
    const sch = schemaFragment(plan, model, screenToModel)
    return {
      kind: 'ionic',
      atoms: sch.atoms,
      src: 'schema',
      ...(genKey ? { gen: genKey } : {}),
      ...(sch.snap ? { snap: sch.snap } : {}),
      ...(sch.nodes ? { nodes: sch.nodes } : {}),
      shells: sch.shells ?? copiesShells(sch.atoms, COPY_R.molecular),
    }
  }
  if (script?.latticeKind === 'molecular') {
    const atoms = copiesFragment('molecular', model, screenToModel)
    return { kind: 'molecular', atoms, src: 'copies', shells: copiesShells(atoms, COPY_R.molecular) }
  }
  if (type === 'PM' || script?.latticeKind === 'chain') {
    const atoms = copiesFragment('chain', model, screenToModel)
    return { kind: 'chain', atoms, src: 'copies', shells: copiesShells(atoms, COPY_R.chain) }
  }
  return { kind: 'none', atoms: [], src: 'none' }
}

const ease = (x: number): number => {
  const u = x < 0 ? 0 : x > 1 ? 1 : x
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}
/** Длительность «усадки в узлы», с: атомы модели доходят до узлов решётки, пока растёт S1. */
export const SNAP_DUR = 1.0
/**
 * «Усадка в узлы»: атом i модели в момент t — PF + latticeSnap·u, u = easeInOut((t − latticeWin[0]) / 1 с)
 * (у точных частиц latticeSnap ≈ 0). Пишет в out (к уже вычисленному положению прибавляется смещение).
 */
export function applyLatticeSnap(s: { latticeSnap?: V3[]; latticeWin: readonly [number, number] }, i: number, t: number, out: V3): V3 {
  const v = s.latticeSnap?.[i]
  if (!v) return out
  const u = ease((t - s.latticeWin[0]) / SNAP_DUR)
  if (u <= 0) return out
  out[0] += v[0] * u
  out[1] += v[1] * u
  out[2] += v[2] * u
  return out
}
