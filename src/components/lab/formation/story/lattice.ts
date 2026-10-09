import type { FormationPlan } from '../../../../chemistry/formationPlan'
import type { FormationScript } from '../../../../chemistry/formationScripts'
import { getCrystal } from '../../../../chemistry/data/crystalData'
import { cellMatrix, fracToPm } from '../../../../lab/cinema/scenes/kit/lattice'
import type { SchoolHeroModel, V3 } from '../../hero/schoolHeroModel'
import { phaseRow } from './phase-data'

/**
 * Фрагмент решётки вокруг формульной единицы модели карточки («Как образуется», этап «Решётка» / «Готово»).
 * Правила — docs/plans/formation200-rules.md, раздел 1:
 *  - ионные (IB / IC / IH): 'generator' — настоящий фрагмент из CRYSTAL_DATA[latticeGen] (ячейки 3×3×3 или 2×2×2,
 *    масштаб — расстояние катион–анион модели), 'schema' — обобщённый кубический 3D-фрагмент с верным соотношением ионов;
 *  - молекулярная решётка (I₂, S₈, P₄, P₄O₁₀, H₃PO₄ …): молекулы в узлах (центр + 8 вершин куба);
 *  - полимер (CrO₃, V₂O₅, H₂SiO₃, HPO₃): соседние звенья цепи по оси;
 *  - S / MP (газы, жидкости) и N (модель — сам каркас): без фрагмента.
 * Каждый атом фрагмента имеет k ∈ [0, 1] — порядок роста по удалённости от центра (решётка растёт слоями).
 */

/** ion — знак узла (+1 катион, −1 анион; у молекулярной укладки/цепи нет), u — номер частицы фрагмента (атомы одного иона/молекулы) */
export type LatticeAtom = { el: string; pos: V3; r: number; charge: number; k: number; ion?: 1 | -1; u?: number }
export type StoryLatticeKind = 'ionic' | 'molecular' | 'chain' | 'network' | 'none'

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
  if (c > 1 - 1e-9) return (p) => p
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

/** Порядок роста: k по удалённости центра частицы от центра фрагмента (слоями). */
function withK(list: { center: V3; atoms: Omit<LatticeAtom, 'k'>[] }[], origin: V3, maxAtoms: number): LatticeAtom[] {
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
    const k = d1 - d0 < 1e-9 ? 0 : (lenv(sub(u.center, origin)) - d0) / (d1 - d0)
    for (const a of u.atoms) out.push({ ...a, k, u: ui })
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

function generatorFragment(gen: string, plan: FormationPlan, model: SchoolHeroModel, screenToModel: (s: V3) => V3): LatticeAtom[] | null {
  const syn = synthFor(gen, plan.compoundId)
  const cr = syn ? null : getCrystal(gen)
  const basis: readonly { el?: string; charge?: number; frac: readonly number[] }[] | undefined = syn ? syn.basis : cr?.basis
  if (!basis?.length) return null
  const { cat, an } = ionsOf(plan, model)
  if (!cat.length || !an.length) return null
  // Частицы модели с якорями (O у OH⁻): шаблон — относительно якоря.
  type P = { tpl: Tpl; c: V3; cation: boolean }
  const mk = (x: Ions['cat'][number], cation: boolean): P => {
    const atoms = plan.units[x.u]!.atoms
    const c = anchorOf(model, atoms)
    return { tpl: atoms.map((a, q) => ({ el: model.atoms[a]!.el, rel: sub(model.atoms[a]!.pos, c), r: model.atoms[a]!.r, charge: x.tpl[q]!.charge })), c, cation }
  }
  const parts: P[] = [...cat.map((x) => mk(x, true)), ...an.map((x) => mk(x, false))]
  const C0 = parts.find((p) => p.cation)!
  const A0 = parts.filter((p) => !p.cation).sort((a, b) => lenv(sub(a.c, C0.c)) - lenv(sub(b.c, C0.c)))[0]!
  const dModel = lenv(sub(A0.c, C0.c))
  if (dModel < 1e-6) return null
  const catEl = new Set(cat.flatMap((x) => x.tpl.map((t) => t.el)))
  const m = syn ? null : cellMatrix(gen)
  const toPm = (f: V3): V3 => (syn ? matVec(syn.cell, f) : fracToPm(m!, f))
  const nC = syn ? syn.range : basis.length > 12 ? [2, 2, 2] : [3, 3, 3]
  const sites: { cation: boolean; p: V3; b: number }[] = []
  for (let i = -Math.floor(nC[0]! / 2); i < nC[0]! - Math.floor(nC[0]! / 2); i++)
    for (let j = -Math.floor(nC[1]! / 2); j < nC[1]! - Math.floor(nC[1]! / 2); j++)
      for (let k = -Math.floor(nC[2]! / 2); k < nC[2]! - Math.floor(nC[2]! / 2); k++)
        basis.forEach((b, bi) => {
          if (syn?.skip?.(i, j, k, bi)) return
          const cation = b.charge != null ? b.charge > 0 : catEl.has(b.el ?? '')
          sites.push({ cation, b: bi, p: toPm([b.frac[0]! + i, b.frac[1]! + j, b.frac[2]! + k]) })
        })
  const mid: V3 = [0, 0, 0]
  for (const s of sites) for (let q = 0; q < 3; q++) mid[q] += s.p[q]! / sites.length
  const C = sites.filter((s) => s.cation).sort((a, b) => lenv(sub(a.p, mid)) - lenv(sub(b.p, mid)))[0]
  if (!C) return null
  const byD = sites.filter((s) => !s.cation).sort((a, b) => lenv(sub(a.p, C.p)) - lenv(sub(b.p, C.p)))
  if (!byD.length) return null
  const dL = lenv(sub(byD[0]!.p, C.p))
  const k = dModel / dL
  const near = sites.filter((s) => lenv(sub(s.p, C.p)) < 2.6 * dL)
  const mAxis = norm(sub(A0.c, C0.c))
  const Zs = norm(screenToModel([0, 0, 1]))
  const cAxis: V3 = syn ? norm(syn.cell[2]) : [0, 0, 1]
  const pyrite = /пирит/.test(phaseRow(plan.compoundId)?.info.lattice?.type ?? '') && gen === 'nacl'
  const dumb = (p: P) => (p.tpl.length === 2 && p.tpl[0]!.el === p.tpl[1]!.el ? norm(sub(p.tpl[1]!.rel, p.tpl[0]!.rel)) : null)
  // Поворот: узел C → катион модели, C→A (один из ближайших анионов) → C0→A0, угол θ вокруг этой оси подбирается так,
  // чтобы остальные частицы модели легли ближе к узлам своего знака; у слоистых — ось c ближе к плоскости экрана.
  const others = parts.filter((p) => p !== C0 && p !== A0)
  let best: { R: (p: V3) => V3; score: number } | null = null
  for (const A of byD.filter((s) => lenv(sub(s.p, C.p)) < 1.02 * dL)) {
    const R1 = rotFromTo(norm(sub(A.p, C.p)), mAxis)
    for (let st = 0; st < 72; st++) {
      const R2 = rotAxis(mAxis, (st * Math.PI) / 36)
      const R = (p: V3) => R2(R1(p))
      const place = (p: V3): V3 => addv(C0.c, R(scale(sub(p, C.p), k)))
      let score = 0
      for (const o of others) {
        let dm = Infinity
        for (const s of near) if (s.cation === o.cation) dm = Math.min(dm, lenv(sub(place(s.p), o.c)))
        score += (dm / dModel) ** 2
      }
      if (syn?.layered) score += 0.6 * Math.abs(dot(norm(R(cAxis)), Zs))
      if (pyrite) {
        const dm = dumb(A0)
        if (dm) score += 0.5 * (1 - Math.abs(dot(norm(R(PYRITE_DIR[A.b - 4] ?? [1, 1, 1])), dm)))
      }
      if (!best || score < best.score - 1e-9) best = { R, score }
    }
  }
  if (!best) return null
  const R = best.R
  const place = (p: V3): V3 => addv(C0.c, R(scale(sub(p, C.p), k)))
  const placed = sites.map((s) => ({ ...s, P: place(s.p) }))
  // Узлы частиц модели: у каждой частицы — ближайший узел её знака (его показывает модель).
  const skip = new Set<number>()
  for (const p of parts) {
    let bi = -1
    let bd = Infinity
    placed.forEach((s, i) => {
      if (s.cation !== p.cation || skip.has(i)) return
      const d = lenv(sub(s.P, p.c))
      if (d < bd) {
        bd = d
        bi = i
      }
    })
    if (bi >= 0 && bd < 1.3 * dModel) skip.add(bi)
  }
  const list: { center: V3; atoms: Omit<LatticeAtom, 'k'>[] }[] = []
  const modelAtoms = model.atoms
  placed.forEach((s, i) => {
    if (skip.has(i)) return
    const P = s.P
    const T = s.cation ? C0 : A0
    let atoms: Omit<LatticeAtom, 'k'>[]
    const dm = dumb(T)
    const hasH = T.tpl.some((t) => t.el === 'H') && T.tpl.some((t) => t.el !== 'H')
    if (pyrite && !s.cation && dm) {
      const half = lenv(sub(T.tpl[1]!.rel, T.tpl[0]!.rel)) / 2
      const dir = norm(R(PYRITE_DIR[s.b - 4] ?? [1, 1, 1]))
      atoms = T.tpl.map((t, q) => ({ el: t.el, pos: addv(P, dir, q === 0 ? -half : half), r: t.r, charge: t.charge }))
    } else if (hasH) {
      // OH⁻ в слое: H — от катионов слоя наружу (в брусите O–H идёт вдоль оси c)
      const cs = placed.filter((q) => q.cation !== s.cation && lenv(sub(q.P, P)) < 1.2 * dModel)
      const mc: V3 = [0, 0, 0]
      for (const q of cs) for (let w = 0; w < 3; w++) mc[w] += q.P[w]! / Math.max(1, cs.length)
      const out = cs.length ? norm(sub(P, mc)) : norm(sub(P, C0.c))
      atoms = T.tpl.map((t) => ({ el: t.el, pos: t.el === 'H' ? addv(P, out, lenv(t.rel)) : addv(P, t.rel), r: t.r, charge: t.charge }))
    } else atoms = T.tpl.map((t) => ({ el: t.el, pos: addv(P, t.rel), r: t.r, charge: t.charge }))
    // Без наложений на атомы модели (модель может быть молекулой «как в паре» — AlCl₃): такой узел не рисуем.
    if (atoms.some((x) => modelAtoms.some((a) => lenv(sub(a.pos, x.pos)) < 0.8 * (a.r + x.r)))) return
    list.push({ center: P, atoms: atoms.map((x) => ({ ...x, ion: s.cation ? 1 : -1 })) })
  })
  const origin = centroid(model, model.atoms.map((_, i) => i))
  return withK(list, origin, 170)
}

/** Обобщённый 3D-фрагмент: 1 : 1 — шахматная кубическая сетка ионов; иначе — формульные единицы в кубической сетке. */
function schemaFragment(plan: FormationPlan, model: SchoolHeroModel, screenToModel: (s: V3) => V3): LatticeAtom[] {
  const { cat, an } = ionsOf(plan, model)
  const origin = centroid(model, model.atoms.map((_, i) => i))
  const list: { center: V3; atoms: Omit<LatticeAtom, 'k'>[] }[] = []
  const catSp = new Set(cat.map((x) => plan.units[x.u]!.species))
  const anSp = new Set(an.map((x) => plan.units[x.u]!.species))
  const hasMolecules = plan.units.some((u) => plan.species[u.species]!.charge === 0)
  if (cat.length === 1 && an.length === 1 && catSp.size === 1 && anSp.size === 1 && !hasMolecules) {
    const C0 = cat[0]!
    const A0 = an[0]!
    // Шаг сетки — расстояние катион–анион в модели: узел (1, 0, 0) — это анион самой модели.
    const d = lenv(sub(A0.c, C0.c))
    const u = norm(sub(A0.c, C0.c))
    let w = cross(u, screenToModel([0, 0, 1]))
    if (lenv(w) < 1e-6) w = cross(u, [0, 1, 0])
    const v = norm(cross(w, u))
    w = norm(cross(u, v))
    for (let i = -2; i <= 3; i++)
      for (let j = -2; j <= 2; j++)
        for (let k = -2; k <= 2; k++) {
          if (j === 0 && k === 0 && (i === 0 || i === 1)) continue
          const pos = addv(addv(addv(C0.c, u, i * d), v, j * d), w, k * d)
          // Узел (i, j, k): чётный — катион, нечётный — анион (шахматный порядок, у каждого иона 6 соседей другого знака).
          const cation = (((i + j + k) % 2) + 2) % 2 === 0
          const tpl = cation ? C0.tpl : A0.tpl
          list.push({ center: pos, atoms: tpl.map((t) => ({ el: t.el, pos: addv(pos, t.rel), r: t.r, charge: t.charge })) })
        }
    // Многоатомный ион длиннее шага сетки (NaAlO₂: O–Al–O) — копии легли бы на атомы модели: тогда — формульные единицы.
    const heavy = model.atoms.filter((a) => a.el !== 'H')
    // мера — ближайшие атомы катион–анион модели (K–O у KClO₃), а не центры ионов
    let dMin = Infinity
    for (const x of C0.tpl) for (const y of A0.tpl) dMin = Math.min(dMin, lenv(sub(addv(C0.c, x.rel), addv(A0.c, y.rel))))
    const covers = list.some((u) => u.atoms.some((x) => x.el !== 'H' && heavy.some((a) => lenv(sub(a.pos, x.pos)) < 0.45 * (Number.isFinite(dMin) ? dMin : d))))
    if (!covers) return withK(list, addv(C0.c, u, 0.5 * d), 150)
    list.length = 0
  }
  // Формульная единица целиком (верное соотношение ионов и молекул воды), копии — в узлах кубической сетки;
  // в соседних узлах единица повёрнута на 180° — катионы одной единицы обращены к анионам соседней.
  const X = norm(screenToModel([1, 0, 0]))
  const Y = norm(screenToModel([0, 1, 0]))
  const Z = norm(screenToModel([0, 0, 1]))
  // Шаг по каждой оси — по протяжённости единицы вдоль неё (+ зазор): плотная, но без наложений укладка.
  const avgR = model.atoms.reduce((q, a) => q + a.r, 0) / Math.max(1, model.atoms.length)
  const extOn = (ax: V3) => Math.max(...model.atoms.map((a) => Math.abs(dot(sub(a.pos, origin), ax)) + a.r))
  const LX = 2 * extOn(X) + 1.15 * avgR
  const LY = 2 * extOn(Y) + 1.15 * avgR
  const LZ = 2 * extOn(Z) + 1.15 * avgR
  const flip = (p: V3): V3 => {
    // поворот на 180° вокруг экранной оси Y: x → −x, z → −z
    const r = sub(p, origin)
    const a = dot(r, X)
    const b = dot(r, Y)
    const c = dot(r, Z)
    return addv(addv(scale(X, -a), Y, b), Z, -c)
  }
  // Шаг растёт, пока выступающие атомы соседних единиц (O повёрнутого ClO₃⁻ у KClO₃) не отойдут от атомов модели
  // хотя бы на 0,45 расстояния «катион — ближайший атом аниона» (как в проверке геометрии).
  const heavyAll = model.atoms.filter((a) => a.el !== 'H')
  let dCA = Infinity
  for (const c of cat) for (const x of c.tpl) for (const an0 of an) for (const y of an0.tpl) dCA = Math.min(dCA, lenv(sub(addv(c.c, x.rel), addv(an0.c, y.rel))))
  if (!Number.isFinite(dCA)) dCA = 2 * avgR
  let f = 1
  for (let tries = 0; tries < 8; tries++, f *= 1.08) {
    let ok = true
    for (let i = -1; i <= 1 && ok; i++)
      for (let j = -1; j <= 1 && ok; j++)
        for (let k = -1; k <= 1 && ok; k++) {
          if (i === 0 && j === 0 && k === 0) continue
          const off = addv(addv(scale(X, i * LX * f), Y, j * LY * f), Z, k * LZ * f)
          const odd = (((i + j + k) % 2) + 2) % 2 === 1
          for (const a of model.atoms) {
            if (a.el === 'H') continue
            const P = addv(addv(origin, off), odd ? flip(a.pos) : sub(a.pos, origin))
            if (heavyAll.some((h) => lenv(sub(h.pos, P)) < 0.46 * dCA)) ok = false
          }
        }
    if (ok) break
  }
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        if (i === 0 && j === 0 && k === 0) continue
        const off = addv(addv(scale(X, i * LX * f), Y, j * LY * f), Z, k * LZ * f)
        const odd = (((i + j + k) % 2) + 2) % 2 === 1
        const center = addv(origin, off)
        list.push({
          center,
          atoms: model.atoms.map((a) => {
            const rel = odd ? flip(a.pos) : sub(a.pos, origin)
            return { el: a.el, pos: addv(center, rel), r: a.r, charge: a.charge }
          }),
        })
      }
  const n = model.atoms.length
  return withK(list, origin, Math.max(6 * n, Math.min(26 * n, 240)))
}

/** Молекулы в узлах (центр — модель, + 8 вершин куба) или соседние звенья цепи. */
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
  const origin = centroid(model, model.atoms.map((_, i) => i))
  let ext = 0
  for (const a of model.atoms) ext = Math.max(ext, lenv(sub(a.pos, origin)) + a.r)
  const list: { center: V3; atoms: Omit<LatticeAtom, 'k'>[] }[] = []
  const X = norm(screenToModel([1, 0, 0]))
  const Y = norm(screenToModel([0, 1, 0]))
  const Z = norm(screenToModel([0, 0, 1]))
  const offs: V3[] = []
  if (kind === 'molecular') {
    const a = 1.35 * ext
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) offs.push(addv(addv(scale(X, sx * a), Y, sy * a), Z, sz * a))
  } else if (chainShift(model, X, Z)) {
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
    list.push({ center, atoms: model.atoms.map((a) => ({ el: a.el, pos: addv(a.pos, off), r: a.r, charge: 0 })) })
  }
  return withK(list, origin, 400)
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

export function latticeFor(
  script: FormationScript | null,
  plan: FormationPlan,
  model: SchoolHeroModel,
  screenToModel: (s: V3) => V3,
): { kind: StoryLatticeKind; atoms: LatticeAtom[]; src: LatticeSource; gen?: string } {
  const type = script?.type ?? (plan.mode === 'ionic' ? 'IC' : 'MP')
  const ionic = type === 'IB' || type === 'IC' || type === 'IH'
  if (type === 'N') return { kind: 'network', atoms: [], src: 'model' }
  if (ionic) {
    // Модель карточки уже кристалл (NaCl, MgO, Al₂O₃, PbO, BaSO₄): фрагмент — она сама, растёт слоями.
    if (model.kind === 'crystal') return { kind: 'ionic', atoms: [], src: 'model' }
    if (plan.mode !== 'ionic') return { kind: 'none', atoms: [], src: 'none' }
    // Генератор: таблица фаз (story/phase-data.ts, структурный тип вещества) → таблица правил (latticeGen) → хинт по подписи.
    // смесь (KCl·NaCl — сильвинит) — не одна решётка: схема из формульных единиц сохраняет оба катиона
    const mixture = script?.routeKind === 'mixture'
    const hint = script?.latticeKind === 'schema' && !mixture ? hintOf(script.lattice) : null
    // кальцит (CaCO₃, MgCO₃) и NaNO₃ — «искажённый тип NaCl»: катионы и группы XO₃ в узлах каменной соли
    // (в crystalData у calcite нет базиса — генератор nacl, группы CO₃/NO₃ — как в модели; в таблице фаз CAL → nacl)
    const fromScript = script?.latticeKind === 'generator' && script.latticeGen ? (script.latticeGen === 'calcite' ? 'nacl' : script.latticeGen) : null
    const genKey = mixture ? null : (phaseRow(plan.compoundId)?.gen ?? fromScript ?? hint)
    const gen = genKey ? generatorFragment(genKey, plan, model, screenToModel) : null
    if (gen && gen.length) return { kind: 'ionic', atoms: gen, src: 'generator', gen: genKey! }
    return { kind: 'ionic', atoms: schemaFragment(plan, model, screenToModel), src: 'schema' }
  }
  if (script?.latticeKind === 'molecular') return { kind: 'molecular', atoms: copiesFragment('molecular', model, screenToModel), src: 'copies' }
  if (type === 'PM' || script?.latticeKind === 'chain') return { kind: 'chain', atoms: copiesFragment('chain', model, screenToModel), src: 'copies' }
  return { kind: 'none', atoms: [], src: 'none' }
}
