/**
 * Реактор, этап балансировки: «частица = формульная единица».
 * Тест сверяет частицы реактора с ядром данных (src/chemistry/data), а не со строками:
 *   • двухатомные: атомов = coeff × 2, расстояние в молекуле = bondLengthPm, кратность связи;
 *   • металл: 2 Na на расстоянии ближайших соседей своей решётки (из базиса crystalData);
 *   • сложные реагенты: все атомы формулы каталога (H₂SO₄, KMnO₄, P₄O₁₀);
 *   • сумма атомов частиц слева по элементам = счётчик ReactorAtomLedger;
 *   • радиусы — того типа, что требует документ (Кордеро / металлический / Шеннон).
 * Запуск: npx tsx scripts/test-reactor-particles.mts
 */
import assert from 'node:assert/strict'
import {
  ATOMIC_DATA,
  BOND_DATA,
  bondLengthPm,
  getCrystal,
  radiusForSpecies,
  type BondKey,
  type ElementSymbol,
} from '../src/chemistry/data/index.ts'
import type { ReactorEquationTerm } from '../src/chemistry/reactorEquationBalance.ts'
import { compoundById } from '../src/data/compounds.ts'
import { latticeFragment } from '../src/lab/cinema/scenes/kit/lattice.ts'
import { pmToScene, SPECIES_SCALE } from '../src/lab/cinema/scenes/kit/cpkAtoms.ts'
import {
  buildAtomLedger,
  buildReactorParticles,
  electronRole,
  leftTermsComposition,
  particleSetComposition,
  rightSideComposition,
  type ReactorParticleSet,
} from '../src/lab/reactorParticles.ts'

let checks = 0
function ok(cond: unknown, msg: string): void {
  checks++
  assert.ok(cond, msg)
}
function near(a: number, b: number, tol: number, msg: string): void {
  checks++
  assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`)
}

const Z: Record<string, number> = Object.fromEntries(
  (Object.keys(ATOMIC_DATA) as ElementSymbol[]).map((s) => [s, ATOMIC_DATA[s].z]),
)
const TOL = 1e-6

function worldPos(set: ReactorParticleSet, pi: number, ai: number): [number, number, number] {
  const p = set.particles[pi]!
  const a = p.atoms[ai]!
  return [p.center[0] + a.pos[0], p.center[1] + a.pos[1], p.center[2] + a.pos[2]]
}
function d3(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
}

// ── 1. Двухатомные: 2 атома на молекулу, длина = bondData, без призраков ─────
const DIATOMIC: Array<[ElementSymbol, BondKey, number]> = [
  ['Cl', 'Cl-Cl', 1],
  ['O', 'O=O', 2],
  ['H', 'H-H', 1],
  ['N', 'N#N', 3],
]
for (const [el, key, order] of DIATOMIC) {
  for (const coeff of [1, 2, 3]) {
    const set = buildReactorParticles([{ id: `t-${el}`, z: Z[el]!, coeff, diatomic: true }])
    ok(set.particles.length === coeff, `${el}₂ ×${coeff}: частиц ${set.particles.length}, ожидалось ${coeff}`)
    ok(set.atomCount === coeff * 2, `${el}₂ ×${coeff}: атомов ${set.atomCount}, ожидалось ${coeff * 2} (никакого третьего атома)`)
    for (let pi = 0; pi < set.particles.length; pi++) {
      const p = set.particles[pi]!
      ok(p.atoms.length === 2, `${el}₂: в молекуле ${p.atoms.length} атома`)
      ok(p.bonds.length === 1 && p.bonds[0]!.order === order, `${el}₂: кратность связи ${p.bonds[0]?.order}, ожидалась ${order}`)
      near(d3(worldPos(set, pi, 0), worldPos(set, pi, 1)), pmToScene(bondLengthPm(key)), TOL, `${el}–${el} = ${key} из bondData`)
      for (const a of p.atoms) {
        ok(a.radiusKind === 'covalent', `${el} в молекуле — ковалентный радиус Кордеро`)
        near(a.radiusPm, ATOMIC_DATA[el].covalentRadiusPm, TOL, `${el}: радиус = covalentRadiusPm`)
        near(a.radius, pmToScene(a.radiusPm) * SPECIES_SCALE, TOL, `${el}: масштаб шара = kit (pmToScene · SPECIES_SCALE)`)
      }
      ok(p.label.startsWith(`${el}₂`), `${el}₂: подпись частицы «${p.label}»`)
    }
    // Молекулы одного кластера не перекрываются: атомы разных молекул дальше, чем сумма радиусов шаров.
    for (let i = 0; i < set.particles.length; i++)
      for (let j = i + 1; j < set.particles.length; j++)
        for (let ai = 0; ai < 2; ai++)
          for (let aj = 0; aj < 2; aj++) {
            const ri = set.particles[i]!.atoms[ai]!.radius
            const rj = set.particles[j]!.atoms[aj]!.radius
            ok(d3(worldPos(set, i, ai), worldPos(set, j, aj)) > ri + rj, `${el}₂ ×${coeff}: молекулы ${i} и ${j} слиплись`)
          }
  }
}

// ── 2. Металл: 2 Na — ближайшие соседи ОЦК из базиса crystalData ─────────────
function nnFromCrystal(id: string, el: ElementSymbol): number {
  const frag = latticeFragment(id, [2, 2, 2])
  let min = Infinity
  for (let i = 0; i < frag.sites.length; i++) {
    if (frag.sites[i]!.el !== el) continue
    for (let j = i + 1; j < frag.sites.length; j++) {
      if (frag.sites[j]!.el !== el) continue
      min = Math.min(min, d3(frag.posPm[i]!, frag.posPm[j]!))
    }
  }
  return min
}
for (const [el, crystal] of [
  ['Na', 'na_metal'],
  ['Mg', 'mg_metal'],
  ['Al', 'al_metal'],
  ['Pb', 'pb_metal'],
] as Array<[ElementSymbol, string]>) {
  ok(getCrystal(crystal)?.basis?.length, `${crystal}: базис решётки есть в ядре`)
  const set = buildReactorParticles([{ id: `m-${el}`, z: Z[el]!, coeff: 2 }])
  ok(set.atomCount === 2, `2 ${el}: атомов ${set.atomCount}`)
  near(d3(worldPos(set, 0, 0), worldPos(set, 1, 0)), pmToScene(nnFromCrystal(crystal, el)), 1e-6, `2 ${el}: расстояние = ближайшие соседи ${crystal}`)
  for (const p of set.particles) {
    ok(p.atoms[0]!.radiusKind === 'metallic', `${el}: металлический радиус`)
    near(p.atoms[0]!.radiusPm, ATOMIC_DATA[el].metallicRadiusPm!, TOL, `${el}: радиус = metallicRadiusPm`)
  }
  // Коэффициент 5 — пять атомов, каждый на узле решётки: любой атом имеет соседа на nn.
  const five = buildReactorParticles([{ id: `m5-${el}`, z: Z[el]!, coeff: 5 }])
  ok(five.atomCount === 5, `5 ${el}: атомов ${five.atomCount}`)
  const nn = pmToScene(nnFromCrystal(crystal, el))
  for (let i = 0; i < 5; i++) {
    let best = Infinity
    for (let j = 0; j < 5; j++) if (j !== i) best = Math.min(best, d3(worldPos(five, i, 0), worldPos(five, j, 0)))
    ok(best >= nn - 1e-6, `5 ${el}: атом ${i} ближе соседа решётки`)
  }
}

// Графит: атомы одного слоя на C–C, связи фрагмента — только на этой длине.
{
  const set = buildReactorParticles([{ id: 'c', z: Z.C!, coeff: 3 }])
  ok(set.atomCount === 3, `3 C: атомов ${set.atomCount}`)
  const cl = set.clusters[0]!
  ok(cl.links.length >= 2, `3 C графита: связей слоя ${cl.links.length}`)
  for (const l of cl.links) {
    near(
      d3(worldPos(set, cl.particles[l.pa]!, 0), worldPos(set, cl.particles[l.pb]!, 0)),
      pmToScene(nnFromCrystal('graphite', 'C')),
      1e-6,
      'графит: C–C слоя = ближайшие соседи решётки графита',
    )
  }
  const ys = set.particles.map((p) => p.center[1])
  ok(Math.max(...ys) - Math.min(...ys) < 1e-6, 'графит: атомы в одном слое')
}

// Сера: соседи по короне S₈ на S–S.
{
  const set = buildReactorParticles([{ id: 's', z: Z.S!, coeff: 2 }])
  near(d3(worldPos(set, 0, 0), worldPos(set, 1, 0)), pmToScene(bondLengthPm('S-S')), 1e-6, 'S₈: S–S')
}

// ── 3. Сложные реагенты: все атомы формулы ───────────────────────────────────
for (const id of ['h2so4', 'salt_k_mno4', 'tb_p4o10']) {
  const c = compoundById[id]
  ok(c, `${id} есть в каталоге`)
  for (const coeff of [1, 2]) {
    const set = buildReactorParticles([{ id: `x-${id}`, z: 0, coeff, compoundId: id }])
    const comp = particleSetComposition(set)
    for (const [el, n] of Object.entries(c!.composition)) {
      ok(comp[el] === Number(n) * coeff, `${coeff} ${c!.formulaUnicode}: ${el} ${comp[el]} ≠ ${Number(n) * coeff}`)
    }
    ok(set.particles.length === coeff, `${c!.formulaUnicode}: частиц ${set.particles.length}`)
  }
}
// KMnO₄: K без связей — катион K⁺ с ионным радиусом Шеннона.
{
  const set = buildReactorParticles([{ id: 'k', z: 0, coeff: 1, compoundId: 'salt_k_mno4' }])
  const k = set.particles[0]!.atoms.find((a) => a.el === 'K')!
  ok(k.charge === 1 && k.radiusKind === 'ionic', 'KMnO₄: K⁺')
  near(k.radiusPm, radiusForSpecies('K', 1), TOL, 'K⁺: радиус Шеннона')
  // Связанные атомы на сумме ковалентных радиусов (в среднем) — геометрия нормирована.
  const p = set.particles[0]!
  let cur = 0
  let target = 0
  for (const b of p.bonds) {
    const A = p.atoms[b.a]!
    const B = p.atoms[b.b]!
    cur += d3(A.pos, B.pos)
    target += pmToScene(A.radiusPm + B.radiusPm)
  }
  near(cur / p.bonds.length, target / p.bonds.length, 1e-6, 'KMnO₄: средняя связь = сумма радиусов Кордеро')
}

// ── 4. Счётчик атомов = частицы слева ────────────────────────────────────────
const EQUATIONS: Array<{ name: string; left: ReactorEquationTerm[]; product: string; k: number; balanced: boolean }> = [
  { name: '2Na + Cl₂ → 2NaCl', left: [{ id: 'a', z: Z.Na!, coeff: 2 }, { id: 'b', z: Z.Cl!, coeff: 1, diatomic: true }], product: 'nacl', k: 2, balanced: true },
  { name: '2Na + 2Cl₂ → 2NaCl', left: [{ id: 'a', z: Z.Na!, coeff: 2 }, { id: 'b', z: Z.Cl!, coeff: 2, diatomic: true }], product: 'nacl', k: 2, balanced: false },
  { name: '2H₂ + O₂ → 2H₂O', left: [{ id: 'a', z: Z.H!, coeff: 2, diatomic: true }, { id: 'b', z: Z.O!, coeff: 1, diatomic: true }], product: 'h2o', k: 2, balanced: true },
  { name: 'C + O₂ → CO₂', left: [{ id: 'a', z: Z.C!, coeff: 1 }, { id: 'b', z: Z.O!, coeff: 1, diatomic: true }], product: 'co2', k: 1, balanced: true },
  { name: '2Mg + O₂ → 2MgO', left: [{ id: 'a', z: Z.Mg!, coeff: 2 }, { id: 'b', z: Z.O!, coeff: 1, diatomic: true }], product: 'mgo', k: 2, balanced: true },
  { name: '2Mg + O₂ → MgO', left: [{ id: 'a', z: Z.Mg!, coeff: 2 }, { id: 'b', z: Z.O!, coeff: 1, diatomic: true }], product: 'mgo', k: 1, balanced: false },
]
for (const eq of EQUATIONS) {
  const set = buildReactorParticles(eq.left)
  const fromParticles = particleSetComposition(set)
  const left = leftTermsComposition(eq.left)
  ok(JSON.stringify(Object.entries(fromParticles).sort()) === JSON.stringify(Object.entries(left).sort()), `${eq.name}: атомы частиц ${JSON.stringify(fromParticles)} = счётчик ${JSON.stringify(left)}`)
  const ledger = buildAtomLedger(left, rightSideComposition(compoundById[eq.product]!, eq.k))
  ok(ledger.balanced === eq.balanced, `${eq.name}: balanced=${ledger.balanced}`)
}
// Рецепт с compoundId: 2 KMnO₄ + H₂SO₄ → Mn₂O₇ + K₂SO₄ + H₂O (учебник 9 кл.).
{
  const left: ReactorEquationTerm[] = [
    { id: 'a', z: 0, coeff: 2, compoundId: 'salt_k_mno4' },
    { id: 'b', z: 0, coeff: 1, compoundId: 'h2so4' },
  ]
  const set = buildReactorParticles(left)
  const lc = leftTermsComposition(left)
  ok(JSON.stringify(Object.entries(particleSetComposition(set)).sort()) === JSON.stringify(Object.entries(lc).sort()), 'KMnO₄ + H₂SO₄: частицы = счётчик')
  const right = rightSideComposition(compoundById.tb_mn2o7!, 1, [
    { id: 'c', coeff: 1, compoundId: 'salt_k_so4' },
    { id: 'd', coeff: 1, compoundId: 'h2o' },
  ])
  ok(buildAtomLedger(lc, right).balanced, 'Mn₂O₇ по учебнику: счётчик сходится')
}

// ── 5. Роли в переносе электронов ────────────────────────────────────────────
{
  const na = electronRole('Na', ['Na', 'Cl'])
  ok(na.kind === 'donor' && na.electrons === 1, 'Na отдаёт 1 e⁻')
  const mg = electronRole('Mg', ['Mg', 'O'])
  ok(mg.kind === 'donor' && mg.electrons === 2, 'Mg отдаёт 2 e⁻')
  const cl = electronRole('Cl', ['Na', 'Cl'])
  ok(cl.kind === 'acceptor' && cl.electrons === 1, 'Cl принимает 1 e⁻')
  const o = electronRole('O', ['Mg', 'O'])
  ok(o.kind === 'acceptor' && o.electrons === 2, 'O принимает 2 e⁻')
  ok(electronRole('O', ['H', 'O']).kind === 'shares', 'H₂ + O₂: ковалентные связи (обобществление)')
}

// ── 6. Ряд кластеров: порядок уравнения слева направо, без наложений ─────────
{
  const set = buildReactorParticles([
    { id: 'a', z: Z.Na!, coeff: 3 },
    { id: 'b', z: Z.Cl!, coeff: 3, diatomic: true },
  ])
  const [c0, c1] = set.clusters
  ok(c0!.center[0] + c0!.halfExtent[0] < c1!.center[0] - c1!.halfExtent[0], 'кластеры не перекрываются и идут в порядке уравнения')
  ok(set.clusters[1]!.label === 'Cl₂ (g)' && set.clusters[0]!.label === 'Na (s)', `подписи кластеров «${set.clusters[0]!.label}», «${set.clusters[1]!.label}»`)
}

void BOND_DATA
console.log(`✅ частицы реактора: ${checks} проверок пройдено`)
