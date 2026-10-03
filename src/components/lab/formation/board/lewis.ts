/**
 * «Доска учителя» (Kimyo 8, § 15–16): электронная формула (точки Льюиса) и структурная формула вещества — чистые
 * функции. Источник — модель карточки (buildSchoolHeroModel: атомы и кратности связей) и план (formationPlan:
 * частицы, заряды). Электроны: валентные — по номеру группы; общие пары — по кратности связей; неподелённые —
 * остаток (сначала достраиваются октеты более электроотрицательных атомов, остаток — центральному атому).
 */
import type { FormationPlan, FormationSpecies } from '../../../../chemistry/formationPlan'
import type { SchoolHeroModel, V3 } from '../../hero/schoolHeroModel'

/** Валентные электроны (номер группы; у d-металлов — число электронов внешних уровней, как в школьной записи). */
export const VALENCE: Record<string, number> = {
  H: 1, Li: 1, Na: 1, K: 1, Rb: 1, Cs: 1, Ag: 1, Cu: 1, Be: 2, Mg: 2, Ca: 2, Sr: 2, Ba: 2, Zn: 2, Hg: 2, Fe: 2, Pb: 4, Sn: 4,
  B: 3, Al: 3, C: 4, Si: 4, Ge: 4, N: 5, P: 5, As: 5, O: 6, S: 6, Se: 6, Te: 6, F: 7, Cl: 7, Br: 7, I: 7,
  V: 5, Cr: 6, Mn: 7, Ti: 4,
}

/** Электроотрицательность (Полинг; Kimyo 8, § 14, табл. 13) — только для порядка заполнения октетов. */
const EN: Record<string, number> = { F: 3.98, O: 3.44, Cl: 3.16, N: 3.04, Br: 2.96, I: 2.66, S: 2.58, C: 2.55, Se: 2.55, H: 2.2, P: 2.19, As: 2.18, B: 2.04, Si: 1.9 }
const en = (el: string) => EN[el] ?? 1.5
/** Элементы 2-го периода: не больше четырёх электронных пар вокруг атома. */
const PERIOD2 = new Set(['B', 'C', 'N', 'O', 'F'])

/**
 * faces — у отдельного атома (схема перехода): неспаренный электрон смотрит в эту сторону (рад, 0 — вправо);
 * ghost — сосед вне фрагмента (бледный, без электронов); q — заряд атома во фрагменте (O⁻ у звена силиката).
 */
export type LAtom = { el: string; x: number; y: number; lone: number; single: number; faces?: number; ghost?: boolean; q?: number }
/** dative — донорно-акцепторная: from — атом-донор пары (стрелка от него). */
export type LBond = { a: number; b: number; order: number; dative?: number }
/** poly — звено цепи: скобки «( … )ₙ» между x0 и x1 (в длинах связи). */
export type LGraph = { atoms: LAtom[]; bonds: LBond[]; charge: number; poly?: { x0: number; x1: number } }

/** Часть электронной формулы ионного вещества: [Na]⁺, 2[:Cl:]⁻, [SO₄]²⁻ (graph = null — только подпись). */
export type LPart = { graph: LGraph | null; label: string; charge: number; count: number; bracket: boolean; lead?: string }

// ─── Электроны ─────────────────────────────────────────────────────────────

/** Неподелённые пары и неспаренные электроны по атомам; null — валентность какого-то атома неизвестна. */
export function distributeElectrons(els: readonly string[], bonds: readonly LBond[], charge: number): { lone: number[]; single: number[] } | null {
  const n = els.length
  const bondSum = new Array<number>(n).fill(0)
  for (const b of bonds) {
    bondSum[b.a]! += b.order
    bondSum[b.b]! += b.order
  }
  let total = -charge
  for (const el of els) {
    const v = VALENCE[el]
    if (v == null) return null
    total += v
  }
  // В связях — по 2 e⁻ на пару; сумма bondSum считает каждую пару дважды (по атому на конце) = число e⁻ в связях.
  let left = total - bondSum.reduce((s, x) => s + x, 0)
  if (left < 0) return null
  const e = new Array<number>(n).fill(0)
  const order = els.map((_, i) => i).sort((i, j) => en(els[j]!) - en(els[i]!) || bondSum[i]! - bondSum[j]!)
  for (const i of order) {
    const need = Math.max(0, (els[i] === 'H' ? 2 : 8) - 2 * bondSum[i]!)
    const give = Math.min(need, left)
    e[i] = give
    left -= give
  }
  if (left > 0) {
    // Остаток — центральному атому (больше всего связей, не H; у 3-го периода октет может быть расширен).
    const centers = els.map((_, i) => i).filter((i) => els[i] !== 'H').sort((i, j) => bondSum[j]! - bondSum[i]! || en(els[i]!) - en(els[j]!))
    const c = centers[0]
    if (c == null) return null
    e[c]! += left
  }
  return { lone: e.map((x) => Math.floor(x / 2)), single: e.map((x) => x % 2) }
}

// ─── Раскладка на плоскости ────────────────────────────────────────────────

const rotX = (p: V3, a: number): V3 => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]
const rotY = (p: V3, a: number): V3 => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)]

/** Проекция модели как на экране (та же поза, что у 3D), затем «расправление» на плоскости: длина связи = 1, атомы не слипаются. */
function relax(pts: [number, number][], bonds: readonly LBond[]): [number, number][] {
  const n = pts.length
  if (n === 1) return [[0, 0]]
  let mean = 0
  for (const b of bonds) mean += Math.hypot(pts[b.a]![0] - pts[b.b]![0], pts[b.a]![1] - pts[b.b]![1])
  mean = bonds.length ? mean / bonds.length : 1
  const P = pts.map(([x, y]) => [x / (mean || 1), y / (mean || 1)] as [number, number])
  const bonded = new Set(bonds.map((b) => `${Math.min(b.a, b.b)}:${Math.max(b.a, b.b)}`))
  for (let it = 0; it < 120; it++) {
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const dx = P[j]![0] - P[i]![0]
        const dy = P[j]![1] - P[i]![1]
        const d = Math.hypot(dx, dy) || 1e-3
        const isB = bonded.has(`${i}:${j}`)
        const want = isB ? 1 : 1.45
        if (!isB && d >= want) continue
        const k = ((want - d) / d) * (isB ? 0.25 : 0.12)
        P[i]![0] -= dx * k
        P[i]![1] -= dy * k
        P[j]![0] += dx * k
        P[j]![1] += dy * k
      }
  }
  return P
}

function projectModel(model: SchoolHeroModel, idx: readonly number[]): [number, number][] {
  return idx.map((i) => {
    const p = model.atoms[i]!.pos
    const s = model.motion === 'orbit' ? rotX(rotY(p, model.yaw), model.pitch) : rotY(rotX(p, model.pitch), model.yaw)
    return [s[0], -s[1]]
  })
}

/** Граф по атомам модели idx (связи — между ними). */
function graphFromModel(model: SchoolHeroModel, idx: readonly number[], charge: number, dativeHint: [string, string] | null): LGraph | null {
  const pos = new Map(idx.map((a, k) => [a, k]))
  const bonds: LBond[] = []
  for (const b of model.bonds) {
    const a = pos.get(b.a)
    const c = pos.get(b.b)
    if (a != null && c != null) bonds.push({ a, b: c, order: Math.max(1, Math.min(3, b.order)) })
  }
  if (idx.length > 1 && bonds.length < idx.length - 1) return null
  const els = idx.map((i) => model.atoms[i]!.el as string)
  markDative(els, bonds, dativeHint)
  const P = relax(projectModel(model, idx), bonds)
  const ed = distributeElectrons(els, bonds, charge)
  return { atoms: els.map((el, k) => ({ el, x: P[k]![0], y: P[k]![1], lone: ed?.lone[k] ?? 0, single: ed?.single[k] ?? 0 })), bonds, charge }
}

/** Донорно-акцепторная связь по подсказке «N→O»: одинарная к концевому атому, иначе (двухатомная молекула) — кратная. */
function markDative(els: readonly string[], bonds: LBond[], hint: [string, string] | null) {
  if (!hint) return
  const [don, acc] = hint
  const deg = els.map((_, i) => bonds.filter((b) => b.a === i || b.b === i).length)
  const match = (b: LBond) => (els[b.a] === don && els[b.b] === acc ? b.a : els[b.b] === don && els[b.a] === acc ? b.b : -1)
  for (const b of bonds) {
    const d = match(b)
    if (d >= 0 && b.order === 1 && deg[d === b.a ? b.b : b.a] === 1) {
      b.dative = d
      return
    }
  }
  if (els.length === 2 && bonds.length === 1) {
    const d = match(bonds[0]!)
    if (d >= 0 && bonds[0]!.order > 1) bonds[0]!.dative = d
  }
}

/** Подсказка о донорно-акцепторной связи из «уникального момента» сценария: «N→O», «пара O → C». */
export function dativeHintOf(special: string | undefined): [string, string] | null {
  const m = special?.match(/\b([A-Z][a-z]?)\s?→\s?([A-Z][a-z]?)\b/)
  return m ? [m[1]!, m[2]!] : null
}

const DIATOMIC_ORDER: Record<string, number> = { H: 1, F: 1, Cl: 1, Br: 1, I: 1, O: 2, N: 3 }

/** Молекула вещества (S/MP): из модели карточки; у кристаллической модели простого вещества X₂ — сама молекула X₂. */
export function moleculeGraph(model: SchoolHeroModel | null, formula: string, special: string | undefined): LGraph | null {
  if (model && model.kind === 'molecule' && model.atoms.length <= 16) {
    return graphFromModel(
      model,
      model.atoms.map((_, i) => i),
      0,
      dativeHintOf(special),
    )
  }
  const m = formula.match(/^([A-Z][a-z]?)₂$/)
  if (m && DIATOMIC_ORDER[m[1]!]) {
    const el = m[1]!
    const bonds: LBond[] = [{ a: 0, b: 1, order: DIATOMIC_ORDER[el]! }]
    const ed = distributeElectrons([el, el], bonds, 0)
    return { atoms: [0, 1].map((k) => ({ el, x: k, y: 0, lone: ed?.lone[k] ?? 0, single: ed?.single[k] ?? 0 })), bonds, charge: 0 }
  }
  return null
}

// ─── Ионные вещества ───────────────────────────────────────────────────────

/** Многоатомный ион «звездой» по школьной записи: центр + O (H — на одинарных O); заряд — на одинарных O⁻. */
function starIon(sp: FormationSpecies): LGraph | null {
  const comp = sp.comp
  const els = Object.keys(comp)
  const nH = comp.H ?? 0
  const q = Math.abs(sp.charge)
  if (els.length === 2 && comp.O === 1 && nH === 1) {
    // OH⁻
    const bonds: LBond[] = [{ a: 0, b: 1, order: 1 }]
    const ed = distributeElectrons(['O', 'H'], bonds, sp.charge)
    return { atoms: [{ el: 'O', x: 0, y: 0, lone: ed?.lone[0] ?? 3, single: 0 }, { el: 'H', x: 1, y: 0, lone: 0, single: 0 }], bonds, charge: sp.charge }
  }
  if (els.length === 2 && comp.N === 1 && nH === 4) {
    // NH₄⁺: три обычные пары + одна донорно-акцепторная (пара N → H⁺)
    const at: LAtom[] = [{ el: 'N', x: 0, y: 0, lone: 0, single: 0 }]
    const bonds: LBond[] = []
    const dirs: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]
    dirs.forEach(([x, y], k) => {
      at.push({ el: 'H', x, y, lone: 0, single: 0 })
      bonds.push({ a: 0, b: k + 1, order: 1, dative: k === 3 ? 0 : undefined })
    })
    return { atoms: at, bonds, charge: sp.charge }
  }
  const center = els.find((e) => e !== 'O' && e !== 'H' && comp[e] === 1)
  const nO = comp.O ?? 0
  if (!center || nO < 2 || els.length > (nH ? 3 : 2) || q > nO) return null
  const ox = 2 * nO - nH + sp.charge
  const singles = q + nH
  if (singles > nO) return null
  const maxPairs = PERIOD2.has(center) ? 4 : 8
  let budget = Math.min(ox, maxPairs) - singles
  const at: LAtom[] = [{ el: center, x: 0, y: 0, lone: 0, single: 0 }]
  const bonds: LBond[] = []
  const angles = nO === 2 ? [180, 0] : nO === 3 ? [-90, 30, 150] : [-90, 0, 90, 180]
  for (let k = 0; k < nO; k++) {
    const a = ((angles[k % angles.length]! + (k >= angles.length ? 45 : 0)) * Math.PI) / 180
    at.push({ el: 'O', x: Math.cos(a), y: Math.sin(a), lone: 0, single: 0 })
    let order = 1
    let dative: number | undefined
    if (k >= singles) {
      const left = nO - k
      if (budget >= 2 * left || (budget >= 2 && budget - 2 >= left - 1)) {
        order = 2
        budget -= 2
      } else {
        dative = 0
        budget -= 1
      }
    }
    bonds.push({ a: 0, b: k + 1, order, dative })
  }
  // H — на O с одинарной связью (после заряженных O⁻).
  for (let h = 0; h < nH; h++) {
    const oi = q + h + 1
    const o = at[oi]!
    at.push({ el: 'H', x: o.x * 2, y: o.y * 2, lone: 0, single: 0 })
    bonds.push({ a: oi, b: at.length - 1, order: 1 })
  }
  const ed = distributeElectrons(
    at.map((a) => a.el),
    bonds,
    sp.charge,
  )
  if (ed) at.forEach((a, k) => ((a.lone = ed.lone[k]!), (a.single = ed.single[k]!)))
  const P = relax(
    at.map((a) => [a.x, a.y]),
    bonds,
  )
  at.forEach((a, k) => ((a.x = P[k]![0]), (a.y = P[k]![1])))
  return { atoms: at, bonds, charge: sp.charge }
}

/** Электронная формула ионного вещества по частицам плана: [Na]⁺ [:Cl:]⁻, [Ca]²⁺ 2[:Cl:]⁻, 2[Na]⁺ [SO₄]²⁻. */
export function ionicParts(plan: FormationPlan, model: SchoolHeroModel | null): LPart[] {
  return plan.species.map((sp, si): LPart => {
    const els = Object.keys(sp.comp)
    if (sp.kind === 'ion' && els.length === 1) {
      const el = els[0]!
      const v = VALENCE[el] ?? 0
      // Катион отдал внешние электроны — точек нет; анион достроил октет (H⁻ — дуплет).
      const e = sp.charge > 0 ? 0 : Math.max(0, v - sp.charge)
      const g: LGraph = { atoms: [{ el, x: 0, y: 0, lone: Math.floor(e / 2), single: e % 2 }], bonds: [], charge: sp.charge }
      return { graph: g, label: sp.formula, charge: sp.charge, count: sp.count, bracket: true }
    }
    if (sp.kind === 'polyion') {
      // Школьная запись иона (две S=O и две S–O⁻; одна C=O и две C–O⁻; N→O) — по правилу; иначе — связи модели.
      let g: LGraph | null = starIon(sp)
      const unit = !g && model && model.kind === 'molecule' ? plan.units.find((u) => u.species === si && u.atoms.length > 1) : undefined
      if (model && unit && unit.atoms.length <= 12) g = graphFromModel(model, unit.atoms, sp.charge, null)
      if (g && sp.donorAcceptor && !g.bonds.some((b) => b.dative != null)) {
        // NH₄⁺ и комплексы: одна из связей — донорно-акцепторная (пара — от N / O).
        const donorEl = sp.comp.N ? 'N' : 'O'
        const b = [...g.bonds].reverse().find((x) => g!.atoms[x.a]!.el === donorEl || g!.atoms[x.b]!.el === donorEl)
        if (b) b.dative = g.atoms[b.a]!.el === donorEl ? b.a : b.b
      }
      return { graph: g, label: sp.formula, charge: sp.charge, count: sp.count, bracket: true }
    }
    // Кристаллизационная вода и другие молекулы — подписью.
    return { graph: null, label: sp.formula, charge: 0, count: sp.count, bracket: false }
  })
}

/** Атом с валентными электронами до образования связи (H·, ·Ö·, Na·): по Льюису — сначала по одному, потом пары. */
export function valenceAtom(el: string): LAtom {
  const v = VALENCE[el] ?? 0
  const pairs = Math.max(0, v - 4)
  return { el, x: 0, y: 0, lone: pairs, single: v - 2 * pairs }
}
