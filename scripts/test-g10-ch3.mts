/**
 * Kimyo 10, глава III (§ 3.1–3.21, с. 103–167) в органической лаборатории — docs/textbook/g10-ch3-*.md.
 *  1) каждая молекула расшифровки есть; брутто-формула по скелету (C/гетероатомы + H по валентности) = формуле
 *     учебника; 3D-граф совпадает со скелетом, валентности верны, главная цепь / кольцо — как в названии;
 *  2) все уравнения главы III уравнены (атомы; для ионов — заряд; R — как «атом»), у каждого есть EN/UZ;
 *  3) уроки главы ссылаются только на существующие молекулы, уравнения, задания изомеров и квизы;
 *  4) задания изомеров: верные кандидаты — одной формулы и разного строения; ловушки — другой формулы;
 *  5) квизы: ровно один верный ответ, есть EN/UZ; исправления учебника на месте.
 * Запуск: npx tsx scripts/test-g10-ch3.mts
 */
import {
  canonicalizeSkeleton,
  graphFromSkeletonSpec,
  isValenceOk,
  stripHydrogens,
  type OrganicGraph,
} from '../src/chemistry/organic/organicGraph.ts'
import { ORGANIC_CURRICULUM_BY_ID } from '../src/data/organicLab/organicCurriculum.ts'
import { organicMoleculeById } from '../src/data/organicLab/organicMoleculeRegistry.ts'
import { NOMENCLATURE_QUIZ_BY_ID } from '../src/data/organicLab/organicNomenclatureQuizzes.ts'
import { G10_CH3_QUIZZES } from '../src/data/organicLab/organicQuizzesG10ch3.ts'
import {
  ORGANIC_BUILD_CHALLENGES,
  organicBuildChallengeById,
  type OrganicBuildChallenge,
} from '../src/data/researchLab/organicBuildCatalog.ts'
import { G10_CH3_BUILD_CHALLENGES } from '../src/data/researchLab/organicBuildCatalogG10ch3.ts'
import { G10_G11_EDU_EQUATIONS, type GradeEq } from '../src/data/researchLab/g10g11Equations.ts'
import { G10_CH3_EQUATIONS } from '../src/data/researchLab/g10EquationsCh3.ts'
import { ISOMER_CHALLENGES } from '../src/data/researchLab/researchLabData.ts'
import { G10_CH3_ISOMER_CHALLENGES } from '../src/data/researchLab/isomerChallengesG10ch3.ts'

const errors: string[] = []
const fail = (msg: string) => {
  errors.push(msg)
  console.error('FAIL', msg)
}
let checks = 0

// ── формулы ───────────────────────────────────────────────
const SUB = '₀₁₂₃₄₅₆₇₈₉'
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
type Counts = Record<string, number>
function add(into: Counts, from: Counts, k = 1) {
  for (const [el, n] of Object.entries(from)) into[el] = (into[el] ?? 0) + n * k
}

/** Нейтральная частица или ион без заряда в записи: скобки () и [], связи –=≡, ↓↑; R — «атом». */
function parseNeutral(raw: string): Counts | null {
  const s = raw
    .replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d)))
    .replace(/ₙ/g, '')
    .replace(/[–=≡•↓↑\s-]/g, '')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
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
        const mm = s.slice(i).match(/^[A-Z][a-z]?/)
        if (!mm) return null
        i += mm[0].length
        part = { [mm[0]]: 1 }
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
  return counts
}

/** Формула с зарядами: «[(C₂H₅)₂OH]⁺HSO₄⁻» — части, разделённые знаками заряда, складываются. */
function parseFormula(raw: string): { counts: Counts; charge: number } | null {
  const counts: Counts = {}
  let charge = 0
  const re = /([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])/g
  let last = 0
  let mm: RegExpExecArray | null
  const parts: { body: string; q: number }[] = []
  while ((mm = re.exec(raw))) {
    const mag = mm[1] ? Number([...mm[1]].map((c) => SUP.indexOf(c)).join('')) : 1
    parts.push({ body: raw.slice(last, mm.index), q: mm[2] === '⁺' ? mag : -mag })
    last = mm.index + mm[0].length
  }
  if (last < raw.length) parts.push({ body: raw.slice(last), q: 0 })
  for (const p of parts) {
    if (!p.body.trim()) return null
    const c = parseNeutral(p.body)
    if (!c) return null
    add(counts, c)
    charge += p.q
  }
  return { counts, charge }
}

function parseToken(tok: string): { counts: Counts; charge: number } | null {
  const mm = tok.trim().match(/^(\d*)(n?)(.*)$/)
  if (!mm) return null
  const k = mm[1] ? Number(mm[1]) : 1
  const body = parseFormula(mm[3]!)
  if (!body) return null
  const counts: Counts = {}
  add(counts, body.counts, k)
  return { counts, charge: body.charge * k }
}

function sideSum(tokens: readonly string[]): { counts: Counts; charge: number } | null {
  const counts: Counts = {}
  let charge = 0
  for (const tk of tokens) {
    const p = parseToken(tk)
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

// ── скелет и 3D ───────────────────────────────────────────
const VALENCE: Record<string, number> = { C: 4, O: 2, N: 3, S: 2, Cl: 1, Br: 1 }
function skeletonCounts(c: OrganicBuildChallenge): Counts {
  const out: Counts = {}
  const used = c.skeleton.elements.map(() => 0)
  for (const e of c.skeleton.edges) {
    const ord = e[2] ?? 1
    used[e[0]]! += ord
    used[e[1]]! += ord
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

/** Самая длинная цепь атомов C и наибольший цикл из атомов C (0 — нет). */
function carbonTopology(g: OrganicGraph): { longest: number; ring: number } {
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
  if (cs.length <= 40) for (const id of cs) dfs(id, id, new Set([id]))
  else longest = -1
  return { longest, ring }
}

/** Размер наибольшего цикла из тяжёлых атомов (для колец с O: диоксан, пиранозы). */
function heavyRing(g: OrganicGraph): number {
  const hv = g.atoms.filter((a) => a.element !== 'H').map((a) => a.id)
  const set = new Set(hv)
  const adj = new Map<string, string[]>(hv.map((id) => [id, []]))
  for (const b of g.bonds) {
    if (set.has(b.a) && set.has(b.b)) {
      adj.get(b.a)!.push(b.b)
      adj.get(b.b)!.push(b.a)
    }
  }
  let ring = 0
  const dfs = (start: string, cur: string, seen: Set<string>) => {
    if (seen.size > 8) return
    for (const nx of adj.get(cur)!) {
      if (nx === start && seen.size >= 3) ring = Math.max(ring, seen.size)
      if (seen.has(nx)) continue
      seen.add(nx)
      dfs(start, nx, seen)
      seen.delete(nx)
    }
  }
  for (const id of hv) dfs(id, id, new Set([id]))
  return ring
}

/** Правдоподобие 3D: длины связей, нет наложений атомов, углы у sp³-углерода вне малых колец. */
function geometryIssues(g: OrganicGraph, smallRing: boolean): string | null {
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
      const minD = A.element === 'H' && B.element === 'H' ? 1.0 : A.element === 'H' || B.element === 'H' ? 1.2 : 1.5
      if (d < minD) return `атомы ${A.element} и ${B.element} ближе ${minD} Å (${d.toFixed(2)})`
    }
  if (!smallRing) {
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
          if (deg < 95 || deg > 125) return `угол у sp³-C ${deg.toFixed(0)}°`
        }
    }
  }
  return null
}

// ── 1. Молекулы расшифровок ───────────────────────────────
type Expect = { f: string; chain?: number; ring?: number; heavyRing?: number; name?: RegExp }
const SPEC: Record<string, Expect> = {
  // § 3.1–3.2 (с. 107–113)
  methanol: { f: 'CH4O' },
  ethanol: { f: 'C2H6O' },
  propanol: { f: 'C3H8O', chain: 3 },
  'propan-2-ol': { f: 'C3H8O', chain: 3, name: /пропан-2-ол/ },
  'tert-butanol': { f: 'C4H10O', chain: 3, name: /2-метилпропан-2-ол/ },
  'allyl-alcohol': { f: 'C3H6O', chain: 3, name: /проп-2-ен-1-ол[\s\S]*виниловый спирт/i },
  '6-ethyl-4-methyl-3-chlorononan-4-ol': { f: 'C12H25ClO', chain: 9, name: /4-Метил-3-хлор-6-этилнонан-4-ол/ },
  'dimethyl-ether': { f: 'C2H6O' },
  methoxyethane: { f: 'C3H8O' },
  'diethyl-ether': { f: 'C4H10O' },
  'ethyl-acetate': { f: 'C4H8O2' },
  chloroethane: { f: 'C2H5Cl' },
  pentanal: { f: 'C5H10O', chain: 5 },
  'pentan-1-ol': { f: 'C5H12O', chain: 5 },
  'pent-2-en-1-ol': { f: 'C5H10O', chain: 5 },
  'ethyl-pent-2-enoate': { f: 'C7H12O2', chain: 5 },
  formaldehyde: { f: 'CH2O' },
  'formic-acid': { f: 'CH2O2' },
  // § 3.3–3.5 (с. 115–121)
  'ethylene-glycol': { f: 'C2H6O2' },
  glycerol: { f: 'C3H8O3' },
  xylitol: { f: 'C5H12O5', chain: 5, name: /пентан-1,2,3,4,5-пентол[\s\S]*пентанол/ },
  sorbitol: { f: 'C6H14O6', chain: 6, name: /гексан-1,2,3,4,5,6-гексол[\s\S]*гексанол/ },
  'butane-1-2-diol': { f: 'C4H10O2', chain: 4 },
  'butane-1-3-diol': { f: 'C4H10O2', chain: 4, name: /1,2-бутиленгликоль/ },
  'butane-1-4-diol': { f: 'C4H10O2', chain: 4, name: /«бутандиол-1,3»/ },
  'butane-2-3-diol': { f: 'C4H10O2', chain: 4, name: /«бутандиол-1,4»/ },
  '2-methylpropane-1-2-diol': { f: 'C4H10O2', chain: 3, name: /«бутандиол-2,3»/ },
  '2-methylpropane-1-3-diol': { f: 'C4H10O2', chain: 3, name: /«2-метилпропандиол-1,2»/ },
  'butane-1-2-4-triol': { f: 'C4H10O3', chain: 4 },
  '5-6-dimethyloctane-3-5-diol': { f: 'C10H22O2', chain: 8 },
  '2-chloroethanol': { f: 'C2H5ClO' },
  'ethylene-glycol-monoacetate': { f: 'C4H8O3' },
  '1-4-dioxane': { f: 'C4H8O2', heavyRing: 6 },
  'ethylene-oxide': { f: 'C2H4O', heavyRing: 3, name: /оксиран/ },
  '1-2-3-trichloropropane': { f: 'C3H5Cl3', chain: 3 },
  acetaldehyde: { f: 'C2H4O' },
}

const ownIds = new Set(G10_CH3_BUILD_CHALLENGES.map((c) => c.id))
{
  checks += 1
  if (ownIds.size !== G10_CH3_BUILD_CHALLENGES.length) fail('в organicBuildCatalogG10ch3 повторяются id')
  const seen = new Set<string>()
  for (const c of ORGANIC_BUILD_CHALLENGES) {
    if (seen.has(c.id)) fail(`каталог: повтор id ${c.id}`)
    seen.add(c.id)
  }
}

for (const [id, exp] of Object.entries(SPEC)) {
  checks += 1
  const mol = organicMoleculeById[id]
  if (!mol) {
    fail(`молекула ${id} отсутствует в реестре`)
    continue
  }
  const want = parseFormula(exp.f)!.counts
  const g = mol.graph
  if (!sameCounts(graphCounts(g), want)) fail(`${id}: 3D-граф ${fmt(graphCounts(g))} ≠ ${exp.f}`)
  if (!isValenceOk(g)) fail(`${id}: 3D-граф — ошибка валентности`)
  const topo = carbonTopology(g)
  if (exp.chain != null && topo.longest !== exp.chain) fail(`${id}: главная цепь ${topo.longest} C, ждали ${exp.chain}`)
  if (exp.ring != null && topo.ring !== exp.ring) fail(`${id}: кольцо ${topo.ring} C, ждали ${exp.ring}`)
  const hr = exp.heavyRing != null || exp.ring != null ? heavyRing(g) : 0
  if (exp.heavyRing != null && hr !== exp.heavyRing) fail(`${id}: цикл из ${hr} атомов, ждали ${exp.heavyRing}`)
  const geo = geometryIssues(g, (exp.heavyRing ?? 6) < 6 || (exp.ring ?? 6) < 6)
  if (geo) fail(`${id}: 3D-геометрия — ${geo}`)
  const c = organicBuildChallengeById(id)
  if (c) {
    const bySkeleton = skeletonCounts(c)
    if (!sameCounts(bySkeleton, want)) fail(`${id}: по скелету ${fmt(bySkeleton)}, в учебнике ${exp.f}`)
    const shown = parseFormula(c.formula)
    if (!shown || !sameCounts(shown.counts, want)) fail(`${id}: formula «${c.formula}» ≠ ${exp.f}`)
    const kit: Counts = {}
    for (const [el, n] of Object.entries(c.kit)) if (n) kit[el] = n
    if (!sameCounts(kit, want)) fail(`${id}: kit ${fmt(kit)} ≠ ${exp.f}`)
    if (canonicalizeSkeleton(stripHydrogens(g)) !== canonicalizeSkeleton(graphFromSkeletonSpec(c.skeleton))) {
      fail(`${id}: 3D-граф не совпадает со скелетом`)
    }
  }
  if (ownIds.has(id)) {
    const oc = G10_CH3_BUILD_CHALLENGES.find((x) => x.id === id)!
    if (!oc.hintEn.trim() || !oc.hintUz.trim() || oc.hintEn === oc.hintRu || oc.hintUz === oc.hintRu) fail(`${id}: нет подсказки EN/UZ`)
    if (!oc.titleEn.trim() || !oc.titleUz.trim()) fail(`${id}: нет названия EN/UZ`)
    if (!/Учебник|учебник|с\. \d/.test(oc.hintRu)) fail(`${id}: в подсказке нет ссылки на учебник`)
  }
  if (exp.name) {
    const text = `${mol.nameRu} ${mol.descriptionRu}`
    if (!exp.name.test(text)) fail(`${id}: нет названия/исправления ${exp.name}`)
  }
}
// Все молекулы файла главы III покрыты спецификацией
for (const c of G10_CH3_BUILD_CHALLENGES) {
  checks += 1
  if (!SPEC[c.id]) fail(`молекула ${c.id} не описана в спецификации теста`)
  const mol = organicMoleculeById[c.id]
  if (mol && mol.challengeId !== c.id) fail(`${c.id}: реестр берёт не запись каталога главы III`)
}

// ── 2. Уравнения ─────────────────────────────────────────
const eqById = new Map(G10_G11_EDU_EQUATIONS.map((x) => [x.id, x]))
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
{
  const ids = new Set<string>()
  for (const eq of G10_CH3_EQUATIONS) {
    checks += 1
    if (ids.has(eq.id)) fail(`повтор уравнения ${eq.id}`)
    ids.add(eq.id)
    if (eqById.get(eq.id) !== eq) fail(`${eq.id}: нет в G10_G11_EDU_EQUATIONS (или перекрыто)`)
    checkBalance(eq)
    if (!eq.hintEn || !eq.hintUz || eq.hintEn === eq.hintRu || eq.hintUz === eq.hintRu) fail(`${eq.id}: нет EN/UZ подсказки`)
    if (!eq.topicEn || !eq.topicUz || eq.topicEn === eq.topicRu) fail(`${eq.id}: нет EN/UZ темы`)
    if (!/Учебник, с\. \d/.test(eq.hintRu)) fail(`${eq.id}: в подсказке нет страницы учебника`)
    if (eq.conditionsRu && (!eq.conditionsEn || !eq.conditionsUz)) fail(`${eq.id}: условия без EN/UZ`)
  }
}

// ── 3. Уроки ─────────────────────────────────────────────
const LESSONS = ['alcohols', 'polyols']
const isoById = new Map(ISOMER_CHALLENGES.map((x) => [x.id, x]))
const usedEq = new Set<string>()
for (const lid of LESSONS) {
  checks += 1
  const lesson = ORGANIC_CURRICULUM_BY_ID[lid]
  if (!lesson) {
    fail(`нет урока ${lid}`)
    continue
  }
  if (lesson.chapter !== 3) fail(`${lid}: не глава 3`)
  for (const mid of lesson.challengeIds) {
    checks += 1
    if (!organicMoleculeById[mid]) fail(`${lid}: нет молекулы ${mid}`)
  }
  if (new Set(lesson.challengeIds).size !== lesson.challengeIds.length) fail(`${lid}: повтор молекулы в уроке`)
  if (!organicMoleculeById[lesson.defaultMolId]) fail(`${lid}: нет defaultMolId ${lesson.defaultMolId}`)
  for (const eid of lesson.equationIds) {
    checks += 1
    const eq = eqById.get(eid)
    if (!eq) fail(`${lid}: нет уравнения ${eid}`)
    else checkBalance(eq)
    usedEq.add(eid)
  }
  for (const iid of lesson.isomerChallengeIds) {
    checks += 1
    if (!isoById.has(iid)) fail(`${lid}: нет задания изомеров ${iid}`)
  }
  for (const qid of [lesson.nomenclatureQuizId, ...(lesson.extraQuizIds ?? [])].filter(Boolean) as string[]) {
    checks += 1
    if (!NOMENCLATURE_QUIZ_BY_ID[qid]) fail(`${lid}: нет квиза ${qid}`)
  }
  if (!lesson.goalEn || !lesson.goalUz || lesson.goalEn === lesson.goalRu) fail(`${lid}: нет цели EN/UZ`)
}
for (const eq of G10_CH3_EQUATIONS) {
  checks += 1
  if (!usedEq.has(eq.id)) fail(`уравнение ${eq.id} не входит ни в один урок главы III`)
}

// ── 4. Изомеры ───────────────────────────────────────────
for (const ch of G10_CH3_ISOMER_CHALLENGES) {
  checks += 1
  if (isoById.get(ch.id) !== ch) fail(`задание ${ch.id} не подключено в ISOMER_CHALLENGES`)
  const want = parseFormula(ch.formula.split(' ')[0]!)?.counts
  if (!want) {
    fail(`${ch.id}: формула задания «${ch.formula}»`)
    continue
  }
  const correct = ch.candidates.filter((x) => x.correct)
  if (correct.length !== ch.targetCount) fail(`${ch.id}: верных ${correct.length}, targetCount ${ch.targetCount}`)
  const seen = new Set<string>()
  for (const cand of ch.candidates) {
    const mol = organicMoleculeById[cand.id]
    if (!mol) {
      fail(`${ch.id}: нет 3D-молекулы ${cand.id}`)
      continue
    }
    const f = graphCounts(mol.graph)
    const shown = parseFormula(cand.formula)?.counts
    if (!shown || !sameCounts(shown, f)) fail(`${ch.id}/${cand.id}: подпись формулы ${cand.formula} ≠ ${fmt(f)}`)
    if (cand.correct) {
      if (!sameCounts(f, want)) fail(`${ch.id}/${cand.id}: не ${ch.formula}`)
      const key = canonicalizeSkeleton(stripHydrogens(mol.graph))
      if (seen.has(key)) fail(`${ch.id}/${cand.id}: повтор строения`)
      seen.add(key)
    } else if (sameCounts(f, want) && !/межклассов|interclass/.test(cand.hazardRu + cand.hazardEn)) {
      fail(`${ch.id}/${cand.id}: «ловушка» той же формулы без пояснения`)
    }
    if (!cand.nameEn || !cand.nameUz || !cand.hazardEn || !cand.hazardUz) fail(`${ch.id}/${cand.id}: нет EN/UZ`)
  }
}

// ── 5. Квизы и исправления учебника ──────────────────────
for (const quiz of G10_CH3_QUIZZES) {
  checks += 1
  if (NOMENCLATURE_QUIZ_BY_ID[quiz.id] !== quiz) fail(`квиз ${quiz.id} не подключён`)
  for (const qq of quiz.questions) {
    checks += 1
    const ok = qq.options.filter((x) => x.correct).length
    if (ok !== 1) fail(`квиз ${qq.id}: верных ответов ${ok}`)
    if (!qq.promptEn || !qq.promptUz || qq.promptEn === qq.promptRu) fail(`квиз ${qq.id}: нет EN/UZ`)
    for (const op of qq.options) {
      if (!op.labelEn || !op.labelUz) fail(`квиз ${qq.id}/${op.id}: нет EN/UZ`)
      if (/[а-яё]/i.test(op.labelEn)) fail(`квиз ${qq.id}/${op.id}: кириллица в EN «${op.labelEn}»`)
    }
  }
}

/** Уравнение: исправлено (нет записи учебника в токенах) и в подсказке сказано, как было в учебнике. */
const FIXES: Record<string, { hint: RegExp; notLeft?: string; notRight?: string }> = {
  'g10c3-etoh-hcl': { hint: /учебнике записано «2C₂H₅OH \+ HCl → 2C₂H₅Cl \+ H₂O»/, notLeft: '2C₂H₅OH' },
  'g10c3-iodoform': { hint: /«J»/ },
  'g10c3-pentanal-h2': { hint: /«H⁺»/ },
  'g10c3-glycol-acetic': { hint: /нет воды/ },
  'g10c3-glycerol-hno3': { hint: /O₂N–CH₂–C\(NO₂\)H–CH₂–NO₂/ },
  'g10c3-glycerol-rcooh': { hint: /«−H₂O»/ },
  'g10c3-chain1-elim': { hint: /Zn/, notLeft: 'Zn' },
  'g10c3-fat-hydrolysis-118': { hint: /омыление — щелочной гидролиз/ },
}
for (const [eid, fx] of Object.entries(FIXES)) {
  checks += 1
  const eq = eqById.get(eid)
  if (!eq) {
    fail(`нет уравнения ${eid}`)
    continue
  }
  if (!fx.hint.test(eq.hintRu)) fail(`${eid}: в подсказке нет пояснения ${fx.hint}`)
  if (fx.notLeft && eq.left.includes(fx.notLeft)) fail(`${eid}: в левой части осталась запись учебника ${fx.notLeft}`)
  if (fx.notRight && eq.right.includes(fx.notRight)) fail(`${eid}: в правой части осталась запись учебника ${fx.notRight}`)
}

console.log(`checks ${checks}`)
console.log(errors.length === 0 ? 'OK test-g10-ch3' : `FAILED ${errors.length}`)
process.exit(errors.length === 0 ? 0 : 1)
