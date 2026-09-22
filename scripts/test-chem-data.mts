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
  ionicRadiusCnsOf,
  ionicRadiusPm,
  isElementSymbol,
  metallicRadiusPm,
  molarMassGMol,
  parseFormula,
  radiusForSpecies,
  SPECTRAL_LINES,
  photonEnergyKJPerMol,
  spectralLineNm,
  type ElementSymbol,
} from '../src/chemistry/data/atomicData.ts'
import {
  BOND_ANGLES,
  BOND_DATA,
  DIHEDRAL_ANGLES,
  DIPOLE_MOMENTS,
  WATER_SEQUENTIAL_BDE_KJ,
  bondAngleDeg,
  dihedralAngleDeg,
  bondEnthalpyKJ,
  bondLengthPm,
  REAGENT_GEOMETRY,
  reagentAngleDeg,
  reagentBondPm,
  type BondKey,
} from '../src/chemistry/data/bondData.ts'
import { CRYSTAL_DATA, CRYSTAL_IDS, cellAngstrom, isCationSite } from '../src/chemistry/data/crystalData.ts'
import {
  BORN_HABER,
  FORMATION_ENTHALPY,
  FORMATION_REACTIONS,
  HYDRATION_ENTHALPY_KJ,
  LATTICE_ENTHALPY_INFO,
  LATTICE_ENTHALPY_KJ,
  MOLECULAR_REACTIONS,
  OXIDE_SECOND_EA_KJ,
  REACTION_STEP_CHAINS,
  bornHaberResidualKJ,
  bornHaberSumKJ,
  dHfKJ,
  formationReactionIsEstimated,
  formationReactionKJ,
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
  radiusForSpecies as atomsRadiusForSpecies,
  sceneRadius,
  reagentBondA,
} from '../src/lab/cinema/core/atoms.ts'
import { FLAME_TEMPERATURES, NATIVE_OXIDE_FILMS } from '../src/chemistry/data/phenomenaData.ts'
import * as coreIndex from '../src/chemistry/data/index.ts'

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

// ── 1.1 Радиусы по КЧ (Shannon 1976): катион < атом < анион при ФАКТИЧЕСКОМ КЧ, запись КЧ 6 = основной таблице.
for (const symbol of ELEMENT_SYMBOLS) {
  const byCn = ATOMIC_DATA[symbol].ionicRadiiByCnPm ?? {}
  const atom = atomicRadiusPm(symbol)
  for (const [qKey, table] of Object.entries(byCn)) {
    const q = Number(qKey)
    ok(ATOMIC_DATA[symbol].ionicRadiiPm[qKey] != null, `${symbol}${qKey}: ион с радиусами по КЧ есть и в основной таблице`)
    if (table['6'] != null) {
      ok(table['6'] === ATOMIC_DATA[symbol].ionicRadiiPm[qKey], `${symbol}${qKey}: КЧ 6 в таблице по КЧ = основной таблице`)
    }
    const cns = Object.keys(table).map(Number).sort((x, y) => x - y)
    for (let k = 0; k < cns.length; k++) {
      const r = ionicRadiusPm(symbol, q, cns[k]) as number
      ok(r === table[String(cns[k])], `${symbol}${qKey} КЧ ${cns[k]}: ionicRadiusPm(…, cn) читает таблицу`)
      if (q > 0) ok(r < atom, `${symbol}${qKey} КЧ ${cns[k]}: катион ${r} < атома ${atom} пм`)
      else ok(r > atom, `${symbol}${qKey} КЧ ${cns[k]}: анион ${r} > атома ${atom} пм`)
      // у Шеннона радиус растёт с КЧ: больше соседей — дальше они отодвигаются
      if (k > 0) ok(r > (table[String(cns[k - 1])] as number), `${symbol}${qKey}: радиус растёт с КЧ (${cns[k - 1]} → ${cns[k]})`)
    }
    ok(ionicRadiusCnsOf(symbol, q).includes(6), `${symbol}${qKey}: ionicRadiusCnsOf включает КЧ 6`)
  }
}
{
  // Значения, которые задание требует дословно (Shannon 1976, Table 1)
  const shannon: ReadonlyArray<readonly [ElementSymbol, number, number, number]> = [
    ['Pb', 2, 4, 98], ['Pb', 2, 6, 119], ['Pb', 2, 8, 129],
    ['O', -2, 2, 135], ['O', -2, 4, 138], ['O', -2, 6, 140],
    ['Al', 3, 4, 39], ['Al', 3, 6, 53.5],
    ['Si', 4, 4, 26], ['Si', 4, 6, 40],
    ['Mn', 7, 4, 25], ['Mn', 7, 6, 46],
    ['Cl', 7, 4, 8], ['Cl', 7, 6, 27],
    ['S', 6, 4, 12], ['S', 6, 6, 29],
    ['V', 5, 4, 35.5], ['V', 5, 6, 54],
    ['Na', 1, 6, 102], ['Mg', 2, 6, 72],
  ]
  for (const [el, q, cn, r] of shannon) ok(ionicRadiusPm(el, q, cn) === r, `${el}${chargeKey(q)} КЧ ${cn} = ${r} пм (Shannon 1976)`)
  ok(ionicRadiusPm('Pb', 2, 5) === null, 'Pb²⁺ КЧ 5 в таблице нет — ionicRadiusPm честно возвращает null')
  // обратная совместимость: без КЧ — как раньше (КЧ 6)
  ok(ionicRadiusPm('Pb', 2) === 119 && radiusForSpecies('Pb', 2) === 119, 'без cn поведение прежнее: Pb²⁺ = 119 (КЧ 6)')
  ok(radiusForSpecies('Pb', 2, { cn: 4 }) === 98, 'radiusForSpecies(Pb, +2, {cn: 4}) = 98 пм — глёт')
  ok(radiusForSpecies('Pb', 2, { cn: 5 }) === 119, 'нет КЧ 5 → откат на КЧ 6, а не пустота')
  ok(radiusForSpecies('Si', 4, { model: 'covalent' }) === covalentRadiusPm('Si'), 'SiO₂ δ±: модель covalent даёт Кордеро, а не Si⁴⁺')
  ok(radiusForSpecies('O', -2, { model: 'covalent' }) === covalentRadiusPm('O'), 'модель covalent для O в каркасе — 66 пм')
  ok(radiusForSpecies('Al', 0, { model: 'metallic' }) === metallicRadiusPm('Al'), 'модель metallic — металлический радиус')
  ok(radiusForSpecies('O', -2, { model: 'ionic', cn: 4 }) === 138, 'модель ionic с КЧ 4 — O²⁻ 138 пм (корунд, глёт)')
  ok(atomsRadiusForSpecies('Pb', 2, { cn: 4 }) === 98, 'atoms.ts пробрасывает opts в ядро')
  near(sceneRadius('Pb', 2, 1, { cn: 4 }) / sceneRadius('Pb', 2, 1), 98 / 119, 1e-9, 'sceneRadius с КЧ сохраняет отношение радиусов')
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
  if (datum.ie3KJ != null) {
    ok(datum.ie2KJ != null && datum.ie3KJ > datum.ie2KJ, `${symbol}: IE₁ < IE₂ < IE₃`)
  }
  // масса: Z ≤ M ≤ 2.6·Z (у всех стабильных элементов ядра) — ловит опечатку порядка
  ok(datum.atomicMassU >= datum.z && datum.atomicMassU <= 2.6 * datum.z, `${symbol}: атомная масса ${datum.atomicMassU} правдоподобна для Z = ${datum.z}`)
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

// ── Валентные электроны считаются ПО КОНФИГУРАЦИИ, а не «по правилу s+d для всех d-металлов».
// Именно механическое s+d давало цинку 12 — при том что Zn всегда Zn(II).
{
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
  /** Разбор '[Ar] 3d¹⁰ 4s²' → [{ n: 3, l: 'd', e: 10 }, { n: 4, l: 's', e: 2 }]. */
  const orbitals = (config: string): ReadonlyArray<{ n: number; l: string; e: number }> =>
    [...config.matchAll(/(\d)([spdf])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/gu)].map((m) => ({
      n: Number(m[1]),
      l: m[2],
      e: Number([...m[3]].map((ch) => SUP.indexOf(ch)).join('')),
    }))

  for (const symbol of ELEMENT_SYMBOLS) {
    const datum = ATOMIC_DATA[symbol]
    const orb = orbitals(datum.configuration)
    ok(orb.length > 0, `${symbol}: конфигурация «${datum.configuration}» разбирается на орбитали`)
    // Внешний слой — самый большой n среди s/p.
    const nOuter = Math.max(...orb.filter((o) => o.l === 's' || o.l === 'p').map((o) => o.n))
    const sp = orb.filter((o) => o.n === nOuter && (o.l === 's' || o.l === 'p')).reduce((a, o) => a + o.e, 0)
    const d = orb.find((o) => o.n === nOuter - 1 && o.l === 'd')
    /**
     * d-оболочка идёт в валентные, если она недозаполнена (Cr, Mn, Fe) ЛИБО если у элемента
     * есть ион с зарядом БОЛЬШЕ числа s+p-электронов — то есть закрытая d¹⁰ всё-таки
     * раскрылась (Cu → Cu²⁺, Ag → Ag²⁺). У Zn максимум — Zn²⁺ = 4s², у Br — Br⁷⁺ = 4s²4p⁵:
     * d¹⁰ у обоих нетронута, поэтому в валентные она не идёт.
     */
    const maxCharge = Math.max(0, ...ionChargesOf(symbol))
    const dOpens = d != null && (d.e < 10 || maxCharge > sp)
    const expected = sp + (dOpens && d != null ? d.e : 0)
    ok(
      datum.valenceElectrons === expected,
      `${symbol}: по конфигурации «${datum.configuration}» (высший ион +${maxCharge}) валентных ${expected}, ` +
        `в таблице ${datum.valenceElectrons}`,
    )
    // Закрытая d¹⁰, которая всё же считается валентной, обязана быть объяснена.
    if (d != null && d.e === 10) {
      ok(
        !dOpens || Boolean(datum.valenceElectronsNote),
        `${symbol}: закрытая d¹⁰ засчитана в валентные — это обязано быть объяснено в valenceElectronsNote`,
      )
    }
  }

  // Цинк адресно: было 12 по правилу «s+d», должно быть 2.
  ok(ATOMIC_DATA.Zn.valenceElectrons === 2, 'Zn: валентных электронов 2 (4s²), а не 12 — 3d¹⁰ не раскрывается')
  ok(
    ATOMIC_DATA.Zn.valenceElectrons === ATOMIC_DATA.Mg.valenceElectrons,
    'Zn и Mg дают школьнику одно и то же число: оба всегда двухвалентны',
  )
  ok(ionChargesOf('Zn').every((q) => q <= 2), 'Zn: в таблице нет ионов выше Zn²⁺ — IE₃ = 3833 кДж/моль их запрещает')
  ok(
    /3833/.test(ATOMIC_DATA.Zn.valenceElectronsNote ?? ''),
    'Zn: в примечании названа причина — третий электрон рвётся из d¹⁰ (IE₃ = 3833 кДж/моль)',
  )
  // А вот меди и серебру s+d остаётся: у них есть M(II), т.е. d-электрон действительно уходит.
  for (const symbol of ['Cu', 'Ag'] as const) {
    ok(ATOMIC_DATA[symbol].valenceElectrons === 11, `${symbol}: 11 валентных — d-оболочка раскрывается`)
    ok(ionChargesOf(symbol).includes(2), `${symbol}: в таблице есть ${symbol}²⁺ — именно он оправдывает счёт s+d`)
    ok(
      Boolean(ATOMIC_DATA[symbol].valenceElectronsNote),
      `${symbol}: исключение из «d¹⁰ не считается» объяснено в valenceElectronsNote`,
    )
  }
  // Закрытая d¹⁰ под p-элементами никогда не считается — контрольная группа для цинка.
  ok(ATOMIC_DATA.Br.valenceElectrons === 7, 'Br: 7 валентных (4s²4p⁵), 3d¹⁰ не считается')
  ok(ATOMIC_DATA.Pb.valenceElectrons === 4, 'Pb: 4 валентных (6s²6p²), 5d¹⁰ и 4f¹⁴ не считаются')
  // d-металлы с незакрытой оболочкой: правило s+d к ним применимо честно.
  for (const [symbol, n] of [['Cr', 6], ['Mn', 7], ['Fe', 8]] as const) {
    ok(ATOMIC_DATA[symbol].valenceElectrons === n, `${symbol}: ${n} валентных — d-оболочка недозаполнена, s+d верно`)
  }
}

// IE₃ из CRC 97th — числа, на которых стоит цикл Al₂O₃ и объяснение «почему Na⁺, а не Na²⁺»
ok(ATOMIC_DATA.Al.ie3KJ === 2744.8, 'IE₃(Al) = 2744.8 кДж/моль (CRC)')
ok(ATOMIC_DATA.Mg.ie3KJ === 7732.7, 'IE₃(Mg) = 7732.7 кДж/моль (CRC)')
ok(ATOMIC_DATA.Na.ie3KJ === 6910.3, 'IE₃(Na) = 6910.3 кДж/моль (CRC)')
ok((ATOMIC_DATA.Mg.ie3KJ as number) / (ATOMIC_DATA.Mg.ie2KJ as number) > 5, 'Mg: скачок IE₃/IE₂ > 5 — третий электрон из закрытой оболочки, поэтому Mg²⁺')
ok((ATOMIC_DATA.Al.ie3KJ as number) / (ATOMIC_DATA.Al.ie2KJ as number) < 2, 'Al: IE₃/IE₂ < 2 — третий электрон ещё валентный, поэтому Al³⁺')
ok(ATOMIC_DATA.Zn.ie3KJ === 3833, 'IE₃(Zn) в поле совпадает с числом из valenceElectronsNote (3833)')
// Ванадий: катализатор контактного способа
ok(isElementSymbol('V') && ATOMIC_DATA.V.z === 23, 'V (Z 23) есть в ядре')
ok(ATOMIC_DATA.V.valenceElectrons === 5 && ionChargesOf('V').includes(5), 'V: 5 валентных электронов, высший ион V⁵⁺')
// Массы IUPAC 2021 и формульный разбор
near(molarMassGMol(parseFormula('SiO₂')), 60.083, 0.001, 'M(SiO₂) из формулы')
near(molarMassGMol(parseFormula('Al2O3')), 101.961, 0.001, 'M(Al₂O₃) из формулы')
near(molarMassGMol(parseFormula('CaCO₃')), 100.086, 0.001, 'M(CaCO₃) из формулы')

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
  ['H-H', 435.8],
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

// Вода: r_0-набор 95.8 пм / 104.5°, r_e 95.72 / 104.52 — в отдельных полях, не смешиваются
near(bondAngleDeg('water'), 104.5, 1e-9, 'угол H–O–H (r_0)')
ok(BOND_ANGLES.water.angleType === 'r_0' && BOND_DATA['O-H'].lengthType === 'r_0', 'угол и длина воды из ОДНОГО набора r_0')
near(BOND_ANGLES.water.degRe as number, 104.52, 1e-9, 'угол воды r_e = 104.52°')
near(BOND_DATA['O-H'].lengthRePm as number, 95.72, 1e-9, 'O–H воды r_e = 95.72 пм')
ok((BOND_DATA['O-H'].lengthRePm as number) < bondLengthPm('O-H'), 'r_e короче r_0 (колебательное усреднение удлиняет)')
near(bondLengthPm('O=O'), 120.75, 1e-9, 'O=O r_e = 120.75 пм')
ok(BOND_DATA['O=O'].lengthType === 'r_e' && BOND_DATA['H-H'].lengthType === 'r_e', 'O₂ и H₂ — равновесные длины')
// Последовательные энергии связей воды — сверка с ΔH°f (а не наличие чисел)
near(WATER_SEQUENTIAL_BDE_KJ.first, dHfKJ('H(g)') + dHfKJ('OH(g)') - dHfKJ('H2O(g)'), 0.05, 'D(H–OH) = ΔH°f(H) + ΔH°f(OH) − ΔH°f(H₂O, г)')
near(WATER_SEQUENTIAL_BDE_KJ.second, dHfKJ('O(g)') + dHfKJ('H(g)') - dHfKJ('OH(g)'), 0.05, 'D(O–H в ·OH) = ΔH°f(O) + ΔH°f(H) − ΔH°f(OH)')
near(WATER_SEQUENTIAL_BDE_KJ.first + WATER_SEQUENTIAL_BDE_KJ.second, 2 * dHfKJ('H(g)') + dHfKJ('O(g)') - dHfKJ('H2O(g)'), 0.05, 'сумма = атомизация H₂O (г)')
ok(WATER_SEQUENTIAL_BDE_KJ.first > WATER_SEQUENTIAL_BDE_KJ.second, 'первый H отрывать дороже второго')
near((WATER_SEQUENTIAL_BDE_KJ.first + WATER_SEQUENTIAL_BDE_KJ.second) / 2, bondEnthalpyKJ('O-H'), 1, 'средняя O–H = полусумма последовательных')
// Выведенные энергии новых связей сходятся с ΔH°f
near(bondEnthalpyKJ('Si-O'), (dHfKJ('Si(g)') + 2 * dHfKJ('O(g)') - dHfKJ('SiO2(s)')) / 4, 0.06, 'E(Si–O) = атомизация кварца / 4')
near(bondEnthalpyKJ('Si-Si'), dHfKJ('Si(g)') / 2, 0.05, 'E(Si–Si) = ΔH°f(Si, г)/2 (две связи на атом)')
near(bondEnthalpyKJ('Pb-O'), (dHfKJ('Pb(g)') + dHfKJ('O(g)') - dHfKJ('PbO(litharge)')) / 4, 0.06, 'E(Pb–O) = атомизация глёта / 4')
near(
  bondEnthalpyKJ('O-H(H2O2)'),
  (2 * dHfKJ('H(g)') + 2 * dHfKJ('O(g)') - dHfKJ('H2O2(g)') - bondEnthalpyKJ('O-O')) / 2,
  0.05,
  'E(O–H в H₂O₂) из атомизации H₂O₂ (г)',
)
ok(4 * bondEnthalpyKJ('Si-O') > 2 * 2 * bondEnthalpyKJ('Si-Si'), 'Si–O вдвое прочнее Si–Si — кремний «любит» кислород')
// Длины новых связей: порядок и тип
ok(bondLengthPm('Mn-O(term)') < bondLengthPm('Mn-O(MnO4)') && bondLengthPm('Mn-O(MnO4)') < bondLengthPm('Mn-O(bridge)'), 'Mn–O: концевая < в MnO₄⁻ < мостиковая')
ok(bondLengthPm('Cl-O(term)') < bondLengthPm('Cl-O(bridge)'), 'Cl–O: концевая короче мостиковой')
ok(BOND_DATA['Cl-O(term)'].lengthType === 'r_g' && BOND_DATA['Cl-O(bridge)'].lengthType === 'r_g', 'Cl₂O₇: один газовый набор (r_g), не смешан с кристаллом')
ok(BOND_ANGLES.cl2o7ClOCl.angleType === 'r_g' && BOND_ANGLES.cl2o7OClO.angleType === 'r_g', 'углы Cl₂O₇ из того же газового набора')
near(bondLengthPm('S=O(SO3)'), 141.98, 1e-9, 'S–O в SO₃ = 141.98 пм (CRC)')
ok(bondLengthPm('S=O(SO3)') < bondLengthPm('S=O'), 'S–O в SO₃ короче, чем в SO₂')
ok(bondLengthPm('O-O(O2 2-)') > bondLengthPm('O=O'), 'O–O в пероксид-ионе длиннее двойной O=O (порядок 1)')
ok(BOND_DATA['O-O'].lengthType === 'r_0' && BOND_DATA['O-H(H2O2)'].lengthType === 'r_0' && BOND_ANGLES.hydrogenPeroxideOOH.angleType === 'r_0', 'H₂O₂: весь набор r_0 (Redington 1962)')
for (const [key, b] of Object.entries(BOND_DATA)) {
  if (b.enthalpyFrom) {
    ok(b.enthalpyKJ === bondEnthalpyKJ(b.enthalpyFrom), `${key}: заимствованная энергия совпадает с донором ${b.enthalpyFrom}`)
    ok(Boolean(b.note), `${key}: заимствование энергии объяснено в note`)
  }
  if (b.lengthsPm) {
    const mean = b.lengthsPm.reduce((a, x) => a + x, 0) / b.lengthsPm.length
    near(mean, b.lengthPm, 0.06, `${key}: lengthPm — среднее неэквивалентных длин`)
  }
  if (b.lengthRePm != null) ok(b.lengthType === 'r_0', `${key}: r_e дополняет только r_0-значение`)
}
// Углы и двугранные
near(bondAngleDeg('hydrogenPeroxideOOH'), 94.8, 1e-9, '∠O–O–H H₂O₂ (r_0)')
near(bondAngleDeg('sulfurTrioxide'), 120, 1e-9, 'SO₃ — D₃h, 120°')
near(bondAngleDeg('quartzSiOSi'), 143.7, 1e-9, '∠Si–O–Si кварца')
near(bondAngleDeg('mn2o7MnOMn'), 120.7, 1e-9, '∠Mn–O–Mn')
near(bondAngleDeg('cl2o7ClOCl'), 118.6, 1e-9, '∠Cl–O–Cl')
near(bondAngleDeg('cl2o7OClO'), 115.2, 1e-9, '∠O–Cl–O')
near(dihedralAngleDeg('hydrogenPeroxideGas'), 111.5, 1e-9, 'двугранный угол H₂O₂ (газ)')
near(dihedralAngleDeg('hydrogenPeroxideCrystal'), 90.2, 1e-9, 'двугранный угол H₂O₂ (кристалл)')
for (const [key, d] of Object.entries(DIHEDRAL_ANGLES)) {
  ok(d.key === key, `${key}: поле key совпадает с ключом`)
  ok(d.deg > 0 && d.deg < 180, `${key}: двугранный угол в (0, 180) — молекула не плоская`)
}
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

near(DIPOLE_MOMENTS.H2O.debye, 1.855, 1e-9, 'дипольный момент H₂O (CRC 1.8546)')
near(DIPOLE_MOMENTS.H2O2.debye, 1.57, 1e-9, 'дипольный момент H₂O₂ (газ, Cohen & Pickett 1981)')
ok(DIPOLE_MOMENTS.SO3.debye === 0, 'SO₃ плоская симметричная — μ = 0')
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

// При ФАКТИЧЕСКОМ КЧ сумма радиусов Шеннона воспроизводит расстояние в слоистых/каркасных оксидах
near(
  (ionicRadiusPm('Pb', 2, 4) as number) + (ionicRadiusPm('O', -2, 4) as number),
  CRYSTAL_DATA.litharge.cationAnionPm,
  5,
  'глёт: r(Pb²⁺, КЧ4) + r(O²⁻, КЧ4) ≈ Pb–O',
)
ok(
  Math.abs((ionicRadiusPm('Pb', 2, 4) as number) + (ionicRadiusPm('O', -2, 4) as number) - CRYSTAL_DATA.litharge.cationAnionPm) <
    Math.abs((ionicRadiusPm('Pb', 2) as number) + (ionicRadiusPm('O', -2) as number) - CRYSTAL_DATA.litharge.cationAnionPm),
  'глёт: радиусы при КЧ 4 описывают Pb–O лучше, чем при КЧ 6',
)
ok(CRYSTAL_DATA.litharge.coordination['Pb²⁺'] === 4, 'глёт: КЧ Pb = 4 — радиус берётся при КЧ 4')

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

/** Значение perUnitFrom из таблиц ядра: 'ie1:Al+ie2:Al', '-dHf:H(g)', 'ea2:O', 'hyd:Zn2+'. */
const perUnitFromCore = (spec: string): number => {
  let sum = 0
  // термы разделены '+', за которым идёт имя терма (в 'hyd:H+' плюс — часть имени иона)
  for (const raw of spec.split(/\+(?=-?[a-z])/)) {
    const neg = raw.startsWith('-')
    const term = neg ? raw.slice(1) : raw
    const [kind, arg] = term.split(':') as [string, string]
    let v: number
    if (kind === 'dHf') v = dHfKJ(arg)
    else if (/^ie[123]$/.test(kind)) {
      const d = ATOMIC_DATA[arg as ElementSymbol]
      v = (kind === 'ie1' ? d.ie1KJ : kind === 'ie2' ? d.ie2KJ : d.ie3KJ) as number
      ok(v != null, `perUnitFrom «${term}»: в atomicData есть эта энергия ионизации`)
    } else if (kind === 'ea1') v = ATOMIC_DATA[arg as ElementSymbol].electronAffinityKJ
    else if (kind === 'ea2' && arg === 'O') v = OXIDE_SECOND_EA_KJ
    else if (kind === 'hyd') v = HYDRATION_ENTHALPY_KJ[arg] as number
    else throw new Error(`perUnitFrom: неизвестный терм «${term}»`)
    sum += neg ? -v : v
  }
  return Math.round(sum * 1000) / 1000
}

for (const id of Object.keys(BORN_HABER)) {
  const cycle = BORN_HABER[id]
  ok(cycle.id === id, `${id}: поле id совпадает с ключом`)
  const sum = bornHaberSumKJ(id)
  const residual = bornHaberResidualKJ(id)
  console.log(
    `   ${cycle.formula}: Σ ступеней = ${sum.toFixed(1)} кДж/моль, таблица ΔH°f = ${cycle.dHfTableKJ}, расхождение ${residual.toFixed(1)}`,
  )
  ok(Math.abs(residual) <= 5, `${cycle.formula}: цикл сходится с ΔH°f в пределах ±5 кДж/моль`)
  ok(sum < 0, `${cycle.formula}: образование экзотермично`)
  if (cycle.productKey) near(cycle.dHfTableKJ, dHfKJ(cycle.productKey), 1e-9, `${id}: dHfTableKJ = ΔH°f(${cycle.productKey}) из таблицы`)
  if (cycle.formal) ok(Boolean(cycle.note), `${id}: формальный цикл обязан сказать об этом в note`)

  for (const stage of cycle.stages) {
    const reversed = stage.perUnitFrom?.startsWith('-') === true
    // Знаки ступеней — строго по физике процесса (обратные процессы — с perUnitFrom '-…')
    if (!reversed) {
      if (stage.kind === 'sublimation') ok(stage.dHKJ > 0, `${cycle.formula}/${stage.id}: ΔH_субл > 0`)
      if (stage.kind === 'dissociation') ok(stage.dHKJ > 0, `${cycle.formula}/${stage.id}: ½D(X₂) > 0`)
      if (stage.kind === 'ionization') ok(stage.dHKJ > 0, `${cycle.formula}/${stage.id}: IE > 0`)
    }
    if (stage.kind === 'lattice') ok(stage.dHKJ < 0, `${cycle.formula}/${stage.id}: U_реш < 0`)
    // Множители: dHKJ = multiplier · perUnitKJ, а perUnitKJ = число из ядра
    if (stage.perUnitKJ != null) {
      const k = stage.multiplier ?? 1
      near(stage.dHKJ, k * stage.perUnitKJ, 1e-6, `${cycle.formula}/${stage.id}: ΔH = ${k} × ${stage.perUnitKJ}`)
      ok(Boolean(stage.perUnitFrom), `${cycle.formula}/${stage.id}: указано, откуда взято perUnitKJ`)
      near(stage.perUnitKJ, perUnitFromCore(stage.perUnitFrom as string), 1e-6, `${cycle.formula}/${stage.id}: perUnitKJ = ${stage.perUnitFrom} из ядра`)
      if (k !== 1) ok(stage.equation.includes(`${k} `),`${cycle.formula}/${stage.id}: множитель ${k} виден в уравнении ступени`)
    } else {
      ok(stage.kind === 'lattice' || stage.kind === 'bond', `${cycle.formula}/${stage.id}: без perUnitKJ бывает только выведенная ступень (решётка/связи)`)
    }
  }
  const lattice = cycle.stages.filter((s) => s.kind === 'lattice')
  if (cycle.latticeKey) {
    ok(lattice.length === 1, `${cycle.formula}: ровно одна ступень решётки`)
    ok(lattice[0].dHKJ === LATTICE_ENTHALPY_KJ[cycle.latticeKey], `${cycle.latticeKey}: цикл и таблица решёток согласованы`)
  }
  const ids = cycle.stages.map((s) => s.id)
  ok(new Set(ids).size === ids.length, `${cycle.formula}: id ступеней не дублируются`)
  // Оксиды: EA₁ < 0, EA₂ > 0
  const aff = cycle.stages.filter((s) => s.kind === 'affinity')
  if (aff.length === 2) {
    ok(aff[0].dHKJ < 0, `${cycle.formula}: EA₁(O) < 0`)
    ok(aff[1].dHKJ > 0, `${cycle.formula}: EA₂(O) > 0 — второй электрон загоняют против отталкивания`)
  }
}

// Al₂O₃: цикл с множителями, U ≈ −15 170 при EA₂ = +744
{
  const c = BORN_HABER.al2o3
  const U = c.stages.find((s) => s.kind === 'lattice')!.dHKJ
  const others = c.stages.filter((s) => s.kind !== 'lattice').reduce((a, s) => a + s.dHKJ, 0)
  near(others, 13494.6, 0.05, 'Al₂O₃: Σ ступеней без решётки = 13 494.6 кДж')
  near(U, dHfKJ('Al2O3(s)') - others, 0.05, 'Al₂O₃: U = ΔH°f − Σ = −15 170.3 (выведена из цикла)')
  ok(U > -15900 && U < -15100, 'Al₂O₃: U в литературном коридоре 15 100–15 900')
  ok(LATTICE_ENTHALPY_INFO['Al2O3(s)']?.derived === true, 'Al₂O₃: энергия решётки помечена как выведенная')
  const ion = c.stages.find((s) => s.id === 'ionization')!
  near(ion.perUnitKJ as number, ATOMIC_DATA.Al.ie1KJ + (ATOMIC_DATA.Al.ie2KJ as number) + (ATOMIC_DATA.Al.ie3KJ as number), 1e-6, 'Al₂O₃: IE₁+IE₂+IE₃ из atomicData')
  ok(ion.multiplier === 2 && c.stages.find((s) => s.id === 'affinity2')!.multiplier === 3, 'Al₂O₃: 2 атома Al и 3 атома O на формульную единицу')
  ok(Math.abs(U) > 3 * Math.abs(LATTICE_ENTHALPY_KJ['MgO(s)']), '|U(Al₂O₃)| во много раз больше |U(MgO)| — заряды +3/−2')
  near(2 * dHfKJ('Al2O3(s)'), formationReactionKJ('al2o3_formation'), 1e-9, 'реакция 4Al + 3O₂ = 2·ΔH°f(Al₂O₃)')
  near(formationReactionKJ('al2o3_formation'), -3351.4, 1e-9, 'реакция 4Al + 3O₂ → 2Al₂O₃: −3351.4 кДж')
}
// PbO: формальный цикл
ok(BORN_HABER.pbo.formal === true && LATTICE_ENTHALPY_INFO['PbO(litharge)']?.estimated === true, 'PbO: цикл и U помечены формальными/оценочными')

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
for (const key of ['H2(g)', 'N2(g)', 'O2(g)', 'Cl2(g)', 'Br2(l)', 'I2(s)', 'C(graphite)', 'S8(s)', 'P4(s)', 'Na(s)', 'Si(s)', 'Pb(s)', 'Mn(s)', 'Ba(s)', 'K(s)', 'Al(s)']) {
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

// Оценочные ΔH°f обязаны назвать источник; первичные — нет флага
for (const [key, f] of Object.entries(FORMATION_ENTHALPY)) {
  if (f.estimated) ok(Boolean(f.source), `${key}: оценочное значение обязано назвать источник`)
}
ok(FORMATION_ENTHALPY['Mn2O7(l)'].estimated === true, 'Mn₂O₇: ΔH°f помечена как оценочная (в CRC/JANAF нет)')
ok(FORMATION_ENTHALPY['Cl2O7(l)'].dHfKJ > 0 && FORMATION_ENTHALPY['Cl2O7(g)'].dHfKJ > 0, 'Cl₂O₇ эндотермичен (ж и г)')
near(dHfKJ('Cl2O7(g)') - dHfKJ('Cl2O7(l)'), 33.9, 0.05, 'Cl₂O₇: теплота испарения = ΔH°f(г) − ΔH°f(ж)')
near(dHfKJ('H2O2(g)') - dHfKJ('H2O2(l)'), 51.5, 0.05, 'H₂O₂: теплота испарения 51.5 кДж/моль')
ok(dHfKJ('PbO(litharge)') < dHfKJ('PbO(massicot)'), 'глёт устойчивее массикота при 25 °C')
// Контрольные реакции — пересчёт по ΔH°f
near(formationReactionKJ('so3_contact'), 2 * dHfKJ('SO3(g)') - 2 * dHfKJ('SO2(g)'), 1e-9, 'SO₃: ΔH = 2ΔH°f(SO₃) − 2ΔH°f(SO₂)')
near(formationReactionKJ('so3_contact'), -197.8, 1e-9, 'SO₃: −197.8 кДж на уравнение')
near(formationReactionKJ('h2o2_decomposition'), -196.0, 1e-9, 'H₂O₂ → H₂O(ж): −196.0 кДж на уравнение')
near(formationReactionKJ('h2o2_decomposition'), -196.1, 0.15, 'ориентир документа −196.1 отличается на 0.1 (названо в note)')
ok(/196\.1/.test(FORMATION_REACTIONS.h2o2_decomposition.note ?? ''), 'расхождение −196.0/−196.1 названо в note реакции')
near(formationReactionKJ('thermite'), -851.5, 1e-9, 'термит: −851.5 кДж')
near(formationReactionKJ('mgo_formation'), -1203.2, 1e-9, '2Mg + O₂: −1203.2 кДж')
ok(formationReactionKJ('cl2o7_decomposition') < 0, 'распад Cl₂O₇ на простые вещества экзотермичен — взрывоопасен')
ok(formationReactionIsEstimated('mn2o7_textbook') && !formationReactionIsEstimated('so3_contact'), 'реакция с Mn₂O₇ помечена оценочной, SO₃ — нет')
for (const id of Object.keys(FORMATION_REACTIONS)) ok(FORMATION_REACTIONS[id].id === id, `${id}: поле id совпадает с ключом`)

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
near(BOND_LENGTH_A.OO, bondLengthPm('O=O') / 100, 1e-12, 'atoms.ts: O=O = ядро (r_e 1.2075 Å)')
near(BOND_LENGTH_A.OO, 1.2075, 1e-9, 'atoms.ts: O=O = 1.2075 Å')
near(BOND_ANGLE_DEG.water, bondAngleDeg('water'), 1e-12, 'atoms.ts: угол воды = ядро')
near(BOND_LENGTH_A.HH, bondLengthPm('H-H') / 100, 1e-12, 'atoms.ts: H–H = ядро')
near(IONIC_RADIUS_A['V5+'], (ionicRadiusPm('V', 5) as number) / 100, 1e-12, 'atoms.ts: V⁵⁺ = ядро')
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
  // ключи сравниваются внутри одной таблицы (блок `export const …`), а не по всему файлу:
  // 'Al2O3(s)' законно есть и в FORMATION_ENTHALPY, и в LATTICE_ENTHALPY_INFO
  let total = 0
  for (const block of text.split(/^export const /m)) {
    const seen = new Map<string, number>()
    for (const m of block.matchAll(re)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1)
    total += seen.size
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k)
    ok(dupes.length === 0, `${rel}: нет дублирующихся ключей в таблице (найдены: ${dupes.join(', ') || '—'})`)
  }
  ok(total > 0, `${rel}: сканер ключей действительно что-то нашёл`)
}

const symbols = [...ELEMENT_SYMBOLS]
ok(new Set(symbols).size === symbols.length, 'символы элементов уникальны')
ok(symbols.length >= 25, `в ядре не меньше 25 элементов (сейчас ${symbols.length})`)
const zValues = symbols.map((s) => ATOMIC_DATA[s].z)
ok(new Set(zValues).size === zValues.length, 'заряды ядер Z уникальны')
for (const s of symbols) ok(ATOMIC_DATA[s].symbol === s, `${s}: поле symbol совпадает с ключом`)

// ─────────────────────────────────────────────────────────────────────────────
section('8. Ревизия рецензентов: каждое исправленное число под замком')
// ─────────────────────────────────────────────────────────────────────────────

// ── 8.1 Цикл NaCl: ступень диссоциации — это ΔH°f(Cl, г), а не ½·243.4 из таблицы связей.
// Было 121.7 (значение при 0 K) — цикл не сходился на 0.4 кДж.
const naclDissociation = BORN_HABER.nacl.stages.find((s) => s.kind === 'dissociation') as { dHKJ: number }
near(naclDissociation.dHKJ, dHfKJ('Cl(g)'), 1e-9, 'NaCl/диссоциация = ΔH°f(Cl, г) из FORMATION_ENTHALPY')
ok(naclDissociation.dHKJ !== 121.7, 'NaCl/диссоциация больше не 121.7 (это ½D(Cl₂) при 0 K, чужое число)')
near(bornHaberResidualKJ('nacl'), 0, 0.05, 'цикл NaCl закрывается ТОЧНО, а не «в пределах ±5»')

// Ни одна ступень цикла не имеет права быть вбитой мимо остальных таблиц ядра.
const stageSources: ReadonlyArray<readonly [string, string, number]> = [
  ['nacl', 'sublimation', dHfKJ('Na(g)')],
  ['nacl', 'dissociation', dHfKJ('Cl(g)')],
  ['nacl', 'ionization', ATOMIC_DATA.Na.ie1KJ],
  ['nacl', 'affinity', ATOMIC_DATA.Cl.electronAffinityKJ],
  ['mgo', 'sublimation', dHfKJ('Mg(g)')],
  ['mgo', 'dissociation', dHfKJ('O(g)')],
  ['cao', 'sublimation', dHfKJ('Ca(g)')],
  ['cao', 'dissociation', dHfKJ('O(g)')],
]
for (const [cycleId, stageId, expected] of stageSources) {
  const stage = BORN_HABER[cycleId].stages.find((s) => s.id === stageId) as { dHKJ: number }
  near(stage.dHKJ, expected, 1e-9, `${cycleId}/${stageId}: ступень взята из таблиц ядра, а не вбита руками`)
}

// ── 8.2 Комментарии thermoData не имеют права называть энергии решёток, которых нет в данных.
{
  const text = readFileSync(resolve(root, 'src/chemistry/data/thermoData.ts'), 'utf8')
  for (const [key, wrong] of [
    ['MgO(s)', 3791],
    ['CaO(s)', 3401],
  ] as const) {
    ok(
      !text.includes(String(wrong)),
      `thermoData: число ${wrong} не встречается в файле — в данных ${Math.abs(LATTICE_ENTHALPY_KJ[key])}`,
    )
    ok(
      text.includes(String(Math.abs(LATTICE_ENTHALPY_KJ[key]))),
      `thermoData: комментарии называют ту же энергию решётки ${key}, что и данные`,
    )
  }
}

// ── 8.3 CPK: хлор зелёный (Jmol #1FF01F) и отличим от магния на экране.
ok(cpkColor('Cl') === 0x1ff01f, 'Cl — ЗЕЛЁНЫЙ 0x1ff01f (канонический Jmol), а не жёлто-зелёный')
ok(cpkColor('Mg') === 0x8aff00, 'Mg сохраняет жёлто-зелёный 0x8aff00')
const rgb = (hex: number) => [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff] as const
const cpkDistance = (x: ElementSymbol, y: ElementSymbol) => {
  const a = rgb(cpkColor(x))
  const b = rgb(cpkColor(y))
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])
}
// Было 0xa6ff00 против 0x8aff00 — расстояние 28, на экране неотличимо.
ok(cpkDistance('Cl', 'Mg') >= 120, `Cl и Mg больше не сливаются (расстояние ${cpkDistance('Cl', 'Mg')})`)
// Элементы десяти сцен встречаются в общем каталоге и в таблице элементов рядом,
// поэтому их шары обязаны различаться хотя бы на 60 единиц суммарно по RGB.
// (H и He у Jmol намеренно почти одинаковы — благородные газы в сценах не участвуют.)
// Пара Fe/Cu (#E06633 и #C88033) близка уже у самого Jmol — это канон, мы его не переписываем,
// и в одной сцене железо с медью не встречаются.
const sceneElements: readonly ElementSymbol[] = ['H', 'C', 'N', 'O', 'S', 'Cl', 'Na', 'Mg', 'Ca', 'Fe', 'Zn', 'Cu']
const cpkExempt = new Set(['Fe|Cu'])
for (let i = 0; i < sceneElements.length; i++) {
  for (let j = i + 1; j < sceneElements.length; j++) {
    if (cpkExempt.has(`${sceneElements[i]}|${sceneElements[j]}`)) continue
    const dist = cpkDistance(sceneElements[i], sceneElements[j])
    ok(dist >= 60, `${sceneElements[i]} и ${sceneElements[j]}: цвета CPK различимы (расстояние ${dist})`)
  }
}

// ── 8.4/8.5/8.10 Энергии связей двухатомных молекул обязаны сходиться по Гессу
// с собственной таблицей ΔH°f. Было: Mg–O 394, Ca–O 464, N=O 607, S–H 339.
const derivedBonds: ReadonlyArray<readonly [BondKey, number, string]> = [
  // ΔH°f(MgO, г) = +58.2 (NIST-JANAF)
  ['Mg-O', dHfKJ('Mg(g)') + dHfKJ('O(g)') - 58.2, 'D(Mg–O) = ΔH°f(Mg,г) + ΔH°f(O,г) − ΔH°f(MgO,г)'],
  // ΔH°f(CaO, г) = +43.9 — газовая CaO ЭНДОТЕРМИЧНА
  ['Ca-O', dHfKJ('Ca(g)') + dHfKJ('O(g)') - 43.9, 'D(Ca–O) = ΔH°f(Ca,г) + ΔH°f(O,г) − ΔH°f(CaO,г)'],
  ['N=O', dHfKJ('N(g)') + dHfKJ('O(g)') - dHfKJ('NO(g)'), 'D(N–O в NO) = ΔH°f(N,г) + ΔH°f(O,г) − ΔH°f(NO,г)'],
  ['S-H', (dHfKJ('S(g)') + 2 * dHfKJ('H(g)') - dHfKJ('H2S(g)')) / 2, 'средняя S–H в H₂S = атомизация / 2'],
]
for (const [key, expected, why] of derivedBonds) {
  near(bondEnthalpyKJ(key), expected, 1, `${why}: таблица связей согласована с ΔH°f`)
  ok(Boolean(BOND_DATA[key].derived), `${key}: значение выведено по Гессу — обязано нести derived: true`)
  ok(Boolean(BOND_DATA[key].note), `${key}: выведенное значение обязано объяснять свой вывод в note`)
}
ok(bondEnthalpyKJ('Ca-O') > bondEnthalpyKJ('Mg-O'), 'D(Ca–O) > D(Mg–O) — как в NIST-JANAF')

// Правило файла: если context называет конкретную молекулу, значение относится ИМЕННО к ней
// (сверка по ΔH°f), а усреднённые по соединениям числа обязаны сказать это в context.
{
  const averaged: readonly BondKey[] = ['S-S', 'C-C', 'C-O', 'C=O', 'C-Cl']
  for (const key of averaged) {
    const ctx = BOND_DATA[key].context
    ok(
      /сред|соединени|алкан|спирт|кетон|эфир/i.test(ctx),
      `${key}: усреднённое по соединениям значение обязано честно сказать это в context («${ctx}»)`,
    )
  }
  ok(
    !/кольцо S₈ \(ромбическая сера\)$/.test(BOND_DATA['S-S'].context),
    'S–S: 266 кДж/моль — не энергия связи в самой короне S₈ (там 277.2 = ΔH°f(S, г))',
  )
}

// Разбор остатка реакции горения серы: 16.8 кДж — сумма ТРЁХ вкладов, а не один S=O.
{
  const sso2 = reactionEnthalpyBothKJ('so2_from_elements')
  const trueSO = (dHfKJ('S(g)') + 2 * dHfKJ('O(g)') - dHfKJ('SO2(g)')) / 2 // 536.2
  const trueSS = dHfKJ('S(g)') // 277.2 — в короне S₈ на атом ровно одна связь
  const trueOO = 2 * dHfKJ('O(g)') // 498.4
  const fromSO = 2 * (trueSO - bondEnthalpyKJ('S=O'))
  const fromSS = -(trueSS - bondEnthalpyKJ('S-S'))
  const fromOO = -(trueOO - bondEnthalpyKJ('O=O'))
  near(fromSO, 28.4, 0.1, 'вклад усреднённой S=O в остаток горения серы = +28.4 кДж')
  near(fromSS, -11.2, 0.1, 'вклад усреднённой S–S в остаток горения серы = −11.2 кДж')
  near(fromSO + fromSS + fromOO, sso2.deltaKJ, 0.1, 'остаток 16.8 кДж раскладывается на S=O, S–S и O=O без хвоста')
  ok(
    (MOLECULAR_REACTIONS.so2_from_elements.note ?? '').includes('277.2'),
    'note реакции обязан назвать настоящую энергию S–S в S₈ (277.2), а не сваливать всё на S=O',
  )
}

// ── 8.6/8.7 Плотности — рентгеновские: ρ = Z·M / (N_A·V) по параметрам ЭТОЙ ЖЕ ячейки.
// Было: троилит 4.61 (плотность пирротина) и α-ZnCl₂ 2.907 (справочная макроскопическая).
{
  const NA = 6.02214076e23
  // Молярная масса — из формулы записи и атомных масс IUPAC 2021 (не из захардкоженной таблицы)
  const massOf = (id: string): number => molarMassGMol(parseFormula(CRYSTAL_DATA[id].formula))
  /** Объём ячейки в Å³ по её параметрам и углам. */
  const cellVolumeA3 = (id: string): number => {
    const c = CRYSTAL_DATA[id]
    const a = c.cellPm.a / 100
    const b = (c.cellPm.b ?? c.cellPm.a) / 100
    const cc = (c.cellPm.c ?? c.cellPm.a) / 100
    // гексагональная установка: γ = 120°, V = (√3/2)·a²·c; иначе прямоугольная (куб, тетрагон, ромб)
    if (c.cellAnglesDeg?.gamma === 120) return (Math.sqrt(3) / 2) * a * a * cc
    ok(c.cellAnglesDeg == null || (c.cellAnglesDeg.alpha === 90 && c.cellAnglesDeg.beta === 90 && c.cellAnglesDeg.gamma === 90), `${id}: ячейка прямоугольная`)
    return a * b * cc
  }
  /**
   * Допуск 0.3 %, а не 1 %: при 1 % мимо теста проскакивала ошибка CsCl (0.70 %) —
   * там стояла ячейка a = 411.3 при плотности, отвечающей a = 412.3. На 0.3 % все записи
   * проходят с запасом (худшая — CaO, 0.16 %), а подмена рентгеновской ρ макроскопической ловится.
   */
  const RHO_TOL = 0.003
  for (const id of CRYSTAL_IDS) {
    const M = massOf(id)
    ok(M > 0, `${id}: молярная масса посчитана из формулы «${CRYSTAL_DATA[id].formula}»`)
    const rho = (CRYSTAL_DATA[id].z * M) / (NA * cellVolumeA3(id) * 1e-24)
    const rel = Math.abs(rho - CRYSTAL_DATA[id].densityGCm3) / rho
    ok(
      rel <= RHO_TOL,
      `${id}: ρ из ячейки ${rho.toFixed(3)} против таблицы ${CRYSTAL_DATA[id].densityGCm3}${CRYSTAL_DATA[id].temperatureK ? ` при ${CRYSTAL_DATA[id].temperatureK} K` : ''} — расхождение ${(rel * 100).toFixed(2)} % (допуск 0.3 %)`,
    )
  }

  // Там, где справочная МАКРОСКОПИЧЕСКАЯ плотность законно другая (вакансии, границы зёрен,
  // нестехиометрия, другая полиморфная форма), она обязана быть названа в note — числом.
  {
    const macroscopic: ReadonlyArray<readonly [string, string, number]> = [
      ['troilite', '4.67', 4.84],
      ['zncl2', '2.907', 3.01],
      ['cu_metal', '8.96', 8.935],
    ]
    for (const [id, printed, xray] of macroscopic) {
      const note = CRYSTAL_DATA[id].note ?? ''
      ok(
        note.includes(printed),
        `${id}: макроскопическая плотность ${printed} г/см³ обязана быть честно вынесена в note`,
      )
      ok(
        CRYSTAL_DATA[id].densityGCm3 === xray,
        `${id}: в поле densityGCm3 стоит РЕНТГЕНОВСКАЯ ${xray}, а не справочная ${printed}`,
      )
      ok(
        Number(printed) !== CRYSTAL_DATA[id].densityGCm3,
        `${id}: два числа разные — иначе ветка с note потеряла смысл`,
      )
    }
    // Медь — именно тот случай, что раньше сидел в поле без всякого note.
    ok(
      CRYSTAL_DATA.cu_metal.densityGCm3 !== 8.96,
      'медь: 8.96 — макроскопическая CRC; рентгеновская по a = 361.49 пм равна 8.935',
    )
  }
  ok(CRYSTAL_DATA.troilite.densityGCm3 !== 4.61, 'троилит: 4.61 — плотность нестехиометрического пирротина, не FeS')
  ok(
    (CRYSTAL_DATA.troilite.note ?? '').includes('4.67'),
    'троилит: измеренная плотность природного минерала вынесена в note',
  )
  ok(CRYSTAL_DATA.zncl2.densityGCm3 !== 2.907, 'α-ZnCl₂: 2.907 — справочная макроскопическая, а не рентгеновская')
  ok(
    (CRYSTAL_DATA.zncl2.note ?? '').includes('2.907'),
    'α-ZnCl₂: справочная плотность технического продукта вынесена в note',
  )
}

// ── 8.14 Геометрия внутри записи: cationAnionPm НЕ имеет права жить своей жизнью.
// В кубических структурах он жёстко связан с a — именно эта связь была разорвана у CsCl.
{
  const cubicRule: ReadonlyArray<readonly [string, number, string]> = [
    ['nacl', 1 / 2, 'a/2 (октаэдр каменной соли)'],
    ['mgo', 1 / 2, 'a/2'],
    ['cao', 1 / 2, 'a/2'],
    ['cscl', Math.sqrt(3) / 2, 'a·√3/2 (объёмная диагональ куба пополам)'],
    ['sphalerite', Math.sqrt(3) / 4, 'a·√3/4 (четверть диагонали — тетраэдрическая пустота)'],
    ['diamond', Math.sqrt(3) / 4, 'a·√3/4'],
    ['na_metal', Math.sqrt(3) / 2, 'a·√3/2 (ОЦК: центр → вершина)'],
    ['fe_metal', Math.sqrt(3) / 2, 'a·√3/2 (ОЦК)'],
    ['cu_metal', Math.SQRT1_2, 'a/√2 (ГЦК: центр грани → вершина)'],
    ['si', Math.sqrt(3) / 4, 'a·√3/4 (решётка алмаза)'],
    ['pb_metal', Math.SQRT1_2, 'a/√2 (ГЦК)'],
    ['al_metal', Math.SQRT1_2, 'a/√2 (ГЦК)'],
  ]
  for (const [id, k, how] of cubicRule) {
    near(
      CRYSTAL_DATA[id].cationAnionPm,
      CRYSTAL_DATA[id].cellPm.a * k,
      0.1,
      `${id}: ближайший сосед = ${how}`,
    )
  }

  // CsCl адресно: а = 412.3 пм (Wyckoff/ICSD, 298 K). Старые 411.3/356.2 давали ρ = 4.018,
  // а в поле стояло 3.99 — три числа противоречили друг другу.
  ok(CRYSTAL_DATA.cscl.cellPm.a !== 411.3, 'CsCl: 411.3 пм — не тот параметр ячейки; при 298 K a = 412.3 пм')
  near(CRYSTAL_DATA.cscl.cellPm.a, 412.3, 0.001, 'CsCl: a = 412.3 пм (Wyckoff, Crystal Structures vol. 1; ICSD)')
  near(CRYSTAL_DATA.cscl.cationAnionPm, 357.1, 0.05, 'CsCl: Cs⁺···Cl⁻ = a·√3/2 = 357.1 пм')
  ok(CRYSTAL_DATA.cscl.cationAnionPm !== 356.2, 'CsCl: 356.2 пм — след старой ячейки 411.3')
  // КЧ 8 обязано остаться короче второй сферы (6 соседей на a) — иначе это уже не структура CsCl.
  ok(
    CRYSTAL_DATA.cscl.cationAnionPm < CRYSTAL_DATA.cscl.cellPm.a,
    'CsCl: восемь Cl⁻ по диагонали ближе шести Cs⁺ на ребре — отсюда КЧ 8',
  )
  ok((CRYSTAL_DATA.cscl.note ?? '').includes('357.1'), 'CsCl: расстояние 357.1 пм названо в note числом')

  // Цинк: в note обещаны две сферы соседей — обе обязаны считаться по собственной ячейке.
  {
    const a = CRYSTAL_DATA.zn_metal.cellPm.a
    const c = CRYSTAL_DATA.zn_metal.cellPm.c as number
    near(CRYSTAL_DATA.zn_metal.cationAnionPm, a, 0.05, 'цинк: 6 ближних соседей в слое стоят ровно на a')
    const far = Math.sqrt((a * a) / 3 + (c * c) / 4)
    near(far, 291.3, 0.05, 'цинк: 6 дальних соседей = √(a²/3 + c²/4) = 291.3 пм')
    const znNote = CRYSTAL_DATA.zn_metal.note ?? ''
    ok(!znNote.includes('290.7'), 'цинк: 290.7 пм в note не сходится с a = 266.49 и c = 494.68')
    ok(znNote.includes(far.toFixed(1)), `цинк: note называет дальних соседей тем же числом ${far.toFixed(1)}, что даёт ячейка`)
    near(c / a, 1.856, 0.002, 'цинк: c/a = 1.856 — именно это число обещает note')
  }
}

// ГПУ магния: кратчайшее — между слоями, √(a²/3 + c²/4)
near(
  CRYSTAL_DATA.mg_metal.cationAnionPm,
  Math.min(CRYSTAL_DATA.mg_metal.cellPm.a, Math.sqrt(CRYSTAL_DATA.mg_metal.cellPm.a ** 2 / 3 + CRYSTAL_DATA.mg_metal.cellPm.c! ** 2 / 4)),
  0.05,
  'магний: ближайший сосед = min(a, √(a²/3 + c²/4))',
)
// Глёт: Pb–O из ячейки и z(Pb) — полная проверка базиса в test-crystal-basis
{
  const c = CRYSTAL_DATA.litharge
  const z = c.basis!.find((b) => b.el === 'Pb')!.frac[2]
  near(Math.hypot(c.cellPm.a / 2, z * (c.cellPm.c as number)), c.cationAnionPm, 0.05, 'глёт: Pb–O = √((a/2)² + (z·c)²)')
  near(c.cationAnionPm, 231.8, 0.5, 'глёт: Pb–O 231.8 ± 0.5 пм')
  near(c.cationAnionPm, bondLengthPm('Pb-O'), 1e-9, 'глёт: crystalData и bondData называют одну длину Pb–O')
}
near(CRYSTAL_DATA.si.cationAnionPm, bondLengthPm('Si-Si'), 1e-9, 'кремний: crystalData и bondData — одна длина Si–Si')
near(CRYSTAL_DATA.quartz.cationAnionPm, BOND_DATA['Si-O'].lengthsPm![0], 1e-9, 'кварц: кратчайшая Si–O одна и та же в двух таблицах')

// ── 8.12 Графит: кратчайшее C–C жёстко связано с параметром ячейки (a/√3).
near(
  CRYSTAL_DATA.graphite.cationAnionPm,
  CRYSTAL_DATA.graphite.cellPm.a / Math.sqrt(3),
  0.05,
  'графит: C–C в слое = a/√3 (гексагональная сетка)',
)
near(
  (CRYSTAL_DATA.graphite.cellPm.c as number) / 2,
  335.45,
  0.1,
  'графит: межслоевое расстояние = c/2',
)

// ── 8.15 Комментарии не имеют права врать про числа, которые лежат рядом с ними.
// Докстринг radiusForSpecies и шапка kit/cpkAtoms.ts обещали «Cl⁰ 99 пм» — это старое
// значение по Полингу, а в таблице стоит ковалентный радиус Cordero 2008 = 102 пм.
{
  const commentScan: ReadonlyArray<readonly [string, string]> = [
    ['src/chemistry/data/atomicData.ts', 'докстринг radiusForSpecies'],
    ['src/lab/cinema/scenes/kit/cpkAtoms.ts', 'шапка кита частиц'],
  ]
  const clCovalent = covalentRadiusPm('Cl')
  ok(clCovalent === 102, 'Cl: ковалентный радиус 102 пм (Cordero 2008) — именно он идёт в radiusForSpecies')
  ok(radiusForSpecies('Cl', 0) === clCovalent, 'Cl⁰ в сцене получает ковалентный радиус, а не полинговский')
  for (const [rel, what] of commentScan) {
    const text = readFileSync(resolve(root, rel), 'utf8')
    const comments = text.match(/\/\*\*[\s\S]*?\*\//g)?.join('\n') ?? ''
    ok(comments.length > 0, `${rel}: ${what} прочитан`)
    ok(
      !/Cl[⁰0]\s*99/.test(comments) && !/\(Cl[⁰0]\s*99\s*пм\)/.test(comments),
      `${rel}: в комментариях нет «Cl⁰ 99 пм» — это радиус по Полингу, а в таблице ${clCovalent} пм`,
    )
    ok(
      !/Cl\s*99\s*→/.test(comments),
      `${rel}: цепочка «Cl 99 → 181» тоже обязана начинаться с ${clCovalent} пм`,
    )
    ok(
      comments.includes(`${clCovalent}`),
      `${rel}: комментарий называет настоящее значение ${clCovalent} пм`,
    )
  }

  // Шапка кита обещает цвета словами — слова обязаны отвечать числам из ATOMIC_DATA.
  const kit = readFileSync(resolve(root, 'src/lab/cinema/scenes/kit/cpkAtoms.ts'), 'utf8')
  const kitHead = kit.slice(0, kit.indexOf('*/') + 2)
  ok(cpkColor('Cl') === 0x1ff01f, 'Cl — канонический зелёный Jmol 0x1FF01F, а не жёлто-зелёный')
  ok(
    !/Cl\s+жёлто-зелёный/.test(kitHead),
    `шапка cpkAtoms: хлор в ATOMIC_DATA ${cpkCss('Cl')} — зелёный Jmol, называть его жёлто-зелёным нельзя`,
  )
  ok(/0x1ff01f/i.test(kitHead), 'шапка cpkAtoms: канонический цвет хлора назван числом')
  ok(cpkColor('C') === 0x2a2a32, 'C — 0x2a2a32 (почти чёрный), «тёмно-серый» без числа вводит в заблуждение')
  ok(/0x2a2a32/i.test(kitHead), 'шапка cpkAtoms: цвет углерода назван числом')
  ok(cpkColor('O') === 0xff0040, 'O — 0xff0040 (алый с уходом в малиновый), а не чистый красный')
  ok(/0xff0040/i.test(kitHead), 'шапка cpkAtoms: цвет кислорода назван числом')
  // «Ни одного числа руками» — обещание про КОД, а не про комментарий: в шапке чисел полно.
  ok(
    !/Ни одного числа руками/.test(kitHead),
    'шапка cpkAtoms: формулировка «Ни одного числа руками» неверна — числа в самой шапке набраны руками',
  )
}

// ── 8.13 Температуры плавления оксидов: урок сравнивает их между собой.
for (const id of ['nacl', 'mgo', 'cao'] as const) {
  ok(CRYSTAL_DATA[id].meltingC != null, `${id}: температура плавления задана — урок сравнивает тугоплавкость`)
}
ok(
  (CRYSTAL_DATA.mgo.meltingC as number) > (CRYSTAL_DATA.cao.meltingC as number),
  'MgO плавится выше CaO: Mg²⁺ меньше Ca²⁺, решётка прочнее',
)
ok(
  (CRYSTAL_DATA.cao.meltingC as number) > (CRYSTAL_DATA.nacl.meltingC as number),
  'CaO плавится выше NaCl: заряды ±2 против ±1',
)
// MgO: T_пл ≈ 2830 °C (3105 K, NIST-JANAF; разброс 2825–2852), потолок пламени — улетучивание оксида (Глассман)
{
  const mgo = CRYSTAL_DATA.mgo
  near((mgo.meltingC as number) + 273.15, 3105, 3, 'MgO: T_пл в кельвинах ≈ 3105 K (NIST-JANAF)')
  ok((mgo.meltingC as number) >= 2825 && (mgo.meltingC as number) <= 2852, 'MgO: T_пл в справочном коридоре 2825–2852 °C')
  ok((mgo.note ?? '').includes('2825') && (mgo.note ?? '').includes('2852'), 'MgO: разброс справочников назван в note')
  near(mgo.volatilizationK as number, 3430, 1e-9, 'MgO: потолок пламени — улетучивание-диссоциация ≈ 3430 K (Глассман)')
  ok((mgo.volatilizationK as number) > (mgo.meltingC as number) + 273.15, 'потолок пламени выше плавления: 3100 K — это порядок ПЛАВЛЕНИЯ MgO')
  const cor = CRYSTAL_DATA.corundum
  ok((cor.volatilizationK as number) > (cor.meltingC as number) + 273.15, 'Al₂O₃: потолок улетучивания выше плавления')
}

// Порядок температур плавления обязан повторять порядок энергий решёток
ok(
  Math.abs(LATTICE_ENTHALPY_KJ['MgO(s)']) > Math.abs(LATTICE_ENTHALPY_KJ['CaO(s)']) &&
    Math.abs(LATTICE_ENTHALPY_KJ['CaO(s)']) > Math.abs(LATTICE_ENTHALPY_KJ['NaCl(s)']),
  'энергии решёток выстроены в том же порядке, что и температуры плавления',
)

// ── 8.11 Примечания к ионным радиусам не имеют права противоречить шапке файла (Shannon, КЧ 6).
{
  const mnNote = ATOMIC_DATA.Mn.ionicRadiiNote ?? ''
  ok(ionicRadiusPm('Mn', 7) === 46, 'Mn⁷⁺ = 46 пм (Shannon, КЧ 6)')
  ok(/46 пм[^;.]*КЧ 6/.test(mnNote), 'Mn⁷⁺ 46 пм — это КЧ 6 (у Шеннона), а не КЧ 4')
  ok(/КЧ 4[^;.]*25/.test(mnNote), 'в примечании назван радиус Mn⁷⁺ для КЧ 4 (25 пм) — чтобы разница была видна')

  const crNote = ATOMIC_DATA.Cr.ionicRadiiNote ?? ''
  ok(
    !/Cr³⁺ — высокоспиновы|Cr²⁺ и Cr³⁺ — высокоспиновы/.test(crNote),
    'Cr³⁺ (d³, октаэдр) не бывает ВС/НС — спиновых состояний у него не два',
  )
  ok(/Cr²⁺/.test(crNote), 'у Cr²⁺ спиновое состояние указано — оно действительно бывает ВС и НС')
}

// ─────────────────────────────────────────────────────────────────────────────
section('9. Этап 11: данные десяти сцен сверены между собой, а не со строками')
// ─────────────────────────────────────────────────────────────────────────────

// ── 9.1 Геометрия реагентов: одна запись — один метод; порядок связи виден в длине.
for (const [key, g] of Object.entries(REAGENT_GEOMETRY)) {
  ok(g.key === key, `${key}: поле key совпадает с ключом`)
  ok(g.source.length > 10, `${key}: назван первоисточник геометрии`)
  for (const [b, pm] of Object.entries(g.bondsPm)) ok(pm > 50 && pm < 400, `${key}: ${b} в разумных пределах`)
  for (const [an, deg] of Object.entries(g.anglesDeg)) ok(deg > 60 && deg <= 180, `${key}: ${an} в разумных пределах`)
  for (const b of Object.keys(g.bondsPm)) ok((g.bondCounts[b] ?? 0) > 0, `${key}: у связи ${b} указано число`)
}
{
  const h = REAGENT_GEOMETRY.h2so4
  ok(h.lengthType === 'r_0' && h.phase === 'г', 'H₂SO₄: газовый микроволновый набор (r_0)')
  ok(reagentBondPm('h2so4', 'S=O') < reagentBondPm('h2so4', 'S–O(H)'), 'H₂SO₄: S=O короче S–OH')
  ok(reagentAngleDeg('h2so4', '∠O=S=O') > bondAngleDeg('tetrahedral'), 'H₂SO₄: две S=O расталкиваются сильнее тетраэдра')
  ok(reagentAngleDeg('h2so4', '∠HO–S–OH') < bondAngleDeg('tetrahedral'), 'H₂SO₄: ∠HO–S–OH меньше тетраэдра')
  // состав: 2 S=O + 2 S–O(H) = 4 O; 2 O–H = 2 H — сверка с формулой, а не с числом
  const f = parseFormula('H2SO4')
  ok(h.bondCounts['S=O'] + h.bondCounts['S–O(H)'] === f.O && h.bondCounts['O–H'] === f.H, 'H₂SO₄: число связей согласовано с формулой')
  near(reagentBondPm('h2so4', 'O–H'), bondLengthPm('O-H'), 2, 'H₂SO₄: O–H того же порядка, что в воде')
}
{
  ok(REAGENT_GEOMETRY.hclo4.lengthType === 'r_g', 'HClO₄: электронография (r_g)')
  ok(reagentBondPm('hclo4', 'Cl=O') < reagentBondPm('hclo4', 'Cl–O(H)'), 'HClO₄: Cl=O короче Cl–OH')
  near(reagentBondPm('hclo4', 'Cl=O'), bondLengthPm('Cl-O(term)'), 1, 'HClO₄ Cl=O ≈ концевой Cl=O в Cl₂O₇ (тот же тип связи, тот же метод)')
  ok(reagentBondPm('hclo4', 'Cl–O(H)') < bondLengthPm('Cl-O(bridge)'), 'Cl–OH кислоты короче мостика Cl–O–Cl оксида')
  const c = REAGENT_GEOMETRY.hclo4.bondCounts
  ok(c['Cl=O'] + c['Cl–O(H)'] === parseFormula('HClO4').O, 'HClO₄: четыре O вокруг Cl')
}
{
  const p = REAGENT_GEOMETRY.p4o10
  ok(reagentBondPm('p4o10', 'P=O') < reagentBondPm('p4o10', 'P–O(мост)'), 'P₄O₁₀: концевая P=O короче мостиковой')
  // 4 концевых O + 12 мостиковых связей / 2 (каждый мостиковый O — на двух P) = 10 O
  ok(p.bondCounts['P=O'] + p.bondCounts['P–O(мост)'] / 2 === parseFormula('P4O10').O, 'P₄O₁₀: 4 концевых + 6 мостиковых O = формула')
  ok(p.bondCounts['P=O'] === parseFormula('P4O10').P, 'P₄O₁₀: по одной концевой P=O на каждый P')
  near(reagentAngleDeg('p4o10', '∠P–O–P'), 124, 1, '∠P–O–P ≈ 124° (ориентир документа)')
}
{
  // сульфат-ион: порядок 1½ — между S=O и S–OH кислоты
  ok(
    reagentBondPm('h2so4', 'S=O') < reagentBondPm('sulfate', 'S–O') && reagentBondPm('sulfate', 'S–O') < reagentBondPm('h2so4', 'S–O(H)'),
    'SO₄²⁻: S–O между S=O и S–OH кислоты (порядок 1½)',
  )
  near(reagentAngleDeg('sulfate', '∠O–S–O'), bondAngleDeg('tetrahedral'), 1e-9, 'SO₄²⁻: правильный тетраэдр')
  near(reagentAngleDeg('permanganate', '∠O–Mn–O'), bondAngleDeg('tetrahedral'), 1e-9, 'MnO₄⁻: правильный тетраэдр')
  // S₃O₉ (γ-SO₃)
  ok(reagentBondPm('s3o9', 'S=O(конц.)') < reagentBondPm('s3o9', 'S–O(кольцо)'), 'S₃O₉: концевые короче кольцевых')
  near(reagentBondPm('s3o9', 'S=O(конц.)'), bondLengthPm('S=O(SO3)'), 3, 'S₃O₉: концевая S=O ≈ S=O мономера SO₃')
  near(reagentBondPm('s3o9', 'S–O(кольцо)'), reagentBondPm('h2so4', 'S–O(H)'), 6, 'S₃O₉: кольцевая S–O ≈ одинарной S–O кислоты')
  const s = REAGENT_GEOMETRY.s3o9.bondCounts
  ok(s['S=O(конц.)'] + s['S–O(кольцо)'] / 2 === 9, 'S₃O₉: 6 концевых + 3 мостиковых O = 9')
  // одно место истины: пероксид и перманганат не дублируют BOND_DATA
  ok(reagentBondPm('peroxide', 'O–O') === bondLengthPm('O-O(O2 2-)'), 'O₂²⁻: длина взята из BOND_DATA')
  near(reagentBondPm('peroxide', 'O–O'), 149, 1e-9, 'O₂²⁻ в Na₂O₂: 149 пм')
  ok(reagentBondPm('permanganate', 'Mn–O') === bondLengthPm('Mn-O(MnO4)'), 'MnO₄⁻: длина взята из BOND_DATA')
  near(reagentBondPm('permanganate', 'Mn–O'), 162.9, 1e-9, 'MnO₄⁻: 162.9 пм (Palenik 1967)')
  near(reagentBondA('h2so4', 'S=O'), reagentBondPm('h2so4', 'S=O') / 100, 1e-12, 'atoms.ts: reagentBondA = ядро / 100')
  let threw = false
  try {
    reagentBondPm('h2so4', 'S=S')
  } catch {
    threw = true
  }
  ok(threw, 'опечатка в подписи связи бросает, а не даёт 0')
}

// ── 9.2 Стадии цепей: каждое число — из ΔH°f ядра.
const hf = dHfKJ
near(formationReactionKJ('h2_dissociation'), 2 * hf('H(g)'), 1e-9, 'H₂ → 2H: 2·ΔH°f(H)')
near(formationReactionKJ('h2o_chain_branch_h'), hf('OH(g)') + hf('O(g)') - hf('H(g)'), 1e-9, 'H + O₂ → OH + O по ΔH°f')
near(formationReactionKJ('h2o_chain_branch_h'), 68.5, 0.05, 'H + O₂ → OH + O ≈ +68.5')
near(formationReactionKJ('h2o_chain_branch_o'), 6.1, 0.05, 'O + H₂ → OH + H ≈ +6.1')
near(formationReactionKJ('h2o_chain_propagation'), -61.1, 0.05, 'OH + H₂ → H₂O + H ≈ −61.1')
near(formationReactionKJ('co_oh_oxidation'), -102.3, 0.05, 'CO + OH → CO₂ + H ≈ −102.3')
near(formationReactionKJ('h2o_formation_g'), 2 * hf('H2O(g)'), 1e-9, '2H₂ + O₂ → 2H₂O (г) = 2·ΔH°f')
near(formationReactionKJ('h2o_formation_g'), reactionEnthalpyBothKJ('water_g_2mol').fromFormation, 1e-9, 'та же величина, что в MOLECULAR_REACTIONS')
// Гесс по цепи: branch_h + branch_o + 2·propagation = H + O₂ + 3H₂ → 2H₂O + 3H
near(
  formationReactionKJ('h2o_chain_branch_h') + formationReactionKJ('h2o_chain_branch_o') + 2 * formationReactionKJ('h2o_chain_propagation'),
  formationReactionKJ('h2o_formation_g') + 2 * hf('H(g)'),
  1e-9,
  'цепь H₂ + O₂ сходится по Гессу с итоговым уравнением (+ два лишних атома H — носители цепи)',
)
near(formationReactionKJ('co_formation') + formationReactionKJ('co_combustion'), formationReactionKJ('co2_formation'), 1e-9, 'C → CO → CO₂ = C → CO₂')
near(formationReactionKJ('co2_formation'), BORN_HABER.co2.dHfTableKJ, 1e-9, 'горение графита = ΔH°f(CO₂) цикла co2')
near(
  formationReactionKJ('co_oh_oxidation') - formationReactionKJ('co_combustion'),
  hf('H(g)') - hf('OH(g)'),
  1e-9,
  'CO + ·OH отличается от CO + ½O₂ ровно на ΔH°f(H) − ΔH°f(OH)',
)
for (const [chain, ids] of Object.entries(REACTION_STEP_CHAINS)) {
  for (const id of ids) ok(Boolean(FORMATION_REACTIONS[id]), `цепь ${chain}: стадия ${id} есть в FORMATION_REACTIONS`)
}
// Катализ V₂O₅: катализатор не меняет ΔH — сумма стадий = ½ контактной реакции
near(
  formationReactionKJ('so3_cat_v2o5_reduction') + formationReactionKJ('so3_cat_v2o4_reoxidation'),
  formationReactionKJ('so3_contact') / 2,
  1e-9,
  'V₂O₅-схема: две стадии дают ровно ½·(2SO₂ + O₂ → 2SO₃)',
)
ok(/СХЕМА/.test(FORMATION_REACTIONS.so3_cat_v2o5_reduction.note ?? ''), 'V₂O₅: школьная схема названа схемой')
near(dHfKJ('V2O5(s)'), -1550.6, 1e-9, 'ΔH°f V₂O₅ = −1550.6 (CRC)')
ok(dHfKJ('V(s)') === 0, 'ванадий — простое вещество, ΔH°f = 0')
near(formationReactionKJ('so3_hydration'), -132, 1, 'SO₃ + H₂O (ж) → H₂SO₄ ≈ −132 кДж/моль')
// Mn₂O₇ и MnO₂
near(dHfKJ('MnO2(s)'), -520.0, 1e-9, 'ΔH°f MnO₂ = −520.0 (CRC)')
ok(formationReactionKJ('mn2o7_decomposition') < 0, 'распад Mn₂O₇ на MnO₂ и O₂ экзотермичен')
ok(formationReactionIsEstimated('mn2o7_decomposition'), 'распад Mn₂O₇ помечен оценочным (ΔH°f Mn₂O₇ вторичная)')
// PbO: оговорка о способе учебника
ok(formationReactionKJ('pbno3_decomposition') > 0, 'разложение Pb(NO₃)₂ эндотермично — нужен нагрев')
near(dHfKJ('NO2(g)'), 33.2, 1e-9, 'ΔH°f NO₂ (г) = +33.2 (CRC)')
near(formationReactionKJ('pbo_formation'), 2 * dHfKJ('PbO(litharge)'), 1e-9, '2Pb + O₂ → 2PbO = 2·ΔH°f(глёт)')
// H₂O₂
ok(formationReactionKJ('h2o2_from_na2o2') < 0 && formationReactionKJ('h2o2_from_bao2') < 0, 'оба способа получения H₂O₂ экзотермичны')
near(formationReactionKJ('h2o2_from_elements'), dHfKJ('H2O2(l)'), 1e-9, 'формальная ступень Гесса H₂ + O₂ → H₂O₂ = ΔH°f')
ok(/ФОРМАЛЬН/.test(FORMATION_REACTIONS.h2o2_from_elements.note ?? ''), 'H₂ + O₂ → H₂O₂ названа формальной')
// Cl₂O₇: сводка учебника эндотермична — поэтому нужен осушитель
ok(formationReactionKJ('cl2o7_textbook_formal') > 0, '2HClO₄ → Cl₂O₇ + H₂O сама по себе эндотермична')
ok(/P₄O₁₀/.test(FORMATION_REACTIONS.cl2o7_textbook_formal.note ?? ''), 'роль P₄O₁₀ названа в note')
// Всё новое видно из публичного индекса ядра
for (const name of ['REAGENT_GEOMETRY', 'reagentBondPm', 'reagentAngleDeg', 'REACTION_STEP_CHAINS', 'SPECTRAL_LINES', 'spectralLineNm', 'photonEnergyKJPerMol', 'NATIVE_OXIDE_FILMS', 'FLAME_TEMPERATURES']) {
  ok(name in coreIndex, `индекс ядра экспортирует ${name}`)
}

// ── 9.3 Линия Na D: дублет, порядок, энергия фотона меньше энергии ионизации.
{
  const d2 = spectralLineNm('Na-D2')
  const d1 = spectralLineNm('Na-D1')
  ok(d2 < d1, 'D₂ (3p₃/₂) короче D₁ (3p₁/₂)')
  near(d1 - d2, 0.597, 0.001, 'расщепление дублета Na D ≈ 0.597 нм')
  const e = photonEnergyKJPerMol(d2)
  near(e, 203, 1, 'энергия фотона D₂ ≈ 203 кДж/моль (2.1 эВ)')
  ok(e < ATOMIC_DATA.Na.ie1KJ, 'возбуждение 3s → 3p дешевле ионизации Na')
  for (const line of Object.values(SPECTRAL_LINES)) ok(line.el in ATOMIC_DATA && /NIST/.test(line.source), `${line.id}: элемент есть в ядре, источник NIST`)
}

// ── 9.4 Плёнки и пламя: диапазоны, а не «точные» числа.
{
  for (const f of Object.values(NATIVE_OXIDE_FILMS)) {
    ok(f.min > 0 && f.min < f.max, `${f.id}: min < max`)
    if (f.extendedMax != null) ok(f.extendedMax >= f.max, `${f.id}: расширенная граница не меньше обычной`)
    ok(f.source.length > 10, `${f.id}: источник назван`)
  }
  ok(/аморф/i.test(NATIVE_OXIDE_FILMS.al.what) && /корунд/.test(NATIVE_OXIDE_FILMS.al.note ?? ''), 'Al: плёнка аморфная, отличие от корунда названо')
  ok(NATIVE_OXIDE_FILMS.al.min === 2 && NATIVE_OXIDE_FILMS.al.max === 4 && NATIVE_OXIDE_FILMS.al.extendedMax === 5, 'Al: 2–4 нм, до ~5 нм при старении')
  ok(NATIVE_OXIDE_FILMS.si.min === 1 && NATIVE_OXIDE_FILMS.si.max === 2, 'Si: нативный SiO₂ 1–2 нм')
  const mg = FLAME_TEMPERATURES.mg_ribbon_air
  const ceilingC = (CRYSTAL_DATA.mgo.volatilizationK as number) - 273.15
  ok(mg.max < ceilingC, 'реальное пламя Mg ниже потолка улетучивания MgO (Глассман)')
  ok(mg.min > 0 && mg.min < mg.max && mg.estimated === true, 'пламя Mg — диапазон-оценка 2200–3100 °C')
  ok((CRYSTAL_DATA.mgo.meltingC as number) > mg.min && (CRYSTAL_DATA.mgo.meltingC as number) < mg.max, 'плавление MgO (≈ 2830 °C) лежит внутри диапазона пламени')
}

console.log(`\n✅ научное ядро данных: ${checks} проверок пройдено`)
