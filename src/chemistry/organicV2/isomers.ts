/**
 * Перечисление структурных изомеров для задания «найди все изомеры».
 * Генерация — достраиванием графа с отсевом повторов по канонической форме (canonical.ts):
 *  - алканы CₙH₂ₙ₊₂ (n ≤ 10; n ≤ 8: 1, 1, 1, 2, 3, 5, 9, 18);
 *  - CₙH₂ₙ: алкены (с цис/транс по желанию) + циклоалканы как межклассовые изомеры;
 *  - CₙH₂ₙ₊₂O: спирты + простые эфиры.
 */
import { canonicalizeMol } from './canonical'
import { toMol, type BondOrder, type SkeletonGraph } from './graph'

export interface IsomerEntry {
  /** канонический код (с цис/транс, если задан) */
  readonly code: string
  /** код без цис/транс — «структурный изомер» */
  readonly constitution: string
  readonly graph: SkeletonGraph
  readonly kind: 'alkane' | 'alkene' | 'cycloalkane' | 'alcohol' | 'ether'
  readonly cisTrans?: 'cis' | 'trans'
}

type G = { el: string[]; bonds: { a: number; b: number; o: BondOrder }[] }

const toSkel = (g: G): SkeletonGraph => ({ atoms: g.el.map((el) => ({ el })), bonds: g.bonds.map((b) => ({ ...b })) })
const code = (g: SkeletonGraph) => canonicalizeMol(toMol(g)).smiles

function valenceUsed(g: G, i: number): number {
  let s = 0
  for (const b of g.bonds) if (b.a === i || b.b === i) s += b.o
  return s
}

const treeCache = new Map<number, G[]>()

/** Все углеродные деревья (скелеты алканов) с n атомами C. */
function carbonTrees(n: number): G[] {
  if (treeCache.has(n)) return treeCache.get(n)!
  let level: G[] = [{ el: ['C'], bonds: [] }]
  for (let k = 1; k < n; k++) {
    const next = new Map<string, G>()
    for (const g of level) {
      for (let i = 0; i < g.el.length; i++) {
        if (valenceUsed(g, i) >= 4) continue
        const ng: G = { el: [...g.el, 'C'], bonds: [...g.bonds, { a: i, b: g.el.length, o: 1 }] }
        const c = code(toSkel(ng))
        if (!next.has(c)) next.set(c, ng)
      }
    }
    level = [...next.values()]
  }
  treeCache.set(n, level)
  return level
}

/** Изомеры алканов CₙH₂ₙ₊₂ (1 ≤ n ≤ 10). */
export function alkaneIsomers(n: number): IsomerEntry[] {
  if (n < 1 || n > 10) return []
  return carbonTrees(n).map((g) => { const s = toSkel(g); const c = code(s); return { code: c, constitution: c, graph: s, kind: 'alkane' as const } })
}

/**
 * Изомеры состава CₙH₂ₙ (2 ≤ n ≤ 7): алкены (по желанию — с цис/транс) и циклоалканы (межклассовая изомерия).
 * Пространственная изомерия в кольцах не учитывается.
 */
export function alkeneIsomers(n: number, opts: { cisTrans?: boolean; cycloalkanes?: boolean } = {}): IsomerEntry[] {
  const withCT = opts.cisTrans ?? true, withCyc = opts.cycloalkanes ?? true
  if (n < 2 || n > 7) return []
  const out = new Map<string, IsomerEntry>()
  for (const t of carbonTrees(n)) {
    // C=C на каждой связи дерева
    t.bonds.forEach((_, k) => {
      const g: G = { el: t.el, bonds: t.bonds.map((b, j) => (j === k ? { ...b, o: 2 as BondOrder } : b)) }
      if (valenceUsed(g, g.bonds[k].a) > 4 || valenceUsed(g, g.bonds[k].b) > 4) return
      const s = toSkel(g)
      const c0 = code(s)
      const variants: IsomerEntry[] = []
      if (withCT) for (const ct of ['cis', 'trans'] as const) {
        const sct: SkeletonGraph = { atoms: s.atoms, bonds: s.bonds.map((b, j) => (j === k ? { ...b, cisTrans: ct } : b)) }
        const c = code(sct)
        if (c !== c0) variants.push({ code: c, constitution: c0, graph: sct, kind: 'alkene', cisTrans: ct })
      }
      if (!variants.length) variants.push({ code: c0, constitution: c0, graph: s, kind: 'alkene' })
      for (const v of variants) if (!out.has(v.code)) out.set(v.code, v)
    })
    // циклоалканы: замыкаем цикл (≥ 3 атомов) между двумя несвязанными атомами дерева
    if (withCyc) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (t.bonds.some((b) => (b.a === i && b.b === j) || (b.a === j && b.b === i))) continue
      const g: G = { el: t.el, bonds: [...t.bonds, { a: i, b: j, o: 1 }] }
      if (valenceUsed(g, i) > 4 || valenceUsed(g, j) > 4) continue
      const s = toSkel(g)
      const c = code(s)
      if (!out.has(c)) out.set(c, { code: c, constitution: c, graph: s, kind: 'cycloalkane' })
    }
  }
  return [...out.values()]
}

/** Изомеры состава CₙH₂ₙ₊₂O (1 ≤ n ≤ 7): спирты (–OH на любом C) и простые эфиры (–O– в любой связи C–C). */
export function alcoholEtherIsomers(n: number): IsomerEntry[] {
  if (n < 1 || n > 7) return []
  const out = new Map<string, IsomerEntry>()
  for (const t of carbonTrees(n)) {
    for (let i = 0; i < n; i++) {
      if (valenceUsed(t, i) >= 4) continue
      const g: G = { el: [...t.el, 'O'], bonds: [...t.bonds, { a: i, b: n, o: 1 }] }
      const s = toSkel(g), c = code(s)
      if (!out.has(c)) out.set(c, { code: c, constitution: c, graph: s, kind: 'alcohol' })
    }
    t.bonds.forEach((b0, k) => {
      const g: G = { el: [...t.el, 'O'], bonds: [...t.bonds.filter((_, j) => j !== k), { a: b0.a, b: n, o: 1 }, { a: n, b: b0.b, o: 1 }] }
      const s = toSkel(g), c = code(s)
      if (!out.has(c)) out.set(c, { code: c, constitution: c, graph: s, kind: 'ether' })
    })
  }
  return [...out.values()]
}

/**
 * Проверка ответа ученика в задании «найди все изомеры»: какие из нарисованных — верные (и не повторы),
 * какие — повтор уже найденного («это тот же 2-метилбутан, просто повёрнут»), каких не хватает.
 */
export function checkIsomerAnswers(expected: readonly IsomerEntry[], drawn: readonly SkeletonGraph[], useStereo = false): {
  readonly found: readonly string[]
  readonly duplicates: readonly number[]
  readonly wrong: readonly number[]
  readonly missing: readonly IsomerEntry[]
} {
  const key = (e: IsomerEntry) => (useStereo ? e.code : e.constitution)
  const want = new Map(expected.map((e) => [key(e), e]))
  const found: string[] = []
  const duplicates: number[] = []
  const wrong: number[] = []
  drawn.forEach((g, i) => {
    const m = toMol(g)
    const c = useStereo ? canonicalizeMol(m).smiles : canonicalizeMol({ ...m, stereo: new Map() }).smiles
    if (!want.has(c)) wrong.push(i)
    else if (found.includes(c)) duplicates.push(i)
    else found.push(c)
  })
  const missing = [...want.entries()].filter(([c]) => !found.includes(c)).map(([, e]) => e)
  return { found, duplicates, wrong, missing: [...new Map(missing.map((e) => [key(e), e])).values()] }
}
