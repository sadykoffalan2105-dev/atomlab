/**
 * Тест героя продукта и выбора научной сцены по реакции.
 *   npx tsx scripts/test-product-hero.mts
 *
 * Проверяется согласованность с ядром данных (crystalData / bondData / thermoData / atomicData)
 * и с банком реакций — а не наличие строк.
 *  A. Сцена выбирается ровно тогда, когда множество реагентов реакции банка совпадает с сигнатурой.
 *  B. Для 11 веществ: вид героя по данным; у кристаллов — целое число ячеек, соседи противоположного
 *     знака, радиусы Шеннона при КЧ из базиса, катион меньше аниона; у молекул — длины, углы и
 *     двугранный угол = bondData; у воды — водородные связи с длиной из ядра.
 *  C. Карточка: ΔH°f = thermoData, «почему» и тип структуры есть на трёх языках.
 */
import * as THREE from 'three'
import {
  BOND_DATA,
  bondAngleDeg,
  bondLengthPm,
  CRYSTAL_DATA,
  dihedralAngleDeg,
  FORMATION_ENTHALPY,
  radiusForSpecies,
} from '../src/chemistry/data'
import { HERO_COMPOUND_IDS, HERO_STRUCTURES, heroSpecFor, meanGasSpacingNm } from '../src/chemistry/data/heroStructures'
import { SCHOOL_REACTION_BANK } from '../src/chemistry/schoolReactionBank'
import { compoundById } from '../src/data/compounds'
import { getElementByZ } from '../src/data/elements'
import { messagesEn } from '../src/i18n/messagesEn'
import { messagesRu } from '../src/i18n/messagesRu'
import { messagesUz } from '../src/i18n/messagesUz'
import { formatHeroNumber, heroFormationLine } from '../src/components/lab/hero/heroCardData'
import { buildHeroModel, type HeroModel } from '../src/components/lab/hero/heroGeometry'
import { heroCaptionLines } from '../src/components/lab/hero/heroFrame'
import { latticeFragment } from '../src/lab/cinema/scenes/kit/lattice'
import { measureDihedral } from '../src/lab/cinema/core/vsepr'
import { pmToScene } from '../src/lab/cinema/scenes/kit/cpkAtoms'
import {
  SCIENTIFIC_SCENE_SIGNATURES,
  scientificSceneFor,
  type SceneReactant,
} from '../src/lab/scientificSynthesis/sceneSignatures'

let checks = 0
const fails: string[] = []
function ok(cond: unknown, msg: string): void {
  checks++
  if (!cond) fails.push(msg)
}
function near(a: number, b: number, tol: number, msg: string): void {
  ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b} (±${tol})`)
}

// ─── A. Сцена по реакции ─────────────────────────────────────────────────────

const toReactants = (r: (typeof SCHOOL_REACTION_BANK)[number]): SceneReactant[] =>
  r.reactants.map((x) => (x.kind === 'element' ? { z: x.z } : { compoundId: x.compoundId }))

/** Независимый ключ множества реагентов реакции банка (символы элементов и id соединений). */
const bankKey = (r: (typeof SCHOOL_REACTION_BANK)[number]): string =>
  [...new Set(r.reactants.map((x) => (x.kind === 'element' ? `el:${getElementByZ(x.z)!.symbol}` : `cmp:${x.compoundId}`)))]
    .sort()
    .join('+')
const sigKey = (s: { elements?: readonly string[]; compounds?: readonly string[] }): string =>
  [...(s.elements ?? []).map((e) => `el:${e}`), ...(s.compounds ?? []).map((c) => `cmp:${c}`)].sort().join('+')

const sceneIds = Object.keys(SCIENTIFIC_SCENE_SIGNATURES) as (keyof typeof SCIENTIFIC_SCENE_SIGNATURES)[]
let bankWithScene = 0
let playing = 0
for (const r of SCHOOL_REACTION_BANK) {
  if (!(sceneIds as string[]).includes(r.productId)) continue
  bankWithScene++
  const sigs = SCIENTIFIC_SCENE_SIGNATURES[r.productId as keyof typeof SCIENTIFIC_SCENE_SIGNATURES]
  const expected = sigs.some((s) => sigKey(s) === bankKey(r))
  const got = scientificSceneFor(r.productId, toReactants(r)) !== null
  if (got) playing++
  ok(got === expected, `A: ${r.id} (${r.equationRu}) — сцена ${got ? 'играет' : 'не играет'}, ожидалось ${expected ? 'играет' : 'не играет'}`)
  // Коэффициенты и порядок не важны: перестановка и удвоение реагентов не меняют выбор.
  const rev = [...toReactants(r)].reverse()
  ok((scientificSceneFor(r.productId, [...rev, ...rev]) !== null) === expected, `A: ${r.id} — выбор зависит от порядка/повторов`)
}
ok(bankWithScene >= 20, `A: в банке мало реакций с продуктом из реестра (${bankWithScene})`)

// Явные случаи из задания: какие реакции ОБЯЗАНЫ играть сцену, а какие — нет.
const MUST_PLAY = ['na-cl-nacl', 'c-o2-co2', 'caco3-decomp', 'h2-o2-h2o', 'n2-h2-nh3', 'fe-s-fes', 's-o2-so2', 'h2-cl2-hcl', 'mg-o2-mgo', 'zn-hcl', 'clo2-naclo2-cl2']
const MUST_NOT = ['naoh-hcl', 'na2co3-hcl', 'nahco3-hcl', 'mg-oh2-decomp', 'co-o2-co2', 'h2co3-decomp', 'h2o2-decomp', 'aloh3-decomp', 'ca-o2-cao', 'zn-cl2-zncl2', 'h2s-o2-so2', 'fes2-roast']
for (const id of [...MUST_PLAY, ...MUST_NOT]) {
  const r = SCHOOL_REACTION_BANK.find((x) => x.id === id)
  ok(r, `A: реакции ${id} нет в банке`)
  if (!r) continue
  const got = scientificSceneFor(r.productId, toReactants(r)) !== null
  ok(got === MUST_PLAY.includes(id), `A: ${id} (${r.equationRu}) — сцена ${got ? 'играет' : 'не играет'}`)
}
// Без реагентов и с чужим продуктом сцена не выбирается никогда.
ok(scientificSceneFor('nacl', []) === null, 'A: сцена без реагентов')
ok(scientificSceneFor('nacl', null) === null, 'A: сцена при null-реагентах')
ok(scientificSceneFor('mgo', [{ z: 11 }, { z: 17 }]) === null, 'A: реагенты NaCl не включают сцену MgO')
// Сигнатуры ссылаются на существующие элементы и соединения (кроме будущего 'ch4', см. комментарий).
for (const [id, sigs] of Object.entries(SCIENTIFIC_SCENE_SIGNATURES)) {
  ok(sigs.length > 0, `A: у сцены ${id} нет сигнатуры`)
  for (const s of sigs as readonly { elements?: readonly string[]; compounds?: readonly string[] }[]) {
    for (const e of s.elements ?? []) ok(/^[A-Z][a-z]?$/.test(e), `A: ${id}: «${e}» — не символ элемента`)
    for (const c of s.compounds ?? []) ok(c === 'ch4' || compoundById[c], `A: ${id}: соединения ${c} нет в каталоге`)
  }
}

// ─── B. Герой ────────────────────────────────────────────────────────────────

const PM = pmToScene(1)
const v = (m: HeroModel, i: number) => new THREE.Vector3(...m.atoms[i]!.pos)
const distPm = (m: HeroModel, i: number, j: number) => v(m, i).distanceTo(v(m, j)) / PM
const angleDeg = (m: HeroModel, a: number, c: number, b: number) =>
  (v(m, a).sub(v(m, c)).angleTo(v(m, b).sub(v(m, c))) * 180) / Math.PI

ok(HERO_COMPOUND_IDS.length === 11, 'B: ровно 11 веществ')
for (const id of HERO_COMPOUND_IDS) {
  const spec = heroSpecFor(id)
  ok(spec, `B: ${id}: нет описателя героя`)
  ok(compoundById[id], `B: ${id}: нет в каталоге`)
  const m = buildHeroModel(id)
  ok(m, `B: ${id}: модель не построена`)
  if (!spec || !m) continue
  ok(FORMATION_ENTHALPY[spec.formationKey], `B: ${id}: нет ΔH°f «${spec.formationKey}» в thermoData`)

  if (spec.kind === 'crystal') {
    const cr = CRYSTAL_DATA[spec.crystalId]
    ok(cr?.basis && cr.basis.length > 0, `B: ${id}: у кристалла ${spec.crystalId} нет базиса`)
    if (!cr) continue
    // Целое число ячеек, фрагмент = генератор решётки
    ok(m.cells && m.cells.every((n) => Number.isInteger(n) && n >= 1), `B: ${id}: нецелое число ячеек ${m.cells}`)
    const frag = latticeFragment(spec.crystalId, [spec.cells[0], spec.cells[1], spec.cells[2]])
    ok(frag.sites.length === m.atoms.length, `B: ${id}: число узлов ${m.atoms.length} ≠ фрагменту ${frag.sites.length}`)
    ok(m.cellEdges.length > 0, `B: ${id}: нет рёбер ячейки`)
    // Подпись: a из ячейки, группа и КЧ из данных; только символы, числа и токены
    const cap = heroCaptionLines(m.caption).join(' · ')
    ok(cap.includes(cr.spaceGroup), `B: ${id}: в подписи нет группы ${cr.spaceGroup}`)
    ok(cap.includes(`{cn} ${Object.values(cr.coordination).join(':')}`), `B: ${id}: в подписи нет КЧ`)
    ok(cap.includes('a = ') && cap.includes('{pm}'), `B: ${id}: в подписи нет параметра a`)
    ok(!/[а-яё]/i.test(cap), `B: ${id}: в 3D-подписи есть слова: «${cap}»`)
    // Соседи: у внутренних узлов первая сфера — только противоположный сорт (ионы — противоположный знак)
    const d0 = cr.cationAnionPm
    let inner = 0
    for (let i = 0; i < m.atoms.length; i++) {
      const a = m.atoms[i]!
      const near1: number[] = []
      for (let j = 0; j < m.atoms.length; j++) if (j !== i && distPm(m, i, j) < d0 * 1.13) near1.push(j)
      if (spec.radiusModel === 'ionic') {
        ok(a.charge !== 0, `B: ${id}: ион без заряда`)
        for (const j of near1) ok(Math.sign(m.atoms[j]!.charge) === -Math.sign(a.charge), `B: ${id}: одноимённые ионы — соседи (${a.el}${a.charge} и ${m.atoms[j]!.el}${m.atoms[j]!.charge})`)
      } else {
        for (const j of near1) ok(m.atoms[j]!.el !== a.el, `B: ${id}: одинаковые атомы ${a.el} в первой сфере`)
      }
      // Полная первая сфера у внутреннего узла = КЧ узла в бесконечном кристалле (генератор решётки)
      if (near1.length === frag.sites[i]!.cn && frag.sites[i]!.cn > 0) inner++
      // Радиус: Шеннон при КЧ узла (ионные) или Кордеро (каркас); КЧ узла = coordination
      if (spec.radiusModel === 'ionic') {
        near(a.radiusPm, radiusForSpecies(a.el, a.charge, { cn: a.cn, model: 'ionic' }), 1e-9, `B: ${id}: радиус ${a.el}${a.charge} при КЧ ${a.cn}`)
        const cnData = Object.entries(cr.coordination).find(([k]) => k.startsWith(a.el))?.[1]
        ok(cnData === a.cn, `B: ${id}: КЧ ${a.el} ${a.cn} ≠ crystalData ${cnData}`)
      } else {
        near(a.radiusPm, radiusForSpecies(a.el, 0, { model: 'covalent' }), 1e-9, `B: ${id}: ковалентный радиус ${a.el}`)
      }
    }
    ok(inner > 0, `B: ${id}: нет ни одного внутреннего узла с полной первой сферой`)
    // Катион меньше аниона (на экране — те же отношения)
    if (spec.radiusModel === 'ionic') {
      const cat = m.atoms.find((a) => a.charge > 0)!
      const an = m.atoms.find((a) => a.charge < 0)!
      ok(cat.radius < an.radius, `B: ${id}: катион ${cat.el} (${cat.radius}) не меньше аниона ${an.el} (${an.radius})`)
      near(cat.radius / an.radius, cat.radiusPm / an.radiusPm, 1e-9, `B: ${id}: отношение радиусов на экране ≠ Шеннону`)
    }
    // Без палочек у ионной решётки, σ-связи Si–O у каркаса = bondData
    if (spec.drawBonds) {
      ok(m.bonds.length > 0, `B: ${id}: у каркаса нет связей`)
      const siO = BOND_DATA['Si-O'].lengthsPm ?? [bondLengthPm('Si-O')]
      const [lo, hi] = [Math.min(...siO), Math.max(...siO)]
      for (const b of m.bonds) ok(b.lengthPm >= lo - 0.5 && b.lengthPm <= hi + 0.5, `B: ${id}: Si–O ${b.lengthPm} вне bondData ${lo}–${hi}`)
    } else {
      ok(m.bonds.length === 0, `B: ${id}: у ионной решётки нарисованы палочки`)
    }
  } else {
    const g = spec.geometry
    const main = m.atoms.filter((a) => !a.neighbor).length
    if (g.shape === 'bent') {
      near(distPm(m, 0, 1), bondLengthPm(g.bond), 1e-6, `B: ${id}: ${g.bond}`)
      near(distPm(m, 0, 2), bondLengthPm(g.bond), 1e-6, `B: ${id}: ${g.bond}`)
      near(angleDeg(m, 1, 0, 2), bondAngleDeg(g.angle), 1e-6, `B: ${id}: угол ${g.angle}`)
    } else if (g.shape === 'linear') {
      near(distPm(m, 0, 1), bondLengthPm(g.bond), 1e-6, `B: ${id}: ${g.bond}`)
      near(angleDeg(m, 1, 0, 2), bondAngleDeg('carbonDioxide'), 1e-6, `B: ${id}: линейность`)
    } else if (g.shape === 'trigonalPlanar') {
      for (const j of [1, 2, 3]) near(distPm(m, 0, j), bondLengthPm(g.bond), 1e-6, `B: ${id}: ${g.bond}`)
      near(angleDeg(m, 1, 0, 2), bondAngleDeg(g.angle), 1e-6, `B: ${id}: угол ${g.angle}`)
      // плоский: сумма трёх углов = 360°
      near(angleDeg(m, 1, 0, 2) + angleDeg(m, 2, 0, 3) + angleDeg(m, 3, 0, 1), 360, 1e-6, `B: ${id}: не плоский`)
    } else if (g.shape === 'peroxide') {
      near(distPm(m, 0, 1), bondLengthPm(g.oo), 1e-6, `B: ${id}: ${g.oo}`)
      near(distPm(m, 0, 2), bondLengthPm(g.oh), 1e-6, `B: ${id}: ${g.oh}`)
      near(distPm(m, 1, 3), bondLengthPm(g.oh), 1e-6, `B: ${id}: ${g.oh}`)
      near(angleDeg(m, 1, 0, 2), bondAngleDeg(g.angle), 1e-6, `B: ${id}: угол O–O–H`)
      near(angleDeg(m, 0, 1, 3), bondAngleDeg(g.angle), 1e-6, `B: ${id}: угол O–O–H (второй)`)
      near(Math.abs(measureDihedral(v(m, 2), v(m, 0), v(m, 1), v(m, 3))), dihedralAngleDeg(g.dihedral), 1e-4, `B: ${id}: двугранный угол`)
    } else {
      near(distPm(m, 0, 1), bondLengthPm(g.bridge), 1e-6, `B: ${id}: ${g.bridge}`)
      near(distPm(m, 0, 2), bondLengthPm(g.bridge), 1e-6, `B: ${id}: ${g.bridge}`)
      near(angleDeg(m, 1, 0, 2), bondAngleDeg(g.bridgeAngle), 1e-6, `B: ${id}: мостиковый угол`)
      for (const j of [3, 4, 5]) near(distPm(m, 1, j), bondLengthPm(g.term), 1e-6, `B: ${id}: ${g.term}`)
      near(angleDeg(m, 3, 1, 4), bondAngleDeg(g.termAngle), 1e-4, `B: ${id}: угол между концевыми`)
      ok(main === 9, `B: ${id}: атомов ${main}, ожидалось 9`)
    }
    // Все связи главной молекулы = bondData по своим длинам
    for (const b of m.bonds) if (b.kind !== 'hbond') near(distPm(m, b.a, b.b), b.lengthPm, 1e-6, `B: ${id}: связь ${b.a}-${b.b}`)
    if (spec.neighbors === 'hbond-water') {
      const hb = m.bonds.filter((b) => b.kind === 'hbond')
      ok(hb.length === 4, `B: ${id}: водородных связей ${hb.length}, ожидалось 4`)
      for (const b of hb) {
        near(distPm(m, b.a, b.b), bondLengthPm('O-H...O'), 1e-6, `B: ${id}: H···O`)
        const hIdx = m.atoms[b.a]!.el === 'H' ? b.a : b.b
        ok(m.atoms[hIdx]!.el === 'H', `B: ${id}: водородная связь не через H`)
      }
    } else {
      ok(m.atoms.every((a) => !a.neighbor), `B: ${id}: соседи без данных о межмолекулярных расстояниях`)
    }
    ok(m.cellEdges.length === 0, `B: ${id}: у молекулы рёбра ячейки`)
  }
}
// Карта героев ссылается только на существующие кристаллы
for (const [id, spec] of Object.entries(HERO_STRUCTURES)) {
  if (spec.kind === 'crystal') ok(CRYSTAL_DATA[spec.crystalId]?.basis, `B: ${id}: кристалл ${spec.crystalId} без базиса`)
}
// Прочие вещества каталога — прежний вид (модели нет)
ok(buildHeroModel('salt_k_mno4') === null, 'B: у вещества вне списка появился герой')
// Газ: соседи не рисуются, среднее расстояние ≈ 3,4 нм при 25 °C
near(meanGasSpacingNm(), 3.44, 0.02, 'B: расстояние между молекулами газа')

// ─── C. Карточка ─────────────────────────────────────────────────────────────

for (const id of HERO_COMPOUND_IDS) {
  const spec = heroSpecFor(id)!
  const fd = FORMATION_ENTHALPY[spec.formationKey]!
  for (const loc of ['ru', 'en', 'uz'] as const) {
    const line = heroFormationLine(spec.formationKey, loc)
    ok(line, `C: ${id}: нет строки ΔH°f`)
    if (!line) continue
    ok(line.text.includes(formatHeroNumber(fd.dHfKJ, 1, loc)), `C: ${id}/${loc}: ΔH°f в карточке ≠ thermoData (${line.text})`)
    ok(line.estimated === Boolean(fd.estimated), `C: ${id}: пометка «оценка» не совпадает с ядром`)
  }
  for (const [loc, table] of [['ru', messagesRu], ['en', messagesEn], ['uz', messagesUz]] as const) {
    const t = table as Record<string, string>
    const why = t[`hero.why.${id}`]
    ok(typeof why === 'string' && why.length > 30, `C: ${id}: нет «почему» на ${loc}`)
    ok(typeof t[`hero.structure.${id}`] === 'string', `C: ${id}: нет типа структуры на ${loc}`)
    if (loc !== 'ru') ok(why !== (messagesRu as Record<string, string>)[`hero.why.${id}`], `C: ${id}: «почему» на ${loc} не переведено`)
  }
}
// Число в «почему» MgO берётся параметром из ядра (U(MgO)/U(NaCl)), а не зашито в текст
for (const table of [messagesRu, messagesEn, messagesUz]) {
  ok((table as Record<string, string>)['hero.why.mgo']?.includes('{ratio}'), 'C: «почему» MgO без параметра {ratio}')
}
// Cl₂O₇ эндотермичен — знак «+» в карточке
ok(heroFormationLine('Cl2O7(l)', 'ru')!.text.includes('= +'), 'C: у Cl₂O₇ нет знака «+»')

if (fails.length) {
  console.error(`❌ test-product-hero: ${fails.length} из ${checks} проверок не прошли`)
  for (const f of fails.slice(0, 60)) console.error('  • ' + f)
  process.exit(1)
}
console.log(`✅ test-product-hero: ${checks} проверок пройдено (реакций с продуктом из реестра: ${bankWithScene}, со сценой: ${playing})`)
