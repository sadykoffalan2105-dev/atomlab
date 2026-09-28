/**
 * Единый школьный 3D-вид вещества (герой лаборатории = 3D карточки каталога):
 *  • кратность связей = школьная спецификация сцены / ядро (CO ≡, NO =, NO₂ = и →, N₂O ≡ и →, SO₂/SO₃ =,
 *    H₂SO₄ — две S=O и две S–OH, HNO₃ — одна N=O);
 *  • цвета шаров = CPK школьной сцены (C 0x6a707c, H × 0,9, S жёлтая), палочки — серые, как в сцене;
 *  • длины связей и углы = ядру ± 0,5 пм / ± 0,5°; шары 0,62 ковалентного (у ионов — ионный радиус);
 *  • поза: линейная молекула — по горизонтали, плоская — в плоскости экрана;
 *  • герой лаборатории и каталог строят вид одной функцией (buildSchoolHeroModel → SchoolMoleculeView).
 * Запуск: npx tsx scripts/test-hero-style.mts
 */
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import {
  ATOMIC_DATA,
  bondAngleDeg,
  bondLengthPm,
  getCrystal,
  radiusForSpecies,
  reagentAngleDeg,
  reagentBondPm,
  type ElementSymbol,
} from '../src/chemistry/data'
import { compoundById } from '../src/data/compounds'
import { buildSchoolHeroModel, findSchoolMolecule, inferOrders, type SchoolHeroModel } from '../src/components/lab/hero/schoolHeroModel'
import { SCHOOL_CARBON_HEX, SCHOOL_STICK_HEX, schoolAtomHex, schoolLabelDark } from '../src/components/lab/hero/schoolHeroStyle'
import { LATTICE_BALL_SCALE, pmToScene, speciesLabel } from '../src/lab/cinema/scenes/kit/cpkAtoms'
import { SCHOOL_DRAW } from '../src/lab/cinema/scenes/school/schoolModel'

let fails = 0
let checks = 0
function ok(cond: boolean, msg: string): void {
  checks++
  if (!cond) {
    fails++
    console.error(`  ✗ ${msg}`)
  }
}

const K = pmToScene(1)
const dist = (m: SchoolHeroModel, a: number, b: number) => {
  const p = m.atoms[a]!.pos
  const q = m.atoms[b]!.pos
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / K
}
const angle = (m: SchoolHeroModel, a: number, c: number, b: number) => {
  const p = m.atoms[a]!.pos
  const o = m.atoms[c]!.pos
  const q = m.atoms[b]!.pos
  const u = [p[0] - o[0], p[1] - o[1], p[2] - o[2]]
  const v = [q[0] - o[0], q[1] - o[1], q[2] - o[2]]
  const cs = (u[0]! * v[0]! + u[1]! * v[1]! + u[2]! * v[2]!) / (Math.hypot(u[0]!, u[1]!, u[2]!) * Math.hypot(v[0]!, v[1]!, v[2]!))
  return (Math.acos(Math.max(-1, Math.min(1, cs))) * 180) / Math.PI
}
const model = (id: string): SchoolHeroModel => {
  const c = compoundById[id]
  if (!c) throw new Error(`нет вещества ${id}`)
  const m = buildSchoolHeroModel(c)
  if (!m) throw new Error(`нет модели ${id}`)
  return m
}
/** Кратности связей по парам элементов: 'C-O' → [2, 2]. */
function ordersByPair(m: SchoolHeroModel): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const b of m.bonds) {
    const k = [m.atoms[b.a]!.el, m.atoms[b.b]!.el].sort().join('-')
    ;(out[k] ??= []).push(b.order)
  }
  for (const k of Object.keys(out)) out[k]!.sort()
  return out
}
const same = (a: Record<string, number[]>, b: Record<string, number[]>) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())

// ─── 1. Кратность связей ───
console.log('1) кратность связей')
const EXPECT: Record<string, Record<string, number[]>> = {
  h2o: { 'H-O': [1, 1] },
  co2: { 'C-O': [2, 2] },
  co: { 'C-O': [3] },
  so2: { 'O-S': [2, 2] },
  so3: { 'O-S': [2, 2, 2] },
  no: { 'N-O': [2] },
  no2: { 'N-O': [1, 2] },
  n2o: { 'N-N': [3], 'N-O': [1] },
  n2o5: { 'N-O': [1, 1, 1, 1, 2, 2] },
  hno3: { 'H-O': [1], 'N-O': [1, 1, 2] },
  h2so4: { 'O-S': [1, 1, 2, 2], 'H-O': [1, 1] },
  nh3: { 'H-N': [1, 1, 1] },
}
for (const [id, exp] of Object.entries(EXPECT)) {
  const m = model(id)
  const got = ordersByPair(m)
  ok(same(got, exp), `${id}: кратности ${JSON.stringify(got)} ≠ ${JSON.stringify(exp)}`)
}
// Школьные молекулы: кратность = число общих пар спецификации сцены.
for (const id of ['h2o', 'co2', 'co', 'so2', 'so3', 'no', 'no2', 'n2o', 'n2o5', 'hno3']) {
  const c = compoundById[id]!
  const hit = findSchoolMolecule({ ...c.composition })
  ok(hit != null, `${id}: нет молекулы в школьных сценах`)
  if (!hit) continue
  const m = model(id)
  ok(m.source === 'school', `${id}: источник ${m.source}, ожидался school`)
  const els = new Map(hit.spec.atoms.map((a) => [a.id, a.element]))
  const exp: Record<string, number[]> = {}
  for (const b of hit.mol.bonds) (exp[[els.get(b.a)!, els.get(b.b)!].sort().join('-')] ??= []).push(b.pairs.length)
  for (const k of Object.keys(exp)) exp[k]!.sort()
  ok(same(ordersByPair(m), exp), `${id}: кратности ≠ школьной сцене`)
}
// Правило валентности запасного пути (данные каталога без кратности).
ok(JSON.stringify(inferOrders(['C', 'O', 'O'], [[0, 1], [0, 2]])) === '[2,2]', 'inferOrders CO₂ → O=C=O')
ok(JSON.stringify(inferOrders(['N', 'N'], [[0, 1]])) === '[3]', 'inferOrders N₂ → N≡N')
ok(JSON.stringify(inferOrders(['P', 'O', 'O', 'O', 'O', 'H', 'H', 'H'], [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 6], [3, 7]])) === '[1,1,1,2,1,1,1]', 'inferOrders H₃PO₄ → одна P=O')
ok(JSON.stringify(inferOrders(['N', 'O', 'O', 'O', 'H'], [[0, 1], [0, 2], [0, 3], [1, 4]])) === '[1,2,1,1]', 'inferOrders HNO₃ → одна N=O')
ok(JSON.stringify(inferOrders(['C', 'H', 'H', 'H', 'H'], [[0, 1], [0, 2], [0, 3], [0, 4]])) === '[1,1,1,1]', 'inferOrders CH₄ — одинарные')

// ─── 2. Цвета и палочки ───
console.log('2) цвета CPK школьной сцены')
const sceneSrc = readFileSync(new URL('../src/lab/cinema/scenes/school/SchoolReactionScene.ts', import.meta.url), 'utf8')
ok(sceneSrc.includes(`setHex(0x${SCHOOL_CARBON_HEX.toString(16)})`), 'C графитовый 0x6a707c — как в сцене')
ok(sceneSrc.includes(`color: 0x${SCHOOL_STICK_HEX.dark.toString(16)}`), 'палочки тёмной темы — цвет сцены 0xd4dce6')
ok(sceneSrc.includes("a.element === 'H') col.multiplyScalar(0.9)"), 'H × 0,9 — как в сцене')
ok(schoolAtomHex('C') === 0x6a707c, 'C → 0x6a707c')
ok(schoolAtomHex('S') === ATOMIC_DATA.S.cpk, 'S — CPK (жёлтая)')
const sCol = new THREE.Color(schoolAtomHex('S'))
ok(sCol.r > 0.8 && sCol.g > 0.8 && sCol.b < 0.4, 'S жёлтая, не синяя')
ok(schoolAtomHex('H') === new THREE.Color(0xffffff).multiplyScalar(0.9).getHex(), 'H × 0,9')
ok(schoolAtomHex('O') === ATOMIC_DATA.O.cpk && schoolAtomHex('N') === ATOMIC_DATA.N.cpk, 'O, N — CPK')
ok(schoolLabelDark(schoolAtomHex('H')) && schoolLabelDark(schoolAtomHex('S')), 'на H и S — тёмная буква')
ok(!schoolLabelDark(schoolAtomHex('O')) && !schoolLabelDark(schoolAtomHex('C')), 'на O и C — белая буква')
const stickL = new THREE.Color(SCHOOL_STICK_HEX.light)
const stickD = new THREE.Color(SCHOOL_STICK_HEX.dark)
ok(stickL.r + stickL.g + stickL.b < stickD.r + stickD.g + stickD.b, 'светлая тема — палочки темнее')
{
  const h = SCHOOL_STICK_HEX.dark
  const ch = [(h >> 16) & 255, (h >> 8) & 255, h & 255]
  ok(Math.max(...ch) - Math.min(...ch) < 32, 'палочки серые (не цвет атома)')
}

// ─── 3. Длины, углы, радиусы ───
console.log('3) длины и углы = ядру')
const bondPm = (b: { bondKey?: string; lengthPm?: number }) => (b.bondKey ? bondLengthPm(b.bondKey as never) : b.lengthPm!)
for (const id of ['h2o', 'co2', 'co', 'so2', 'so3', 'no', 'no2', 'n2o', 'n2o5', 'hno3']) {
  const c = compoundById[id]!
  const hit = findSchoolMolecule({ ...c.composition })!
  const m = model(id)
  const idx = new Map(hit.mol.atoms.map((a, i) => [a, i]))
  for (const b of hit.mol.bonds) {
    const d = dist(m, idx.get(b.a)!, idx.get(b.b)!)
    ok(Math.abs(d - bondPm(b)) <= 0.5, `${id}: ${b.a}–${b.b} ${d.toFixed(2)} пм ≠ ${bondPm(b)}`)
  }
  for (const an of hit.mol.angles ?? []) {
    const want = an.angleKey ? bondAngleDeg(an.angleKey) : an.deg!
    const got = angle(m, idx.get(an.a)!, idx.get(an.center)!, idx.get(an.b)!)
    ok(Math.abs(got - want) <= 0.5, `${id}: ∠${an.a}${an.center}${an.b} ${got.toFixed(2)}° ≠ ${want}`)
  }
}
{
  const m = model('h2so4')
  const S = m.atoms.findIndex((a) => a.el === 'S')
  const oDouble = m.bonds.filter((b) => b.order === 2).map((b) => (b.a === S ? b.b : b.a))
  const oSingle = m.bonds.filter((b) => b.order === 1 && (b.a === S || b.b === S)).map((b) => (b.a === S ? b.b : b.a))
  for (const o of oDouble) ok(Math.abs(dist(m, S, o) - reagentBondPm('h2so4', 'S=O')) <= 0.5, 'H₂SO₄: S=O')
  for (const o of oSingle) ok(Math.abs(dist(m, S, o) - reagentBondPm('h2so4', 'S–O(H)')) <= 0.5, 'H₂SO₄: S–O(H)')
  ok(Math.abs(angle(m, oDouble[0]!, S, oDouble[1]!) - reagentAngleDeg('h2so4', '∠O=S=O')) <= 0.5, 'H₂SO₄: ∠O=S=O')
  ok(Math.abs(angle(m, oSingle[0]!, S, oSingle[1]!) - reagentAngleDeg('h2so4', '∠HO–S–OH')) <= 0.5, 'H₂SO₄: ∠HO–S–OH')
  for (const b of m.bonds.filter((x) => m.atoms[x.a]!.el === 'H' || m.atoms[x.b]!.el === 'H')) {
    const h = m.atoms[b.a]!.el === 'H' ? b.a : b.b
    const o = h === b.a ? b.b : b.a
    ok(Math.abs(dist(m, o, h) - reagentBondPm('h2so4', 'O–H')) <= 0.5, 'H₂SO₄: O–H')
    ok(Math.abs(angle(m, S, o, h) - reagentAngleDeg('h2so4', '∠S–O–H')) <= 0.5, 'H₂SO₄: ∠S–O–H')
  }
}
{
  const m = model('nh3')
  for (let i = 1; i < 4; i++) ok(Math.abs(dist(m, 0, i) - bondLengthPm('N-H')) <= 0.5, 'NH₃: N–H')
  ok(Math.abs(angle(m, 1, 0, 2) - bondAngleDeg('ammonia')) <= 0.5 && Math.abs(angle(m, 2, 0, 3) - bondAngleDeg('ammonia')) <= 0.5, 'NH₃: ∠H–N–H')
}
{
  // CH₄ — органическая молекула каталога (ORGANIC_MOLECULES); здесь — тот же вход по составу.
  const m = buildSchoolHeroModel({ id: 'test-ch4', composition: { C: 1, H: 4 }, atoms: [{ symbol: 'C', pos: [0, 0, 0] }], bonds: [] })!
  ok(m.source === 'core', 'CH₄: по ядру')
  for (let i = 1; i < 5; i++) ok(Math.abs(dist(m, 0, i) - bondLengthPm('C-H')) <= 0.5, 'CH₄: C–H')
  for (let i = 1; i < 5; i++) for (let j = i + 1; j < 5; j++) ok(Math.abs(angle(m, i, 0, j) - bondAngleDeg('methane')) <= 0.5, `CH₄: ∠H${i}CH${j}`)
}
// Радиусы шаров молекул: 0,62 ковалентного
for (const id of ['h2o', 'co2', 'so3', 'h2so4', 'hno3']) {
  const m = model(id)
  for (const a of m.atoms) ok(Math.abs(a.r - radiusForSpecies(a.el, 0, { model: 'covalent' }) * SCHOOL_DRAW.ballScale * K) < 1e-9, `${id}: шар ${a.el} = 0,62 ковалентного`)
}
// Кристаллы: ионы с зарядом, ионные радиусы, расстояние катион–анион = ядру
for (const [id, cation, anion] of [['nacl', 'Na⁺', 'Cl⁻'], ['mgo', 'Mg²⁺', 'O²⁻']] as const) {
  const m = model(id)
  ok(m.kind === 'crystal', `${id}: кристалл`)
  const labels = new Set(m.atoms.map((a) => a.label))
  ok(labels.has(cation) && labels.has(anion), `${id}: подписи ${cation}, ${anion}`)
  for (const a of m.atoms.slice(0, 6)) ok(a.label === speciesLabel(a.el, a.charge), `${id}: подпись ${a.label}`)
  for (const a of m.atoms) ok(Math.abs(a.r - a.radiusPm * LATTICE_BALL_SCALE * K) < 1e-9, `${id}: ионный радиус шара`)
  let nn = Infinity
  for (let i = 0; i < m.atoms.length; i++) for (let j = i + 1; j < m.atoms.length; j++) if (m.atoms[i]!.charge * m.atoms[j]!.charge < 0) nn = Math.min(nn, dist(m, i, j))
  const cr = getCrystal(id)!
  ok(Math.abs(nn - cr.cellPm.a / 2) <= 0.5, `${id}: катион–анион ${nn.toFixed(2)} пм ≠ a/2 = ${cr.cellPm.a / 2}`)
  ok(m.motion === 'orbit', `${id}: облёт`)
}

// ─── 4. Поза ───
console.log('4) поза: линейная — горизонтально, плоская — в плоскости экрана')
for (const id of ['co2', 'co', 'no', 'n2o']) {
  const m = model(id)
  const flat = m.atoms.every((a) => Math.abs(a.pos[1]) < 1e-6 && Math.abs(a.pos[2]) < 1e-6)
  ok(flat && m.yaw === 0, `${id}: ось по горизонтали, без рыскания`)
}
for (const id of ['h2o', 'so2', 'so3', 'no2', 'hno3']) {
  const m = model(id)
  ok(m.atoms.every((a) => Math.abs(a.pos[2]) < 6 * K) && m.yaw === 0, `${id}: в плоскости экрана`)
}

// ─── 5. Один путь для героя и каталога ───
console.log('5) герой и каталог — один вид')
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
ok(/buildSchoolHeroModel/.test(src('../src/components/lab/hero/ProductHero.tsx')) && /SchoolMoleculeView/.test(src('../src/components/lab/hero/ProductHero.tsx')), 'герой лаборатории — SchoolMoleculeView')
ok(/SchoolCatalogCanvas/.test(src('../src/components/lab/CatalogMoleculeHero.tsx')), 'каталог — SchoolCatalogCanvas')
ok(/SchoolCatalogCanvas/.test(src('../src/components/organicLab/OrganicMoleculeHero.tsx')), 'органика каталога — SchoolCatalogCanvas')
ok(/SchoolMoleculeView/.test(src('../src/components/lab/hero/SchoolCatalogCanvas.tsx')), 'SchoolCatalogCanvas — SchoolMoleculeView')
// Все вещества каталога получают школьную модель.
let built = 0
let missing: string[] = []
for (const c of Object.values(compoundById)) {
  if (!c.atoms.every((a) => a.symbol in ATOMIC_DATA)) continue
  const m = buildSchoolHeroModel(c)
  if (m) built++
  else missing.push(c.id)
}
ok(missing.length === 0, `нет школьной модели: ${missing.slice(0, 10).join(', ')}`)
for (const c of Object.values(compoundById)) {
  const m = buildSchoolHeroModel(c)
  if (!m) continue
  const bad = m.atoms.some((a) => !(a.el in ATOMIC_DATA)) || m.bonds.some((b) => b.order < 1 || b.order > 3)
  if (bad) missing.push(c.id)
}
ok(missing.length === 0, `модели с ошибкой: ${missing.slice(0, 10).join(', ')}`)
missing = []

console.log(`\n${checks - fails}/${checks} проверок, моделей: ${built}`)
if (fails > 0) {
  console.error(`test-hero-style: ${fails} ошибок`)
  process.exit(1)
}
console.log('test-hero-style: OK')
void (0 as unknown as ElementSymbol)
