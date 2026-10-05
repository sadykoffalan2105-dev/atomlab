/**
 * Органика v2 — проверка данных молекул (src/data/organicV2/molecules.json + molecules3d.json) и адаптера реестра.
 *   npx tsx scripts/validate-organic-v2.mts
 * Для всех 329 молекул реестра:
 *  - состав = исходному графу реестра (топология без раскладки) = разобранному полю formula = графу адаптера;
 *  - InChIKey уникальны (кроме честно одинаковых веществ под разными id — список ALLOWED_SAME);
 *  - длины связей и валентные углы по гибридизации (окна — ниже), нет «слипшихся» несвязанных атомов;
 *  - стереохимия: цис-кислоты и жиры — Z (и проверка двугранного угла по 3D), эталонные InChIKey сахаров,
 *    L-цистеина, D-глицеринового альдегида; метки CIP на месте;
 *  - адаптер: graph реестра = координаты v2 (id атомов `${el}_${n}`), метка ступени = organicGradeForMolecule.
 * Падает с кодом 1 при любой ошибке.
 */
import { readFileSync } from 'node:fs'
import { ORGANIC_BUILD_CHALLENGES } from '../src/data/researchLab/organicBuildCatalog'
import { TEXTBOOK_ORGANIC_SPECS } from '../src/data/organicLab/textbookOrganic.data'
import {
  applySkeletonBonds,
  autoBondKitHydrogens,
  compositionOf,
  createFormulaKit,
  type OrganicGraph,
} from '../src/chemistry/organic/organicGraph'
import { fructoseOpenGraph, glucosePyranoseGraph, sucroseSimplifiedGraph } from '../src/data/organicLab/geometries/carbGeometries'
import { triacetinGraph } from '../src/data/organicLab/geometries/fatGeometries'
import { ORGANIC_MOLECULES } from '../src/data/organicLab/organicMoleculeRegistry'
import { organicGradeForMolecule } from '../src/data/curriculum/compoundGradeIndex'
import type { OV2Molecule } from '../src/data/organicV2/types'

const MOLS = JSON.parse(readFileSync('src/data/organicV2/molecules.json', 'utf8')) as Record<string, OV2Molecule>
const errors: string[] = []
const fail = (s: string) => errors.push(s)

/** Честно одинаковые вещества под разными id (два входа в каталог на одну молекулу). */
const ALLOWED_SAME: readonly (readonly string[])[] = [
  ['fructose', 'fructose-open'], // «Фруктоза» (учебная открытая форма) = D-фруктоза открытая
  ['sucrose', 'sucrose-structure'], // ручной граф сахарозы заменён правильной молекулой
]

// ── 1. состав ──
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
function parseFormula(raw: string): Record<string, number> {
  const s = raw.replace(/[₀-₉]/g, (c) => SUB[c]!).replace(/[–\-=≡·\s]/g, '')
  let i = 0
  const group = (): Record<string, number> => {
    const c: Record<string, number> = {}
    const add = (e: string, n: number) => (c[e] = (c[e] ?? 0) + n)
    while (i < s.length) {
      const ch = s[i]!
      if (ch === '(' || ch === '[') {
        i++
        const inner = group()
        const m = /^\d+/.exec(s.slice(i))
        const k = m ? Number(m[0]) : 1
        i += m ? m[0].length : 0
        for (const [e, n] of Object.entries(inner)) add(e, n * k)
      } else if (ch === ')' || ch === ']') {
        i++
        return c
      } else {
        const m = /^([A-Z][a-z]?)(\d*)/.exec(s.slice(i))
        if (!m) {
          i++
          continue
        }
        add(m[1]!, Number(m[2] || 1))
        i += m[0].length
      }
    }
    return c
  }
  return group()
}
function hillComposition(f: string): Record<string, number> {
  const c: Record<string, number> = {}
  for (const m of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) c[m[1]!] = (c[m[1]!] ?? 0) + Number(m[2] || 1)
  return c
}
const compKey = (c: Record<string, number>) =>
  Object.entries(c)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([e, n]) => `${e}${n}`)
    .join('')

const legacy = new Map<string, OrganicGraph>()
for (const c of ORGANIC_BUILD_CHALLENGES) legacy.set(c.id, autoBondKitHydrogens(applySkeletonBonds(createFormulaKit(c.kit), c.skeleton)))
const extraGraphs: Record<string, () => OrganicGraph> = {
  'glucose-pyranose': glucosePyranoseGraph,
  fructose: fructoseOpenGraph,
  sucrose: sucroseSimplifiedGraph,
  triacetin: triacetinGraph,
}
for (const [id, f] of Object.entries(extraGraphs)) if (!legacy.has(id)) legacy.set(id, f())
for (const s of TEXTBOOK_ORGANIC_SPECS)
  if (!legacy.has(s.id)) legacy.set(s.id, autoBondKitHydrogens(applySkeletonBonds(createFormulaKit(s.kit), s.skeleton)))
/** Старый ручной граф сахарозы был сломан (C₁₁H₁₂O₁₁) — его состав сверять нельзя, только formula. */
const LEGACY_BROKEN = new Set(['sucrose'])

let nComp = 0
for (const m of ORGANIC_MOLECULES) {
  const v = MOLS[m.id]
  if (!v) {
    fail(`${m.id}: нет в molecules.json`)
    continue
  }
  const kv = compKey(hillComposition(v.formula))
  const kf = compKey(parseFormula(m.formula))
  if (kv !== kf) fail(`${m.id}: формула v2 ${v.formula} ≠ formula реестра ${m.formula}`)
  const lg = legacy.get(m.id)
  if (!lg) fail(`${m.id}: нет исходного графа`)
  else if (!LEGACY_BROKEN.has(m.id) && compKey(compositionOf(lg)) !== kv) fail(`${m.id}: состав исходного графа ≠ v2`)
  const ka = compKey(compositionOf(m.graph))
  if (ka !== kv) fail(`${m.id}: граф адаптера ${ka} ≠ v2 ${kv}`)
  const atomsComp: Record<string, number> = {}
  for (const a of v.atoms) atomsComp[a.el] = (atomsComp[a.el] ?? 0) + 1
  if (compKey(atomsComp) !== kv) fail(`${m.id}: атомы v2 ≠ формуле v2`)
  nComp++
}
if (Object.keys(MOLS).length !== ORGANIC_MOLECULES.length)
  fail(`molecules.json: ${Object.keys(MOLS).length} молекул, в реестре ${ORGANIC_MOLECULES.length}`)

// ── 2. InChIKey ──
const byKey = new Map<string, string[]>()
for (const v of Object.values(MOLS)) byKey.set(v.inchikey, [...(byKey.get(v.inchikey) ?? []), v.id])
const allowed = new Set(ALLOWED_SAME.map((g) => [...g].sort().join('|')))
const dups: string[][] = []
for (const ids of byKey.values())
  if (ids.length > 1) {
    dups.push(ids)
    if (!allowed.has([...ids].sort().join('|'))) fail(`одинаковый InChIKey: ${ids.join(', ')}`)
  }

// ── 3. геометрия ──
type V3 = readonly [number, number, number]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.sqrt(dot(a, a))
const angle = (a: V3, c: V3, b: V3) => (Math.acos(Math.max(-1, Math.min(1, dot(sub(a, c), sub(b, c)) / (len(sub(a, c)) * len(sub(b, c)))))) * 180) / Math.PI
function dihedral(p0: V3, p1: V3, p2: V3, p3: V3): number {
  const b0 = sub(p1, p0), b1 = sub(p2, p1), b2 = sub(p3, p2)
  const n1 = cross(b0, b1), n2 = cross(b1, b2)
  const m1 = cross(n1, [b1[0] / len(b1), b1[1] / len(b1), b1[2] / len(b1)])
  return (Math.atan2(dot(m1, n2), dot(n1, n2)) * 180) / Math.PI
}
const RCOV: Record<string, number> = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, S: 1.05, F: 0.57, Cl: 1.02, Br: 1.2, I: 1.39, P: 1.07 }

/**
 * Окна длин связей (Å): [имя, учебное окно (из задания), физический допуск]. Вне учебного окна — только отчёт с
 * причиной (напряжённые 3-циклы, стерически нагруженные C–C, связь C(sp)–H короче), вне допуска — ошибка.
 */
type Win = readonly [string, number, number, number, number]
function bondWindow(v: OV2Molecule, a: number, b: number, o: number, ar: boolean): Win | null {
  const A = v.atoms[a]!, B = v.atoms[b]!
  const els = [A.el, B.el].sort().join('')
  const hyb = [A.hyb, B.hyb].sort().join('-')
  if (els === 'CC') {
    if (ar) return ['C:C аром.', 1.37, 1.42, 1.36, 1.43]
    if (o === 3) return ['C≡C', 1.19, 1.22, 1.18, 1.23]
    if (o === 2) {
      const cumul = A.hyb === 'sp' || B.hyb === 'sp'
      return cumul ? ['C=C кумул.', 1.29, 1.34, 1.28, 1.35] : ['C=C', 1.32, 1.36, 1.31, 1.37]
    }
    if (hyb === 'sp3-sp3') return ['C–C sp³', 1.5, 1.56, 1.48, 1.6]
    return ['C–C сопряж.', 1.4, 1.53, 1.38, 1.56]
  }
  if (els === 'CH') return A.hyb === 'sp' || B.hyb === 'sp' ? ['C(sp)–H', 1.05, 1.08, 1.04, 1.09] : ['C–H', 1.08, 1.11, 1.07, 1.12]
  if (els === 'CO') {
    if (o === 2) return ['C=O', 1.2, 1.23, 1.19, 1.25]
    const c = A.el === 'C' ? A : B
    return c.hyb === 'sp3' ? ['C–O sp³', 1.4, 1.45, 1.38, 1.48] : ['C–O sp²', 1.32, 1.4, 1.3, 1.42]
  }
  if (els === 'HO') return ['O–H', 0.96, 0.99, 0.95, 1.0]
  if (els === 'HN') return ['N–H', 1.0, 1.03, 0.99, 1.04]
  if (els === 'CN') return o === 3 ? ['C≡N', 1.14, 1.17, 1.13, 1.18] : o === 2 || ar ? ['C=N', 1.32, 1.38, 1.3, 1.4] : ['C–N', 1.36, 1.5, 1.33, 1.52]
  return null
}

/** Отклонения от учебного окна (не ошибки): категория → число и худшие примеры. */
const soft = new Map<string, { n: number; worst: { d: number; at: string }[] }>()
function check(cat: string, x: number, w: readonly [number, number, number, number], at: string): void {
  if (x < w[2] - 1e-3 || x > w[3] + 1e-3) fail(`${at}: ${cat} ${x.toFixed(3)} вне допуска ${w[2]}–${w[3]}`)
  else if (x < w[0] - 1e-3 || x > w[1] + 1e-3) {
    const e = soft.get(cat) ?? { n: 0, worst: [] }
    e.n++
    e.worst.push({ d: Math.max(w[0] - x, x - w[1]), at: `${at} ${x.toFixed(x > 20 ? 1 : 3)}` })
    e.worst.sort((p, q) => q.d - p.d)
    e.worst.length = Math.min(e.worst.length, 3)
    soft.set(cat, e)
  }
}

const bondStats = new Map<string, { n: number; min: number; max: number }>()
const angStats = new Map<string, { n: number; min: number; max: number }>()
const stat = (m: Map<string, { n: number; min: number; max: number }>, k: string, x: number) => {
  const s = m.get(k) ?? { n: 0, min: Infinity, max: -Infinity }
  s.n++
  s.min = Math.min(s.min, x)
  s.max = Math.max(s.max, x)
  m.set(k, s)
}
let minClash = Infinity
let minClashAt = ''
let nAngles = 0
for (const v of Object.values(MOLS)) {
  const n = v.atoms.length
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const b of v.bonds) {
    adj[b.a]!.push(b.b)
    adj[b.b]!.push(b.a)
    const w = bondWindow(v, b.a, b.b, b.o, !!b.ar)
    const d = len(sub(v.atoms[b.a]!.p, v.atoms[b.b]!.p))
    if (!w) {
      stat(bondStats, `${[v.atoms[b.a]!.el, v.atoms[b.b]!.el].sort().join('')}:${b.o}`, d)
      const ref = (RCOV[v.atoms[b.a]!.el] ?? 1) + (RCOV[v.atoms[b.b]!.el] ?? 1)
      if (d < ref * 0.8 || d > ref * 1.2) fail(`${v.id}: связь ${v.atoms[b.a]!.el}${b.a}–${v.atoms[b.b]!.el}${b.b} ${d.toFixed(3)} Å`)
      continue
    }
    stat(bondStats, w[0], d)
    check(w[0], d, [w[1], w[2], w[3], w[4]], v.id)
  }
  const smallRing = new Set<string>()
  const ring5 = new Set<number>()
  for (const r of v.rings) {
    if (r.length <= 4) for (let i = 0; i < r.length; i++) for (let j = 0; j < r.length; j++) smallRing.add(`${r[i]}|${r[j]}`)
    if (r.length === 5) for (const i of r) ring5.add(i)
  }
  const ringSmall = new Set(v.rings.filter((r) => r.length <= 4).flat())
  for (let c = 0; c < n; c++) {
    const A = v.atoms[c]!
    const nb = adj[c]!
    if (A.el !== 'C' && A.el !== 'N' && A.el !== 'O') continue
    for (let i = 0; i < nb.length; i++)
      for (let j = i + 1; j < nb.length; j++) {
        const a = nb[i]!, b = nb[j]!
        if (smallRing.has(`${a}|${c}`) && smallRing.has(`${b}|${c}`) && smallRing.has(`${a}|${b}`)) continue // угол 3/4-цикла
        const x = angle(v.atoms[a]!.p, A.p, v.atoms[b]!.p)
        const at = `${v.id} ∠${v.atoms[a]!.el}${a}-${A.el}${c}-${v.atoms[b]!.el}${b}`
        nAngles++
        const in5 = ring5.has(c) && ring5.has(a) && ring5.has(b)
        if (A.el !== 'C') {
          stat(angStats, `${A.el} ${A.hyb}`, x)
          check(`угол ${A.el}`, x, [104, 125, 100, 132], at)
        } else if (A.hyb === 'sp3') {
          const cat = in5 ? 'C sp³ (5-цикл)' : ringSmall.has(c) ? 'C sp³ (у 3/4-цикла)' : 'C sp³'
          stat(angStats, cat, x)
          check(cat, x, in5 ? [100, 110, 98, 112] : ringSmall.has(c) ? [104, 122, 100, 125] : [104, 115, 100, 122], at)
        } else if (A.hyb === 'sp2') {
          const cat = in5 ? 'C sp² (5-цикл)' : 'C sp²'
          stat(angStats, cat, x)
          check(cat, x, in5 ? [104, 112, 102, 114] : [115, 125, 107, 132], at)
        } else if (A.hyb === 'sp') {
          stat(angStats, 'C sp', x)
          check('C sp', x, [175, 180, 170, 180], at)
        }
      }
  }
  // несвязанные атомы (через ≥ 3 связи): d ≥ 0,9·(R₁+R₂) + 0,5 Å
  const dist: number[][] = adj.map((_, s) => {
    const d = new Array<number>(n).fill(99)
    d[s] = 0
    const q = [s]
    while (q.length) {
      const x = q.shift()!
      if (d[x]! >= 3) continue
      for (const y of adj[x]!) if (d[y]! > d[x]! + 1) ((d[y] = d[x]! + 1), q.push(y))
    }
    return d
  })
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (dist[i]![j]! < 3) continue
      const d = len(sub(v.atoms[i]!.p, v.atoms[j]!.p))
      const lim = 0.9 * ((RCOV[v.atoms[i]!.el] ?? 1) + (RCOV[v.atoms[j]!.el] ?? 1)) + 0.5
      if (d / lim < minClash) ((minClash = d / lim), (minClashAt = `${v.id} ${v.atoms[i]!.el}${i}…${v.atoms[j]!.el}${j} ${d.toFixed(2)} Å`))
      if (d < lim) fail(`${v.id}: атомы ${v.atoms[i]!.el}${i} и ${v.atoms[j]!.el}${j} слишком близко (${d.toFixed(2)} Å)`)
    }
}

// ── 3б. 2D скелетной формулы: нет пересечений связей и слипшихся атомов (кроме клеток, которые на плоскости без
// пересечения не нарисовать) ──
const CAGES = new Set(['adamantane', 'hexamine'])
let n2d = 0
for (const v of Object.values(MOLS)) {
  const heavy = v.atoms.map((a, i) => (a.el === 'H' ? -1 : i)).filter((i) => i >= 0)
  const hb = v.bonds.filter((b) => v.atoms[b.a]!.el !== 'H' && v.atoms[b.b]!.el !== 'H')
  const bonded = new Set(hb.map((b) => `${Math.min(b.a, b.b)}|${Math.max(b.a, b.b)}`))
  const o = (a: readonly number[], b: readonly number[], c: readonly number[]) => (b[0]! - a[0]!) * (c[1]! - a[1]!) - (b[1]! - a[1]!) * (c[0]! - a[0]!)
  let issues = 0
  for (let x = 0; x < heavy.length; x++)
    for (let y = x + 1; y < heavy.length; y++) {
      const i = heavy[x]!, j = heavy[y]!
      if (bonded.has(`${i}|${j}`)) continue
      const p = v.atoms[i]!.p2, q = v.atoms[j]!.p2
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.5) issues++
    }
  for (let x = 0; x < hb.length; x++)
    for (let y = x + 1; y < hb.length; y++) {
      const e = hb[x]!, f = hb[y]!
      if (new Set([e.a, e.b, f.a, f.b]).size < 4) continue
      const [p1, p2, p3, p4] = [v.atoms[e.a]!.p2, v.atoms[e.b]!.p2, v.atoms[f.a]!.p2, v.atoms[f.b]!.p2]
      if (o(p3, p4, p1) * o(p3, p4, p2) < 0 && o(p1, p2, p3) * o(p1, p2, p4) < 0) issues++
    }
  if (issues && !CAGES.has(v.id)) fail(`${v.id}: 2D — ${issues} наложений/пересечений`)
  n2d++
}

// ── 4. стереохимия ──
const Z_IDS = ['palmitoleic-acid', 'oleic-acid', 'linoleic-acid', 'linolenic-acid', 'triolein', 'dioleoyl-stearoyl-glycerol', 'stearopalmitolein', 'cis-but-2-ene', 'cis-penta-1-3-diene']
const E_IDS = ['trans-but-2-ene', 'trans-penta-1-3-diene', 'cinnamyl-alcohol', 'beta-carotene']
const EXPECT_KEY: Record<string, string> = {
  'alpha-glucopyranose': 'WQZGKKKJIJFFOK-DVKNGEFBSA-N', // α-D-глюкопираноза
  'glucose-pyranose': 'WQZGKKKJIJFFOK-VFUOTHLCSA-N', // β-D-глюкопираноза
  sucrose: 'CZMRCDWAGMRECN-UGDNZRGBSA-N',
  'sucrose-structure': 'CZMRCDWAGMRECN-UGDNZRGBSA-N',
  cysteine: 'XUJNEKJLAYXESH-REOHCLBHSA-N', // L-цистеин
  glyceraldehyde: 'MNQZXJOMYWMBOU-VKHMYHEASA-N', // D-глицериновый альдегид
  fructofuranose: 'RFSUNEUAIZKAJO-ARQDHWQXSA-N', // β-D-фруктофураноза
  sorbitol: 'FBPFZTCFMRRESA-JGWLITMVSA-N', // D-сорбит
}
/** Ожидаемые наборы меток CIP (по возрастанию индекса не сверяем — только состав меток). */
const EXPECT_CIP: Record<string, string> = {
  cysteine: 'R', // L-цистеин — R (у S приоритет выше, чем у COOH)
  adrenaline: 'R',
  'malic-acid': 'S', // L-яблочная
  glyceraldehyde: 'R',
  'glucose-open': 'RRRS', // D-глюкоза (2R,3S,4R,5R)
  'gluconic-acid': 'RRRS',
  ribose: 'RRR', // D-рибоза (2R,3R,4R)
  'fructose-open': 'RRS', // D-фруктоза (3S,4R,5R)
  fructose: 'RRS',
  'alpha-glucopyranose': 'RRSSS', // α-D-Glcp: (2S,3R,4S,5S,6R)
  'glucose-pyranose': 'RRRSS', // β-D-Glcp: (2R,3R,4S,5S,6R)
}
const sortedCip = (v: OV2Molecule) => v.atoms.map((a) => a.cip ?? '').filter(Boolean).sort().join('')
let nDihedral = 0
for (const [ids, want] of [
  [Z_IDS, 'Z'],
  [E_IDS, 'E'],
] as const)
  for (const id of ids) {
    const v = MOLS[id]
    if (!v) {
      fail(`${id}: нет молекулы`)
      continue
    }
    const st = v.bonds.filter((b) => b.ez)
    if (!st.length || st.some((b) => b.ez !== want)) fail(`${id}: двойные связи ${st.map((b) => b.ez).join('')} ≠ ${want}`)
    for (const b of st) {
      const heavy = (c: number, other: number) =>
        v.bonds.flatMap((x) => (x.a === c ? [x.b] : x.b === c ? [x.a] : [])).filter((k) => k !== other && v.atoms[k]!.el !== 'H')
      const ha = heavy(b.a, b.b), hb = heavy(b.b, b.a)
      if (ha.length !== 1 || hb.length !== 1) continue
      const t = Math.abs(dihedral(v.atoms[ha[0]!]!.p, v.atoms[b.a]!.p, v.atoms[b.b]!.p, v.atoms[hb[0]!]!.p))
      nDihedral++
      if ((want === 'Z' && t > 20) || (want === 'E' && t < 160)) fail(`${id}: двугранный угол ${t.toFixed(0)}° не ${want}`)
    }
  }
for (const [id, key] of Object.entries(EXPECT_KEY)) if (MOLS[id]?.inchikey !== key) fail(`${id}: InChIKey ${MOLS[id]?.inchikey} ≠ ${key}`)
for (const [id, c] of Object.entries(EXPECT_CIP)) if (MOLS[id] && sortedCip(MOLS[id]!) !== c) fail(`${id}: CIP ${sortedCip(MOLS[id]!)} ≠ ${c}`)
// разные вещества, которые старый граф не различал
for (const [a, b] of [
  ['maltose', 'lactose'],
  ['amylose-fragment', 'cellulose-fragment'],
  ['alpha-glucopyranose', 'glucose-pyranose'],
  ['amylose-fragment', 'amylopectin-fragment'],
] as const)
  if (MOLS[a]?.inchikey === MOLS[b]?.inchikey) fail(`${a} и ${b} совпадают`)

// ── 5. адаптер реестра ──
let nAdapter = 0
for (const m of ORGANIC_MOLECULES) {
  const v = MOLS[m.id]
  if (!v) continue
  const g = m.graph
  if (g.atoms.length !== v.atoms.length || g.bonds.length !== v.bonds.length) {
    fail(`${m.id}: адаптер ${g.atoms.length}/${g.bonds.length} ≠ v2 ${v.atoms.length}/${v.bonds.length}`)
    continue
  }
  for (let i = 0; i < v.atoms.length; i++) {
    const a = g.atoms[i]!, w = v.atoms[i]!
    if (a.id !== `${w.el}_${i + 1}` || a.element !== w.el) fail(`${m.id}: id атома ${a.id}`)
    if (Math.max(...a.pos.map((x, k) => Math.abs(x - w.p[k]!))) > 0.006) fail(`${m.id}: координаты атома ${i} не из v2`)
  }
  if (g !== m.graph) fail(`${m.id}: граф не кэшируется`)
  if (m.grade !== organicGradeForMolecule(m.id, m.classId)) fail(`${m.id}: ступень ${m.grade} ≠ organicGradeForMolecule`)
  if (!m.functionalGroups) fail(`${m.id}: нет функциональных групп`)
  nAdapter++
}

const fmt = (m: Map<string, { n: number; min: number; max: number }>) =>
  [...m].map(([k, s]) => `  ${k.padEnd(16)} n=${String(s.n).padStart(5)}  ${s.min.toFixed(3)}…${s.max.toFixed(3)}`).join('\n')
console.log(`молекул: ${Object.keys(MOLS).length}; состав сверен: ${nComp}; адаптер: ${nAdapter}`)
console.log('длины связей, Å:\n' + fmt(bondStats))
console.log(`углы (${nAngles}), °:\n` + fmt(angStats))
console.log(
  'вне учебного окна (в физическом допуске — не ошибка):\n' +
    [...soft].map(([k, e]) => `  ${k.padEnd(20)} ${String(e.n).padStart(4)}  напр. ${e.worst.map((w) => w.at).join('; ')}`).join('\n'),
)
console.log(`ближайшие несвязанные: ${minClash.toFixed(2)}× порога (${minClashAt})`)
console.log(`одинаковые InChIKey (разрешены): ${dups.map((d) => d.join('=')).join('; ') || 'нет'}`)
console.log(`двугранные углы цис/транс проверены: ${nDihedral}; 2D без наложений: ${n2d} (клетки адамантан/уротропин — 1 пересечение)`)
if (errors.length) {
  console.log(`\nОШИБКИ (${errors.length}):\n` + errors.slice(0, 80).join('\n'))
  process.exit(1)
}
console.log('OK — все проверки органики v2 зелёные')
