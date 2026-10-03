/**
 * «Доска учителя»: компактная электронная и структурная формула ПОВТОРЯЮЩЕГОСЯ ФРАГМЕНТА (Kimyo 8, § 15–17) — для
 * веществ, у которых нет маленькой отдельной молекулы или она велика для доски:
 *  • мостик X–O–X (две «половинки» вокруг одного O): Cl₂O₇, Mn₂O₇, N₂O₅, H₄P₂O₇, Cr₂O₇²⁻;
 *  • узел каркаса / клетки с соседями-«призраками»: SiO₂ (≡Si–O–Si≡, у Si 4 связи, у O 2), P₄O₁₀ (P=O + 3 мостика P–O–P);
 *  • звено цепи в скобках «( … )ₙ» с мостиковым O: (CrO₃)ₙ, (HPO₃)ₙ, (H₂SiO₃)ₙ, (SiO₃²⁻)ₙ;
 *  • молекула кристаллизационной воды H–O–H (у катиона — неподелённой парой O).
 * Всё строится по составу частицы (формула плана) и степени окисления центра: кратность связей — по школьной записи
 * (сначала одинарные к O⁻ / OH / мостикам, остаток — двойные; у N — не больше четырёх пар, остальное — N→O). Электроны
 * считаются локально: у каждого атома e⁻ = валентные − (в связях свои) (+1 у O⁻); у акцептора пары N→O своих в связи нет.
 */
import { VALENCE, type LAtom, type LBond, type LGraph } from './lewis'

/** Элементы 2-го периода: вокруг атома не больше четырёх электронных пар. */
const PERIOD2 = new Set(['B', 'C', 'N', 'O', 'F'])

type Term = 'double' | 'dative' | 'minus' | 'oh'

/** Локальный подсчёт неподелённых пар / неспаренных e⁻ у всех атомов, кроме «призраков» (соседи вне фрагмента). */
export function localElectrons(g: LGraph): LGraph {
  const used = g.atoms.map(() => 0)
  for (const b of g.bonds) {
    if (b.dative != null) {
      // донор отдаёт пару целиком, акцептор своих e⁻ в связь не вносит
      used[b.dative]! += 2 * b.order
    } else {
      used[b.a]! += b.order
      used[b.b]! += b.order
    }
  }
  g.atoms.forEach((a, i) => {
    if (a.ghost) {
      a.lone = 0
      a.single = 0
      return
    }
    const e = Math.max(0, (VALENCE[a.el] ?? 0) - used[i]! - (a.q ?? 0))
    a.lone = Math.floor(e / 2)
    a.single = e % 2
  })
  return g
}

/** Концевые группы центра по составу: на центр v связей; одинарные — O⁻ и OH, остальное — двойные (у N — N→O). */
function terminals(center: string, v: number, nTerm: number, nOH: number, nMinus: number, bridges: number): Term[] | null {
  const singles = nOH + nMinus
  if (singles > nTerm) return null
  let budget = Math.min(v, PERIOD2.has(center) ? 4 : 8) - bridges - singles
  const out: Term[] = []
  for (let k = 0; k < nTerm - singles; k++) {
    const left = nTerm - singles - k
    if (budget >= 2 * left || (budget >= 2 && budget - 2 >= left - 1)) {
      out.push('double')
      budget -= 2
    } else if (budget >= 1) {
      out.push('dative')
      budget -= 1
    } else return null
  }
  // двойные — первыми (вверх/вниз), затем O⁻ и OH (наружу) — как в школьной записи
  return [...out, ...Array<Term>(nMinus).fill('minus'), ...Array<Term>(nOH).fill('oh')]
}

/** Добавить к центру c концевую группу в направлении (dx, dy). */
function addTerm(atoms: LAtom[], bonds: LBond[], c: number, t: Term, dx: number, dy: number) {
  const cx = atoms[c]!.x
  const cy = atoms[c]!.y
  atoms.push({ el: 'O', x: cx + dx, y: cy + dy, lone: 0, single: 0, q: t === 'minus' ? -1 : undefined })
  const o = atoms.length - 1
  bonds.push({ a: c, b: o, order: t === 'double' ? 2 : 1, dative: t === 'dative' ? c : undefined })
  if (t === 'oh') {
    atoms.push({ el: 'H', x: cx + 2 * dx, y: cy + 2 * dy, lone: 0, single: 0 })
    bonds.push({ a: o, b: atoms.length - 1, order: 1 })
  }
}

const deg = (a: number) => (a * Math.PI) / 180

/**
 * Мостик X–O–X: X₂OₙHₕ^q, n нечётно (один мостиковый O), n ≥ 5. Степень окисления X = (2n − h + q)/2 (q < 0 у аниона).
 * Половинки зеркальны: у левого X концевые группы — вверх / вниз / влево, у правого — вверх / вниз / вправо.
 */
export function bridgedDimer(comp: Record<string, number>, charge: number): LGraph | null {
  const els = Object.keys(comp)
  const X = els.find((e) => e !== 'O' && e !== 'H')
  const nO = comp.O ?? 0
  const nH = comp.H ?? 0
  if (!X || comp[X] !== 2 || els.length > (nH ? 3 : 2) || nO < 5 || nO % 2 === 0 || nH % 2 || charge % 2) return null
  if (VALENCE[X] == null) return null
  const v = (2 * nO - nH + charge) / 2
  const per = (nO - 1) / 2
  if (per > 3 || v < 1) return null
  const terms = terminals(X, v, per, nH / 2, -charge / 2, 1)
  if (!terms) return null
  const atoms: LAtom[] = [
    { el: X, x: -1, y: 0, lone: 0, single: 0 },
    { el: 'O', x: 0, y: -0.35, lone: 0, single: 0 },
    { el: X, x: 1, y: 0, lone: 0, single: 0 },
  ]
  const bonds: LBond[] = [
    { a: 0, b: 1, order: 1 },
    { a: 1, b: 2, order: 1 },
  ]
  // направления концевых групп (левый центр; у правого — зеркально по x)
  const dirs = per === 3 ? [-90, 90, 180] : per === 2 ? [-120, 120] : [180]
  for (const [c, sx] of [
    [0, 1],
    [2, -1],
  ] as const)
    terms.forEach((t, k) => {
      const a = deg(dirs[k]!)
      addTerm(atoms, bonds, c, t, Math.cos(a) * sx, Math.sin(a))
    })
  return localElectrons({ atoms, bonds, charge })
}

/** Узел каркаса / клетки XOₘ: концевые группы + мостики к соседям-«призракам» (координация 4). */
function nodeFragment(X: string, terms: Term[], bridges: number, chain: boolean, charge: number): LGraph {
  const atoms: LAtom[] = [{ el: X, x: 0, y: 0, lone: 0, single: 0 }]
  const bonds: LBond[] = []
  if (chain) {
    // звено цепи: (–O–X(…)–)ₙ — мостиковый O слева (свой), справа связь к O следующего звена (призрак)
    atoms.push({ el: X, x: -2, y: 0, lone: 0, single: 0, ghost: true })
    atoms.push({ el: 'O', x: -1, y: 0, lone: 0, single: 0 })
    bonds.push({ a: 1, b: 2, order: 1 }, { a: 2, b: 0, order: 1 })
    atoms.push({ el: 'O', x: 1, y: 0, lone: 0, single: 0, ghost: true })
    bonds.push({ a: 0, b: 3, order: 1 })
    terms.forEach((t, k) => addTerm(atoms, bonds, 0, t, 0, k === 0 ? -1 : 1))
    return { ...localElectrons({ atoms, bonds, charge }), poly: { x0: -1.5, x1: 0.5 } }
  }
  // каркас / клетка: концевые — вверх, мостики — влево, вправо, вниз (и вверх, если концевых нет)
  const bdirs: [number, number][] = terms.length ? [[-1, 0], [1, 0], [0, 1]] : [[0, -1], [1, 0], [0, 1], [-1, 0]]
  terms.forEach((t) => addTerm(atoms, bonds, 0, t, 0, -1))
  for (const [dx, dy] of bdirs.slice(0, bridges)) {
    atoms.push({ el: 'O', x: dx, y: dy, lone: 0, single: 0 })
    const o = atoms.length - 1
    bonds.push({ a: 0, b: o, order: 1 })
    atoms.push({ el: X, x: 2 * dx, y: 2 * dy, lone: 0, single: 0, ghost: true })
    bonds.push({ a: o, b: atoms.length - 1, order: 1 })
  }
  return localElectrons({ atoms, bonds, charge })
}

/**
 * Узел по составу XOₘHₕ^q (на один атом X), координация 4: t + b = 4, t + b/2 = m → b = 2(4 − m), t = 4 − b.
 * SiO₂ (m = 2): b = 4; P₄O₁₀ (m = 2,5): b = 3, P=O; CrO₃, HPO₃, H₂SiO₃, SiO₃²⁻ (m = 3): b = 2 — цепь.
 */
export function unitFragment(comp: Record<string, number>, charge: number): LGraph | null {
  const els = Object.keys(comp)
  const X = els.find((e) => e !== 'O' && e !== 'H')
  if (!X || VALENCE[X] == null || els.length > (comp.H ? 3 : 2)) return null
  const nX = comp[X]!
  const m = (comp.O ?? 0) / nX
  const h = (comp.H ?? 0) / nX
  const q = charge / nX
  const b = 2 * (4 - m)
  if (!Number.isInteger(b) || b < 2 || b > 4 || !Number.isInteger(h) || !Number.isInteger(q)) return null
  const t = 4 - b
  const v = 2 * m - h + q
  const terms = terminals(X, v, t, h, -q, b)
  if (!terms || terms.includes('dative')) return null
  return nodeFragment(X, terms, b, b === 2, charge)
}

/** Молекула воды H–O–H (уголок; две неподелённые пары O смотрят к катиону — влево). */
export function waterGraph(): LGraph {
  return localElectrons({
    atoms: [
      { el: 'O', x: 0, y: 0, lone: 0, single: 0 },
      { el: 'H', x: 0.62, y: -0.78, lone: 0, single: 0 },
      { el: 'H', x: 0.62, y: 0.78, lone: 0, single: 0 },
    ],
    bonds: [
      { a: 0, b: 1, order: 1 },
      { a: 0, b: 2, order: 1 },
    ],
    charge: 0,
  })
}

/** Вид фрагмента для подписи на доске. */
export type FragmentKind = 'bridge' | 'node' | 'chain'
export const fragmentKind = (g: LGraph): FragmentKind => (g.poly ? 'chain' : g.atoms.some((a) => a.ghost) ? 'node' : 'bridge')
