/**
 * Конструктор органики v2 — живой разбор рисунка и проверка заданий (чистый TS, без React).
 * Всё считает движок src/chemistry/organicV2: H по валентности, формула, класс, название ИЮПАК, степень C,
 * каноническая форма (одинаковая для любых рисовок одной молекулы).
 */
import type { OV2Molecule } from '../../../data/organicV2/types'
import {
  CLASS_LABELS, alcoholEtherIsomers, alkaneIsomers, alkeneIsomers, canonicalizeMol, carbonDegrees, checkValence,
  classifyMolecule, hillFormula, matchKeys, matchRegistry, nameMol, semiStructuralFormula, skeletonFromOV2,
  subscriptDigits, toMol, type IsomerEntry, type Mol, type OrganicClassKey, type RegistryIndex, type SkeletonGraph,
  type ValenceIssue,
} from '../../../chemistry/organicV2'
import type { OV2Lang } from '../contracts'

export interface Analysis {
  readonly empty: boolean
  readonly mol: Mol
  /** число H у каждого атома графа (индекс графа) */
  readonly hCount: readonly number[]
  readonly formula: string
  readonly formulaPretty: string
  readonly semi: string
  readonly semiExact: boolean
  readonly classKey: OrganicClassKey
  readonly classLabel: { ru: string; en: string; uz: string }
  /** название (null — считается в фоне: у больших молекул намер долгий, см. nameOf) */
  readonly name: NameSet | null
  readonly issues: readonly ValenceIssue[]
  /** степень C по индексу графа (−1 — не C) */
  readonly degrees: readonly number[]
  readonly code: string
  readonly constitution: string
  /** несколько отдельных молекул на холсте */
  readonly fragments: number
  readonly match: { id: string; exact: boolean } | null
}

function fragmentsOf(g: SkeletonGraph): number {
  const p = g.atoms.map((_, i) => i)
  const f = (x: number): number => (p[x] === x ? x : (p[x] = f(p[x])))
  for (const b of g.bonds) p[f(b.a)] = f(b.b)
  return new Set(g.atoms.map((_, i) => f(i))).size
}

export interface NameSet {
  readonly ru: string
  readonly en: string
  readonly uz: string
  readonly synonymsRu: readonly string[]
  readonly synonymsEn: readonly string[]
  readonly synonymsUz: readonly string[]
  readonly systematic: boolean
}

/** До скольких тяжёлых атомов название считается сразу (дальше — в фоне, в воркере). */
export const SYNC_NAME_LIMIT = 16

const nameCache = new Map<string, NameSet>()
/** Название по ИЮПАК (RU/EN/UZ) для канонической молекулы; кэш по коду. */
export function nameOf(mol: Mol, code?: string): NameSet {
  const key = code ?? canonicalizeMol(mol).smiles
  const hit = nameCache.get(key)
  if (hit) return hit
  const nm = nameMol(canonicalizeMol(mol).mol)
  const r: NameSet = { ru: nm.ru, en: nm.en, uz: nm.uz, synonymsRu: nm.synonymsRu, synonymsEn: nm.synonymsEn, synonymsUz: nm.synonymsUz, systematic: nm.systematic }
  if (nameCache.size > 300) nameCache.clear()
  nameCache.set(key, r)
  return r
}
export const cachedName = (code: string): NameSet | undefined => nameCache.get(code)
export const rememberName = (code: string, n: NameSet): void => { nameCache.set(code, n) }

export function analyze(g: SkeletonGraph, index: RegistryIndex | null, opts: { name?: 'auto' | 'always' | 'never' } = {}): Analysis {
  const mol = toMol(g)
  const empty = g.atoms.length === 0
  const issues = checkValence(g)
  const hCount = g.atoms.map(() => 0)
  mol.src.forEach((i, k) => { hCount[i] = mol.hc[k] })
  if (empty) {
    return {
      empty, mol, hCount, formula: '', formulaPretty: '', semi: '', semiExact: true, classKey: 'other', classLabel: CLASS_LABELS.other,
      name: null, issues, degrees: [], code: '', constitution: '', fragments: 0, match: null,
    }
  }
  const canon = canonicalizeMol(mol)
  const keys = matchKeys(g)
  const formula = hillFormula(mol)
  const semi = semiStructuralFormula(canon.mol)
  const classKey = classifyMolecule(mol)
  const mode = opts.name ?? 'auto'
  const nm = mode === 'always' || (mode === 'auto' && mol.n <= SYNC_NAME_LIMIT) ? nameOf(mol, keys.exact) : cachedName(keys.exact) ?? null
  const degM = carbonDegrees(mol)
  const degrees = g.atoms.map(() => -1)
  mol.src.forEach((i, k) => { degrees[i] = degM[k] })
  return {
    empty, mol, hCount, formula, formulaPretty: subscriptDigits(formula), semi: semi.text, semiExact: semi.exact,
    classKey, classLabel: CLASS_LABELS[classKey],
    name: nm,
    issues, degrees, code: keys.exact, constitution: keys.constitution, fragments: fragmentsOf(g),
    match: index ? matchRegistry(g, index) : null,
  }
}

export const pickLang = <T,>(o: { ru: T; en: T; uz: T }, L: OV2Lang): T => o[L]

// ───────────────────────── задание «собери» ─────────────────────────

export interface Target {
  readonly id: string
  readonly graph: SkeletonGraph
  readonly code: string
  readonly constitution: string
  /** цис/транс важен (код с ним отличается от кода без него) */
  readonly stereo: boolean
  readonly name: { ru: string; en: string; uz: string }
  readonly formula: string
  readonly semi: string
}

export function makeTarget(mol: OV2Molecule): Target {
  const graph = skeletonFromOV2(mol)
  const k = matchKeys(graph)
  const m = canonicalizeMol(toMol(graph)).mol
  const nm = nameMol(m)
  return {
    id: mol.id, graph, code: k.exact, constitution: k.constitution, stereo: k.exact !== k.constitution,
    name: { ru: nm.ru, en: nm.en, uz: nm.uz }, formula: subscriptDigits(hillFormula(m)), semi: semiStructuralFormula(m).text,
  }
}

const countEl = (m: Mol, el: string) => m.el.filter((e) => e === el).length
function bondStats(m: Mol): { double: number; triple: number } {
  let d = 0, t = 0
  m.adj.forEach((l, i) => l.forEach((e) => { if (e.to > i) { if (e.o === 2) d++; if (e.o === 3) t++ } }))
  return { double: d, triple: t }
}
function cycles(m: Mol): number {
  let e = 0
  for (const l of m.adj) e += l.length
  return e / 2 - m.n + 1
}
/** Самая длинная цепь из атомов C (по дереву/графу — перебором от каждого C, n ≤ 60). */
export function longestCarbonChain(m: Mol): number {
  let best = 0
  const isC = (i: number) => m.el[i] === 'C'
  const dfs = (v: number, seen: Set<number>, len: number) => {
    best = Math.max(best, len)
    if (best >= 40) return
    for (const e of m.adj[v]) if (isC(e.to) && !seen.has(e.to)) { seen.add(e.to); dfs(e.to, seen, len + 1); seen.delete(e.to) }
  }
  for (let i = 0; i < m.n; i++) if (isC(i)) dfs(i, new Set([i]), 1)
  return best
}

export type BuildVerdict =
  | { kind: 'empty' }
  | { kind: 'solved' }
  | { kind: 'hint'; key: HintKey; args?: Record<string, string | number> }

export type HintKey =
  | 'valence' | 'fragments' | 'carbonMore' | 'carbonLess' | 'heteroMissing' | 'heteroExtra'
  | 'extraMultiple' | 'missingMultiple' | 'tripleVsDouble' | 'ringMissing' | 'ringExtra'
  | 'chainLonger' | 'chainShorter' | 'position' | 'stereo'

/** Проверка «собери»: решено или первая понятная подсказка, что не так. */
export function judgeBuild(a: Analysis, t: Target): BuildVerdict {
  if (a.empty) return { kind: 'empty' }
  if (t.stereo ? a.code === t.code : a.constitution === t.constitution) return { kind: 'solved' }
  if (a.issues.length) return { kind: 'hint', key: 'valence', args: { atom: a.issues[0].label } }
  if (a.fragments > 1) return { kind: 'hint', key: 'fragments' }
  const tm = toMol(t.graph)
  const m = a.mol
  const cT = countEl(tm, 'C'), cA = countEl(m, 'C')
  if (cA < cT) return { kind: 'hint', key: 'carbonMore', args: { have: cA, need: cT } }
  if (cA > cT) return { kind: 'hint', key: 'carbonLess', args: { have: cA, need: cT } }
  for (const el of ['O', 'N', 'S', 'Cl', 'Br', 'I', 'F']) {
    const x = countEl(tm, el), y = countEl(m, el)
    if (y < x) return { kind: 'hint', key: 'heteroMissing', args: { el, n: x - y } }
    if (y > x) return { kind: 'hint', key: 'heteroExtra', args: { el, n: y - x } }
  }
  const rT = cycles(tm), rA = cycles(m)
  if (rA < rT) return { kind: 'hint', key: 'ringMissing' }
  if (rA > rT) return { kind: 'hint', key: 'ringExtra' }
  const bT = bondStats(tm), bA = bondStats(m)
  if (bA.triple !== bT.triple && bA.double + 2 * bA.triple === bT.double + 2 * bT.triple) return { kind: 'hint', key: 'tripleVsDouble' }
  if (bA.double + bA.triple > bT.double + bT.triple) return { kind: 'hint', key: 'extraMultiple' }
  if (bA.double + bA.triple < bT.double + bT.triple) return { kind: 'hint', key: 'missingMultiple' }
  if (t.stereo && a.constitution === t.constitution) return { kind: 'hint', key: 'stereo' }
  const lT = longestCarbonChain(tm), lA = longestCarbonChain(m)
  if (lA < lT) return { kind: 'hint', key: 'chainLonger', args: { have: lA, need: lT } }
  if (lA > lT) return { kind: 'hint', key: 'chainShorter', args: { have: lA, need: lT } }
  return { kind: 'hint', key: 'position' }
}

// ───────────────────────── задание «изомеры» ─────────────────────────

/** "C₆H₁₄" / "C6H14" → { C: 6, H: 14 } */
export function parseFormula(f: string): Record<string, number> {
  const s = f.replace(/[₀-₉]/g, (d) => String('₀₁₂₃₄₅₆₇₈₉'.indexOf(d)))
  const out: Record<string, number> = {}
  for (const m of s.matchAll(/([A-Z][a-z]?)(\d*)/g)) out[m[1]] = (out[m[1]] ?? 0) + (m[2] ? +m[2] : 1)
  return out
}

export interface IsomerSet {
  readonly formula: string
  /** главный класс (алканы, алкены, спирты) */
  readonly main: readonly IsomerEntry[]
  /** межклассовые (циклоалканы, простые эфиры) */
  readonly inter: readonly IsomerEntry[]
}

/** Перечень изомеров из движка; если движок формулу не умеет — по id реестра (`expected`). */
export function isomerSet(formula: string, expected: readonly string[] | undefined, molecules: Readonly<Record<string, OV2Molecule>>): IsomerSet {
  const f = parseFormula(formula)
  const keys = Object.keys(f).sort().join(',')
  const C = f.C ?? 0, H = f.H ?? 0
  const pretty = subscriptDigits(Object.entries(f).map(([e, n]) => e + (n > 1 ? n : '')).join(''))
  let list: IsomerEntry[] = []
  if (keys === 'C,H' && H === 2 * C + 2) list = alkaneIsomers(C)
  else if (keys === 'C,H' && H === 2 * C) list = alkeneIsomers(C, { cisTrans: false })
  else if (keys === 'C,H,O' && f.O === 1 && H === 2 * C + 2) list = alcoholEtherIsomers(C)
  if (!list.length && expected?.length) {
    list = expected.flatMap((id) => {
      const m = molecules[id]
      if (!m) return []
      const g = skeletonFromOV2(m)
      const k = matchKeys(g)
      return [{ code: k.exact, constitution: k.constitution, graph: g, kind: 'alkane' as const }]
    })
  }
  const inter = list.filter((e) => e.kind === 'cycloalkane' || e.kind === 'ether')
  const main = list.filter((e) => !inter.includes(e))
  return { formula: pretty, main, inter }
}

export type IsomerVerdict =
  | { kind: 'new'; entry: IsomerEntry; inter: boolean }
  | { kind: 'duplicate'; of: string }
  | { kind: 'wrongFormula'; have: string; need: string }
  | { kind: 'notInList' }
  | { kind: 'invalid' }

/** Нарисованное в задании «изомеры»: новый / повтор (тот же, нарисован иначе) / не та формула. */
export function judgeIsomer(a: Analysis, set: IsomerSet, found: readonly string[]): IsomerVerdict {
  if (a.empty || a.issues.length || a.fragments > 1) return { kind: 'invalid' }
  const need = set.formula
  if (a.formulaPretty !== need) return { kind: 'wrongFormula', have: a.formulaPretty, need }
  const all = [...set.main, ...set.inter]
  const e = all.find((x) => x.constitution === a.constitution)
  if (!e) return { kind: 'notInList' }
  if (found.includes(e.constitution)) return { kind: 'duplicate', of: e.constitution }
  return { kind: 'new', entry: e, inter: set.inter.includes(e) }
}

/** Название изомера из перечня. */
export function entryName(e: IsomerEntry, L: OV2Lang): string {
  const nm = nameMol(canonicalizeMol(toMol(e.graph)).mol)
  return L === 'ru' ? nm.ru : L === 'en' ? nm.en : nm.uz
}
