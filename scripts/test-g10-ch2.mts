/**
 * Kimyo 10, гл. II § 2.6–2.24 (с. 55–102) в органической лаборатории
 * (docs/textbook/g10-ch2-alkenes-dienes.md, g10-ch2-alkynes-arenes.md):
 *  1) каждая молекула расшифровки есть; брутто-формула по скелету = формула учебника; 3D-граф = скелет,
 *     главная цепь / кольцо как в названии, геометрия правдоподобна;
 *  2) цис/транс и плоскость двойной связи в 3D: цис-бутен-2 — метилы рядом, транс — напротив; аллен — плоскости ⊥;
 *  3) все уравнения уроков уравнены (атомы и заряд), есть EN/UZ, условия и исправления опечаток учебника;
 *  4) уроки ссылаются только на существующие молекулы, уравнения, задания изомеров и квизы;
 *  5) задания изомеров: число верных, формулы, «ловушки»; квизы — ровно один верный ответ, есть EN/UZ.
 * Запуск: npx tsx scripts/test-g10-ch2.mts
 */
import {
  canonicalizeSkeleton,
  graphFromSkeletonSpec,
  isValenceOk,
  stripHydrogens,
  type OrganicGraph,
} from '../src/chemistry/organic/organicGraph.ts'
import { ORGANIC_CURRICULUM_BY_ID, ORGANIC_CURRICULUM, resolveOrganicLessonFromLearn } from '../src/data/organicLab/organicCurriculum.ts'
import { organicMoleculeById } from '../src/data/organicLab/organicMoleculeRegistry.ts'
import { NOMENCLATURE_QUIZ_BY_ID } from '../src/data/organicLab/organicNomenclatureQuizzes.ts'
import { organicBuildChallengeById, type OrganicBuildChallenge } from '../src/data/researchLab/organicBuildCatalog.ts'
import { G10_CH2_BUILD_CHALLENGES } from '../src/data/researchLab/organicBuildCatalogG10ch2.ts'
import { G10_G11_EDU_EQUATIONS, type GradeEq } from '../src/data/researchLab/g10g11Equations.ts'
import { G10_CH2_EQUATIONS } from '../src/data/researchLab/g10EquationsCh2.ts'
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


// ── 1. Молекулы расшифровок ──────────────────────────────
type Expect = { f: string; chain?: number; ring?: number }
/** Молекулы каталога (скелет + kit + подсказки RU/EN/UZ). */
const SPEC_MOLECULES: Record<string, Expect> = {
  // § 2.7–2.8 алкены
  ethylene: { f: 'C2H4' },
  propene: { f: 'C3H6', chain: 3 },
  'but-1-ene': { f: 'C4H8', chain: 4 },
  'pent-1-ene': { f: 'C5H10', chain: 5 },
  'hex-1-ene': { f: 'C6H12', chain: 6 },
  'hept-1-ene': { f: 'C7H14', chain: 7 },
  '3-methylbut-1-ene': { f: 'C5H10', chain: 4 },
  '4-4-dimethylpent-2-ene': { f: 'C7H14', chain: 5 },
  isobutylene: { f: 'C4H8', chain: 3 },
  '2-methylbut-1-ene': { f: 'C5H10', chain: 4 },
  'but-2-ene': { f: 'C4H8', chain: 4 },
  'cis-but-2-ene': { f: 'C4H8', chain: 4 },
  'trans-but-2-ene': { f: 'C4H8', chain: 4 },
  'pent-2-ene': { f: 'C5H10', chain: 5 },
  '2-methylbut-2-ene': { f: 'C5H10', chain: 4 },
  '2-2-dimethylhept-3-ene': { f: 'C9H18', chain: 7 },
  '1-2-dibromoethane': { f: 'C2H4Br2' },
  bromoethane: { f: 'C2H5Br' },
  '2-bromopropane': { f: 'C3H7Br', chain: 3 },
  'ethylene-glycol': { f: 'C2H6O2' },
  '1-2-dibromopropane': { f: 'C3H6Br2', chain: 3 },
  '1-chloropropane': { f: 'C3H7Cl', chain: 3 },
  chloroethane: { f: 'C2H5Cl' },
  ethanol: { f: 'C2H6O' },
  '1-2-dichloroethane': { f: 'C2H4Cl2' },
  // § 2.10–2.11 диены
  propadiene: { f: 'C3H4', chain: 3 },
  'hexa-1-5-diene': { f: 'C6H10', chain: 6 },
  butadiene: { f: 'C4H6', chain: 4 },
  'buta-1-2-diene': { f: 'C4H6', chain: 4 },
  'penta-1-2-diene': { f: 'C5H8', chain: 5 },
  'penta-1-3-diene': { f: 'C5H8', chain: 5 },
  'cis-penta-1-3-diene': { f: 'C5H8', chain: 5 },
  'trans-penta-1-3-diene': { f: 'C5H8', chain: 5 },
  'penta-1-4-diene': { f: 'C5H8', chain: 5 },
  isoprene: { f: 'C5H8', chain: 4 },
  '3-methylhexa-1-5-diene': { f: 'C7H12', chain: 6 },
  '3-methylbuta-1-2-diene': { f: 'C5H8', chain: 4 },
  chloroprene: { f: 'C4H5Cl', chain: 4 },
  '1-4-dibromobut-2-ene': { f: 'C4H6Br2', chain: 4 },
  '3-4-dibromobut-1-ene': { f: 'C4H6Br2', chain: 4 },
  'n-butane': { f: 'C4H10', chain: 4 },
  // § 2.13 алкины
  acetylene: { f: 'C2H2' },
  propyne: { f: 'C3H4', chain: 3 },
  'but-1-yne': { f: 'C4H6', chain: 4 },
  'but-2-yne': { f: 'C4H6', chain: 4 },
  'pent-1-yne': { f: 'C5H8', chain: 5 },
  'pent-2-yne': { f: 'C5H8', chain: 5 },
  '3-methylbut-1-yne': { f: 'C5H8', chain: 4 },
  'hex-1-yne': { f: 'C6H10', chain: 6 },
  'hept-1-yne': { f: 'C7H12', chain: 7 },
  'hept-2-yne': { f: 'C7H12', chain: 7 },
  'hept-3-yne': { f: 'C7H12', chain: 7 },
  '3-methylhex-1-yne': { f: 'C7H12', chain: 6 },
  '4-4-dimethylpent-2-yne': { f: 'C7H12', chain: 5 },
  acetaldehyde: { f: 'C2H4O' },
  // § 2.15–2.17 арены и стирол
  benzene: { f: 'C6H6', ring: 6 },
  toluene: { f: 'C7H8', ring: 6 },
  ethylbenzene: { f: 'C8H10', ring: 6 },
  'o-xylene': { f: 'C8H10', ring: 6 },
  'm-xylene': { f: 'C8H10', ring: 6 },
  'p-xylene': { f: 'C8H10', ring: 6 },
  cyclohexane: { f: 'C6H12', ring: 6 },
  methylcyclohexane: { f: 'C7H14', ring: 6 },
  bromobenzene: { f: 'C6H5Br', ring: 6 },
  '2-4-6-tribromotoluene': { f: 'C7H5Br3', ring: 6 },
  'hexachlorocyclohexane': { f: 'C6H6Cl6', ring: 6 },
  styrene: { f: 'C8H8', ring: 6 },
  '1-2-dichloroethylbenzene': { f: 'C8H8Cl2', ring: 6 },
  '1-chloroethylbenzene': { f: 'C8H9Cl', ring: 6 },
  biphenyl: { f: 'C12H10', ring: 6 },
  diphenylmethane: { f: 'C13H12', ring: 6 },
  triphenylmethane: { f: 'C19H16', ring: 6 },
  naphthalene: { f: 'C10H8' },
  anthracene: { f: 'C14H10' },
  // § 2.18–2.23
  methane: { f: 'CH4' },
  ethane: { f: 'C2H6' },
  propane: { f: 'C3H8', chain: 3 },
  '2-methylpent-2-ene': { f: 'C6H12', chain: 5 },
  '3-3-dimethylbut-1-yne': { f: 'C6H10', chain: 4 },
  '3-3-dimethylpent-1-ene': { f: 'C7H14', chain: 5 },
  isobutane: { f: 'C4H10', chain: 3 },
  cyclobutane: { f: 'C4H8', ring: 4 },
  neopentane: { f: 'C5H12', chain: 3 },
  '3-3-dimethylbut-1-ene': { f: 'C6H12', chain: 4 },
  '2-3-dimethylhexane': { f: 'C8H18', chain: 6 },
  cyclopentane: { f: 'C5H10', ring: 5 },
  '3-4-dimethylpent-1-ene': { f: 'C7H14', chain: 5 },
  cumene: { f: 'C9H12', ring: 6 },
  'vinyl-chloride': { f: 'C2H3Cl' },
}
/** Вещества гл. III / сгенерированные (только реестр 3D): проверяется состав графа. */
const REGISTRY_ONLY: Record<string, string> = {
  'benzoic-acid': 'C7H6O2',
  '1-phenylethanol': 'C8H10O',
  '1-phenylethane-1-2-diol': 'C8H10O2',
  'ethyl-benzoate': 'C9H10O2',
  'ethylene-oxide': 'C2H4O',
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
for (const [id, f] of Object.entries(REGISTRY_ONLY)) {
  checks += 1
  const mol = organicMoleculeById[id]
  if (!mol) {
    fail(`молекула ${id} отсутствует в реестре`)
    continue
  }
  if (!sameCounts(graphCounts(mol.graph), parseFormula(f)!.counts)) fail(`${id}: 3D-граф ${fmt(graphCounts(mol.graph))} ≠ ${f}`)
  if (!isValenceOk(mol.graph)) fail(`${id}: ошибка валентности`)
  // этиленоксид — трёхчленный цикл C–C–O (углы ~60°), проверка sp³-углов к нему неприменима
  const geo = id === 'ethylene-oxide' ? null : geometryIssues(mol.graph, carbonTopology(mol.graph).ring)
  if (geo) fail(`${id}: 3D-геометрия — ${geo}`)
}
// все новые молекулы главы — в тесте
for (const c of G10_CH2_BUILD_CHALLENGES) {
  checks += 1
  if (!SPEC_MOLECULES[c.id]) fail(`${c.id}: молекула файла главы II не проверяется тестом`)
}
{
  const ids = G10_CH2_BUILD_CHALLENGES.map((c) => c.id)
  checks += 1
  if (new Set(ids).size !== ids.length) fail('повтор id в organicBuildCatalogG10ch2')
}

// IUPAC и исправления опечаток в подсказках молекул
const TEXT_IN_HINT: Record<string, RegExp[]> = {
  '3-methylbut-1-ene': [/3-метилбут-1-ен/, /H₃C=CH/, /H₂C=/],
  '4-4-dimethylpent-2-ene': [/4,4-диметилпент-2-ен/],
  'cis-but-2-ene': [/\(Z\)-бут-2-ен/],
  'trans-but-2-ene': [/\(E\)-бут-2-ен/],
  propadiene: [/пропа-1,2-диен/, /sp/],
  '3-methylhexa-1-5-diene': [/C₇H₁₄/, /C₇H₁₂/],
  'but-1-yne': [/бутен-1/, /бутины/],
  '2-4-6-tribromotoluene': [/FeBr₃/],
  '1-4-dibromobut-2-ene': [/1,4-дибромбут-2-ен/],
  '3-4-dibromobut-1-ene': [/3,4-дибромбут-1-ен/],
  chloroprene: [/2-хлорбута-1,3-диен/],
}
for (const [id, res] of Object.entries(TEXT_IN_HINT)) {
  const c = organicBuildChallengeById(id)
  for (const re of res) {
    checks += 1
    if (!c || !re.test(`${c.titleRu} ${c.hintRu}`)) fail(`${id}: в названии/подсказке нет ${re}`)
  }
}

// ── 2. Цис/транс, плоская C=C, аллен ─────────────────────
function posOf(g: OrganicGraph) {
  return new Map(g.atoms.map((a) => [a.id, a.pos]))
}
type V = readonly [number, number, number]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V) => Math.hypot(a[0], a[1], a[2])
/** Двугранный угол a–b–c–d, градусы (0 — цис, 180 — транс). */
function dihedral(a: V, b: V, c: V, d: V): number {
  const n1 = cross(sub(b, a), sub(c, b))
  const n2 = cross(sub(c, b), sub(d, c))
  const cos = dot(n1, n2) / (len(n1) * len(n2))
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}
function neighbors(g: OrganicGraph, id: string) {
  return g.bonds.filter((b) => b.a === id || b.b === id).map((b) => (b.a === id ? b.b : b.a))
}
/** Все двугранные углы заместителей у каждой некольцевой C=C: должны быть ≈ 0° или ≈ 180°. */
function doubleBondPlanarity(g: OrganicGraph): { worst: number; heavyDihedral: number[] } {
  const P = posOf(g)
  const el = new Map(g.atoms.map((a) => [a.id, a.element]))
  let worst = 0
  const heavyDihedral: number[] = []
  for (const b of g.bonds) {
    if (b.order !== 2 || el.get(b.a) !== 'C' || el.get(b.b) !== 'C') continue
    const sa = neighbors(g, b.a).filter((x) => x !== b.b)
    const sb = neighbors(g, b.b).filter((x) => x !== b.a)
    if (sa.length !== 2 || sb.length !== 2) continue
    for (const x of sa)
      for (const y of sb) {
        const d = dihedral(P.get(x)!, P.get(b.a)!, P.get(b.b)!, P.get(y)!)
        worst = Math.max(worst, Math.min(d, 180 - d))
        if (el.get(x) !== 'H' && el.get(y) !== 'H') heavyDihedral.push(d)
      }
  }
  return { worst, heavyDihedral }
}
for (const id of ['ethylene', 'propene', 'but-1-ene', 'cis-but-2-ene', 'trans-but-2-ene', 'pent-2-ene', '2-methylbut-2-ene', 'butadiene', 'isoprene', 'styrene', 'cis-penta-1-3-diene', 'trans-penta-1-3-diene', '1-4-dibromobut-2-ene']) {
  checks += 1
  const g = organicMoleculeById[id]?.graph
  if (!g) continue
  const { worst } = doubleBondPlanarity(g)
  if (worst > 12) fail(`${id}: заместители у C=C не в одной плоскости (отклонение ${worst.toFixed(0)}°)`)
}
function stereoDihedral(id: string, path: readonly number[]): number | null {
  const c = organicBuildChallengeById(id)
  const g = organicMoleculeById[id]?.graph
  if (!c || !g) return null
  // атомы C графа идут в порядке набора: k-й C эталона = k-й атом C графа
  const cs = g.atoms.filter((a) => a.element === 'C')
  const P = path.map((i) => cs[i]!.pos as V)
  return dihedral(P[0]!, P[1]!, P[2]!, P[3]!)
}
{
  const cis = stereoDihedral('cis-but-2-ene', [0, 1, 2, 3])
  const trans = stereoDihedral('trans-but-2-ene', [0, 1, 2, 3])
  const pcis = stereoDihedral('cis-penta-1-3-diene', [1, 2, 3, 4])
  const ptrans = stereoDihedral('trans-penta-1-3-diene', [1, 2, 3, 4])
  checks += 4
  if (cis == null || cis > 15) fail(`цис-бутен-2: угол CH₃–C=C–CH₃ ${cis?.toFixed(0)}°, ждали ≈ 0°`)
  if (trans == null || trans < 165) fail(`транс-бутен-2: угол CH₃–C=C–CH₃ ${trans?.toFixed(0)}°, ждали ≈ 180°`)
  if (pcis == null || pcis > 15) fail(`цис-пентадиен-1,3: угол ${pcis?.toFixed(0)}°, ждали ≈ 0°`)
  if (ptrans == null || ptrans < 165) fail(`транс-пентадиен-1,3: угол ${ptrans?.toFixed(0)}°, ждали ≈ 180°`)
  const a = organicMoleculeById['cis-but-2-ene']?.graph
  const b = organicMoleculeById['trans-but-2-ene']?.graph
  checks += 1
  if (a && b) {
    const d14 = (g: OrganicGraph) => {
      const cs = g.atoms.filter((x) => x.element === 'C')
      return len(sub(cs[0]!.pos as V, cs[3]!.pos as V))
    }
    if (!(d14(a) < 3.3 && d14(b) > 3.6)) fail(`C1…C4: цис ${d14(a).toFixed(2)} Å, транс ${d14(b).toFixed(2)} Å`)
  }
}
{
  // аллен: плоскости H–C1–H и H–C3–H взаимно перпендикулярны, C1=C2=C3 — прямая
  checks += 2
  const g = organicMoleculeById['propadiene']?.graph
  if (g) {
    const cs = g.atoms.filter((a) => a.element === 'C')
    const [c1, c2, c3] = cs as [typeof cs[0], typeof cs[0], typeof cs[0]]
    const v1 = sub(c1.pos as V, c2.pos as V)
    const v2 = sub(c3.pos as V, c2.pos as V)
    const ang = (Math.acos(dot(v1, v2) / (len(v1) * len(v2))) * 180) / Math.PI
    if (ang < 170) fail(`аллен: угол C=C=C ${ang.toFixed(0)}°, ждали 180°`)
    const h1 = neighbors(g, c1.id).filter((x) => x !== c2.id)
    const h3 = neighbors(g, c3.id).filter((x) => x !== c2.id)
    const P = posOf(g)
    const d = dihedral(P.get(h1[0]!)!, c1.pos, c3.pos, P.get(h3[0]!)!)
    if (Math.abs(d - 90) > 15) fail(`аллен: плоскости CH₂ под углом ${d.toFixed(0)}°, ждали 90°`)
  }
}

// ── 3–4. Уроки главы II: ссылки и уравненность ───────────
const LESSONS = ['cycloalkanes', 'alkenes', 'alkadienes', 'alkynes', 'arenes', 'sources-oil', 'ch2-summary']
const eqById = new Map(G10_G11_EDU_EQUATIONS.map((e) => [e.id, e]))
const MY_EQ = new Set(G10_CH2_EQUATIONS.map((e) => e.id))
const isoById = new Map(ISOMER_CHALLENGES.map((c) => [c.id, c]))
{
  const ids = G10_G11_EDU_EQUATIONS.map((e) => e.id)
  checks += 1
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dup.length) fail(`повтор id уравнений: ${dup.join(', ')}`)
  const order = ORGANIC_CURRICULUM.map((l) => l.id)
  checks += 1
  if (order.indexOf('ch2-summary') !== order.indexOf('sources-oil') + 1) fail('урок ch2-summary должен идти сразу после sources-oil')
  checks += 1
  if (resolveOrganicLessonFromLearn(2, 23).id !== 'ch2-summary') fail('§ 2.23 → ch2-summary')
  if (resolveOrganicLessonFromLearn(2, 21).id !== 'sources-oil') fail('§ 2.21 → sources-oil')
  if (resolveOrganicLessonFromLearn(2, 8).id !== 'alkenes') fail('§ 2.8 → alkenes')
}

function checkBalance(eq: GradeEq): void {
  checks += 1
  const L = sideSum(eq.left)
  const R = sideSum(eq.right)
  if (!L || !R) {
    fail(`${eq.id}: не разобрать формулы «${eq.displayRu}»`)
    return
  }
  if (!sameCounts(L.counts, R.counts) || L.charge !== R.charge) {
    fail(`${eq.id}: не уравнено ${fmt(L.counts)}${L.charge ? ` (${L.charge})` : ''} → ${fmt(R.counts)}${R.charge ? ` (${R.charge})` : ''}`)
  }
}

for (const lid of LESSONS) {
  checks += 1
  const lesson = ORGANIC_CURRICULUM_BY_ID[lid]
  if (!lesson) {
    fail(`нет урока ${lid}`)
    continue
  }
  if (lesson.chapter !== 2) fail(`${lid}: не глава II`)
  if (!lesson.goalEn.trim() || !lesson.goalUz.trim() || lesson.goalEn === lesson.goalRu) fail(`${lid}: нет цели EN/UZ`)
  if (!lesson.titleEn.trim() || !lesson.titleUz.trim()) fail(`${lid}: нет названия EN/UZ`)
  for (const mid of lesson.challengeIds) {
    checks += 1
    if (!organicMoleculeById[mid]) fail(`${lid}: нет молекулы ${mid}`)
    else if (!SPEC_MOLECULES[mid] && !REGISTRY_ONLY[mid] && lid !== 'cycloalkanes') fail(`${lid}: молекула ${mid} не проверена тестом`)
  }
  if (!organicMoleculeById[lesson.defaultMolId]) fail(`${lid}: нет defaultMolId ${lesson.defaultMolId}`)
  if (new Set(lesson.challengeIds).size !== lesson.challengeIds.length) fail(`${lid}: повтор молекулы в уроке`)
  if (new Set(lesson.equationIds).size !== lesson.equationIds.length) fail(`${lid}: повтор уравнения в уроке`)
  for (const eid of lesson.equationIds) {
    const eq = eqById.get(eid)
    if (!eq) {
      fail(`${lid}: нет уравнения ${eid}`)
      continue
    }
    checkBalance(eq)
    if (!MY_EQ.has(eid)) continue // уравнения прежних глав (§ 2.3–2.6) проверяет test-g10-textbook-examples
    if (!eq.hintEn || !eq.hintUz || !eq.topicEn || !eq.topicUz || eq.hintEn === eq.hintRu) fail(`${eid}: нет EN/UZ`)
    if (eq.conditionsRu && (!eq.conditionsEn || !eq.conditionsUz)) fail(`${eid}: условия без EN/UZ`)
  }
  for (const iid of lesson.isomerChallengeIds) {
    checks += 1
    if (!isoById.has(iid)) fail(`${lid}: нет задания изомеров ${iid}`)
  }
  for (const qid of [lesson.nomenclatureQuizId, ...(lesson.extraQuizIds ?? [])].filter(Boolean) as string[]) {
    checks += 1
    if (!NOMENCLATURE_QUIZ_BY_ID[qid]) fail(`${lid}: нет квиза ${qid}`)
  }
}

// все реакции раздела 1 расшифровок — в уроках
const SPEC_EQUATIONS: Record<string, string[]> = {
  cycloalkanes: ['g10-cyc-c6h12-dehydro'],
  alkenes: [
    'g10-ale-c2h4-h2', 'g10-ale-c2h4-br2', 'g10-ale-c2h4-hbr', 'g10-ale-markovnikov', 'g10-ale-wagner', 'g10-ale-pe',
    'g10-ale-etoh-dehydr', 'g10-ale-ch4-c2h4', 'g10-ale-c2h6-dehydro', 'g10-ale-zn', 'g10-ale-c3h7cl-koh',
    'g10-ale-s61-hcl', 'g10-ale-s61-h2o', 'g10-ale-s61-cl2', 'g10-ale-s61-o2', 'g10-ale-kmno4-acid',
  ],
  alkadienes: [
    'g10-dien-lebedev', 'g10-dien-butane', 'g10-dien-pbd', 'g10-dien-pip', 'g10-dien-cr', 'g10-dien-br2-14',
    'g10-dien-br2-12', 'g10-dien-c3h4-burn', 'g10-dien-pbd-cis', 'g10-dien-h2', 'g10-dien-cr-70', 'g10-dien-pip-70',
    'g10-dien-sbr',
  ],
  alkynes: ['g10-alky-carbide', 'g10-alky-ch4', 'g10-alky-kucherov', 'g10-alky-trimer', 'g10-alky-c3h4-burn', 'g10-alky-c5h8-burn', 'g10-alky-kmno4'],
  arenes: [
    'g10-aren-c6h12-dehydro', 'g10-aren-toluene', 'g10-aren-trimer', 'g10-aren-br2', 'g10-aren-hno3', 'g10-aren-tnt',
    'g10-aren-tol-br3', 'g10-aren-tol-kmno4', 'g10-aren-cl2-uv', 'g10-arene-h2', 'g10-sty-h2', 'g10-sty-cl2',
    'g10-sty-hcl', 'g10-sty-h2o', 'g10-sty-poly', 'g10-sty-burn', 'g10-sty-kmno4-acid', 'g10-sty-kmno4-neutral',
    'g10-sty-kmno4-cold', 'g10-sty-from-eb', 'g10-sty-from-benzene',
  ],
  'sources-oil': ['g10-src-ch4-burn', 'g10-src-ch4-c2h2'],
  'ch2-summary': [
    'g10-sum-x1', 'g10-sum-x2', 'g10-sum-x3', 'g10-sum-x4', 'g10-sum-x5', 'g10-sum-a1', 'g10-sum-a2', 'g10-sum-a3',
    'g10-sum-a4', 'g10-sum-b1', 'g10-sum-b2', 'g10-sum-b3', 'g10-sum-c1', 'g10-sum-c2', 'g10-sum-c3', 'g10-sum-c4',
    'g10-sum-d4', 'g10-sum-d5', 'g10-sum-d6', 'g10-sum-d7',
  ],
}
for (const [lid, ids] of Object.entries(SPEC_EQUATIONS)) {
  for (const eid of ids) {
    checks += 1
    if (!ORGANIC_CURRICULUM_BY_ID[lid]?.equationIds.includes(eid)) fail(`${lid}: в уроке нет уравнения ${eid}`)
  }
}

// условия как в учебнике
const COND: Record<string, string> = {
  'g10-cyc-c6h12-dehydro': 'Pt, t', 'g10-ale-c2h4-h2': 'кат.', 'g10-ale-etoh-dehydr': 't, H₂SO₄ (конц.)',
  'g10-ale-ch4-c2h4': 't', 'g10-ale-c2h6-dehydro': 'кат., t', 'g10-ale-s61-h2o': 'H₃PO₄, t, p', 'g10-ale-s61-o2': 'Ag, t',
  'g10-dien-lebedev': 'кат., t', 'g10-dien-pbd-cis': 'C₄H₉Li', 'g10-dien-h2': 'кат.', 'g10-alky-ch4': '1500 °C',
  'g10-alky-kucherov': 'Hg²⁺', 'g10-alky-trimer': 'C (акт.), t', 'g10-aren-hno3': 'H₂SO₄ (конц.), t',
  'g10-aren-cl2-uv': 'УФ-свет', 'g10-sty-h2': 'Ni', 'g10-sty-kmno4-cold': '0 °C', 'g10-sty-from-benzene': 'AlCl₃, t',
  'g10-sum-x1': 'hv', 'g10-sum-x3': 'AlCl₃', 'g10-sum-b2': 'HgCl₂', 'g10-sum-d4': 'Pd',
}
for (const [eid, cond] of Object.entries(COND)) {
  checks += 1
  if (eqById.get(eid)?.conditionsRu !== cond) fail(`${eid}: условия «${eqById.get(eid)?.conditionsRu}» ≠ «${cond}»`)
}

// исправления опечаток учебника
{
  checks += 4
  const km = eqById.get('g10-alky-kmno4')
  if (!km || !km.right.includes('2H₂O') || km.right.includes('2H₂') || !/«\s*\+\s*2H₂»/.test(km.hintRu)) fail('g10-alky-kmno4: нужно 2H₂O и пояснение опечатки «+ 2H₂»')
  const eb = eqById.get('g10-sty-from-eb')
  if (!eb || !eb.right.includes('H₂') || !/гидрированием/.test(eb.hintRu) || !/дегидрированием/.test(eb.hintRu)) fail('g10-sty-from-eb: нужно пояснение «гидрированием» → дегидрированием')
  const x5 = eqById.get('g10-sum-x5')
  if (!x5 || !/разложения/.test(x5.hintRu) || !/этерификац/.test(x5.hintRu)) fail('g10-sum-x5: нужно пояснение «разложение» → этерификация')
  const br3 = eqById.get('g10-aren-tol-br3')
  if (!br3 || br3.conditionsRu !== 'FeBr₃' || !/не указан/.test(br3.hintRu)) fail('g10-aren-tol-br3: катализатор FeBr₃ и пояснение')
}

// ── 5. Изомеры ───────────────────────────────────────────
function checkIsomerSet(challengeId: string, target: number, opts: { formula: string; classIds?: readonly string[] }) {
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
  if (!ch.titleEn || !ch.titleUz || !ch.hintEn || !ch.hintUz) fail(`${challengeId}: нет EN/UZ`)
  const want = parseFormula(opts.formula)!.counts
  const seen = new Set<string>()
  const matches = (id: string) => {
    const mol = organicMoleculeById[id]
    if (!mol) return false
    const okClass = !opts.classIds || opts.classIds.includes(mol.classId)
    return sameCounts(graphCounts(mol.graph), want) && okClass
  }
  for (const cand of correct) {
    checks += 1
    const mol = organicMoleculeById[cand.id]
    if (!mol) {
      fail(`${challengeId}: нет 3D-молекулы ${cand.id}`)
      continue
    }
    if (!matches(cand.id)) fail(`${challengeId}/${cand.id}: не ${opts.formula} нужного класса`)
    // цис/транс — одно строение скелета, но разные вещества
    const stereo = /^(cis|trans)-/.test(cand.id) ? cand.id.slice(0, cand.id.indexOf('-')) : ''
    const key = canonicalizeSkeleton(stripHydrogens(mol.graph)) + stereo
    if (seen.has(key)) fail(`${challengeId}/${cand.id}: повтор строения`)
    seen.add(key)
    if (!cand.nameEn || !cand.nameUz || !cand.hazardEn || !cand.hazardUz) fail(`${challengeId}/${cand.id}: нет EN/UZ`)
  }
  for (const cand of ch.candidates.filter((c) => !c.correct)) {
    checks += 1
    if (!organicMoleculeById[cand.id]) fail(`${challengeId}: нет 3D-молекулы ловушки ${cand.id}`)
    else if (matches(cand.id)) fail(`${challengeId}/${cand.id}: «ловушка» на самом деле подходит`)
  }
}
checkIsomerSet('c4h8-alkene', 6, { formula: 'C4H8' })
checkIsomerSet('c5h10-alkene', 5, { formula: 'C5H10', classIds: ['alkene'] })
checkIsomerSet('c5h8-diene', 5, { formula: 'C5H8', classIds: ['alkadiene'] })
checkIsomerSet('c4h6', 4, { formula: 'C4H6', classIds: ['alkadiene', 'alkyne'] })
checkIsomerSet('c5h8-alkyne', 3, { formula: 'C5H8', classIds: ['alkyne'] })
checkIsomerSet('c7h12-alkyne', 5, { formula: 'C7H12', classIds: ['alkyne'] })
checkIsomerSet('c8h10-arene', 4, { formula: 'C8H10', classIds: ['arene'] })

// ── Квизы ────────────────────────────────────────────────
for (const qid of ['g10-alkenes-p59', 'g10-alkadienes', 'g10-alkynes', 'g10-arenes', 'g10-sources-tasks', 'g10-ch2-summary']) {
  const quiz = NOMENCLATURE_QUIZ_BY_ID[qid]
  checks += 1
  if (!quiz) {
    fail(`нет квиза ${qid}`)
    continue
  }
  if (!quiz.titleEn || !quiz.titleUz) fail(`${qid}: нет названия EN/UZ`)
  const qids = new Set<string>()
  for (const q of quiz.questions) {
    checks += 1
    if (qids.has(q.id)) fail(`${qid}: повтор вопроса ${q.id}`)
    qids.add(q.id)
    const ok = q.options.filter((o) => o.correct).length
    if (ok !== 1) fail(`квиз ${qid}/${q.id}: верных ответов ${ok}`)
    if (!q.promptEn || !q.promptUz || q.promptEn === q.promptRu) fail(`квиз ${qid}/${q.id}: нет EN/UZ`)
    for (const o of q.options) if (!o.labelEn || !o.labelUz) fail(`квиз ${qid}/${q.id}/${o.id}: нет EN/UZ`)
    const labels = q.options.map((o) => o.labelRu)
    if (new Set(labels).size !== labels.length) fail(`квиз ${qid}/${q.id}: одинаковые варианты`)
  }
}
{
  // ответы задач: с. 59 (n = 6), с. 87 (66 г, 3 моль), с. 95 (58, 56, 3,4)
  const answer = (qz: string, q: string) =>
    NOMENCLATURE_QUIZ_BY_ID[qz]?.questions.find((x) => x.id === q)?.options.find((o) => o.correct)?.labelRu ?? ''
  const EXPECT: [string, string, RegExp][] = [
    ['g10-alkenes-p59', 'ale-t4', /^C₆H₁₂$/],
    ['g10-alkenes-p59', 'ale-t2', /^C₄H₁₀$/],
    ['g10-sources-tasks', 'src-t1', /^66 г$/],
    ['g10-sources-tasks', 'src-t2', /^3 моль$/],
    ['g10-sources-tasks', 'src-m-isobutane', /^58/],
    ['g10-sources-tasks', 'src-m-cyclobutane', /^56/],
    ['g10-sources-tasks', 'src-air', /3,4/],
    ['g10-ch2-summary', 'sum-row-alkene', /^Алкены$/],
    ['g10-ch2-summary', 'sum-arene-hyb', /^sp²/],
    ['g10-ch2-summary', 'sum-cyclo-angle', /^60°$/],
  ]
  for (const [qz, q, re] of EXPECT) {
    checks += 1
    if (!re.test(answer(qz, q))) fail(`квиз ${qz}/${q}: ответ «${answer(qz, q)}» ≠ ${re}`)
  }
  // проверка арифметики задач
  checks += 3
  if (Math.abs((67.2 / 22.4 / 2) * 44 - 66) > 1e-9) fail('с. 87, задача 1: ≠ 66 г')
  if (Math.round((2 * 12 + 4 + 2 * 35.5) / 29 * 10) / 10 !== 3.4) fail('с. 95: 99 : 29 ≠ 3,4')
  if (84 / 14 !== 6) fail('с. 59, задача 4: n ≠ 6')
}

console.log(`checks ${checks}`)
console.log(errors.length === 0 ? 'OK test-g10-ch2' : `FAILED ${errors.length}`)
process.exit(errors.length === 0 ? 0 : 1)
