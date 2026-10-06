import type { FormationPlan } from '../../../../chemistry/formationPlan'
import { schoolBallRadius, type SchoolHeroModel, type V3 } from '../../hero/schoolHeroModel'
import type { ElementSymbol } from '../../../../chemistry/data/atomicData'
import { pmToScene } from '../../../../lab/cinema/scenes/kit/cpkAtoms'
import { redoxDecomposition, type RedoxDecompDef } from '../../../../chemistry/formationRedoxDecomposition'
import type { RouteAtom, RouteElectron, RouteStage, RouteStick } from './route'
import type { Stage, StageKey, StoryChargeStep, StoryHud } from '../formationStory'

/**
 * Сценарий «окислительно-восстановительное разложение» (4MnO₂ —t°→ 2Mn₂O₃ + O₂ и др., формулы — formationRedoxDecomposition.ts):
 *  reagents — фрагмент решётки исходного РОВНО по уравнению (4 Mn⁴⁺ + 8 O²⁻; 4 Cu²⁺ + 4 O²⁻; 2 K⁺ + 2 MnO₄⁻; 2 M⁺ + 2 NO₃⁻);
 *  heat — нагревание (атомы на месте, колебания рисует интерфейс); break — связи двух уходящих O рвутся, O смещаются к поверхности;
 *  transfer — 4 e⁻ по одному от уходящих O к восстанавливающимся атомам, заряд меняется в момент прихода (chargeSteps);
 *  release — два O⁰ сближаются до 1,21 Å, двойная связь O=O, молекула уходит вверх;
 *  lattice — оставшиеся ионы перестраиваются в формульные единицы продукта (акцент — одна, она же модель карточки);
 *  final — модель карточки. Все частицы до «Итога» — атомы routeStage (координаты экрана → модели).
 */

export type RedoxUnit = { formula: string; atoms: number[]; main: boolean }
export type RedoxSceneInfo = {
  id: string
  /** формульные единицы продукта (индексы routeStage.atoms), main — та, что становится моделью карточки */
  units: RedoxUnit[]
  /** ионы O исходного, которые уходят (отдают по 2 e⁻), и атомы O⁰ молекулы O₂ */
  leaving: [number, number]
  o2: [number, number]
  /** принимающие центры (по порядку def.gains) */
  centers: number[]
  /** длина O=O в сцене (мир) и в Å */
  dOO: number
}
export type RedoxScene = { stages: Stage[]; total: number; route: RouteStage; chargeSteps: StoryChargeStep[]; hud: StoryHud[]; info: RedoxSceneInfo }

type A = { el: string; r: number; p: V3; q: number; qKind: 'ion' | 'ox'; unit: number; leave: boolean; host: number }
type Slot = { el: string; pos: V3; q: number | null }
type PUnit = { formula: string; slots: Slot[]; bonds: [number, number, number][]; main: boolean }

const D = { reagents: 4, heat: 4, break: 3.5, release: 5, lattice: 6.5, final: 6 }
const E_PER = 1.2
const E_STEP = 1.35
const MIN_TOTAL = 30

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const nrm = (a: V3): V3 => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const mean = (ps: V3[]): V3 => {
  const c: V3 = [0, 0, 0]
  for (const p of ps) for (let q = 0; q < 3; q++) c[q] += p[q]! / Math.max(1, ps.length)
  return c
}
const rotY = (p: V3, a: number): V3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]
const rotX = (p: V3, a: number): V3 => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]

export function buildRedoxDecomposition(
  id: string,
  plan: FormationPlan,
  model: SchoolHeroModel,
  toModel: (s: V3) => V3,
  toScreen: (m: V3) => V3,
): RedoxScene | null {
  const def = redoxDecomposition(id)
  if (!def) return null
  const PFs = model.atoms.map((a) => toScreen(a.pos as V3))
  const rModel = new Map<string, number>()
  model.atoms.forEach((a) => rModel.set(a.el, a.r))
  const rO = rModel.get('O') ?? schoolBallRadius('O' as ElementSymbol)
  const ionicRadii = rO > 0.25
  /** радиус шара: как в модели карточки; нет элемента в модели — пропорционально O (ионные радиусы Шеннона или ковалентные) */
  const ION_PM: Record<string, number> = { K: 138, Na: 102, Mn: 53, Cu: 73, N: 16, O: 140 }
  const rOf = (el: string) =>
    rModel.get(el) ?? (ionicRadii ? (rO * (ION_PM[el] ?? 100)) / 140 : schoolBallRadius(el as ElementSymbol) * (rO / schoolBallRadius('O' as ElementSymbol)))
  const unitOf = new Map<number, number>()
  plan.units.forEach((u, i) => u.atoms.forEach((a) => unitOf.set(a, i)))
  const slotQ = (i: number): number | null => {
    const u = plan.units[unitOf.get(i) ?? -1]
    const sp = u ? plan.species[u.species] : null
    return sp && sp.kind === 'ion' && u!.atoms.length === 1 ? sp.charge : null
  }
  // Расстояние катион–анион модели (масштаб сцены).
  let aMO = Infinity
  model.atoms.forEach((x, i) =>
    model.atoms.forEach((y, j) => {
      if (j <= i || (x.el === 'O') === (y.el === 'O')) return
      aMO = Math.min(aMO, len(sub(PFs[i]!, PFs[j]!)))
    }),
  )
  if (!Number.isFinite(aMO)) aMO = pmToScene(190)

  // ── Фрагмент исходного (экран) ──
  const atoms: A[] = []
  const sticks0: { a: number; b: number; n: number }[] = []
  const push = (x: Omit<A, 'r'> & { r?: number }) => {
    atoms.push({ ...x, r: x.r ?? rOf(x.el) })
    return atoms.length - 1
  }
  const centers: number[] = []
  const units: PUnit[] = []
  const mainSlots: Slot[] = model.atoms.map((a, i) => ({ el: a.el, pos: PFs[i]!, q: slotQ(i) }))
  const mainBonds: [number, number, number][] = model.bonds.map((b) => [b.a, b.b, Math.max(1, Math.min(3, Math.round(b.order)))])
  const mainUnit = (): PUnit => ({ formula: def.products[0]!.formula, slots: mainSlots, bonds: mainBonds, main: true })

  if (def.reagent === 'rutile' || def.reagent === 'cube') {
    const M = def.reagent === 'rutile' ? 'Mn' : 'Cu'
    const q0 = def.gains[0]!.from
    const a = aMO
    if (def.reagent === 'rutile') {
      const L = Math.max(2.6 * a, 1.42 * a + 2.1 * rO)
      const s2 = Math.SQRT1_2
      const cells: [V3, V3][] =
        def.n === 4
          ? [
              [[-L / 2, -L / 2, 0], [s2, s2, 0]],
              [[L / 2, -L / 2, 0], [s2, -s2, 0]],
              [[-L / 2, L / 2, 0], [s2, -s2, 0]],
              [[L / 2, L / 2, 0], [s2, s2, 0]],
            ]
          : [
              [[-L, 0, 0], [s2, s2, 0]],
              [[0, 0, 0], [s2, -s2, 0]],
              [[L, 0, 0], [s2, s2, 0]],
            ]
      const ups: number[] = []
      for (const [c, d] of cells) {
        const m = push({ el: M, p: c, q: q0, qKind: 'ion', unit: -1, leave: false, host: -1 })
        centers.push(m)
        for (const k of [1, -1]) {
          const o = push({ el: 'O', p: add(c, d, k * a), q: -2, qKind: 'ion', unit: -1, leave: false, host: m })
          sticks0.push({ a: m, b: o, n: 1 })
          if (atoms[o]!.p[1] > c[1]) ups.push(o)
        }
      }
      // Уходят два «верхних» O²⁻ у крайних ионов (симметрично).
      const top = [...ups].sort((x, y) => atoms[y]!.p[1] - atoms[x]!.p[1] || atoms[x]!.p[0] - atoms[y]!.p[0])
      const pick = def.n === 4 ? [top[0]!, top[1]!] : [ups[0]!, ups[2]!]
      for (const o of pick) atoms[o]!.leave = true
      // Порядок центров = порядок def.gains (Mn₃O₄: средний Mn — Mn⁴⁺ → Mn²⁺).
    } else {
      const h = a / 2
      const idx = new Map<string, number>()
      for (const x of [-1, 1])
        for (const y of [-1, 1])
          for (const z of [-1, 1]) {
            const p = rotX(rotY([x * h, y * h, z * h], 0.61), 0.35)
            const cat = x * y * z > 0
            const i = push({ el: cat ? M : 'O', p, q: cat ? q0 : -2, qKind: 'ion', unit: -1, leave: !cat && y > 0, host: -1 })
            if (cat) centers.push(i)
            idx.set(`${x},${y},${z}`, i)
          }
      const keys = [...idx.keys()].map((k) => k.split(',').map(Number))
      keys.forEach((u, x) =>
        keys.forEach((v, y) => {
          if (y <= x || u.filter((c, q) => c !== v[q]).length !== 1) return
          sticks0.push({ a: idx.get(u.join(','))!, b: idx.get(v.join(','))!, n: 1 })
        }),
      )
      for (const s of sticks0) {
        const o = atoms[s.a]!.el === 'O' ? s.a : s.b
        if (atoms[o]!.leave && atoms[o]!.host < 0) atoms[o]!.host = s.a === o ? s.b : s.a
      }
      centers.sort((x, y) => atoms[x]!.p[0] - atoms[y]!.p[0])
    }
    // Формульные единицы продукта: главная (модель карточки) + такие же.
    const pf = def.products[0]!
    for (let k = 0; k < pf.count; k++) units.push(k === 0 ? mainUnit() : { ...mainUnit(), main: false })
  } else if (def.reagent === 'permanganate') {
    const mainIsMnO2 = id === 'mno2'
    const rMn = rOf('Mn')
    const rK = rOf('K')
    const mnIdx = model.atoms.findIndex((x) => x.el === 'Mn')
    // MnO₄: у K₂MnO₄ — геометрия модели карточки (тот же тетраэдр), иначе — правильный тетраэдр.
    let dMnO = Math.max(pmToScene(163), 1.2 * rO, 0.95 * (rMn + rO))
    let tet: V3[] = [
      [1, 1, 1],
      [-1, 1, -1],
      [1, -1, -1],
      [-1, -1, 1],
    ].map((v) => nrm(rotY(v as V3, 0.35)))
    if (!mainIsMnO2) {
      const os = model.atoms.map((_, i) => i).filter((i) => model.atoms[i]!.el === 'O')
      dMnO = len(sub(PFs[os[0]!]!, PFs[mnIdx]!))
      tet = os.map((o) => nrm(sub(PFs[o]!, PFs[mnIdx]!)))
    }
    const ext = dMnO + rO
    const Dx = 1.2 * ext
    const H = 0.98 * (dMnO + rO + rK)
    // Слева — тетраэдр, который станет главной формульной единицей.
    const mkTet = (cx: number, toK2: boolean): number => {
      const c: V3 = [cx, 0, 0]
      const m = push({ el: 'Mn', p: c, q: 7, qKind: 'ox', unit: -1, leave: false, host: -1 })
      const os = tet.map((d) => push({ el: 'O', p: add(c, d, dMnO), q: -2, qKind: 'ox', unit: -1, leave: false, host: m }))
      for (const o of os) sticks0.push({ a: m, b: o, n: 1 })
      if (!toK2) {
        const up = [...os].sort((x, y) => atoms[y]!.p[1] - atoms[x]!.p[1])
        atoms[up[0]!]!.leave = atoms[up[1]!]!.leave = true
      }
      return m
    }
    const left = mkTet(-Dx, !mainIsMnO2)
    const right = mkTet(Dx, mainIsMnO2)
    const mnA = mainIsMnO2 ? right : left // → K₂MnO₄ (Mn⁺⁷ → Mn⁺⁶)
    const mnB = mainIsMnO2 ? left : right // → MnO₂ (Mn⁺⁷ → Mn⁺⁴)
    centers.push(mnA, mnB)
    const k1 = push({ el: 'K', p: [0, H, 0], q: 1, qKind: 'ion', unit: -1, leave: false, host: -1 })
    const k2 = push({ el: 'K', p: [0, -H, 0], q: 1, qKind: 'ion', unit: -1, leave: false, host: -1 })
    // Теги: K₂MnO₄ ← Mn_a + его 4 O + 2 K; MnO₂ ← Mn_b + 2 оставшихся O.
    const uK2 = mainIsMnO2 ? 1 : 0
    const uMn = mainIsMnO2 ? 0 : 1
    atoms.forEach((x, i) => {
      if (x.leave) return
      if (i === k1 || i === k2 || i === mnA || x.host === mnA) x.unit = uK2
      else x.unit = uMn
    })
    // Шаблон второго продукта.
    const kTpl = (): PUnit => {
      const rel = tet.map((d) => [d[0] * dMnO, d[1] * dMnO, d[2] * dMnO] as V3)
      const slots: Slot[] = [{ el: 'Mn', pos: [0, 0, 0], q: null }, ...rel.map((p) => ({ el: 'O', pos: p, q: null }))]
      const kx = 0.98 * (dMnO + rO + rK)
      slots.push({ el: 'K', pos: [-kx, 0, 0], q: 1 }, { el: 'K', pos: [kx, 0, 0], q: 1 })
      return { formula: 'K₂MnO₄', slots, bonds: [1, 2, 3, 4].map((o) => [0, o, 1] as [number, number, number]), main: false }
    }
    const mTpl = (): PUnit => {
      const d = Math.max(pmToScene(188), 0.95 * (rMn + rO))
      return { formula: 'MnO₂', slots: [{ el: 'O', pos: [-d, 0, 0], q: null }, { el: 'Mn', pos: [0, 0, 0], q: null }, { el: 'O', pos: [d, 0, 0], q: null }], bonds: [], main: false }
    }
    units.push(mainUnit(), mainIsMnO2 ? kTpl() : mTpl())
  } else {
    // Нитрат: NO₃⁻ — N и два O модели NO₂⁻ + третий O напротив (уходит); катион — как в модели.
    const M = def.cation!
    const nI = model.atoms.findIndex((x) => x.el === 'N')
    const oI = model.atoms.map((_, i) => i).filter((i) => model.atoms[i]!.el === 'O')
    const mI = model.atoms.findIndex((x) => x.el === M)
    const cN = PFs[nI]!
    const dNO = len(sub(PFs[oI[0]!]!, cN))
    const dir3 = nrm(sub(cN, mean(oI.map((o) => PFs[o]!))))
    const tplRel = [...model.atoms.map((_, i) => sub(PFs[i]!, cN)), [dir3[0] * dNO, dir3[1] * dNO, dir3[2] * dNO] as V3]
    const ext = Math.max(...tplRel.map((p) => len(p))) + Math.max(rO, rOf(M))
    const Dx = 1.1 * ext
    for (let u = 0; u < 2; u++) {
      const c: V3 = [u === 0 ? -Dx : Dx, 0, 0]
      // Второй — зеркально (уходящие O смотрят друг на друга).
      const mir = (p: V3): V3 => (u === 0 ? p : [-p[0], p[1], p[2]])
      const ids: number[] = []
      model.atoms.forEach((x, i) => {
        const el = x.el
        ids.push(push({ el, p: add(c, mir(tplRel[i]!)), q: el === M ? 1 : el === 'N' ? 5 : -2, qKind: el === M ? 'ion' : 'ox', unit: u, leave: false, host: -1 }))
      })
      const n = ids[nI]!
      for (const o of oI) atoms[ids[o]!]!.host = n
      const o3 = push({ el: 'O', p: add(c, mir(tplRel[tplRel.length - 1]!)), q: -2, qKind: 'ox', unit: u, leave: true, host: n })
      for (const b of model.bonds) sticks0.push({ a: ids[b.a]!, b: ids[b.b]!, n: Math.max(1, Math.min(3, Math.round(b.order))) })
      sticks0.push({ a: n, b: o3, n: 1 })
      centers.push(n)
      void mI
    }
    units.push(mainUnit(), { ...mainUnit(), main: false })
  }

  // Центрируем фрагмент исходного.
  const c0 = mean(atoms.map((x) => x.p))
  for (const x of atoms) x.p = sub(x.p, c0)

  // Окисляемые O и их электроны → центры (по def.gains).
  const leaving = atoms.map((x, i) => (x.leave ? i : -1)).filter((i) => i >= 0) as [number, number]
  if (leaving.length !== 2 || centers.length !== def.gains.length) return null

  // ── Этапы ──
  const nE = def.gains.reduce((s, g) => s + g.from - g.to, 0)
  const stages: Stage[] = []
  let t = 0
  const st = (key: StageKey, dur: number) => {
    stages.push({ key, t0: t, dur })
    t += dur
  }
  st('reagents', D.reagents)
  st('heat', D.heat)
  st('break', D.break)
  st('transfer', Math.min(16, Math.max(4.5, 1.5 + 1.25 * nE)))
  st('release', D.release)
  st('lattice', D.lattice)
  st('final', Math.max(D.final, MIN_TOTAL - t))
  const S = (k: StageKey) => stages.find((s) => s.key === k)!
  const sBr = S('break')
  const sTr = S('transfer')
  const sRel = S('release')
  const sLat = S('lattice')
  const sFin = S('final')
  const routeEnd = sFin.t0 + 0.1

  // Смещение уходящих O к поверхности.
  const p1 = atoms.map((x) => x.p)
  for (const o of leaving) {
    const x = atoms[o]!
    const host = x.host >= 0 ? atoms[x.host]!.p : [0, 0, 0] as V3
    p1[o] = add(add(x.p, nrm(sub(x.p, host)), 0.35 * aMO), [0, 0.3 * aMO, 0])
  }

  // ── Продукт: формульные единицы, раскладка, привязка ионов к местам ──
  const unitCen = units.map((u) => mean(u.slots.map((s) => s.pos)))
  const unitExt = units.map((u, k) => Math.max(...u.slots.map((s) => len(sub(s.pos, unitCen[k]!)) + rOf(s.el))))
  const arrangeCen: V3[] = []
  if (units.length === 1) arrangeCen.push(unitCen[0]!)
  else {
    const X = unitExt[0]! + unitExt[1]! + 0.5 * aMO
    arrangeCen.push([-X / 2, 0, 0], [X / 2, 0, 0])
  }
  // Оксиды: ионы делим по единицам слева направо (состав из слотов).
  const rest = atoms.map((_, i) => i).filter((i) => !atoms[i]!.leave)
  if (rest.some((i) => atoms[i]!.unit < 0)) {
    const free = new Set(rest)
    units.forEach((u, k) => {
      for (const s of u.slots) {
        const cand = [...free].filter((i) => atoms[i]!.el === s.el).sort((x, y) => atoms[x]!.p[0] - atoms[y]!.p[0])
        const i = cand[0]
        if (i == null) continue
        free.delete(i)
        atoms[i]!.unit = k
      }
    })
  }
  const qFinal = atoms.map((x) => x.q)
  centers.forEach((c, k) => (qFinal[c] = def.gains[k]!.to))
  for (const o of leaving) qFinal[o] = 0
  const slotOf = new Map<number, { unit: number; slot: number }>()
  units.forEach((u, k) => {
    const mine = rest.filter((i) => atoms[i]!.unit === k)
    const ac = mean(mine.map((i) => atoms[i]!.p))
    const pairs: { i: number; s: number; d: number }[] = []
    for (const i of mine)
      u.slots.forEach((s, j) => {
        if (s.el !== atoms[i]!.el) return
        if (s.q != null && atoms[i]!.qKind === 'ion' && s.q !== qFinal[i]) return
        pairs.push({ i, s: j, d: len(sub(sub(atoms[i]!.p, ac), sub(s.pos, unitCen[k]!))) })
      })
    pairs.sort((x, y) => x.d - y.d)
    const usedS = new Set<number>()
    for (const p of pairs) {
      if (slotOf.has(p.i) || usedS.has(p.s)) continue
      slotOf.set(p.i, { unit: k, slot: p.s })
      usedS.add(p.s)
    }
  })
  if (rest.some((i) => !slotOf.has(i))) return null

  // ── Атомы сцены ──
  const rAtoms: RouteAtom[] = []
  const tA = sLat.t0 + 0.3
  const tB = sLat.t0 + 0.62 * sLat.dur
  const tC = sLat.t0 + 0.72 * sLat.dur
  const tD = sLat.t0 + sLat.dur - 0.3
  // Перестройка без столкновений: промежуточные места (середина пути) расталкиваются до касания шаров.
  const arrOf = (i: number): V3 => {
    const { unit, slot } = slotOf.get(i)!
    return add(arrangeCen[unit]!, sub(units[unit]!.slots[slot]!.pos, unitCen[unit]!))
  }
  const midOf = new Map<number, V3>()
  for (const i of rest) midOf.set(i, add(atoms[i]!.p, sub(arrOf(i), atoms[i]!.p), 0.5))
  for (let it = 0; it < 80; it++) {
    let moved = false
    for (const i of rest)
      for (const j of rest) {
        if (j <= i) continue
        const a = midOf.get(i)!
        const b = midOf.get(j)!
        const dv = sub(b, a)
        const d = len(dv)
        const need = 1.08 * (atoms[i]!.r + atoms[j]!.r)
        if (d >= need) continue
        const u: V3 = d < 1e-6 ? [0, 0, 1] : [dv[0] / d, dv[1] / d, dv[2] / d]
        const k = (need - d) / 2
        midOf.set(i, add(a, u, -k))
        midOf.set(j, add(b, u, k))
        moved = true
      }
    if (!moved) break
  }
  const tM = (tA + tB) / 2
  atoms.forEach((x, i) => {
    if (x.leave) {
      rAtoms.push({ el: 'O', r: x.r, keys: [[-1, x.p], [sBr.t0 + 0.35 * sBr.dur, x.p], [sBr.t0 + 0.9 * sBr.dur, p1[i]!]], tIn: -1, tOut: sRel.t0 + 0.2, q: x.q, qKind: x.qKind })
      return
    }
    const { unit, slot } = slotOf.get(i)!
    const u = units[unit]!
    const arr = add(arrangeCen[unit]!, sub(u.slots[slot]!.pos, unitCen[unit]!))
    const keys: [number, V3][] = [[-1, x.p], [tA, x.p], [tM, midOf.get(i)!], [tB, arr]]
    if (u.main && units.length > 1) keys.push([tC, arr], [tD, u.slots[slot]!.pos])
    rAtoms.push({ el: x.el, r: x.r, keys, tIn: -1, tOut: u.main ? routeEnd : tC - 0.2, q: x.q, qKind: x.qKind })
  })
  // Молекула O₂: атомы O⁰ (меньше иона O²⁻), d(O=O) = 1,21 Å.
  const dOO = pmToScene(121)
  const rO0 = ionicRadii ? schoolBallRadius('O' as ElementSymbol) : rO
  const mid = add(mean(leaving.map((o) => p1[o]!)), [0, 0.4 * aMO, 0])
  const rise = Math.max(...atoms.map((x) => x.p[1])) + 2.2 * aMO
  const o2 = leaving.map((o, k) => {
    const sgn = k === 0 ? -1 : 1
    const sideX = Math.sign(p1[o]![0] - p1[leaving[1 - k]!]![0]) || sgn
    const close: V3 = add(mid, [sideX * dOO * 0.5, 0, 0])
    rAtoms.push({
      el: 'O',
      r: rO0,
      keys: [[sRel.t0, p1[o]!], [sRel.t0 + 0.45 * sRel.dur, close], [sRel.t0 + 0.6 * sRel.dur, close], [sRel.t0 + sRel.dur - 0.2, [close[0], rise, close[2]]]],
      tIn: sRel.t0,
      tOut: sRel.t0 + sRel.dur - 0.4,
      q: 0,
      qKind: 'ox',
    })
    return rAtoms.length - 1
  }) as [number, number]

  // ── Палочки ──
  const rSticks: RouteStick[] = []
  const keepBond = (a: number, b: number): number => {
    const sa = slotOf.get(a)
    const sb = slotOf.get(b)
    if (!sa || !sb || sa.unit !== sb.unit) return 0
    const bd = units[sa.unit]!.bonds.find(([x, y]) => (x === sa.slot && y === sb.slot) || (x === sb.slot && y === sa.slot))
    return bd ? bd[2] : 0
  }
  const have = new Set<string>()
  for (const s of sticks0) {
    const leaves = atoms[s.a]!.leave || atoms[s.b]!.leave
    const kept = !leaves && keepBond(s.a, s.b) > 0
    const tOut = leaves ? sBr.t0 + 0.62 * sBr.dur : kept ? (slotOf.get(s.a)!.unit === 0 || units[slotOf.get(s.a)!.unit]!.main ? routeEnd : tC - 0.2) : sLat.t0 + 0.3
    for (let k = 0; k < s.n; k++) rSticks.push({ a: s.a, b: s.b, t0: -1, t1: -0.9, tOut, n: s.n, s: k })
    if (kept) have.add(`${slotOf.get(s.a)!.unit}:${Math.min(slotOf.get(s.a)!.slot, slotOf.get(s.b)!.slot)}-${Math.max(slotOf.get(s.a)!.slot, slotOf.get(s.b)!.slot)}`)
  }
  // Новые связи продукта (если в продукте связь есть, а в исходном её не было).
  units.forEach((u, k) => {
    const atomOfSlot = new Map<number, number>()
    for (const [i, v] of slotOf) if (v.unit === k) atomOfSlot.set(v.slot, i)
    for (const [x, y, n] of u.bonds) {
      if (have.has(`${k}:${Math.min(x, y)}-${Math.max(x, y)}`)) continue
      const a = atomOfSlot.get(x)
      const b = atomOfSlot.get(y)
      if (a == null || b == null) continue
      for (let s = 0; s < n; s++) rSticks.push({ a, b, t0: tB - 0.2, t1: tB + 0.4, tOut: u.main ? routeEnd : tC - 0.2, n, s })
    }
  })
  // O=O — двойная связь (две палочки).
  for (let s = 0; s < 2; s++) rSticks.push({ a: o2[0], b: o2[1], t0: sRel.t0 + 0.42 * sRel.dur, t1: sRel.t0 + 0.6 * sRel.dur, tOut: sRel.t0 + sRel.dur - 0.4, n: 2, s })

  // ── Электроны: 2O → O₂ + 4e⁻, по одному, от уходящих O к принимающим центрам ──
  const rElectrons: RouteElectron[] = []
  const chargeSteps: StoryChargeStep[] = []
  const cap = new Map<number, number>(leaving.map((o) => [o, 2]))
  const qNow = atoms.map((x) => x.q)
  let j = 0
  centers.forEach((c, k) => {
    const g = def.gains[k]!
    for (let e = 0; e < g.from - g.to; e++) {
      const from = [...cap.entries()].filter(([, n]) => n > 0).sort((x, y) => len(sub(p1[x[0]]!, atoms[c]!.p)) - len(sub(p1[y[0]]!, atoms[c]!.p)))[0]![0]
      cap.set(from, cap.get(from)! - 1)
      const t0 = sTr.t0 + 0.5 + j * E_STEP
      const t1 = t0 + E_PER
      j++
      const P = p1[from]!
      const Q = atoms[c]!.p
      const dir = nrm(sub(Q, P))
      const a0 = add(P, dir, 0.9 * atoms[from]!.r)
      const a1 = add(Q, dir, -1.05 * atoms[c]!.r)
      rElectrons.push({ keys: [[t0 - 0.45, a0], [t0, a0], [t1, a1]], tIn: t0 - 0.45, tOut: t1 + 0.1, kind: 'transfer', from, to: c })
      chargeSteps.push({ atom: from, src: 'route', t: t0, from: qNow[from]!, to: qNow[from]! + 1, kind: atoms[from]!.qKind })
      qNow[from]!++
      chargeSteps.push({ atom: c, src: 'route', t: t1, from: qNow[c]!, to: qNow[c]! - 1, kind: atoms[c]!.qKind })
      qNow[c]!--
    }
  })

  // Экран → модель.
  for (const a of rAtoms) a.keys = a.keys.map(([tt, p]) => [tt, toModel(p)])
  for (const e of rElectrons) e.keys = e.keys.map(([tt, p]) => [tt, toModel(p)])

  const route: RouteStage = {
    kind: 'decomposition',
    show: 'decomposition',
    equation: def.equation,
    title: ['Путь: окислительно-восстановительное разложение', 'Route: redox decomposition', 'Yoʻl: oksidlanish-qaytarilish parchalanishi'],
    text: [def.reagentIons[0], def.reagentIons[1], def.reagentIons[2]],
    t0: -0.6,
    dur: routeEnd + 0.5 + 0.6,
    atoms: rAtoms,
    sticks: rSticks,
    electrons: rElectrons,
    badges: [],
  }
  const info: RedoxSceneInfo = {
    id,
    units: units.map((u, k) => ({ formula: u.formula, atoms: rest.filter((i) => slotOf.get(i)!.unit === k), main: u.main })),
    leaving,
    o2,
    centers,
    dOO,
  }
  return { stages, total: t, route, chargeSteps, hud: redoxHud(def, stages), info }
}

/** HUD сценария: путь, исходное, нагревание, разрыв, полуреакции и баланс e⁻, O₂, проверка электронейтральности. */
export function redoxHud(def: RedoxDecompDef, stages: Stage[]): StoryHud[] {
  const S = (k: StageKey) => stages.find((s) => s.key === k)!
  const end = (k: StageKey) => S(k).t0 + S(k).dur
  const total = end('final')
  const tri = (t: [string, string, string]): [string, string, string] => t
  const hud: StoryHud[] = [
    { t0: 0, t1: S('final').t0, title: 'Путь', lines: [def.equation], tone: 'route', titleT: ['Путь', 'Route', 'Yoʻl'], linesT: [[def.equation, def.equation, def.equation]] },
    { t0: 0, t1: S('heat').t0, title: 'Исходное вещество', lines: [def.reagentIons[0]], tone: 'route', titleT: ['Исходное вещество', 'Starting substance', 'Boshlangʻich modda'], linesT: [def.reagentIons] },
    {
      t0: S('heat').t0,
      t1: S('break').t0,
      title: 'Нагревание',
      lines: ['t° ↑ — ионы колеблются сильнее'],
      tone: 'route',
      titleT: ['Нагревание', 'Heating', 'Qizdirish'],
      linesT: [['t° ↑ — ионы колеблются сильнее', 't° ↑ — the ions vibrate more strongly', 't° ↑ — ionlar kuchliroq tebranadi']],
    },
    { t0: S('break').t0, t1: S('transfer').t0, title: 'Разрыв связей', lines: [def.breakNote[0]], tone: 'route', titleT: ['Разрыв связей', 'Bonds break', 'Bogʻlar uziladi'], linesT: [def.breakNote] },
    {
      t0: S('transfer').t0,
      t1: end('release'),
      title: 'Перенос электронов',
      lines: [def.oxidation[0], ...def.reduction.map((r) => r[0]), 'Баланс: 4e⁻ = 4e⁻'],
      tone: 'redox',
      titleT: ['Перенос электронов', 'Electron transfer', 'Elektronlar oʻtishi'],
      linesT: [tri(def.oxidation), ...def.reduction, ['Баланс: 4e⁻ = 4e⁻', 'Balance: 4e⁻ = 4e⁻', 'Balans: 4e⁻ = 4e⁻']],
    },
    {
      t0: S('release').t0,
      t1: end('release'),
      title: 'Выделение O₂',
      lines: ['O=O: d = 1,21 Å, связь двойная', 'O₂↑'],
      tone: 'check',
      titleT: ['Выделение O₂', 'O₂ is released', 'O₂ ajraladi'],
      linesT: [['O=O: d = 1,21 Å, связь двойная', 'O=O: d = 1.21 Å, a double bond', 'O=O: d = 1,21 Å, qoʻsh bogʻ'], ['O₂↑', 'O₂↑', 'O₂↑']],
    },
    {
      t0: S('lattice').t0,
      t1: total,
      title: 'Проверка: сумма зарядов = 0',
      lines: def.products.map((p) => p.check),
      tone: 'check',
      titleT: ['Проверка: сумма зарядов = 0', 'Check: the charges add up to 0', 'Tekshiruv: zaryadlar yigʻindisi = 0'],
      linesT: def.products.map((p) => [p.check, p.check, p.check] as [string, string, string]),
    },
  ]
  return hud
}
