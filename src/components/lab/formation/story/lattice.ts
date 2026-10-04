import type { FormationPlan } from '../../../../chemistry/formationPlan'
import type { FormationScript } from '../../../../chemistry/formationScripts'
import { getCrystal } from '../../../../chemistry/data/crystalData'
import { cellMatrix, fracToPm } from '../../../../lab/cinema/scenes/kit/lattice'
import type { SchoolHeroModel, V3 } from '../../hero/schoolHeroModel'

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

export type LatticeAtom = { el: string; pos: V3; r: number; charge: number; k: number }
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
  for (const u of kept) {
    const k = d1 - d0 < 1e-9 ? 0 : (lenv(sub(u.center, origin)) - d0) / (d1 - d0)
    for (const a of u.atoms) out.push({ ...a, k })
  }
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

/** Настоящий фрагмент по CRYSTAL_DATA (узлы катионов — шаблон катиона модели, узлы анионов — шаблон аниона). */
/**
 * Структурные типы, которых нет в crystalData, — кубическая ячейка задаётся здесь (доли ребра).
 * Антифлюорит (Na₂O, K₂O, Li₂O, Na₂S, K₂S): анионы — в узлах ГЦК, катионы — во всех 8 тетраэдрических пустотах
 * (¼ ¼ ¼ …): у катиона 4 соседа-аниона, у аниона 8 соседей-катионов.
 */
const FCC: V3[] = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]]
const TETRA: V3[] = [0.25, 0.75].flatMap((x) => [0.25, 0.75].flatMap((y) => [0.25, 0.75].map((z) => [x, y, z] as V3)))
const SYNTH: Record<string, { a: number; basis: { charge: number; frac: V3 }[] }> = {
  antifluorite: { a: 555, basis: [...FCC.map((frac) => ({ charge: -2, frac })), ...TETRA.map((frac) => ({ charge: 1, frac }))] },
}

function generatorFragment(gen: string, plan: FormationPlan, model: SchoolHeroModel): LatticeAtom[] | null {
  const syn = SYNTH[gen]
  const cr = syn ? null : getCrystal(gen)
  const basis: readonly { el?: string; charge?: number; frac: readonly number[] }[] | undefined = syn ? syn.basis : cr?.basis
  if (!basis?.length) return null
  const { cat, an } = ionsOf(plan, model)
  if (!cat.length || !an.length) return null
  // Пара «катион — ближайший анион» модели задаёт масштаб и поворот фрагмента.
  const C0 = cat[0]!
  const A0 = [...an].sort((a, b) => lenv(sub(a.c, C0.c)) - lenv(sub(b.c, C0.c)))[0]!
  const dModel = lenv(sub(A0.c, C0.c))
  if (dModel < 1e-6) return null
  const catEl = new Set(cat.flatMap((x) => x.tpl.map((t) => t.el)))
  const m = syn ? null : cellMatrix(gen)
  const toPm = (f: V3): V3 => (syn ? [f[0] * syn.a, f[1] * syn.a, f[2] * syn.a] : fracToPm(m!, f))
  const nC = syn || basis.length > 12 ? 2 : 3
  const lo = -Math.floor(nC / 2)
  const sites: { cation: boolean; p: V3 }[] = []
  for (let i = lo; i < lo + nC; i++)
    for (let j = lo; j < lo + nC; j++)
      for (let k = lo; k < lo + nC; k++)
        for (const b of basis) {
          const cation = b.charge != null ? b.charge > 0 : catEl.has(b.el ?? '')
          sites.push({ cation, p: toPm([b.frac[0]! + i, b.frac[1]! + j, b.frac[2]! + k]) })
        }
  const mid: V3 = [0, 0, 0]
  for (const s of sites) for (let q = 0; q < 3; q++) mid[q] += s.p[q]! / sites.length
  const C = sites.filter((s) => s.cation).sort((a, b) => lenv(sub(a.p, mid)) - lenv(sub(b.p, mid)))[0]
  if (!C) return null
  const A = sites.filter((s) => !s.cation).sort((a, b) => lenv(sub(a.p, C.p)) - lenv(sub(b.p, C.p)))[0]
  if (!A) return null
  const dL = lenv(sub(A.p, C.p))
  const k = dModel / dL
  const R = rotFromTo(norm(sub(A.p, C.p)), norm(sub(A0.c, C0.c)))
  const place = (p: V3): V3 => addv(C0.c, R(scale(sub(p, C.p), k)))
  // Узлы, занятые частицами самой модели, — пропускаем (их показывает модель).
  const occupied = [...cat, ...an].map((x) => x.c)
  const list: { center: V3; atoms: Omit<LatticeAtom, 'k'>[] }[] = []
  for (const s of sites) {
    const P = place(s.p)
    if (occupied.some((o) => lenv(sub(o, P)) < 0.45 * dModel)) continue
    const tpl = s.cation ? C0.tpl : A0.tpl
    list.push({ center: P, atoms: tpl.map((t) => ({ el: t.el, pos: addv(P, t.rel), r: t.r, charge: t.charge })) })
  }
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
    for (const s of [-1, 1, 2]) offs.push(scale(axis, s * L))
  }
  for (const off of offs) {
    const center = addv(origin, off)
    list.push({ center, atoms: model.atoms.map((a) => ({ el: a.el, pos: addv(a.pos, off), r: a.r, charge: 0 })) })
  }
  return withK(list, origin, 400)
}

export function latticeFor(
  script: FormationScript | null,
  plan: FormationPlan,
  model: SchoolHeroModel,
  screenToModel: (s: V3) => V3,
): { kind: StoryLatticeKind; atoms: LatticeAtom[] } {
  const type = script?.type ?? (plan.mode === 'ionic' ? 'IC' : 'MP')
  const ionic = type === 'IB' || type === 'IC' || type === 'IH'
  if (type === 'N') return { kind: 'network', atoms: [] }
  if (ionic) {
    // Модель карточки уже кристалл (NaCl, MgO, Al₂O₃, PbO, BaSO₄): фрагмент — она сама, растёт слоями.
    if (model.kind === 'crystal') return { kind: 'ionic', atoms: [] }
    if (plan.mode !== 'ionic') return { kind: 'none', atoms: [] }
    // «типа NaCl / ZnS / корунда» в таблице — тот же структурный тип: берём его генератор (верная координация 6:6, 4:4, 6:4).
    // смесь (KCl·NaCl — сильвинит) — не одна решётка: схема из формульных единиц сохраняет оба катиона
    const hint = script?.latticeKind === 'schema' && script.routeKind !== 'mixture' ? (/типа NaCl/.test(script.lattice) ? 'nacl' : /типа ZnS/.test(script.lattice) ? 'sphalerite' : /типа корунда/.test(script.lattice) ? 'corundum' : /антифлюорит/.test(script.lattice) ? 'antifluorite' : null) : null
    // кальцит (CaCO₃, MgCO₃) и NaNO₃ — «искажённый тип NaCl»: катионы и группы XO₃ в узлах каменной соли
    // (в crystalData у calcite нет базиса — берём генератор nacl, группы CO₃/NO₃ — как в модели)
    const calciteLike = plan.compoundId === 'salt_ca_co3' || plan.compoundId === 'salt_mg_co3' || plan.compoundId === 'salt_na_no3'
    const genKey0 = script?.latticeKind === 'generator' && script.latticeGen ? script.latticeGen : hint
    const genKey = calciteLike ? 'nacl' : genKey0
    const gen = genKey ? generatorFragment(genKey, plan, model) : null
    return { kind: 'ionic', atoms: gen && gen.length ? gen : schemaFragment(plan, model, screenToModel) }
  }
  if (script?.latticeKind === 'molecular') return { kind: 'molecular', atoms: copiesFragment('molecular', model, screenToModel) }
  if (type === 'PM' || script?.latticeKind === 'chain') return { kind: 'chain', atoms: copiesFragment('chain', model, screenToModel) }
  return { kind: 'none', atoms: [] }
}
