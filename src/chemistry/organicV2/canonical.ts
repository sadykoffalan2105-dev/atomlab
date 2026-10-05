/**
 * Каноническая форма графа: уточнение классов (Морган/WL до стабилизации) + индивидуализация с перебором
 * ничьих (точно для школьных молекул; листья-«близнецы» у одного атома перебираются один раз).
 * Канонический код = канонический SMILES (Кекуле, с / \ для цис/транс) — «это та же молекула?».
 */
import { bondKey, toMol, type BondOrder, type Mol, type SkeletonGraph } from './graph'
import { writeSmiles } from './smiles'

/** Уточнение разбиения: ранги (0..n-1, равные — один класс). */
function refine(m: Mol, start: number[]): number[] {
  let r = start.slice()
  let classes = new Set(r).size
  for (;;) {
    const keys = r.map((ri, i) => {
      const nb = m.adj[i].map((e) => r[e.to] * 5 + e.o).sort((a, b) => a - b)
      return [ri, ...nb]
    })
    const idx = r.map((_, i) => i).sort((a, b) => cmpArr(keys[a], keys[b]))
    const nr = new Array(m.n)
    for (let k = 0; k < idx.length; k++) {
      nr[idx[k]] = k > 0 && cmpArr(keys[idx[k]], keys[idx[k - 1]]) === 0 ? nr[idx[k - 1]] : k
    }
    const c = new Set(nr).size
    r = nr
    if (c === classes) return r
    classes = c
  }
}

function cmpArr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return a.length - b.length
}

function initialRanks(m: Mol): number[] {
  const keys = m.el.map((e, i) => `${e.padEnd(2)}|${m.ch[i] + 5}|${m.hc[i]}|${m.adj[i].length}|${m.adj[i].map((x) => x.o).sort().join('')}`)
  const uniq = [...new Set(keys)].sort()
  // ранг = число атомов с меньшим ключом
  const cnt = new Map<string, number>()
  for (const k of keys) cnt.set(k, (cnt.get(k) ?? 0) + 1)
  const base = new Map<string, number>()
  let acc = 0
  for (const u of uniq) { base.set(u, acc); acc += cnt.get(u)! }
  return keys.map((k) => base.get(k)!)
}

/** Цис/транс, «стереогенные» двойные связи: у каждого конца два разных заместителя. */
function stereoBonds(m: Mol, orbit: number[]): string[] {
  const out: string[] = []
  for (const [key, st] of m.stereo) {
    const [a, b] = key.split('-').map(Number)
    const ok = (end: number, other: number) => {
      const nb = m.adj[end].filter((e) => e.to !== other)
      if (nb.length + m.hc[end] !== 2) return false
      if (nb.length === 2 && orbit[nb[0].to] === orbit[nb[1].to]) return false
      return nb.length >= 1
    }
    if (!ok(a, b) || !ok(b, a)) continue
    if (inSmallRing(m, a, b)) continue
    void st
    out.push(key)
  }
  return out
}

function inSmallRing(m: Mol, a: number, b: number): boolean {
  // путь a→b без прямой связи длиной < 7 → кольцо < 8: цис/транс задаётся кольцом
  const dist = new Map<number, number>([[a, 0]])
  const q = [a]
  while (q.length) {
    const v = q.shift()!
    const d = dist.get(v)!
    if (d >= 7) continue
    for (const e of m.adj[v]) {
      if ((v === a && e.to === b) || (v === b && e.to === a)) continue
      if (!dist.has(e.to)) { dist.set(e.to, d + 1); if (e.to === b) return true; q.push(e.to) }
    }
  }
  return false
}

/** Цис/транс для связи относительно соседей с наименьшим рангом. */
function stereoIn(m: Mol, key: string, rank: number[]): 'cis' | 'trans' {
  const st = m.stereo.get(key)!
  const [a, b] = key.split('-').map(Number)
  const best = (end: number, other: number) => m.adj[end].filter((e) => e.to !== other).map((e) => e.to).sort((p, q) => rank[p] - rank[q])[0]
  let v = st.v
  if (best(a, b) !== st.ref[0]) v = v === 'cis' ? 'trans' : 'cis'
  if (best(b, a) !== st.ref[1]) v = v === 'cis' ? 'trans' : 'cis'
  return v
}

export interface CanonicalResult {
  /** канонический порядок: rank[i] — место атома i */
  readonly rank: number[]
  /** канонический SMILES (код молекулы) */
  readonly smiles: string
  /** классы симметрии (одинаковое число — эквивалентные атомы, по уточнению) */
  readonly symmetryClass: number[]
  /** «нормализованная» молекула (только валидная стереохимия) */
  readonly mol: Mol
}

/**
 * Ароматические (бензольные) связи: связи 6-членных циклов, где у каждого атома (C/N) ровно одна двойная связь
 * и она сама лежит в таком цикле. Нужны, чтобы две формы Кекуле одного бензольного кольца давали один код.
 */
export function aromaticBonds(m: Mol): Set<string> {
  const cycles: number[][] = []
  const seen = new Set<string>()
  const okAtom = (v: number) => (m.el[v] === 'C' || m.el[v] === 'N') && m.adj[v].filter((e) => e.o === 2).length === 1 && m.adj[v].every((e) => e.o <= 2)
  for (let s0 = 0; s0 < m.n; s0++) {
    if (!okAtom(s0)) continue
    const path = [s0]
    const dfs = (v: number) => {
      for (const e of m.adj[v]) {
        if (e.o > 2) continue
        if (path.length === 6) { if (e.to === s0) { const key = [...path].sort((a, b) => a - b).join(','); if (!seen.has(key)) { seen.add(key); cycles.push([...path]) } } continue }
        if (e.to <= s0 || path.includes(e.to) || !okAtom(e.to)) continue
        path.push(e.to); dfs(e.to); path.pop()
      }
    }
    dfs(s0)
  }
  let cand = cycles
  for (;;) {
    const bonds = new Set<string>()
    for (const c of cand) for (let i = 0; i < 6; i++) bonds.add(bondKey(c[i], c[(i + 1) % 6]))
    const next = cand.filter((c) => c.every((v) => { const d = m.adj[v].find((e) => e.o === 2)!; return bonds.has(bondKey(v, d.to)) }))
    if (next.length === cand.length) return bonds
    cand = next
  }
}

/** Молекула с порядком 4 у ароматических связей (для канонизации). */
function withAromatic(m: Mol, aro: Set<string>): Mol {
  if (!aro.size) return m
  return { ...m, adj: m.adj.map((l, i) => l.map((e) => (aro.has(bondKey(i, e.to)) ? { to: e.to, o: 4 as unknown as BondOrder } : e))) }
}

/** Детерминированная расстановка Кекуле по каноническому порядку (меньший ранг — раньше). */
function kekulizeByRank(m: Mol, aro: Set<string>, rank: number[]): Mol {
  if (!aro.size) return m
  const atoms = [...new Set([...aro].flatMap((k) => k.split('-').map(Number)))].sort((a, b) => rank[a] - rank[b])
  const dbl = new Set<string>()
  const matched = new Set<number>()
  const solve = (k: number): boolean => {
    while (k < atoms.length && matched.has(atoms[k])) k++
    if (k >= atoms.length) return true
    const v = atoms[k]
    const nbs = m.adj[v].filter((e) => aro.has(bondKey(v, e.to)) && !matched.has(e.to)).map((e) => e.to).sort((a, b) => rank[a] - rank[b])
    for (const u of nbs) {
      matched.add(v); matched.add(u); dbl.add(bondKey(v, u))
      if (solve(k + 1)) return true
      matched.delete(v); matched.delete(u); dbl.delete(bondKey(v, u))
    }
    return false
  }
  if (!solve(0)) return m
  return { ...m, adj: m.adj.map((l, i) => l.map((e) => { const key = bondKey(i, e.to); return aro.has(key) ? { to: e.to, o: (dbl.has(key) ? 2 : 1) as BondOrder } : e })) }
}

const LEAF_CAP = 5000

/** Канонизация Mol (тяжёлые атомы + H). */
export function canonicalizeMol(mk: Mol): CanonicalResult {
  const aro = aromaticBonds(mk)
  const m0 = withAromatic(mk, aro)
  const r0 = refine(m0, initialRanks(m0))
  // оставляем только настоящую цис/транс-стереохимию
  const keep = new Set(stereoBonds(m0, r0))
  const stereo = new Map([...m0.stereo].filter(([k]) => keep.has(k)))
  const m: Mol = { ...m0, stereo }
  const edgeCode = (rank: number[]) => {
    const atoms = new Array(m.n)
    for (let i = 0; i < m.n; i++) atoms[rank[i]] = `${m.el[i]}${m.ch[i] || ''}h${m.hc[i]}`
    const edges: string[] = []
    for (let i = 0; i < m.n; i++) for (const e of m.adj[i]) if (rank[i] < rank[e.to]) edges.push(`${rank[i]}.${rank[e.to]}.${e.o}`)
    edges.sort()
    const st = [...stereo.keys()].map((k) => { const [a, b] = k.split('-').map(Number); return `${Math.min(rank[a], rank[b])}${stereoIn(m, k, rank)[0]}` }).sort()
    return atoms.join(',') + ';' + edges.join(',') + ';' + st.join(',')
  }
  let bestCode: string | null = null
  let bestRank: number[] = r0
  let leaves = 0
  const search = (r: number[]) => {
    if (leaves > LEAF_CAP) return
    // первый (по рангу) неодиночный класс
    const cnt = new Map<number, number[]>()
    r.forEach((x, i) => { const l = cnt.get(x); if (l) l.push(i); else cnt.set(x, [i]) })
    let cell: number[] | null = null
    let cellRank = Infinity
    for (const [x, l] of cnt) if (l.length > 1 && x < cellRank) { cellRank = x; cell = l }
    if (!cell) {
      leaves++
      const code = edgeCode(r)
      if (bestCode === null || code < bestCode) { bestCode = code; bestRank = r }
      return
    }
    // листья-близнецы (степень 1, общий сосед) взаимозаменяемы — пробуем один
    const seen = new Set<string>()
    for (const v of cell) {
      if (m.adj[v].length === 1) {
        const key = `leaf${m.adj[v][0].to}`
        if (seen.has(key)) continue
        seen.add(key)
      }
      const nr = r.map((x, i) => (x === cellRank && i !== v ? x + 1 : x) * 2)
      nr[v] = cellRank * 2
      search(refine(m, nr))
    }
  }
  search(r0)
  // ранги 0..n-1
  const order = bestRank.map((_, i) => i).sort((a, b) => bestRank[a] - bestRank[b])
  const rank = new Array(m.n)
  order.forEach((v, k) => { rank[v] = k })
  // цис/транс в каноническом виде: опора — сосед с наименьшим рангом
  const canonStereo = new Map<string, { ref: [number, number]; v: 'cis' | 'trans' }>()
  for (const k of stereo.keys()) {
    const [a, b] = k.split('-').map(Number)
    const best = (end: number, other: number) => m.adj[end].filter((e) => e.to !== other).map((e) => e.to).sort((p, q) => rank[p] - rank[q])[0]
    canonStereo.set(bondKey(a, b), { ref: [best(a, b), best(b, a)], v: stereoIn(m, k, rank) })
  }
  const mc: Mol = { ...kekulizeByRank(mk, aro, rank), stereo: canonStereo }
  return { rank, smiles: writeSmiles(mc, rank), symmetryClass: r0, mol: mc }
}

/** Канонический код (SMILES) скелета — одинаков для любых рисовок одной молекулы. */
export function canonicalCode(g: SkeletonGraph): string {
  return canonicalizeMol(toMol(g)).smiles
}

/** «Это та же молекула?» — сравнение по канонической форме (с учётом цис/транс). */
export function sameMolecule(a: SkeletonGraph, b: SkeletonGraph): boolean {
  return canonicalCode(a) === canonicalCode(b)
}

/** Тот же граф без учёта цис/транс (структурный изомер). */
export function sameConstitution(a: SkeletonGraph, b: SkeletonGraph): boolean {
  const strip = (g: SkeletonGraph): SkeletonGraph => ({ atoms: g.atoms, bonds: g.bonds.map((x) => ({ a: x.a, b: x.b, o: x.o })) })
  return canonicalCode(strip(a)) === canonicalCode(strip(b))
}
