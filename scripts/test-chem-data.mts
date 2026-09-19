#!/usr/bin/env node
/**
 * ATOMLAB — проверка научного ядра данных (src/chemistry/data).
 *
 * Профессор химии смотрит не на анимацию, а на числа, поэтому ядро проверяется
 * в Node, без браузера и без three:
 *   • катион МЕНЬШЕ своего атома, анион БОЛЬШЕ (иначе сцена врёт про перенос электрона);
 *   • Na⁺ меньше Cl⁻ в 1.7–1.9 раза;
 *   • суммы циклов Борна — Габера сходятся с табличной ΔH°f (±5 кДж/моль);
 *   • тепловой эффект по энергиям связей совпадает с расчётом по ΔH°f (±25 кДж/моль);
 *   • знаки термохимии: ΔH_субл > 0, IE > 0, EA₁ ≤ 0 (кроме несвязанных анионов), U_реш < 0;
 *   • все цвета CPK — валидные 24-битные числа;
 *   • ключи не дублируются, все ссылки между таблицами разрешаются.
 *
 * Запуск: npx tsx scripts/test-chem-data.mts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  ATOMIC_DATA,
  ELEMENT_SYMBOLS,
  atomicRadiusPm,
  chargeKey,
  covalentRadiusPm,
  cpkColor,
  cpkCss,
  ionChargesOf,
  ionicRadiusPm,
  isElementSymbol,
  metallicRadiusPm,
  radiusForSpecies,
  type ElementSymbol,
} from '../src/chemistry/data/atomicData.ts'
import {
  BOND_ANGLES,
  BOND_DATA,
  DIPOLE_MOMENTS,
  bondAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  type BondKey,
} from '../src/chemistry/data/bondData.ts'
import { CRYSTAL_DATA, CRYSTAL_IDS, cellAngstrom, isCationSite } from '../src/chemistry/data/crystalData.ts'
import {
  BORN_HABER,
  FORMATION_ENTHALPY,
  LATTICE_ENTHALPY_KJ,
  MOLECULAR_REACTIONS,
  bornHaberResidualKJ,
  bornHaberSumKJ,
  dHfKJ,
  reactionEnthalpyBothKJ,
} from '../src/chemistry/data/thermoData.ts'
import {
  BOND_ANGLE_DEG,
  BOND_LENGTH_A,
  COVALENT_RADIUS_A,
  CPK,
  IONIC_RADIUS_A,
  METALLIC_RADIUS_A,
  SCENE_PER_ANGSTROM,
  sceneRadius,
} from '../src/lab/cinema/core/atoms.ts'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

let checks = 0
const ok = (cond: boolean, message: string) => {
  assert.ok(cond, message)
  checks++
}
const near = (a: number, b: number, tol: number, message: string) =>
  ok(Math.abs(a - b) <= tol, `${message}: ${a} против ${b} (допуск ±${tol})`)

const section = (title: string) => console.log(`\n── ${title}`)

// ─────────────────────────────────────────────────────────────────────────────
section('1. Радиусы: катион сжимается, анион раздувается')
// ─────────────────────────────────────────────────────────────────────────────

for (const symbol of ELEMENT_SYMBOLS) {
  const atom = atomicRadiusPm(symbol)
  ok(atom > 0, `${symbol}: атомный радиус задан`)
  ok(covalentRadiusPm(symbol) > 0, `${symbol}: ковалентный радиус задан`)

  for (const charge of ionChargesOf(symbol)) {
    const r = ionicRadiusPm(symbol, charge)
    ok(r !== null && r > 0, `${symbol}${chargeKey(charge)}: ионный радиус задан`)
    if (charge > 0) {
      ok(
        (r as number) < atom,
        `${symbol}${chargeKey(charge)}: КАТИОН обязан быть меньше атома (${r} пм против ${atom} пм)`,
      )
    } else {
      ok(
        (r as number) > atom,
        `${symbol}${chargeKey(charge)}: АНИОН обязан быть больше атома (${r} пм против ${atom} пм)`,
      )
    }
  }
}

// Ключевая пропорция урока «ионная связь»: хлорид-ион почти вдвое крупнее иона натрия.
const naPlus = ionicRadiusPm('Na', 1) as number
const clMinus = ionicRadiusPm('Cl', -1) as number
ok(naPlus === 102, `Na⁺ = 102 пм (Shannon, КЧ 6), получено ${naPlus}`)
ok(clMinus === 181, `Cl⁻ = 181 пм (Shannon, КЧ 6), получено ${clMinus}`)
const ratio = clMinus / naPlus
ok(ratio > 1.7 && ratio < 1.9, `Cl⁻/Na⁺ должно быть 1.7…1.9, получено ${ratio.toFixed(3)}`)

// Металл: нейтральный атом берёт металлический радиус, ион — шеннонов.
ok(metallicRadiusPm('Na') === 186, 'металлический радиус Na = 186 пм')
ok(radiusForSpecies('Na', 0) === 186, 'radiusForSpecies(Na, 0) = металлический радиус')
ok(radiusForSpecies('Na', 1) === 102, 'radiusForSpecies(Na, +1) = ионный радиус')
ok(radiusForSpecies('Cl', 0) === 102, 'radiusForSpecies(Cl, 0) = ковалентный радиус 102 пм')
ok(radiusForSpecies('Cl', -1) === 181, 'radiusForSpecies(Cl, −1) = 181 пм')
ok(
  radiusForSpecies('Na', 0) > radiusForSpecies('Na', 1),
  'Na⁰ → Na⁺: атом натрия ОБЯЗАН сжаться при потере электрона',
)
ok(
  radiusForSpecies('Cl', -1) > radiusForSpecies('Cl', 0),
  'Cl⁰ → Cl⁻: атом хлора ОБЯЗАН раздуться при захвате электрона',
)

// Сценовые радиусы наследуют ту же пропорцию.
const sceneRatio = sceneRadius('Cl', -1) / sceneRadius('Na', 1)
near(sceneRatio, ratio, 1e-9, 'sceneRadius сохраняет отношение Cl⁻/Na⁺')
ok(sceneRadius('Na', 1) > 0 && SCENE_PER_ANGSTROM > 0, 'sceneRadius возвращает положительный масштаб')

// ─────────────────────────────────────────────────────────────────────────────
section('2. Цвета CPK и служебные поля')
// ─────────────────────────────────────────────────────────────────────────────

for (const symbol of ELEMENT_SYMBOLS) {
  const hex = cpkColor(symbol)
  ok(Number.isInteger(hex) && hex >= 0 && hex <= 0xffffff, `${symbol}: цвет CPK — валидное 24-битное число`)
  ok(/^#[0-9a-f]{6}$/.test(cpkCss(symbol)), `${symbol}: cpkCss даёт #rrggbb`)
  const datum = ATOMIC_DATA[symbol]
  ok(datum.ie1KJ > 0, `${symbol}: первая энергия ионизации > 0 (процесс эндотермический)`)
  if (datum.ie2KJ != null) ok(datum.ie2KJ > datum.ie1KJ, `${symbol}: IE₂ > IE₁`)
  ok(datum.configuration.length > 0, `${symbol}: есть электронная конфигурация`)
  ok(datum.valenceElectrons > 0, `${symbol}: есть число валентных электронов`)
  ok(datum.vdwRadiusPm > datum.covalentRadiusPm, `${symbol}: ван-дер-ваальсов радиус больше ковалентного`)
  if (datum.electronAffinityKJ > 0) {
    ok(
      Boolean(datum.electronAffinityNote),
      `${symbol}: положительное сродство к электрону обязано быть объяснено в примечании`,
    )
  }
}

// Цвета из требований учебника
ok(cpkColor('H') === 0xffffff, 'H — белый')
ok(cpkColor('O') === 0xff0040, 'O — красный')
ok(cpkColor('S') === 0xffff30, 'S — жёлтый')
ok(cpkColor('Fe') === 0xe06633, 'Fe — оранжево-бурый')
ok(cpkColor('Zn') === 0x7d80b0, 'Zn — сине-серый')
ok(isElementSymbol('Fe') && !isElementSymbol('Xx'), 'isElementSymbol различает символы')

// ─────────────────────────────────────────────────────────────────────────────
section('3. Связи: длины, энергии, углы, диполи')
// ─────────────────────────────────────────────────────────────────────────────

for (const [key, bond] of Object.entries(BOND_DATA)) {
  ok(bond.key === key, `${key}: поле key совпадает с ключом таблицы`)
  ok(bond.lengthPm > 50 && bond.lengthPm < 400, `${key}: длина связи в разумных пределах`)
  ok(bond.enthalpyKJ > 0, `${key}: энергия связи положительна (её тратят на разрыв)`)
  ok(bond.context.length > 0, `${key}: указано, в какой молекуле измерено`)
}

// Требования задания — точные значения
const expectBond: ReadonlyArray<readonly [BondKey, number]> = [
  ['H-H', 436],
  ['Cl-Cl', 243],
  ['O=O', 498],
  ['N#N', 945],
  ['H-Cl', 431],
  ['O-H', 463],
  ['N-H', 391],
  ['C=O(CO2)', 799],
  ['S=O', 522],
  ['C-H', 413],
]
for (const [key, kJ] of expectBond) ok(bondEnthalpyKJ(key) === kJ, `E(${key}) = ${kJ} кДж/моль`)

// Порядок связи виден в длине: тройная короче двойной, двойная короче одинарной
ok(bondLengthPm('N#N') < bondLengthPm('N=N'), 'N≡N короче N=N')
ok(bondLengthPm('N=N') < bondLengthPm('N-N'), 'N=N короче N–N')
ok(bondEnthalpyKJ('N#N') > bondEnthalpyKJ('N=N'), 'N≡N прочнее N=N')
ok(bondLengthPm('C#C') < bondLengthPm('C=C') && bondLengthPm('C=C') < bondLengthPm('C-C'), 'C≡C < C=C < C–C')
ok(
  bondLengthPm('Cl-O(ClO2)') < bondLengthPm('Cl-O'),
  'Cl–O в радикале ClO₂ короче, чем в ионе ClO₂⁻ (порядок связи выше)',
)

near(bondAngleDeg('water'), 104.45, 1e-9, 'угол H–O–H')
near(bondAngleDeg('ammonia'), 106.7, 1e-9, 'угол H–N–H')
near(bondAngleDeg('sulfurDioxide'), 119.5, 1e-9, 'угол O–S–O')
near(bondAngleDeg('carbonDioxide'), 180, 1e-9, 'угол O–C–O')
near(bondAngleDeg('methane'), 109.47, 1e-9, 'угол H–C–H')
ok(bondAngleDeg('water') < bondAngleDeg('ammonia'), 'у воды две неподелённые пары — угол меньше, чем у аммиака')
ok(bondAngleDeg('ammonia') < bondAngleDeg('tetrahedral'), 'неподелённая пара сжимает аммиак ниже тетраэдра')

for (const [key, angle] of Object.entries(BOND_ANGLES)) {
  ok(angle.key === key, `${key}: поле key совпадает с ключом`)
  ok(angle.deg > 0 && angle.deg <= 180, `${key}: угол в (0, 180]`)
}

near(DIPOLE_MOMENTS.H2O.debye, 1.85, 1e-9, 'дипольный момент H₂O')
near(DIPOLE_MOMENTS.NH3.debye, 1.47, 1e-9, 'дипольный момент NH₃')
near(DIPOLE_MOMENTS.HCl.debye, 1.08, 1e-9, 'дипольный момент HCl')
ok(DIPOLE_MOMENTS.CO2.debye === 0, 'CO₂ линейна и симметрична — дипольный момент 0')
for (const [key, dip] of Object.entries(DIPOLE_MOMENTS)) {
  ok(dip.debye >= 0, `${key}: модуль дипольного момента неотрицателен`)
  if (dip.debye === 0) ok(Boolean(dip.note), `${key}: нулевой диполь обязан быть объяснён`)
}

// ─────────────────────────────────────────────────────────────────────────────
section('4. Кристаллы')
// ─────────────────────────────────────────────────────────────────────────────

for (const id of CRYSTAL_IDS) {
  const c = CRYSTAL_DATA[id]
  ok(c.id === id, `${id}: поле id совпадает с ключом`)
  ok(c.spaceGroupNo >= 1 && c.spaceGroupNo <= 230, `${id}: номер пространственной группы в 1…230`)
  ok(c.spaceGroup.length > 1, `${id}: задан символ Германа — Могена`)
  ok(c.cellPm.a > 100, `${id}: параметр ячейки задан в пм`)
  ok(c.z >= 1 && Number.isInteger(c.z), `${id}: Z — целое ≥ 1`)
  ok(c.densityGCm3 > 0, `${id}: плотность задана`)
  ok(Object.keys(c.coordination).length > 0, `${id}: заданы координационные числа`)
  for (const [ion, cn] of Object.entries(c.coordination)) ok(cn >= 2 && cn <= 12, `${id}/${ion}: КЧ в 2…12`)
  ok(c.cationAnionPm > 100 && c.cationAnionPm < c.cellPm.a * 1.2, `${id}: расстояние соседей меньше ячейки`)
}

// Структурный тип NaCl: расстояние катион–анион — ровно половина ребра
for (const id of ['nacl', 'mgo', 'cao'] as const) {
  const c = CRYSTAL_DATA[id]
  near(c.cationAnionPm, c.cellPm.a / 2, 0.05, `${id}: d(катион–анион) = a/2 (структура каменной соли)`)
  ok(c.coordination[Object.keys(c.coordination)[0]] === 6, `${id}: КЧ 6:6`)
}

// Сумма шенноновых радиусов должна воспроизводить реальное расстояние в решётке
near((ionicRadiusPm('Na', 1) as number) + clMinus, CRYSTAL_DATA.nacl.cationAnionPm, 3, 'NaCl: r(Na⁺) + r(Cl⁻) ≈ a/2')
near(
  (ionicRadiusPm('Mg', 2) as number) + (ionicRadiusPm('O', -2) as number),
  CRYSTAL_DATA.mgo.cationAnionPm,
  3,
  'MgO: r(Mg²⁺) + r(O²⁻) ≈ a/2',
)
near(
  (ionicRadiusPm('Ca', 2) as number) + (ionicRadiusPm('O', -2) as number),
  CRYSTAL_DATA.cao.cationAnionPm,
  3,
  'CaO: r(Ca²⁺) + r(O²⁻) ≈ a/2',
)

// CsCl — примитивная кубическая, а не ОЦК: расстояние равно a·√3/2
near(CRYSTAL_DATA.cscl.cationAnionPm, (CRYSTAL_DATA.cscl.cellPm.a * Math.sqrt(3)) / 2, 0.2, 'CsCl: d = a·√3/2')
ok(CRYSTAL_DATA.cscl.coordination['Cs⁺'] === 8, 'CsCl: КЧ 8:8')
ok(CRYSTAL_DATA.cscl.latticeType === 'примитивная кубическая', 'CsCl — НЕ ОЦК: в центре куба другой сорт ионов')

// Шахматное правило: одноимённые ионы никогда не соседи
for (const [di, dj, dk] of [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
] as const) {
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) {
        ok(
          isCationSite(i, j, k) !== isCationSite(i + di, j + dj, k + dk),
          `решётка: соседние узлы (${i},${j},${k}) обязаны нести разный знак заряда`,
        )
      }
}
ok(isCationSite(-1, 0, 0) !== isCationSite(0, 0, 0), 'шахматное правило работает и для отрицательных индексов')
near(cellAngstrom('nacl') as number, 5.6402, 1e-9, 'параметр ячейки NaCl в ангстремах')

// ─────────────────────────────────────────────────────────────────────────────
section('5. Термохимия: циклы Борна — Габера')
// ─────────────────────────────────────────────────────────────────────────────

for (const id of ['nacl', 'mgo', 'cao'] as const) {
  const cycle = BORN_HABER[id]
  const sum = bornHaberSumKJ(id)
  const residual = bornHaberResidualKJ(id)
  console.log(
    `   ${cycle.formula}: Σ ступеней = ${sum.toFixed(1)} кДж/моль, таблица ΔH°f = ${cycle.dHfTableKJ}, расхождение ${residual.toFixed(1)}`,
  )
  ok(Math.abs(residual) <= 5, `${cycle.formula}: цикл Борна — Габера сходится с ΔH°f в пределах ±5 кДж/моль`)
  ok(sum < 0, `${cycle.formula}: образование экзотермично`)

  // Знаки ступеней — строго по физике процесса
  for (const stage of cycle.stages) {
    if (stage.kind === 'sublimation') ok(stage.dHKJ > 0, `${cycle.formula}/${stage.id}: ΔH_субл > 0`)
    if (stage.kind === 'dissociation') ok(stage.dHKJ > 0, `${cycle.formula}/${stage.id}: ½D(X₂) > 0`)
    if (stage.kind === 'ionization') ok(stage.dHKJ > 0, `${cycle.formula}/${stage.id}: IE > 0`)
    if (stage.kind === 'lattice') ok(stage.dHKJ < 0, `${cycle.formula}/${stage.id}: U_реш < 0`)
  }
  const lattice = cycle.stages.filter((s) => s.kind === 'lattice')
  ok(lattice.length === 1, `${cycle.formula}: ровно одна ступень решётки`)
  const ids = cycle.stages.map((s) => s.id)
  ok(new Set(ids).size === ids.length, `${cycle.formula}: id ступеней не дублируются`)
}

// Первое сродство экзотермично, второе (для O²⁻) — эндотермично
const naclAffinity = BORN_HABER.nacl.stages.find((s) => s.kind === 'affinity')
ok((naclAffinity as { dHKJ: number }).dHKJ < 0, 'NaCl: EA(Cl) < 0 — захват электрона выделяет энергию')
const mgoAffinities = BORN_HABER.mgo.stages.filter((s) => s.kind === 'affinity')
ok(mgoAffinities[0].dHKJ < 0, 'MgO: EA₁(O) < 0')
ok(mgoAffinities[1].dHKJ > 0, 'MgO: EA₂(O) > 0 — второй электрон загоняют против отталкивания')

// Энергия решётки MgO почти впятеро больше NaCl: заряды ±2 и меньшее расстояние
const uNaCl = LATTICE_ENTHALPY_KJ['NaCl(s)']
const uMgO = LATTICE_ENTHALPY_KJ['MgO(s)']
const uCaO = LATTICE_ENTHALPY_KJ['CaO(s)']
ok(uNaCl < 0 && uMgO < 0 && uCaO < 0, 'все энергии решёток отрицательны')
ok(Math.abs(uMgO) > 4 * Math.abs(uNaCl), 'U(MgO) во много раз больше U(NaCl) — заряды ±2 против ±1')
ok(Math.abs(uMgO) > Math.abs(uCaO), 'U(MgO) > U(CaO): Mg²⁺ меньше Ca²⁺, значит решётка плотнее и прочнее')
for (const id of ['nacl', 'mgo', 'cao'] as const) {
  const stage = BORN_HABER[id].stages.find((s) => s.kind === 'lattice')
  const key = id === 'nacl' ? 'NaCl(s)' : id === 'mgo' ? 'MgO(s)' : 'CaO(s)'
  ok((stage as { dHKJ: number }).dHKJ === LATTICE_ENTHALPY_KJ[key], `${key}: цикл и таблица решёток согласованы`)
}

// Энтальпии сублимации в цикле совпадают с ΔH°f одноатомного газа
near(BORN_HABER.nacl.stages[0].dHKJ, dHfKJ('Na(g)'), 1e-9, 'ΔH_субл(Na) = ΔH°f(Na, г)')
near(BORN_HABER.mgo.stages[0].dHKJ, dHfKJ('Mg(g)'), 1e-9, 'ΔH_субл(Mg) = ΔH°f(Mg, г)')
near(BORN_HABER.cao.stages[0].dHKJ, dHfKJ('Ca(g)'), 1e-9, 'ΔH_субл(Ca) = ΔH°f(Ca, г)')
near(BORN_HABER.mgo.stages[1].dHKJ, dHfKJ('O(g)'), 1e-9, '½D(O₂) = ΔH°f(O, г)')
near(BORN_HABER.nacl.stages[1].dHKJ, bondEnthalpyKJ('Cl-Cl') / 2, 0.5, '½D(Cl₂) = половина энергии связи Cl–Cl')
near(BORN_HABER.nacl.stages[2].dHKJ, ATOMIC_DATA.Na.ie1KJ, 1e-9, 'ступень ионизации = IE₁(Na) из atomicData')
near(BORN_HABER.mgo.stages[3].dHKJ, ATOMIC_DATA.Mg.ie2KJ as number, 1e-9, 'ступень = IE₂(Mg) из atomicData')
near(BORN_HABER.cao.stages[2].dHKJ, ATOMIC_DATA.Ca.ie1KJ, 1e-9, 'ступень = IE₁(Ca) из atomicData')
near(BORN_HABER.nacl.stages[3].dHKJ, ATOMIC_DATA.Cl.electronAffinityKJ, 1e-9, 'ступень = EA(Cl) из atomicData')

// ─────────────────────────────────────────────────────────────────────────────
section('6. Тепловые эффекты: по связям против ΔH°f')
// ─────────────────────────────────────────────────────────────────────────────

for (const id of Object.keys(MOLECULAR_REACTIONS)) {
  const r = MOLECULAR_REACTIONS[id]
  ok(r.id === id, `${id}: поле id совпадает с ключом`)
  const { fromBonds, fromFormation, deltaKJ } = reactionEnthalpyBothKJ(id)
  console.log(
    `   ${r.equation}: по связям ${fromBonds.toFixed(1)}, по ΔH°f ${fromFormation.toFixed(1)}, разница ${deltaKJ.toFixed(1)} кДж`,
  )
  ok(Math.abs(deltaKJ) <= 25, `${id}: два способа расчёта расходятся не более чем на 25 кДж`)
  ok(fromFormation < 0, `${id}: реакция экзотермична`)
}

// Требуемые заданием сверки
near(reactionEnthalpyBothKJ('water_g').fromFormation, -241.8, 1e-9, 'ΔH°f H₂O (г)')
near(reactionEnthalpyBothKJ('hcl_g').fromFormation, -92.3, 1e-9, 'ΔH°f HCl (г)')
near(reactionEnthalpyBothKJ('ammonia').fromFormation, -45.9, 1e-9, 'ΔH°f NH₃ (г)')
for (const id of ['water_g', 'hcl_g', 'ammonia'] as const) {
  const { fromBonds, fromFormation } = reactionEnthalpyBothKJ(id)
  near(fromBonds, fromFormation, 25, `${id}: расчёт по связям воспроизводит ΔH°f`)
}

// Простые вещества в стандартном состоянии — строго 0
for (const key of ['H2(g)', 'N2(g)', 'O2(g)', 'Cl2(g)', 'Br2(l)', 'I2(s)', 'C(graphite)', 'S8(s)', 'P4(s)', 'Na(s)']) {
  ok(dHfKJ(key) === 0, `${key}: ΔH°f простого вещества в стандартном состоянии = 0`)
}
ok(Boolean(FORMATION_ENTHALPY['Br2(l)'].note), 'бром при 25 °C — жидкость, это отмечено в таблице')
ok(FORMATION_ENTHALPY['Br2(l)'].state === 'ж', 'состояние брома — жидкое')
ok(FORMATION_ENTHALPY['I2(s)'].state === 'тв', 'состояние иода — твёрдое')
ok(dHfKJ('H2O(l)') < dHfKJ('H2O(g)'), 'жидкая вода ниже по энергии, чем пар (конденсация экзотермична)')
near(dHfKJ('H2O(g)') - dHfKJ('H2O(l)'), 44.0, 0.5, 'теплота испарения воды ≈ 44 кДж/моль')
near(dHfKJ('H(g)') * 2, bondEnthalpyKJ('H-H'), 1, 'D(H–H) = 2·ΔH°f(H, г)')
near(dHfKJ('N(g)') * 2, bondEnthalpyKJ('N#N'), 1, 'D(N≡N) = 2·ΔH°f(N, г)')
near(dHfKJ('O(g)') * 2, bondEnthalpyKJ('O=O'), 1.5, 'D(O=O) = 2·ΔH°f(O, г)')
near(dHfKJ('Cl(g)') * 2, bondEnthalpyKJ('Cl-Cl'), 1, 'D(Cl–Cl) = 2·ΔH°f(Cl, г)')

// ─────────────────────────────────────────────────────────────────────────────
section('7. Согласованность с кино-движком и отсутствие дублей')
// ─────────────────────────────────────────────────────────────────────────────

near(COVALENT_RADIUS_A.Na, 1.66, 1e-9, 'atoms.ts берёт ковалентный радиус Na из ядра')
near(COVALENT_RADIUS_A.Cl, 1.02, 1e-9, 'atoms.ts берёт ковалентный радиус Cl из ядра')
near(IONIC_RADIUS_A['Na+'], 1.02, 1e-9, 'atoms.ts: Na⁺ = 1.02 Å')
near(IONIC_RADIUS_A['Cl-'], 1.81, 1e-9, 'atoms.ts: Cl⁻ = 1.81 Å')
near(METALLIC_RADIUS_A.Na, 1.86, 1e-9, 'atoms.ts: металлический радиус Na = 1.86 Å')
near(BOND_LENGTH_A.ClCl, 1.988, 1e-9, 'atoms.ts: Cl–Cl = 1.988 Å (сцена ClO₂ опирается на это)')
near(BOND_LENGTH_A.ClO_radical, 1.47, 1e-9, 'atoms.ts: Cl–O в ClO₂ = 1.47 Å')
near(BOND_LENGTH_A.ClO_chlorite, 1.57, 1e-9, 'atoms.ts: Cl–O в ClO₂⁻ = 1.57 Å')
near(BOND_LENGTH_A.CH, 1.087, 1e-9, 'atoms.ts: C–H = 1.087 Å (сцена CH₄)')
near(BOND_LENGTH_A.OO, 1.208, 1e-9, 'atoms.ts: O=O = 1.208 Å')
near(BOND_LENGTH_A.CO, 1.16, 1e-9, 'atoms.ts: C=O в CO₂ = 1.16 Å')
near(BOND_ANGLE_DEG.clo2, 117.4, 1e-9, 'atoms.ts: угол ClO₂ = 117.4°')
near(BOND_ANGLE_DEG.chlorite, 110.5, 1e-9, 'atoms.ts: угол ClO₂⁻ = 110.5°')
near(BOND_ANGLE_DEG.tetrahedral, 109.47, 1e-9, 'atoms.ts: тетраэдрический угол')
for (const symbol of Object.keys(CPK) as ElementSymbol[]) {
  ok(CPK[symbol as keyof typeof CPK] === cpkColor(symbol), `CPK.${symbol} совпадает с ядром`)
}

// Дубли ключей: TypeScript их не ловит в объектных литералах с разными регистрами,
// поэтому читаем исходники и считаем ключи верхнего уровня глазами скрипта.
const duplicateScan: ReadonlyArray<readonly [string, RegExp]> = [
  ['src/chemistry/data/atomicData.ts', /^ {2}([A-Z][a-z]?):\s*\{$/gm],
  ['src/chemistry/data/bondData.ts', /^ {2}'([^']+)':\s*\{/gm],
  ['src/chemistry/data/crystalData.ts', /^ {2}([a-z0-9_]+):\s*\{$/gm],
  ['src/chemistry/data/thermoData.ts', /^ {2}'([^']+)':\s*\{/gm],
]
for (const [rel, re] of duplicateScan) {
  const text = readFileSync(resolve(root, rel), 'utf8')
  const seen = new Map<string, number>()
  for (const m of text.matchAll(re)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1)
  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k)
  ok(dupes.length === 0, `${rel}: нет дублирующихся ключей (найдены: ${dupes.join(', ') || '—'})`)
  ok(seen.size > 0, `${rel}: сканер ключей действительно что-то нашёл`)
}

const symbols = [...ELEMENT_SYMBOLS]
ok(new Set(symbols).size === symbols.length, 'символы элементов уникальны')
ok(symbols.length >= 25, `в ядре не меньше 25 элементов (сейчас ${symbols.length})`)
const zValues = symbols.map((s) => ATOMIC_DATA[s].z)
ok(new Set(zValues).size === zValues.length, 'заряды ядер Z уникальны')
for (const s of symbols) ok(ATOMIC_DATA[s].symbol === s, `${s}: поле symbol совпадает с ключом`)

console.log(`\n✅ научное ядро данных: ${checks} проверок пройдено`)
