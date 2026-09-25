/**
 * Частицы реактора вне каталога (src/data/labSpecies.ts): ионы, электрон, органика, простые вещества.
 * Сверка с научным ядром (длины связей и углы из bondData), а не со строками:
 *  • состав геометрии = составу формулы, заряд иона = заряду в формуле;
 *  • длины связей и валентные углы — ровно те, что заданы (ядро или справочная таблица модуля);
 *  • у органики нет «слипшихся» атомов, кольцо глюкозы замкнуто, конфигурация D;
 *  • экран реакции (scientificStageLayout) считает заряды: Ba²⁺ + SO₄²⁻ → BaSO₄ даёт строку «± 0 = 0».
 *
 * Запуск: npx tsx scripts/test-lab-species.mts
 */
import assert from 'node:assert/strict'
import { bondAngleDeg, bondLengthPm } from '../src/chemistry/data/index.ts'
import { formulaCompositionKey, parseFormula } from '../src/chemistry/equationFormula.ts'
import {
  ION_ANGLE_DEG,
  ION_BOND_A,
  angleAt,
  diatomicBondA,
  distance,
  ionGeometry,
  organicGeometry,
  type LabGeometry,
} from '../src/chemistry/labSpeciesGeometry.ts'
import { scientificStageLayout } from '../src/components/lab/scientific/scientificReactorStageLayout.ts'
import { compoundById } from '../src/data/compounds.ts'
import {
  ELECTRON_SPECIES_ID,
  allLabIons,
  allLabOrganics,
  ionSpeciesFor,
  labCompoundById,
  labSpeciesKind,
  simpleSpeciesFor,
} from '../src/data/labSpecies.ts'

let checks = 0
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg)
  checks++
}
const near = (a: number, b: number, tol: number, msg: string) => ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(4)} против ${b} (±${tol})`)

/** Индексы атомов-соседей центра (связи из геометрии). */
const neighbors = (g: LabGeometry, c: number) =>
  g.bonds.flatMap(([a, b]) => (a === c ? [b] : b === c ? [a] : []))

// ── 1. Ионы: состав, заряд, id не пересекаются с каталогом ──
const ions = allLabIons()
ok(ions.length >= 35, `ионов в реестре ${ions.length}`)
for (const ion of ions) {
  ok(ion.charge != null && ion.charge !== 0, `${ion.formulaUnicode}: заряд задан`)
  ok(!compoundById[ion.id], `${ion.id}: не в каталоге`)
  ok(labSpeciesKind(ion.id) === 'ion', `${ion.id}: вид ion`)
  const parsed = parseFormula(ion.formulaUnicode)
  ok(parsed != null && parsed.charge === ion.charge, `${ion.formulaUnicode}: заряд в формуле = ${ion.charge}`)
  ok(parsed != null && formulaCompositionKey(parsed.counts) === formulaCompositionKey(ion.composition), `${ion.formulaUnicode}: состав формулы = состав частицы`)
  const geoCounts: Record<string, number> = {}
  for (const a of ion.atoms) geoCounts[a.symbol] = (geoCounts[a.symbol] ?? 0) + 1
  ok(formulaCompositionKey(geoCounts) === formulaCompositionKey(ion.composition), `${ion.formulaUnicode}: атомы геометрии = составу`)
  ok(ionSpeciesFor(ion.composition, ion.charge!) === ion, `${ion.formulaUnicode}: поиск по составу и заряду`)
}
// Fe²⁺ и Fe³⁺ — разные частицы с одинаковым составом
ok(ionSpeciesFor({ Fe: 1 }, 2) !== ionSpeciesFor({ Fe: 1 }, 3), 'Fe²⁺ ≠ Fe³⁺')

// ── 2. Геометрия ионов: длины и углы ──
const tetra = bondAngleDeg('tetrahedral')
const checkCentered = (key: string, bond: number, angle: number, label: string) => {
  const g = ionGeometry(key)!
  const nb = neighbors(g, 0)
  for (const i of nb) near(distance(g, 0, i), bond, 1e-9, `${label}: длина связи`)
  for (let i = 0; i < nb.length; i++)
    for (let j = i + 1; j < nb.length; j++) near(angleAt(g, nb[i]!, 0, nb[j]!), angle, 0.01, `${label}: угол`)
}
checkCentered('SO4', ION_BOND_A.SO_sulfate, tetra, 'SO₄²⁻ тетраэдр')
checkCentered('PO4', ION_BOND_A.PO_phosphate, tetra, 'PO₄³⁻ тетраэдр')
checkCentered('CrO4', ION_BOND_A.CrO_chromate, tetra, 'CrO₄²⁻ тетраэдр')
checkCentered('NH4', ION_BOND_A.NH_ammonium, tetra, 'NH₄⁺ тетраэдр')
checkCentered('CO3', bondLengthPm('C-O(CO3)') / 100, bondAngleDeg('carbonate'), 'CO₃²⁻ треугольник (ядро)')
checkCentered('NO3', ION_BOND_A.NO_nitrate, 120, 'NO₃⁻ треугольник')
checkCentered('H3O', ION_BOND_A.OH_hydronium, ION_ANGLE_DEG.hydronium, 'H₃O⁺ пирамида')
checkCentered('ClO3', ION_BOND_A.ClO_chlorate, ION_ANGLE_DEG.chlorate, 'ClO₃⁻ пирамида')
checkCentered('IO3', ION_BOND_A.IO_iodate, ION_ANGLE_DEG.iodate, 'IO₃⁻ пирамида')
// плоские ионы — все атомы в одной плоскости, пирамиды — нет
const planar = (g: LabGeometry) => g.atoms.every((a) => Math.abs(a.pos[2] - g.atoms[0]!.pos[2]) < 1e-9)
ok(planar(ionGeometry('CO3')!) && planar(ionGeometry('NO3')!), 'CO₃²⁻ и NO₃⁻ плоские')
ok(!planar(ionGeometry('H3O')!) && !planar(ionGeometry('ClO3')!), 'H₃O⁺ и ClO₃⁻ — пирамиды')
// гидроксил оксоаниона: O–H из ядра, угол X–O–H из таблицы модуля
for (const key of ['HSO4', 'HPO4', 'H2PO4', 'HCO3']) {
  const g = ionGeometry(key)!
  for (let h = 0; h < g.atoms.length; h++) {
    if (g.atoms[h]!.symbol !== 'H') continue
    const o = neighbors(g, h)[0]!
    near(distance(g, o, h), bondLengthPm('O-H') / 100, 1e-9, `${key}: O–H (ядро)`)
    near(angleAt(g, 0, o, h), ION_ANGLE_DEG.xoh, 1e-6, `${key}: X–O–H`)
  }
}

// ── 3. Органика: длины из ядра, углы, нет наложений ──
const orgs = allLabOrganics()
ok(orgs.length === 7, `органических частиц ${orgs.length}`)
const minNonBonded = (g: LabGeometry) => {
  const bonded = new Set(g.bonds.map(([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`))
  let m = Infinity
  for (let i = 0; i < g.atoms.length; i++)
    for (let j = i + 1; j < g.atoms.length; j++) if (!bonded.has(`${i}-${j}`)) m = Math.min(m, distance(g, i, j))
  return m
}
for (const c of orgs) {
  ok(labSpeciesKind(c.id) === 'organic' && !compoundById[c.id], `${c.id}: органика вне каталога`)
  const g = { atoms: c.atoms, bonds: c.bonds as [number, number][] }
  const parsed = parseFormula(c.formulaUnicode)!
  ok(formulaCompositionKey(parsed.counts) === formulaCompositionKey(c.composition), `${c.formulaUnicode}: состав`)
  ok(minNonBonded(g) > 1.0, `${c.formulaUnicode}: несвязанные атомы не ближе 1 Å (${minNonBonded(g).toFixed(3)})`)
  // у каждого C — 4 соседа (sp³), 3 (sp², HCHO) или 2 (sp, C₂H₂): валентность соблюдена
  for (let i = 0; i < c.atoms.length; i++) {
    const sym = c.atoms[i]!.symbol
    const n = neighbors(g, i).length
    if (sym === 'H') ok(n === 1, `${c.formulaUnicode}: H одновалентен`)
    if (sym === 'O') ok(n === 1 || n === 2, `${c.formulaUnicode}: O 1–2 соседа`)
  }
}
const CH = bondLengthPm('C-H') / 100
const ch4 = organicGeometry('CH4')!
for (const i of neighbors(ch4, 0)) near(distance(ch4, 0, i), CH, 1e-9, 'CH₄: C–H (ядро)')
near(angleAt(ch4, 1, 0, 2), bondAngleDeg('methane'), 0.01, 'CH₄: H–C–H (ядро)')
const c3h8 = organicGeometry('C3H8')!
near(angleAt(c3h8, 0, 1, 2), 112.4, 1e-6, 'C₃H₈: C–C–C')
near(distance(c3h8, 0, 1), bondLengthPm('C-C') / 100, 1e-9, 'C₃H₈: C–C (ядро)')
const etoh = organicGeometry('C2H5OH')!
near(angleAt(etoh, 0, 1, 2), 107.8, 1e-6, 'C₂H₅OH: C–C–O')
near(distance(etoh, 1, 2), bondLengthPm('C-O') / 100, 1e-9, 'C₂H₅OH: C–O (ядро)')
const hcho = organicGeometry('HCHO')!
near(angleAt(hcho, 2, 0, 3), 116.1, 1e-6, 'HCHO: H–C–H')
ok(planar(hcho), 'HCHO плоская')
const c2h2 = organicGeometry('C2H2')!
near(angleAt(c2h2, 2, 0, 1), 180, 1e-6, 'C₂H₂ линейная')
near(distance(c2h2, 0, 1), bondLengthPm('C#C') / 100, 1e-9, 'C₂H₂: C≡C (ядро)')
// глюкоза: 24 атома, кольцо из 6 атомов замкнуто (C1–O5 ≈ 1.43 Å), конфигурация D (C5 — R)
const glc = organicGeometry('C6H12O6')!
ok(glc.atoms.length === 24, 'C₆H₁₂O₆: 24 атома')
near(distance(glc, 5, 0), 1.43, 0.005, 'глюкоза: кольцо C1–O5 замкнуто')
near(angleAt(glc, 4, 5, 0), 111.5, 2, 'глюкоза: C5–O5–C1 тетраэдрический')
{
  const p = (i: number) => glc.atoms[i]!.pos
  const sub = (a: readonly number[], b: readonly number[]) => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!]
  const c5 = p(4)
  const c6 = neighbors(glc, 4).find((i) => i > 5 && glc.atoms[i]!.symbol === 'C')!
  const u = sub(p(5), c5)
  const v = sub(p(3), c5)
  const w = sub(p(c6), c5)
  const triple = u[0]! * (v[1]! * w[2]! - v[2]! * w[1]!) - u[1]! * (v[0]! * w[2]! - v[2]! * w[0]!) + u[2]! * (v[0]! * w[1]! - v[1]! * w[0]!)
  ok(triple < 0, 'глюкоза: C5 в R-конфигурации (D-сахар)')
}

// ── 4. Простые вещества и электрон ──
for (const [sym, z] of [['H', 1], ['N', 7], ['O', 8], ['Cl', 17]] as const) {
  const s = simpleSpeciesFor(z, 2)!
  ok(s != null && labSpeciesKind(s.id) === 'simple', `${sym}₂: простое вещество`)
  near(distance({ atoms: s.atoms, bonds: [] }, 0, 1), diatomicBondA(sym)!, 1e-9, `${sym}₂: длина связи (ядро)`)
}
ok(simpleSpeciesFor(80, 1)?.formulaUnicode === 'Hg', 'Hg: одноатомное простое вещество')
ok(labCompoundById[ELECTRON_SPECIES_ID]?.charge === -1, 'e⁻: заряд −1')

// ── 5. Экран реакции считает заряды ──
{
  const ba = ionSpeciesFor({ Ba: 1 }, 2)!
  const so4 = ionSpeciesFor({ S: 1, O: 4 }, -2)!
  const layout = scientificStageLayout(
    [
      { id: 'a', z: 56, coeff: 1, compoundId: ba.id },
      { id: 'b', z: 16, coeff: 1, compoundId: so4.id },
    ],
    [],
    'salt_ba_so4',
    1,
  )
  const q = layout.tally.rows.find((r) => r.kind === 'charge')
  ok(q != null && q.left === 0 && q.right === 0 && q.equal, 'Ba²⁺ + SO₄²⁻ → BaSO₄: заряд 0 = 0')
  ok(layout.tally.equal, 'Ba²⁺ + SO₄²⁻ → BaSO₄: счёт сходится')
  // одноатомный ион — шар с зарядом (роль Ba2+), многоатомный — 5 атомов
  ok(layout.roles.some((r) => r.id === 'Ba2+' && r.charge === 2), 'Ba²⁺: роль с зарядом')
  ok(layout.units.find((u) => u.termKey === 'b')?.atomCount === 5, 'SO₄²⁻: 5 атомов')
  const e = scientificStageLayout([{ id: 'fe', z: 26, coeff: 1 }], [{ id: 'q', compoundId: ionSpeciesFor({ Fe: 1 }, 2)!.id, coeff: 1 }], ELECTRON_SPECIES_ID, 2)
  const qe = e.tally.rows.find((r) => r.kind === 'charge')
  ok(qe != null && qe.left === 0 && qe.right === 0, 'Fe → Fe²⁺ + 2e⁻: заряд 0 = 0')
  ok(e.units.filter((u) => u.termKey === `product:${ELECTRON_SPECIES_ID}`).every((u) => u.atomCount === 1), 'e⁻: частица на сцене')
  const bad = scientificStageLayout([{ id: 'fe', z: 26, coeff: 1 }], [{ id: 'q', compoundId: ionSpeciesFor({ Fe: 1 }, 2)!.id, coeff: 1 }], ELECTRON_SPECIES_ID, 1)
  ok(!bad.tally.equal, 'Fe → Fe²⁺ + e⁻: заряд не сходится — счёт не зелёный')
}

console.log(`✓ частицы реактора вне каталога: ${checks} проверок пройдено`)
