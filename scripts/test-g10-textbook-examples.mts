/**
 * Школьные примеры Kimyo 10, гл. I–II (docs/textbook/g10-ch1-2-organic-examples.md) в органической лаборатории.
 *  1) каждая молекула спецификации есть; её формула по скелету (C/гетероатомы + H по валентности) = формула учебника;
 *     3D-граф совпадает со скелетом, длина главной цепи / размер кольца — как в названии;
 *  2) все уравнения уроков уравнены (атомы и заряд; «n» и «ₙ» — расчёт на одно звено);
 *  3) уроки ссылаются только на существующие молекулы, уравнения, задания изомеров и квизы;
 *  4) изомеры: C₇H₁₆ — 9 разных, C₇H₁₆ с цепью C₅ — 5, C₄H₈ с кольцом — 2, C₅H₁₀ с кольцом — 5;
 *  5) изооктан: 5 первичных, 1 вторичный, 1 третичный, 1 четвертичный C.
 * Запуск: npx tsx scripts/test-g10-textbook-examples.mts
 */
import {
  canonicalizeSkeleton,
  graphFromSkeletonSpec,
  isValenceOk,
  stripHydrogens,
  type OrganicGraph,
} from '../src/chemistry/organic/organicGraph.ts'
import { ORGANIC_CURRICULUM_BY_ID, ORGANIC_CURRICULUM } from '../src/data/organicLab/organicCurriculum.ts'
import { organicMoleculeById } from '../src/data/organicLab/organicMoleculeRegistry.ts'
import { NOMENCLATURE_QUIZ_BY_ID } from '../src/data/organicLab/organicNomenclatureQuizzes.ts'
import {
  ORGANIC_BUILD_CHALLENGES,
  organicBuildChallengeById,
  type OrganicBuildChallenge,
} from '../src/data/researchLab/organicBuildCatalog.ts'
import { G10_G11_EDU_EQUATIONS, type GradeEq } from '../src/data/researchLab/g10g11Equations.ts'
import { ISOMER_CHALLENGES } from '../src/data/researchLab/researchLabData.ts'

const errors: string[] = []
const fail = (m: string) => {
  errors.push(m)
  console.error('FAIL', m)
}
let checks = 0

// ── формулы ───────────────────────────────────────────────
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
function plainDigits(s: string): string {
  return s
    .replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)))
    .replace(/ₙ/g, '')
}

type Counts = Record<string, number>
function add(into: Counts, from: Counts, k = 1) {
  for (const [el, n] of Object.entries(from)) into[el] = (into[el] ?? 0) + n * k
}

/** Брутто-формула из записи (скобки, связи –=≡, радикал •); null — не формула (слово, «жир» …). */
function parseFormula(raw: string): { counts: Counts; charge: number } | null {
  let s = raw.trim()
  let charge = 0
  const ch = s.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/)
  if (ch) {
    const mag = ch[1] ? Number([...ch[1]].map((c) => SUP.indexOf(c)).join('')) : 1
    charge = ch[2] === '⁺' ? mag : -mag
    s = s.slice(0, s.length - ch[0].length)
  }
  s = plainDigits(s).replace(/[–=≡•↓↑\s-]/g, '')
  if (!s || /[^A-Za-z0-9()]/.test(s)) return null
  let i = 0
  const group = (): Counts | null => {
    const out: Counts = {}
    while (i < s.length && s[i] !== ')') {
      let part: Counts | null
      if (s[i] === '(') {
        i += 1
        part = group()
        if (!part || s[i] !== ')') return null
        i += 1
      } else {
        const m = s.slice(i).match(/^[A-Z][a-z]?/)
        if (!m) return null
        i += m[0].length
        part = { [m[0]]: 1 }
      }
      const num = s.slice(i).match(/^\d+/)
      const k = num ? Number(num[0]) : 1
      if (num) i += num[0].length
      add(out, part, k)
    }
    return out
  }
  const counts = group()
  if (!counts || i !== s.length) return null
  return { counts, charge }
}

/** Токен уравнения: коэффициент (цифры и/или n) + формула. */
function parseToken(tok: string): { counts: Counts; charge: number } | null {
  const m = tok.trim().match(/^(\d*)(n?)(.*)$/)
  if (!m) return null
  const k = m[1] ? Number(m[1]) : 1
  const body = parseFormula(m[3]!)
  if (!body) return null
  const counts: Counts = {}
  add(counts, body.counts, k)
  return { counts, charge: body.charge * k }
}

function sideSum(tokens: readonly string[]): { counts: Counts; charge: number } | null {
  const counts: Counts = {}
  let charge = 0
  for (const t of tokens) {
    const p = parseToken(t)
    if (!p) return null
    add(counts, p.counts)
    charge += p.charge
  }
  return { counts, charge }
}

function sameCounts(a: Counts, b: Counts): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false
  return true
}

const fmt = (c: Counts) =>
  Object.entries(c)
    .filter(([, n]) => n)
    .sort(([a], [b]) => (a === 'C' ? -1 : b === 'C' ? 1 : a === 'H' ? -1 : b === 'H' ? 1 : a.localeCompare(b)))
    .map(([el, n]) => el + (n > 1 ? n : ''))
    .join('')

// ── скелет → брутто ───────────────────────────────────────
const VALENCE: Record<string, number> = { C: 4, O: 2, N: 3, S: 2, Cl: 1, Br: 1 }
function skeletonCounts(c: OrganicBuildChallenge): Counts {
  const out: Counts = {}
  const used = c.skeleton.elements.map(() => 0)
  for (const e of c.skeleton.edges) {
    const o = e[2] ?? 1
    used[e[0]]! += o
    used[e[1]]! += o
  }
  let h = 0
  c.skeleton.elements.forEach((el, i) => {
    out[el] = (out[el] ?? 0) + 1
    const free = (VALENCE[el] ?? 0) - used[i]!
    if (free < 0) fail(`${c.id}: атом ${el}#${i} перегружен (${used[i]} связей)`)
    h += Math.max(0, free)
  })
  if (h) out.H = h
  return out
}

function graphCounts(g: OrganicGraph): Counts {
  const out: Counts = {}
  for (const a of g.atoms) out[a.element] = (out[a.element] ?? 0) + 1
  return out
}

/** Самая длинная цепь атомов C (простой путь) и размер кольца (0 — колец нет). */
function carbonTopology(g: OrganicGraph): { longest: number; ring: number; degrees: number[] } {
  const cs = g.atoms.filter((a) => a.element === 'C').map((a) => a.id)
  const set = new Set(cs)
  const adj = new Map<string, string[]>(cs.map((id) => [id, []]))
  for (const b of g.bonds) {
    if (set.has(b.a) && set.has(b.b)) {
      adj.get(b.a)!.push(b.b)
      adj.get(b.b)!.push(b.a)
    }
  }
  let longest = 0
  let ring = 0
  const dfs = (start: string, cur: string, seen: Set<string>) => {
    longest = Math.max(longest, seen.size)
    for (const nx of adj.get(cur)!) {
      if (nx === start && seen.size >= 3) ring = Math.max(ring, seen.size)
      if (seen.has(nx)) continue
      seen.add(nx)
      dfs(start, nx, seen)
      seen.delete(nx)
    }
  }
  for (const id of cs) dfs(id, id, new Set([id]))
  const degrees = cs.map((id) => adj.get(id)!.length)
  return { longest, ring, degrees }
}

/** Правдоподобие 3D: длины связей, отсутствие наложений, углы у sp³-углерода вне малых колец. */
function geometryIssues(g: OrganicGraph, ring: number): string | null {
  const pos = new Map(g.atoms.map((a) => [a.id, a.pos]))
  const dist = (x: string, y: string) => {
    const A = pos.get(x)!
    const B = pos.get(y)!
    return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])
  }
  for (const b of g.bonds) {
    const d = dist(b.a, b.b)
    if (d < 0.9 || d > 2.05) return `связь ${d.toFixed(2)} Å`
  }
  const bonded = new Set(g.bonds.map((b) => [b.a, b.b].sort().join('|')))
  for (let i = 0; i < g.atoms.length; i++)
    for (let j = i + 1; j < g.atoms.length; j++) {
      const A = g.atoms[i]!
      const B = g.atoms[j]!
      if (bonded.has([A.id, B.id].sort().join('|'))) continue
      const d = dist(A.id, B.id)
      if (d < 1.5) return `атомы ${A.element} и ${B.element} ближе 1.5 Å (${d.toFixed(2)})`
    }
  if (ring === 0 || ring >= 6) {
    for (const c of g.atoms.filter((a) => a.element === 'C')) {
      const ns = g.bonds.filter((b) => b.a === c.id || b.b === c.id)
      if (ns.length !== 4 || ns.some((b) => b.order !== 1)) continue
      const others = ns.map((b) => (b.a === c.id ? b.b : b.a))
      for (let x = 0; x < 4; x++)
        for (let y = x + 1; y < 4; y++) {
          const P = pos.get(c.id)!
          const A = pos.get(others[x]!)!
          const B = pos.get(others[y]!)!
          const va = [A[0] - P[0], A[1] - P[1], A[2] - P[2]]
          const vb = [B[0] - P[0], B[1] - P[1], B[2] - P[2]]
          const cos = (va[0]! * vb[0]! + va[1]! * vb[1]! + va[2]! * vb[2]!) / (Math.hypot(...va) * Math.hypot(...vb))
          const deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
          if (deg < 98 || deg > 122) return `угол у sp³-C ${deg.toFixed(0)}°`
        }
    }
  }
  return null
}

// ── 1. Молекулы спецификации ─────────────────────────────
type Expect = { f: string; chain?: number; ring?: number }
const SPEC_MOLECULES: Record<string, Expect> = {
  // § 1.6
  chloroethane: { f: 'C2H5Cl' },
  '1-2-dichloroethane': { f: 'C2H4Cl2' },
  propene: { f: 'C3H6' },
  acetaldehyde: { f: 'C2H4O' },
  '3-hydroxybutanal': { f: 'C4H8O2', chain: 4 },
  'terephthalic-acid': { f: 'C8H6O4', ring: 6 },
  'ethylene-glycol': { f: 'C2H6O2' },
  // § 1.7–1.8
  '2-methylpentane': { f: 'C6H14', chain: 5 },
  '2-2-dimethylbutane': { f: 'C6H14', chain: 4 },
  '2-3-dimethylbutane': { f: 'C6H14', chain: 4 },
  cysteine: { f: 'C3H7NO2S', chain: 3 },
  'propanoic-acid': { f: 'C3H6O2', chain: 3 },
  isobutane: { f: 'C4H10', chain: 3 },
  isobutylene: { f: 'C4H8', chain: 3 },
  'butan-2-ol': { f: 'C4H10O', chain: 4 },
  butadiene: { f: 'C4H6', chain: 4 },
  butanone: { f: 'C4H8O', chain: 4 },
  '4-bromomethylheptane': { f: 'C8H17Br', chain: 7 },
  // § 2.2
  'n-butane': { f: 'C4H10', chain: 4 },
  'n-pentane': { f: 'C5H12', chain: 5 },
  isopentane: { f: 'C5H12', chain: 4 },
  neopentane: { f: 'C5H12', chain: 3 },
  isooctane: { f: 'C8H18', chain: 5 },
  '2-methylhexane': { f: 'C7H16', chain: 6 },
  '3-methyl-4-ethylhexane': { f: 'C9H20', chain: 6 },
  '2-3-5-trimethylhexane': { f: 'C9H20', chain: 6 },
  'n-heptane': { f: 'C7H16', chain: 7 },
  '3-methylhexane': { f: 'C7H16', chain: 6 },
  '2-2-dimethylpentane': { f: 'C7H16', chain: 5 },
  '2-3-dimethylpentane': { f: 'C7H16', chain: 5 },
  '2-4-dimethylpentane': { f: 'C7H16', chain: 5 },
  '3-3-dimethylpentane': { f: 'C7H16', chain: 5 },
  '3-ethylpentane': { f: 'C7H16', chain: 5 },
  '2-2-3-trimethylbutane': { f: 'C7H16', chain: 4 },
  // § 2.4
  chloromethane: { f: 'CH3Cl' },
  dichloromethane: { f: 'CH2Cl2' },
  chloroform: { f: 'CHCl3' },
  tetrachloromethane: { f: 'CCl4' },
  '2-3-dimethylbut-2-ene': { f: 'C6H12', chain: 4 },
  // § 2.5–2.6
  methylcyclopropane: { f: 'C4H8', ring: 3 },
  '1-2-dimethylcyclobutane': { f: 'C6H12', ring: 4 },
  '1-methyl-3-ethylcyclopentane': { f: 'C8H16', ring: 5 },
  cyclobutane: { f: 'C4H8', ring: 4 },
  cyclopentane: { f: 'C5H10', ring: 5 },
  methylcyclobutane: { f: 'C5H10', ring: 4 },
  '1-1-dimethylcyclopropane': { f: 'C5H10', ring: 3 },
  '1-2-dimethylcyclopropane': { f: 'C5H10', ring: 3 },
  ethylcyclopropane: { f: 'C5H10', ring: 3 },
  '1-5-dibromopentane': { f: 'C5H10Br2', chain: 5 },
  benzene: { f: 'C6H6', ring: 6 },
  cyclohexane: { f: 'C6H12', ring: 6 },
  cyclopropane: { f: 'C3H6', ring: 3 },
  chlorocyclohexane: { f: 'C6H11Cl', ring: 6 },
}

for (const [id, exp] of Object.entries(SPEC_MOLECULES)) {
  checks += 1
  const c = organicBuildChallengeById(id)
  const mol = organicMoleculeById[id]
  if (!c || !mol) {
    fail(`молекула ${id} отсутствует (каталог: ${Boolean(c)}, реестр: ${Boolean(mol)})`)
    continue
  }
  const want = parseFormula(exp.f)!.counts
  const bySkeleton = skeletonCounts(c)
  if (!sameCounts(bySkeleton, want)) fail(`${id}: по скелету ${fmt(bySkeleton)}, в учебнике ${exp.f}`)
  const shown = parseFormula(c.formula)
  if (!shown || !sameCounts(shown.counts, want)) fail(`${id}: formula «${c.formula}» ≠ ${exp.f}`)
  const kit: Counts = {}
  for (const [el, n] of Object.entries(c.kit)) if (n) kit[el] = n
  if (!sameCounts(kit, want)) fail(`${id}: kit ${fmt(kit)} ≠ ${exp.f}`)
  const g = mol.graph
  if (!sameCounts(graphCounts(g), want)) fail(`${id}: 3D-граф ${fmt(graphCounts(g))} ≠ ${exp.f}`)
  if (!isValenceOk(g)) fail(`${id}: 3D-граф — ошибка валентности`)
  if (canonicalizeSkeleton(stripHydrogens(g)) !== canonicalizeSkeleton(graphFromSkeletonSpec(c.skeleton))) {
    fail(`${id}: 3D-граф не совпадает со скелетом`)
  }
  const topo = carbonTopology(g)
  if (exp.chain != null && topo.longest !== exp.chain) fail(`${id}: главная цепь ${topo.longest} C, ждали ${exp.chain}`)
  if (exp.ring != null && topo.ring !== exp.ring) fail(`${id}: кольцо ${topo.ring} C, ждали ${exp.ring}`)
  const geo = geometryIssues(g, topo.ring)
  if (geo) fail(`${id}: 3D-геометрия — ${geo}`)
  if (!c.hintRu.trim() || !c.hintEn.trim() || !c.hintUz.trim()) fail(`${id}: нет подсказки RU/EN/UZ`)
  if (!c.titleEn.trim() || !c.titleUz.trim()) fail(`${id}: нет названия EN/UZ`)
}

// IUPAC там, где учебник расходится
const IUPAC_IN_TEXT: Record<string, RegExp> = {
  '3-methyl-4-ethylhexane': /4-Этил-3-метилгексан/,
  '1-methyl-3-ethylcyclopentane': /1-Этил-3-метилциклопентан/,
  isooctane: /2,2,4-триметилпентан/,
  'terephthalic-acid': /бензол-1,4-дикарбоновая/,
  'ethylene-glycol': /этан-1,2-диол/,
  cysteine: /2-амино-3-сульфанилпропановая/,
  isobutylene: /2-метилпроп-1-ен/,
  'butan-2-ol': /бутан-2-ол/,
  butadiene: /бута-1,3-диен/,
  butanone: /бутан-2-он/,
}
for (const [id, re] of Object.entries(IUPAC_IN_TEXT)) {
  checks += 1
  const c = organicBuildChallengeById(id)
  if (!c || !re.test(`${c.titleRu} ${c.hintRu}`)) fail(`${id}: нет IUPAC-варианта ${re}`)
}

// Регрессия: 3D-граф каждой молекулы каталога = её скелет (эталоны с O/N раньше собирались не по элементам)
for (const c of ORGANIC_BUILD_CHALLENGES) {
  checks += 1
  const mol = organicMoleculeById[c.id]
  if (!mol) continue
  if (canonicalizeSkeleton(stripHydrogens(mol.graph)) !== canonicalizeSkeleton(graphFromSkeletonSpec(c.skeleton))) {
    fail(`каталог ${c.id}: 3D-граф не совпадает со скелетом`)
  }
}

// ── 5. Изооктан: типы атомов C ───────────────────────────
{
  checks += 1
  const g = organicMoleculeById['isooctane']?.graph
  const deg = g ? carbonTopology(g).degrees : []
  const count = (d: number) => deg.filter((x) => x === d).length
  if (count(1) !== 5 || count(2) !== 1 || count(3) !== 1 || count(4) !== 1) {
    fail(`изооктан: типы C ${[1, 2, 3, 4].map(count).join('/')} — ждали 5/1/1/1`)
  }
  if (!organicMoleculeById['isooctane']?.viewHints?.carbonDegrees) fail('изооктан: не включена подсветка типов C')
}

// ── 2–3. Уроки: ссылки и уравненность ────────────────────
const SPEC_LESSONS = ['intro-structure', 'reaction-types', 'isomers', 'nomenclature', 'alkanes', 'cycloalkanes']
const eqById = new Map(G10_G11_EDU_EQUATIONS.map((e) => [e.id, e]))
const isoById = new Map(ISOMER_CHALLENGES.map((c) => [c.id, c]))
for (const id of SPEC_LESSONS) {
  checks += 1
  if (!ORGANIC_CURRICULUM_BY_ID[id]) fail(`нет урока ${id}`)
}
const order = ORGANIC_CURRICULUM.map((l) => l.id)
if (!(order.indexOf('isomers') < order.indexOf('reaction-types') && order.indexOf('reaction-types') < order.indexOf('nomenclature'))) {
  fail('reaction-types (§ 1.6) должен стоять между isomers и nomenclature')
}

function checkBalance(eq: GradeEq, strict: boolean): void {
  checks += 1
  const L = sideSum(eq.left)
  const R = sideSum(eq.right)
  if (!L || !R) {
    if (strict) fail(`${eq.id}: не разобрать формулы «${eq.displayRu}»`)
    else console.warn('SKIP (не формулы)', eq.id, eq.displayRu)
    return
  }
  if (!sameCounts(L.counts, R.counts) || L.charge !== R.charge) {
    fail(`${eq.id}: не уравнено ${fmt(L.counts)}${L.charge ? ` (${L.charge})` : ''} → ${fmt(R.counts)}${R.charge ? ` (${R.charge})` : ''}`)
  }
}

for (const lesson of ORGANIC_CURRICULUM) {
  const strict = SPEC_LESSONS.includes(lesson.id)
  for (const mid of lesson.challengeIds) {
    checks += 1
    if (!organicMoleculeById[mid]) fail(`${lesson.id}: нет молекулы ${mid}`)
  }
  if (!organicMoleculeById[lesson.defaultMolId]) fail(`${lesson.id}: нет defaultMolId ${lesson.defaultMolId}`)
  for (const eid of lesson.equationIds) {
    const eq = eqById.get(eid)
    if (!eq) {
      fail(`${lesson.id}: нет уравнения ${eid}`)
      continue
    }
    checkBalance(eq, strict)
    if (strict && (!eq.hintEn || !eq.hintUz || !eq.topicEn || !eq.topicUz)) fail(`${eid}: нет EN/UZ`)
  }
  for (const iid of lesson.isomerChallengeIds) {
    checks += 1
    if (!isoById.has(iid)) fail(`${lesson.id}: нет задания изомеров ${iid}`)
  }
  for (const qid of [lesson.nomenclatureQuizId, ...(lesson.extraQuizIds ?? [])].filter(Boolean) as string[]) {
    checks += 1
    if (!NOMENCLATURE_QUIZ_BY_ID[qid]) fail(`${lesson.id}: нет квиза ${qid}`)
  }
}

// Все реакции раздела 1 спецификации — в уроках
const SPEC_EQUATIONS: Record<string, string[]> = {
  'reaction-types': [
    'g10-rt-ethane-cl2', 'g10-rt-chloroethane-koh', 'g10-rt-propene-h2', 'g10-rt-ethene-cl2', 'g10-rt-ethene-hcl',
    'g10-rt-decane-crack', 'g10-rt-methane-decomp', 'g10-rt-elim-hcl', 'g10-rt-elim-h2o', 'g10-rt-elim-h2',
    'g10-rt-isomerization', 'g10-rt-aldol', 'g10-rt-pet', 'g10-rt-rad-init', 'g10-rt-rad-prop1', 'g10-rt-rad-prop2',
  ],
  alkanes: [
    'g10-alk-wurtz-ethyl', 'g10-alk-wurtz-mix-propane', 'g10-alk-wurtz-mix-ethane', 'g10-alk-dumas-ch4',
    'g10-alk-dumas-c2h6', 'g10-alk-al4c3-h2o', 'g10-alk-al4c3-hcl', 'g10-alk-kolbe', 'g10-alk-crack-octane',
    'g10-alk-crack-dodecane', 'g10-alk-coal-h2', 'g10-alk-co-h2', 'g10-alkane-ch4-burn', 'g10-alkane-c3h8-burn',
    'g10-alk-c4h10-burn', 'g10-alk-decane-crack-p50', 'g10-alkane-ch4-cl2', 'g10-alk-ch3cl-cl2',
    'g10-alk-ch2cl2-cl2', 'g10-alk-chcl3-cl2',
  ],
  cycloalkanes: ['g10-cyc-zn', 'g10-arene-h2', 'g10-cyc-c3h6-h2', 'g10-cyc-c5h10-h2', 'g10-cyc-c6h12-cl2'],
}
for (const [lid, ids] of Object.entries(SPEC_EQUATIONS)) {
  const lesson = ORGANIC_CURRICULUM_BY_ID[lid]
  for (const eid of ids) {
    checks += 1
    if (!lesson?.equationIds.includes(eid)) fail(`${lid}: в уроке нет уравнения ${eid}`)
  }
}

// Условия и опечатка с. 28
const COND: Record<string, string> = {
  'g10-rt-ethane-cl2': 'свет', 'g10-rt-chloroethane-koh': 'водный раствор', 'g10-rt-methane-decomp': 't > 1000 °C',
  'g10-rt-rad-init': 'свет, t', 'g10-alk-dumas-ch4': 't', 'g10-alk-dumas-c2h6': 't', 'g10-alk-kolbe': 'электролиз',
  'g10-alk-crack-octane': 'кат., t', 'g10-alk-crack-dodecane': 'p, t', 'g10-alk-decane-crack-p50': 'кат., t',
  'g10-alkane-ch4-cl2': 'свет', 'g10-alk-ch3cl-cl2': 'свет', 'g10-alk-ch2cl2-cl2': 'свет', 'g10-alk-chcl3-cl2': 'свет',
  'g10-arene-h2': 'кат., t', 'g10-cyc-c3h6-h2': 'Pt, 50–70 °C', 'g10-cyc-c5h10-h2': 'Pt, 300 °C', 'g10-cyc-c6h12-cl2': 'свет',
}
for (const [eid, cond] of Object.entries(COND)) {
  checks += 1
  if (eqById.get(eid)?.conditionsRu !== cond) fail(`${eid}: условия «${eqById.get(eid)?.conditionsRu}» ≠ «${cond}»`)
}
{
  checks += 1
  const p2 = eqById.get('g10-rt-rad-prop2')
  if (!p2 || !p2.left.includes('Cl₂') || p2.left.includes('HCl') || !/опечатка/.test(p2.hintRu)) {
    fail('g10-rt-rad-prop2: нужна исправленная запись R• + Cl₂ и пояснение опечатки')
  }
}

// ── 4. Изомеры ───────────────────────────────────────────
function checkIsomerSet(challengeId: string, target: number, opts: { formula: string; chain?: number; ring?: boolean }) {
  checks += 1
  const ch = isoById.get(challengeId)
  if (!ch) {
    fail(`нет задания ${challengeId}`)
    return
  }
  const correct = ch.candidates.filter((c) => c.correct)
  if (ch.targetCount !== target || correct.length !== target) {
    fail(`${challengeId}: верных ${correct.length}, targetCount ${ch.targetCount}, ждали ${target}`)
  }
  const want = parseFormula(opts.formula)!.counts
  const seen = new Set<string>()
  for (const cand of correct) {
    const mol = organicMoleculeById[cand.id]
    if (!mol) {
      fail(`${challengeId}: нет 3D-молекулы ${cand.id}`)
      continue
    }
    if (!sameCounts(graphCounts(mol.graph), want)) fail(`${challengeId}/${cand.id}: не ${opts.formula}`)
    const topo = carbonTopology(mol.graph)
    if (opts.chain != null && topo.longest !== opts.chain) fail(`${challengeId}/${cand.id}: цепь ${topo.longest} C`)
    if (opts.ring && topo.ring === 0) fail(`${challengeId}/${cand.id}: нет кольца`)
    const key = canonicalizeSkeleton(stripHydrogens(mol.graph))
    if (seen.has(key)) fail(`${challengeId}/${cand.id}: повтор строения`)
    seen.add(key)
  }
  for (const cand of ch.candidates.filter((c) => !c.correct)) {
    const mol = organicMoleculeById[cand.id]
    if (!mol) continue
    const sameF = sameCounts(graphCounts(mol.graph), want)
    const topo = carbonTopology(mol.graph)
    const wouldCount = sameF && (opts.chain == null || topo.longest === opts.chain) && (!opts.ring || topo.ring > 0)
    if (wouldCount) fail(`${challengeId}/${cand.id}: «ловушка» на самом деле подходит`)
  }
}
checkIsomerSet('c7h16', 9, { formula: 'C7H16' })
checkIsomerSet('c7h16-c5chain', 5, { formula: 'C7H16', chain: 5 })
checkIsomerSet('c4h8-ring', 2, { formula: 'C4H8', ring: true })
checkIsomerSet('c5h10-ring', 5, { formula: 'C5H10', ring: true })
{
  // В задании «цепь C₅» все 9 кандидатов — изомеры C₇H₁₆; неверные — с другой длиной цепи
  checks += 1
  const ch = isoById.get('c7h16-c5chain')
  if (ch && ch.candidates.length !== 9) fail(`c7h16-c5chain: кандидатов ${ch.candidates.length}, ждали 9`)
}

// Квиз с. 30–33: ровно один верный ответ, есть EN/UZ
{
  const quiz = NOMENCLATURE_QUIZ_BY_ID['g10-textbook-names']
  if (!quiz) fail('нет квиза g10-textbook-names')
  for (const q of quiz?.questions ?? []) {
    checks += 1
    const ok = q.options.filter((o) => o.correct).length
    if (ok !== 1) fail(`квиз ${q.id}: верных ответов ${ok}`)
    if (!q.promptEn || !q.promptUz || q.promptEn === q.promptRu) fail(`квиз ${q.id}: нет EN/UZ`)
  }
}

console.log(`checks ${checks}`)
console.log(errors.length === 0 ? 'OK test-g10-textbook-examples' : `FAILED ${errors.length}`)
process.exit(errors.length === 0 ? 0 : 1)
