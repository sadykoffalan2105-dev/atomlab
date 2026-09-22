/**
 * ATOMLAB — термохимия: стандартные энтальпии образования, циклы Борна — Габера,
 * энергии решёток и тепловые эффекты реакций, посчитанные ДВУМЯ способами.
 *
 * ИСТОЧНИКИ (по таблице, не по значению):
 *  • ΔH°f (298.15 K, 1 бар) — CRC Handbook of Chemistry and Physics, 97th ed.,
 *    «Standard Thermodynamic Properties of Chemical Substances»; NIST-JANAF Thermochemical Tables.
 *  • Энтальпии сублимации металлов равны ΔH°f их одноатомного газа (та же таблица).
 *  • Энергии ионизации и сродства к электрону — см. atomicData.ts.
 *  • Энергии решёток — значения цикла Борна — Габера (экспериментальные), а не расчёт
 *    по Борну — Ланде: NaCl 787, MgO 3789, CaO 3400 кДж/моль.
 *
 * ЗНАКИ (строго): ΔH_субл > 0, ½D(X₂) > 0, IE > 0, EA₁ < 0 (но EA₂ кислорода > 0),
 * U_реш < 0, ΔH°f < 0 для экзотермического образования.
 *
 * ПРОВЕРКА: сумма ступеней цикла обязана совпасть с табличной ΔH°f (скрипт test-chem-data).
 */

import type { BondKey } from './bondData'
import { bondEnthalpyKJ } from './bondData'

// ─────────────────────────────────────────────────────────────────────────────
// ΔH°f — стандартные энтальпии образования, кДж/моль
// ─────────────────────────────────────────────────────────────────────────────

export type FormationDatum = {
  readonly formula: string
  readonly nameRu: string
  /** Агрегатное состояние в стандартных условиях записи. */
  readonly state: 'г' | 'ж' | 'тв' | 'водн'
  readonly dHfKJ: number
  readonly note?: string
  /** Значение оценочное: в первичных компиляциях (CRC, NIST-JANAF) его нет, сходимость циклов с ним не заявляется. */
  readonly estimated?: boolean
  /** Источник, если он не CRC 97th / NIST-JANAF по умолчанию. */
  readonly source?: string
}

export const FORMATION_ENTHALPY: Readonly<Record<string, FormationDatum>> = {
  // простые вещества в стандартном состоянии — ровно 0 по определению
  'H2(g)': { formula: 'H₂', nameRu: 'водород', state: 'г', dHfKJ: 0 },
  'N2(g)': { formula: 'N₂', nameRu: 'азот', state: 'г', dHfKJ: 0 },
  'O2(g)': { formula: 'O₂', nameRu: 'кислород', state: 'г', dHfKJ: 0 },
  'Cl2(g)': { formula: 'Cl₂', nameRu: 'хлор', state: 'г', dHfKJ: 0 },
  'Br2(l)': { formula: 'Br₂', nameRu: 'бром', state: 'ж', dHfKJ: 0, note: 'при 25 °C бром — ЖИДКОСТЬ; Br₂(г) +30.9' },
  'I2(s)': { formula: 'I₂', nameRu: 'иод', state: 'тв', dHfKJ: 0, note: 'при 25 °C иод — ТВЁРДЫЙ; I₂(г) +62.4' },
  'C(graphite)': { formula: 'C', nameRu: 'графит', state: 'тв', dHfKJ: 0, note: 'алмаз +1.9 кДж/моль' },
  'S8(s)': { formula: 'S₈', nameRu: 'сера ромбическая', state: 'тв', dHfKJ: 0, note: 'на 1 моль атомов S тоже 0' },
  'P4(s)': { formula: 'P₄', nameRu: 'фосфор белый', state: 'тв', dHfKJ: 0, note: 'красный фосфор −17.6' },
  'Na(s)': { formula: 'Na', nameRu: 'натрий', state: 'тв', dHfKJ: 0 },
  'Mg(s)': { formula: 'Mg', nameRu: 'магний', state: 'тв', dHfKJ: 0 },
  'Ca(s)': { formula: 'Ca', nameRu: 'кальций', state: 'тв', dHfKJ: 0 },
  'Fe(s)': { formula: 'Fe', nameRu: 'железо', state: 'тв', dHfKJ: 0 },
  'Zn(s)': { formula: 'Zn', nameRu: 'цинк', state: 'тв', dHfKJ: 0 },
  'Cu(s)': { formula: 'Cu', nameRu: 'медь', state: 'тв', dHfKJ: 0 },
  'Al(s)': { formula: 'Al', nameRu: 'алюминий', state: 'тв', dHfKJ: 0 },
  'Si(s)': { formula: 'Si', nameRu: 'кремний', state: 'тв', dHfKJ: 0 },
  'Pb(s)': { formula: 'Pb', nameRu: 'свинец', state: 'тв', dHfKJ: 0 },
  'Mn(s)': { formula: 'Mn', nameRu: 'марганец (α)', state: 'тв', dHfKJ: 0 },
  'Ba(s)': { formula: 'Ba', nameRu: 'барий', state: 'тв', dHfKJ: 0 },
  'K(s)': { formula: 'K', nameRu: 'калий', state: 'тв', dHfKJ: 0 },

  // одноатомные газы — это и есть энтальпии сублимации / атомизации
  'Na(g)': { formula: 'Na (г)', nameRu: 'натрий атомарный', state: 'г', dHfKJ: 107.3 },
  'Mg(g)': { formula: 'Mg (г)', nameRu: 'магний атомарный', state: 'г', dHfKJ: 147.1 },
  'Ca(g)': { formula: 'Ca (г)', nameRu: 'кальций атомарный', state: 'г', dHfKJ: 177.8 },
  'Zn(g)': { formula: 'Zn (г)', nameRu: 'цинк атомарный', state: 'г', dHfKJ: 130.4 },
  'Fe(g)': { formula: 'Fe (г)', nameRu: 'железо атомарное', state: 'г', dHfKJ: 416.3 },
  // CRC 97th / NIST-JANAF (298 K): энтальпии сублимации = ΔH°f одноатомного газа
  'Al(g)': { formula: 'Al (г)', nameRu: 'алюминий атомарный', state: 'г', dHfKJ: 330.0 },
  'Si(g)': { formula: 'Si (г)', nameRu: 'кремний атомарный', state: 'г', dHfKJ: 450.0 },
  'Pb(g)': { formula: 'Pb (г)', nameRu: 'свинец атомарный', state: 'г', dHfKJ: 195.2 },
  'Mn(g)': { formula: 'Mn (г)', nameRu: 'марганец атомарный', state: 'г', dHfKJ: 283.3 },
  'H(g)': { formula: 'H (г)', nameRu: 'водород атомарный', state: 'г', dHfKJ: 218.0 },
  'O(g)': { formula: 'O (г)', nameRu: 'кислород атомарный', state: 'г', dHfKJ: 249.2 },
  'Cl(g)': { formula: 'Cl (г)', nameRu: 'хлор атомарный', state: 'г', dHfKJ: 121.3 },
  'N(g)': { formula: 'N (г)', nameRu: 'азот атомарный', state: 'г', dHfKJ: 472.7 },
  'S(g)': { formula: 'S (г)', nameRu: 'сера атомарная', state: 'г', dHfKJ: 277.2 },
  'C(g)': { formula: 'C (г)', nameRu: 'углерод атомарный', state: 'г', dHfKJ: 716.7 },
  // гидроксил-радикал: Ruscic et al., J. Phys. Chem. A 106 (2002) 2727 (ATcT), CRC 97th — 37.3
  'OH(g)': { formula: '·OH (г)', nameRu: 'гидроксил-радикал', state: 'г', dHfKJ: 37.3, source: 'Ruscic et al. 2002 (ATcT); CRC 97th' },

  // продукты сцен
  'NaCl(s)': { formula: 'NaCl', nameRu: 'хлорид натрия', state: 'тв', dHfKJ: -411.2 },
  'MgO(s)': { formula: 'MgO', nameRu: 'оксид магния', state: 'тв', dHfKJ: -601.6 },
  'CaO(s)': { formula: 'CaO', nameRu: 'оксид кальция', state: 'тв', dHfKJ: -634.9 },
  'CaCO3(s)': { formula: 'CaCO₃', nameRu: 'карбонат кальция (кальцит)', state: 'тв', dHfKJ: -1207.6 },
  'FeS(s)': { formula: 'FeS', nameRu: 'сульфид железа(II)', state: 'тв', dHfKJ: -100.0 },
  'ZnCl2(s)': { formula: 'ZnCl₂', nameRu: 'хлорид цинка', state: 'тв', dHfKJ: -415.1 },

  // ——— ИОНЫ В ВОДНОМ РАСТВОРЕ (бесконечное разбавление, 298 K) ———
  // Шкала относительная: ΔH°f(H⁺, водн) ≡ 0 ПО СОГЛАШЕНИЮ, всё остальное отсчитано от него.
  // Поэтому «энтальпия образования иона» — не абсолютная величина, а разность; в сумме
  // по электронейтральному уравнению соглашение сокращается и ответ физически точен.
  'H+(aq)': { formula: 'H⁺', nameRu: 'ион водорода (гидратированный)', state: 'водн', dHfKJ: 0, note: 'ноль шкалы по соглашению IUPAC; реально протон в воде существует как H₃O⁺ и далее H₉O₄⁺' },
  'Cl-(aq)': { formula: 'Cl⁻', nameRu: 'хлорид-ион', state: 'водн', dHfKJ: -167.2 },
  'Zn2+(aq)': { formula: 'Zn²⁺', nameRu: 'ион цинка', state: 'водн', dHfKJ: -153.9, note: 'реально существует как аквакомплекс [Zn(H₂O)₆]²⁺' },
  'HCl(aq)': { formula: 'HCl', nameRu: 'соляная кислота', state: 'водн', dHfKJ: -167.2, note: 'кислота диссоциирована нацело: ΔH°f(H⁺) + ΔH°f(Cl⁻) = 0 + (−167.2)' },
  'ZnCl2(aq)': { formula: 'ZnCl₂', nameRu: 'хлорид цинка (раствор)', state: 'водн', dHfKJ: -488.3, note: 'ΔH°f(Zn²⁺) + 2·ΔH°f(Cl⁻) = −153.9 + 2·(−167.2); табличное значение −488.19' },
  'ZnS(s)': { formula: 'ZnS', nameRu: 'сульфид цинка (сфалерит)', state: 'тв', dHfKJ: -206.0 },
  'H2O(g)': { formula: 'H₂O', nameRu: 'вода (пар)', state: 'г', dHfKJ: -241.8 },
  'H2O(l)': { formula: 'H₂O', nameRu: 'вода (жидкость)', state: 'ж', dHfKJ: -285.8 },
  'HCl(g)': { formula: 'HCl', nameRu: 'хлороводород', state: 'г', dHfKJ: -92.3 },
  'NH3(g)': { formula: 'NH₃', nameRu: 'аммиак', state: 'г', dHfKJ: -45.9 },
  'CO2(g)': { formula: 'CO₂', nameRu: 'оксид углерода(IV)', state: 'г', dHfKJ: -393.5 },
  'CO(g)': { formula: 'CO', nameRu: 'оксид углерода(II)', state: 'г', dHfKJ: -110.5 },
  'SO2(g)': { formula: 'SO₂', nameRu: 'оксид серы(IV)', state: 'г', dHfKJ: -296.8 },
  'SO3(g)': { formula: 'SO₃', nameRu: 'оксид серы(VI)', state: 'г', dHfKJ: -395.7 },
  'CH4(g)': { formula: 'CH₄', nameRu: 'метан', state: 'г', dHfKJ: -74.6 },
  'ClO2(g)': { formula: 'ClO₂', nameRu: 'диоксид хлора', state: 'г', dHfKJ: 102.5 },
  'NO(g)': { formula: 'NO', nameRu: 'оксид азота(II)', state: 'г', dHfKJ: 91.3 },
  'NO2(g)': { formula: 'NO₂', nameRu: 'оксид азота(IV)', state: 'г', dHfKJ: 33.2 },
  'H2S(g)': { formula: 'H₂S', nameRu: 'сероводород', state: 'г', dHfKJ: -20.6 },
  'CuO(s)': { formula: 'CuO', nameRu: 'оксид меди(II)', state: 'тв', dHfKJ: -157.3 },
  'Fe2O3(s)': { formula: 'Fe₂O₃', nameRu: 'оксид железа(III)', state: 'тв', dHfKJ: -824.2 },
  'Al2O3(s)': { formula: 'Al₂O₃', nameRu: 'оксид алюминия (корунд)', state: 'тв', dHfKJ: -1675.7 },
  'ZnO(s)': { formula: 'ZnO', nameRu: 'оксид цинка', state: 'тв', dHfKJ: -350.5 },
  'CaCl2(s)': { formula: 'CaCl₂', nameRu: 'хлорид кальция', state: 'тв', dHfKJ: -795.4 },
  'KCl(s)': { formula: 'KCl', nameRu: 'хлорид калия', state: 'тв', dHfKJ: -436.5 },
  'CsCl(s)': { formula: 'CsCl', nameRu: 'хлорид цезия', state: 'тв', dHfKJ: -443.0 },
  'Ca(OH)2(s)': { formula: 'Ca(OH)₂', nameRu: 'гидроксид кальция (гашёная известь)', state: 'тв', dHfKJ: -985.2 },

  // ——— первые одиннадцать веществ каталога и их реагенты (CRC 97th, 298.15 K) ———
  'SiO2(s)': { formula: 'SiO₂', nameRu: 'оксид кремния(IV), α-кварц', state: 'тв', dHfKJ: -910.7, note: 'аморфный SiO₂ −903.5' },
  'PbO(litharge)': { formula: 'PbO', nameRu: 'оксид свинца(II), глёт (красный)', state: 'тв', dHfKJ: -219.0 },
  'PbO(massicot)': {
    formula: 'PbO',
    nameRu: 'оксид свинца(II), массикот (жёлтый)',
    state: 'тв',
    dHfKJ: -217.3,
    note: 'на 1.7 кДж/моль выше глёта — при 25 °C метастабилен',
  },
  'H2O2(l)': { formula: 'H₂O₂', nameRu: 'пероксид водорода (жидкость)', state: 'ж', dHfKJ: -187.8 },
  'H2O2(g)': { formula: 'H₂O₂', nameRu: 'пероксид водорода (пар)', state: 'г', dHfKJ: -136.3 },
  'Na2O2(s)': { formula: 'Na₂O₂', nameRu: 'пероксид натрия', state: 'тв', dHfKJ: -510.9 },
  'Na2SO4(s)': { formula: 'Na₂SO₄', nameRu: 'сульфат натрия', state: 'тв', dHfKJ: -1387.1 },
  'H2SO4(l)': { formula: 'H₂SO₄', nameRu: 'серная кислота (безводная)', state: 'ж', dHfKJ: -814.0 },
  'BaO2(s)': { formula: 'BaO₂', nameRu: 'пероксид бария', state: 'тв', dHfKJ: -634.3 },
  'BaSO4(s)': { formula: 'BaSO₄', nameRu: 'сульфат бария', state: 'тв', dHfKJ: -1473.2 },
  'KMnO4(s)': { formula: 'KMnO₄', nameRu: 'перманганат калия', state: 'тв', dHfKJ: -837.2 },
  'K2SO4(s)': { formula: 'K₂SO₄', nameRu: 'сульфат калия', state: 'тв', dHfKJ: -1437.8 },
  'KHSO4(s)': { formula: 'KHSO₄', nameRu: 'гидросульфат калия', state: 'тв', dHfKJ: -1160.6 },
  'HClO4(l)': { formula: 'HClO₄', nameRu: 'хлорная кислота (безводная)', state: 'ж', dHfKJ: -40.6 },
  'P4O10(s)': { formula: 'P₄O₁₀', nameRu: 'оксид фосфора(V)', state: 'тв', dHfKJ: -2984.0 },
  'Mn2O7(l)': {
    formula: 'Mn₂O₇',
    nameRu: 'оксид марганца(VII)',
    state: 'ж',
    dHfKJ: -743,
    estimated: true,
    source: 'вторичный: Лидин Р. А. и др., «Константы неорганических веществ» (М.: Дрофа); в CRC 97th и NIST-JANAF вещества нет',
    note: 'оценка: сходимость лестниц с первичными таблицами для Mn₂O₇ не заявляется',
  },
  'Cl2O7(l)': {
    formula: 'Cl₂O₇',
    nameRu: 'оксид хлора(VII) (жидкость)',
    state: 'ж',
    dHfKJ: 238.1,
    note: 'ЭНДОТЕРМИЧЕСКОЕ соединение: распад на Cl₂ и O₂ выделяет энергию — отсюда детонация от удара',
  },
  'Cl2O7(g)': { formula: 'Cl₂O₇', nameRu: 'оксид хлора(VII) (пар)', state: 'г', dHfKJ: 272.0 },

  // ——— этап 11: продукты распада, катализатор, оговорки (CRC 97th, 298.15 K) ———
  // продукт распада Mn₂O₇ (2 Mn₂O₇ → 4 MnO₂ + 3 O₂) и катализатор разложения H₂O₂
  'MnO2(s)': { formula: 'MnO₂', nameRu: 'оксид марганца(IV) (пиролюзит)', state: 'тв', dHfKJ: -520.0 },
  // оговорка к PbO: в учебнике оксид свинца получают разложением нитрата
  'Pb(NO3)2(s)': { formula: 'Pb(NO₃)₂', nameRu: 'нитрат свинца(II)', state: 'тв', dHfKJ: -451.9 },
  'V(s)': { formula: 'V', nameRu: 'ванадий', state: 'тв', dHfKJ: 0 },
  // катализатор контактного способа
  'V2O5(s)': { formula: 'V₂O₅', nameRu: 'оксид ванадия(V)', state: 'тв', dHfKJ: -1550.6 },
  // «V₂O₄» школьной схемы катализа = 2 VO₂
  'VO2(s)': {
    formula: 'VO₂',
    nameRu: 'оксид ванадия(IV)',
    state: 'тв',
    dHfKJ: -713.4,
    note: 'школьная запись V₂O₄ — это удвоенная формула VO₂: ΔH°f(V₂O₄) = 2·(−713.4) = −1426.8 кДж/моль',
  },
}

/** ΔH°f по ключу таблицы; бросает, если вещества нет — молчаливый 0 скрыл бы ошибку. */
export function dHfKJ(key: string): number {
  const datum = FORMATION_ENTHALPY[key]
  if (!datum) throw new Error(`thermoData: нет ΔH°f для «${key}»`)
  return datum.dHfKJ
}

// ─────────────────────────────────────────────────────────────────────────────
// Стандартные энтропии S°(298 K), Дж/(моль·К)  — CRC Handbook, 97th ed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Нужны там, где знака ΔH мало: эндотермическая реакция идёт только за счёт
 * роста энтропии. Обжиг известняка CaCO₃ → CaO + CO₂ выделяет ГАЗ, поэтому
 * ΔS° = 38.1 + 213.8 − 91.7 = +160.2 Дж/(моль·К), и ΔG = ΔH − TΔS обращается
 * в ноль около 1119 K — отсюда и печь на 900…1000 °C.
 */
export const STANDARD_ENTROPY_J: Readonly<Record<string, number>> = {
  'CaCO3(s)': 91.7,
  'CaO(s)': 38.1,
  'CO2(g)': 213.8,
  'Ca(OH)2(s)': 83.4,
  'H2O(l)': 69.9,
  'H2O(g)': 188.8,
}

/** S°(298 K), Дж/(моль·К); бросает, если вещества нет. */
export function sJ(key: string): number {
  const s = STANDARD_ENTROPY_J[key]
  if (s == null) throw new Error(`thermoData: нет S° для «${key}»`)
  return s
}

// ─────────────────────────────────────────────────────────────────────────────
// Энергии решёток, кДж/моль (< 0: газообразные ионы → кристалл)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Значения цикла Борна — Габера. В литературе их часто печатают как положительные
 * «энтальпии решётки» (энергия разрушения кристалла) — здесь знак ФИЗИЧЕСКИЙ: сборка
 * решётки экзотермична, поэтому U < 0.
 */
export const LATTICE_ENTHALPY_KJ: Readonly<Record<string, number>> = {
  'NaCl(s)': -787,
  'NaF(s)': -923,
  'KCl(s)': -711,
  'CsCl(s)': -657,
  'MgO(s)': -3789,
  'CaO(s)': -3400,
  'CaCl2(s)': -2258,
  'ZnS(s)': -3610,
  // выведено из цикла BORN_HABER.al2o3 при EA₂(O) = +744 (разброс 15 100–15 900 по EA₂ и методу)
  'Al2O3(s)': -15170.3,
  // ФОРМАЛЬНАЯ величина из цикла BORN_HABER.pbo: PbO существенно ковалентен, см. LATTICE_ENTHALPY_INFO
  'PbO(litharge)': -3432.5,
}

/** Происхождение энергий решёток, которые не взяты из таблицы, а выведены из цикла. */
export const LATTICE_ENTHALPY_INFO: Readonly<Record<string, { readonly derived: boolean; readonly estimated?: boolean; readonly note: string }>> = {
  'Al2O3(s)': {
    derived: true,
    note:
      'U = ΔH°f − Σ(прочих ступеней) = −1675.7 − 13 494.6 = −15 170.3 кДж/моль при EA₂(O) = +744; ' +
      'с EA₂ до +844 и по другим методам в литературе 15 100–15 900.',
  },
  'PbO(litharge)': {
    derived: true,
    estimated: true,
    note:
      'формальная ионная модель Pb²⁺O²⁻: у глёта связь в значительной мере ковалентна (пирамида PbO₄, пара 6s²), ' +
      'поэтому «энергия решётки» из цикла — расчётная величина, а не измеряемая.',
  },
}

/**
 * Вторая энергия сродства к электрону кислорода: O⁻(г) + e⁻ → O²⁻(г).
 * Процесс ЭНДОТЕРМИЧЕСКИЙ (электрон загоняют в уже отрицательный ион), знак «+».
 * Значение 744 кДж/моль согласовано с энтальпиями решёток MgO (3789) и CaO (3400):
 * в литературе встречается разброс 744…844, и вместе с ним «плавает» энергия решётки.
 */
export const OXIDE_SECOND_EA_KJ = 744

// ─────────────────────────────────────────────────────────────────────────────
// Циклы Борна — Габера
// ─────────────────────────────────────────────────────────────────────────────

export type BornHaberKind =
  | 'sublimation'
  | 'dissociation'
  | 'ionization'
  | 'affinity'
  | 'lattice'
  /** ион из газа уходит в воду (ΔH < 0) или вырывается из воды в газ (ΔH > 0) */
  | 'hydration'
  /** образование ковалентной связи из атомов (ΔH < 0) */
  | 'bond'

export type BornHaberStage = {
  readonly id: string
  readonly kind: BornHaberKind
  /** Уравнение ступени — рисуется на лесенке энергии (на формульную единицу, с множителем). */
  readonly equation: string
  /** ΔH ступени, кДж на 1 моль продукта. Знак физический. dHKJ = multiplier·perUnitKJ. */
  readonly dHKJ: number
  /** Сколько частиц проходит ступень на формульную единицу (2 Al, 3 O для Al₂O₃); нет — 1. */
  readonly multiplier?: number
  /** ΔH на одну частицу, кДж/моль (IE, EA, ΔH°f атома…) — ровно число из atomicData/thermoData. */
  readonly perUnitKJ?: number
  /**
   * Откуда взят perUnitKJ — чтобы тест сверил с ядром: термы через '+', каждый 'dHf:<ключ>',
   * 'ie1:<El>'…'ie3:<El>', 'ea1:<El>', 'ea2:O', 'hyd:<ион>'; '-' перед термом — со знаком минус.
   * Нет у ступени решётки, выведенной из цикла.
   */
  readonly perUnitFrom?: string
}

export type BornHaberCycle = {
  readonly id: string
  readonly formula: string
  /** Итоговое уравнение образования 1 моля продукта. */
  readonly equation: string
  readonly stages: readonly BornHaberStage[]
  /** Табличная ΔH°f продукта, кДж/моль — с ней сверяется сумма. */
  readonly dHfTableKJ: number
  /** Ключ FORMATION_ENTHALPY продукта (сверка dHfTableKJ с таблицей). */
  readonly productKey?: string
  /** Ключ LATTICE_ENTHALPY_KJ, если ступень решётки есть. */
  readonly latticeKey?: string
  /** Цикл формальный (ковалентный вклад велик) — сказать об этом в уроке. */
  readonly formal?: boolean
  readonly note?: string
}

export const BORN_HABER: Readonly<Record<string, BornHaberCycle>> = {
  nacl: {
    id: 'nacl',
    formula: 'NaCl',
    equation: 'Na (тв) + ½ Cl₂ (г) → NaCl (тв)',
    dHfTableKJ: -411.2,
    productKey: 'NaCl(s)',
    latticeKey: 'NaCl(s)',
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Na (тв) → Na (г)', dHKJ: 107.3, perUnitKJ: 107.3, perUnitFrom: 'dHf:Na(g)' },
      // 121.3 = ΔH°f(Cl, г) из FORMATION_ENTHALPY (NIST-JANAF, 298 K). Ровно то же число, что ½D(Cl₂)
      // при 298 K; 121.7 — это ½·243.4 из таблицы энергий связей (значение при 0 K), из-за него цикл
      // не сходился на 0.4 кДж. Держим ступень равной табличной ΔH°f — тогда Σ = −411.2 точно.
      { id: 'dissociation', kind: 'dissociation', equation: '½ Cl₂ (г) → Cl (г)', dHKJ: 121.3, perUnitKJ: 121.3, perUnitFrom: 'dHf:Cl(g)' },
      { id: 'ionization', kind: 'ionization', equation: 'Na (г) → Na⁺ (г) + e⁻', dHKJ: 495.8, perUnitKJ: 495.8, perUnitFrom: 'ie1:Na' },
      { id: 'affinity', kind: 'affinity', equation: 'Cl (г) + e⁻ → Cl⁻ (г)', dHKJ: -348.6, perUnitKJ: -348.6, perUnitFrom: 'ea1:Cl' },
      { id: 'lattice', kind: 'lattice', equation: 'Na⁺ (г) + Cl⁻ (г) → NaCl (тв)', dHKJ: -787.0 },
    ],
  },
  mgo: {
    id: 'mgo',
    formula: 'MgO',
    equation: 'Mg (тв) + ½ O₂ (г) → MgO (тв)',
    dHfTableKJ: -601.6,
    productKey: 'MgO(s)',
    latticeKey: 'MgO(s)',
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Mg (тв) → Mg (г)', dHKJ: 147.1, perUnitKJ: 147.1, perUnitFrom: 'dHf:Mg(g)' },
      { id: 'dissociation', kind: 'dissociation', equation: '½ O₂ (г) → O (г)', dHKJ: 249.2, perUnitKJ: 249.2, perUnitFrom: 'dHf:O(g)' },
      { id: 'ionization1', kind: 'ionization', equation: 'Mg (г) → Mg⁺ (г) + e⁻', dHKJ: 737.7, perUnitKJ: 737.7, perUnitFrom: 'ie1:Mg' },
      { id: 'ionization2', kind: 'ionization', equation: 'Mg⁺ (г) → Mg²⁺ (г) + e⁻', dHKJ: 1450.7, perUnitKJ: 1450.7, perUnitFrom: 'ie2:Mg' },
      { id: 'affinity1', kind: 'affinity', equation: 'O (г) + e⁻ → O⁻ (г)', dHKJ: -141.0, perUnitKJ: -141.0, perUnitFrom: 'ea1:O' },
      { id: 'affinity2', kind: 'affinity', equation: 'O⁻ (г) + e⁻ → O²⁻ (г)', dHKJ: OXIDE_SECOND_EA_KJ, perUnitKJ: OXIDE_SECOND_EA_KJ, perUnitFrom: 'ea2:O' },
      { id: 'lattice', kind: 'lattice', equation: 'Mg²⁺ (г) + O²⁻ (г) → MgO (тв)', dHKJ: -3789.0 },
    ],
  },
  cao: {
    id: 'cao',
    formula: 'CaO',
    equation: 'Ca (тв) + ½ O₂ (г) → CaO (тв)',
    dHfTableKJ: -634.9,
    productKey: 'CaO(s)',
    latticeKey: 'CaO(s)',
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Ca (тв) → Ca (г)', dHKJ: 177.8, perUnitKJ: 177.8, perUnitFrom: 'dHf:Ca(g)' },
      { id: 'dissociation', kind: 'dissociation', equation: '½ O₂ (г) → O (г)', dHKJ: 249.2, perUnitKJ: 249.2, perUnitFrom: 'dHf:O(g)' },
      { id: 'ionization1', kind: 'ionization', equation: 'Ca (г) → Ca⁺ (г) + e⁻', dHKJ: 589.8, perUnitKJ: 589.8, perUnitFrom: 'ie1:Ca' },
      { id: 'ionization2', kind: 'ionization', equation: 'Ca⁺ (г) → Ca²⁺ (г) + e⁻', dHKJ: 1145.4, perUnitKJ: 1145.4, perUnitFrom: 'ie2:Ca' },
      { id: 'affinity1', kind: 'affinity', equation: 'O (г) + e⁻ → O⁻ (г)', dHKJ: -141.0, perUnitKJ: -141.0, perUnitFrom: 'ea1:O' },
      { id: 'affinity2', kind: 'affinity', equation: 'O⁻ (г) + e⁻ → O²⁻ (г)', dHKJ: OXIDE_SECOND_EA_KJ, perUnitKJ: OXIDE_SECOND_EA_KJ, perUnitFrom: 'ea2:O' },
      { id: 'lattice', kind: 'lattice', equation: 'Ca²⁺ (г) + O²⁻ (г) → CaO (тв)', dHKJ: -3400.0 },
    ],
  },

  /**
   * 2 Al (тв) + 1½ O₂ (г) → Al₂O₃ (тв, корунд). Все ступени — на ОДНУ формульную единицу, с множителями:
   *   2·ΔH_субл(Al)            2 · 330.0                    =    660.0
   *   2·(IE₁+IE₂+IE₃)(Al)      2 · (577.5 + 1816.7 + 2744.8) = 10 278.0  (третий электрон дороже всех)
   *   3·ΔH°f(O, г)             3 · 249.2                    =    747.6
   *   3·EA₁(O)                 3 · (−141.0)                 =   −423.0
   *   3·EA₂(O)                 3 · (+744)                   =   2232.0
   *   ───────────────────────────────────────────── Σ = 13 494.6
   *   U = −1675.7 − 13 494.6 = −15 170.3 кДж/моль — ВЫВЕДЕНА из цикла (сходимость здесь тождественна;
   *   проверяется то, что U согласована с EA₂ = +744 и с порядком U(Al₂O₃) ≫ U(MgO)).
   */
  al2o3: {
    id: 'al2o3',
    formula: 'Al₂O₃',
    equation: '2 Al (тв) + 1½ O₂ (г) → Al₂O₃ (тв)',
    dHfTableKJ: -1675.7,
    productKey: 'Al2O3(s)',
    latticeKey: 'Al2O3(s)',
    note: 'энергия решётки выведена из цикла при EA₂(O) = +744; разброс в литературе 15 100–15 900 кДж/моль',
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: '2 Al (тв) → 2 Al (г)', dHKJ: 660.0, multiplier: 2, perUnitKJ: 330.0, perUnitFrom: 'dHf:Al(g)' },
      {
        id: 'ionization',
        kind: 'ionization',
        equation: '2 Al (г) → 2 Al³⁺ (г) + 6 e⁻',
        dHKJ: 10278.0,
        multiplier: 2,
        perUnitKJ: 5139.0,
        perUnitFrom: 'ie1:Al+ie2:Al+ie3:Al',
      },
      { id: 'dissociation', kind: 'dissociation', equation: '1½ O₂ (г) → 3 O (г)', dHKJ: 747.6, multiplier: 3, perUnitKJ: 249.2, perUnitFrom: 'dHf:O(g)' },
      { id: 'affinity1', kind: 'affinity', equation: '3 O (г) + 3 e⁻ → 3 O⁻ (г)', dHKJ: -423.0, multiplier: 3, perUnitKJ: -141.0, perUnitFrom: 'ea1:O' },
      {
        id: 'affinity2',
        kind: 'affinity',
        equation: '3 O⁻ (г) + 3 e⁻ → 3 O²⁻ (г)',
        dHKJ: 3 * OXIDE_SECOND_EA_KJ,
        multiplier: 3,
        perUnitKJ: OXIDE_SECOND_EA_KJ,
        perUnitFrom: 'ea2:O',
      },
      { id: 'lattice', kind: 'lattice', equation: '2 Al³⁺ (г) + 3 O²⁻ (г) → Al₂O₃ (тв)', dHKJ: -15170.3 },
    ],
  },

  /**
   * Pb (тв) + ½ O₂ (г) → PbO (глёт). ФОРМАЛЬНЫЙ ионный цикл: PbO существенно ковалентен, поэтому U
   * здесь — расчётная величина (LATTICE_ENTHALPY_INFO), а не измеряемая. Σ прочих ступеней
   * 195.2 + 249.2 + 715.6 + 1450.5 − 141.0 + 744 = 3213.5 → U = −219.0 − 3213.5 = −3432.5.
   */
  pbo: {
    id: 'pbo',
    formula: 'PbO',
    equation: 'Pb (тв) + ½ O₂ (г) → PbO (тв, глёт)',
    dHfTableKJ: -219.0,
    productKey: 'PbO(litharge)',
    latticeKey: 'PbO(litharge)',
    formal: true,
    note: 'ионная модель Pb²⁺O²⁻ формальна: связь в глёте в значительной мере ковалентна (Walsh et al. 2011)',
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Pb (тв) → Pb (г)', dHKJ: 195.2, perUnitKJ: 195.2, perUnitFrom: 'dHf:Pb(g)' },
      { id: 'dissociation', kind: 'dissociation', equation: '½ O₂ (г) → O (г)', dHKJ: 249.2, perUnitKJ: 249.2, perUnitFrom: 'dHf:O(g)' },
      { id: 'ionization1', kind: 'ionization', equation: 'Pb (г) → Pb⁺ (г) + e⁻', dHKJ: 715.6, perUnitKJ: 715.6, perUnitFrom: 'ie1:Pb' },
      { id: 'ionization2', kind: 'ionization', equation: 'Pb⁺ (г) → Pb²⁺ (г) + e⁻', dHKJ: 1450.5, perUnitKJ: 1450.5, perUnitFrom: 'ie2:Pb' },
      { id: 'affinity1', kind: 'affinity', equation: 'O (г) + e⁻ → O⁻ (г)', dHKJ: -141.0, perUnitKJ: -141.0, perUnitFrom: 'ea1:O' },
      { id: 'affinity2', kind: 'affinity', equation: 'O⁻ (г) + e⁻ → O²⁻ (г)', dHKJ: OXIDE_SECOND_EA_KJ, perUnitKJ: OXIDE_SECOND_EA_KJ, perUnitFrom: 'ea2:O' },
      { id: 'lattice', kind: 'lattice', equation: 'Pb²⁺ (г) + O²⁻ (г) → PbO (тв)', dHKJ: -3432.5 },
    ],
  },

  /**
   * C (графит) + O₂ (г) → CO₂ (г) — горение угля. НЕ цикл Борна — Габера
   * (решётки у продукта нет, связи ковалентные), а цикл Гесса того же вида:
   * реакцию разложили на атомизацию исходных веществ и образование связей.
   *
   * ВАЖНО, И ЭТО СКАЗАНО В ТЕКСТЕ УРОКА: это путь РАСЧЁТА, а не механизм.
   * Уголь горит на поверхности твёрдой фазы, свободные атомы C (г) и O (г)
   * в пламени промежуточными частицами не являются. Закон Гесса разрешает
   * считать по любому пути — ответ от пути не зависит.
   *
   * Ступени (кДж на 1 моль CO₂, 298 K):
   *   C (графит) → C (г)            +716.7   = ΔH°f(C, г), NIST-JANAF (энтальпия атомизации графита)
   *   O₂ (г) → 2 O (г)              +498.4   = 2 · ΔH°f(O, г) = 2 · 249.2 (D₀(O=O))
   *   C (г) + 2 O (г) → CO₂ (г)    −1608.6   = ΔH°f(CO₂) − ΔH°f(C, г) − 2 · ΔH°f(O, г)
   *   ────────────────────────────────────
   *   Σ = −393.5 = ΔH°f(CO₂, г) — сходится точно, ступени выведены по Гессу.
   *
   * Отсюда ЭНЕРГИЯ ОДНОЙ связи C=O в самой CO₂: 1608.6 / 2 = 804.3 кДж/моль.
   * Табличная средняя энергия связи C=O(CO2) = 799 кДж/моль (bondData) даёт
   * оценку −383 кДж/моль: средние энергии связей усреднены по многим
   * соединениям и дают ошибку порядка 10 кДж — это и есть школьный вывод.
   */
  co2: {
    id: 'co2',
    formula: 'CO₂ (г)',
    equation: 'C (графит) + O₂ (г) → CO₂ (г)',
    dHfTableKJ: -393.5,
    productKey: 'CO2(g)',
    stages: [
      { id: 'atomization', kind: 'sublimation', equation: 'C (графит) → C (г)', dHKJ: 716.7, perUnitKJ: 716.7, perUnitFrom: 'dHf:C(g)' },
      { id: 'dissociation', kind: 'dissociation', equation: 'O₂ (г) → 2 O (г)', dHKJ: 498.4, multiplier: 2, perUnitKJ: 249.2, perUnitFrom: 'dHf:O(g)' },
      { id: 'bonds', kind: 'bond', equation: 'C (г) + 2 O (г) → CO₂ (г)', dHKJ: -1608.6 },
    ],
  },

  /**
   * Zn (тв) + 2 H⁺ (водн) → Zn²⁺ (водн) + H₂ (г) — получение водорода в аппарате Киппа.
   *
   * Это НЕ цикл Борна — Габера (решётки продукта нет), а цикл Гесса того же вида:
   * реакцию в растворе разложили на газофазные стадии. Сумма по закону Гесса
   * обязана дать ΔH°f(Zn²⁺, водн) = −153.9 кДж/моль, потому что ΔH°f остальных
   * участников (Zn тв, H⁺ водн, H₂ г) равны нулю по определению.
   *
   * Электронный баланс сходится внутри цикла: цинк отдаёт ровно 2 e⁻
   * (ступени ionization1 + ionization2), и ровно 2 e⁻ принимают два протона
   * (ступень neutralization). Заряд тоже сходится: слева 2(+1), справа (+2).
   *
   * Энтальпии гидратации — по шкале, где ΔH_гидр(H⁺) = −1091 кДж/моль
   * (Smith, J. Chem. Educ. 1977). Абсолютные значения зависят от выбора этой
   * опорной точки, но в электронейтральном уравнении она сокращается.
   */
  zncl2_aq: {
    id: 'zncl2_aq',
    formula: 'Zn²⁺ (водн)',
    equation: 'Zn (тв) + 2 H⁺ (водн) → Zn²⁺ (водн) + H₂ (г)',
    dHfTableKJ: -153.9,
    productKey: 'Zn2+(aq)',
    stages: [
      { id: 'sublimation', kind: 'sublimation', equation: 'Zn (тв) → Zn (г)', dHKJ: 130.4, perUnitKJ: 130.4, perUnitFrom: 'dHf:Zn(g)' },
      { id: 'ionization1', kind: 'ionization', equation: 'Zn (г) → Zn⁺ (г) + e⁻', dHKJ: 906.4, perUnitKJ: 906.4, perUnitFrom: 'ie1:Zn' },
      { id: 'ionization2', kind: 'ionization', equation: 'Zn⁺ (г) → Zn²⁺ (г) + e⁻', dHKJ: 1733.3, perUnitKJ: 1733.3, perUnitFrom: 'ie2:Zn' },
      { id: 'hydration', kind: 'hydration', equation: 'Zn²⁺ (г) → Zn²⁺ (водн)', dHKJ: -2046.0, perUnitKJ: -2046.0, perUnitFrom: 'hyd:Zn2+' },
      { id: 'dehydration', kind: 'hydration', equation: '2 H⁺ (водн) → 2 H⁺ (г)', dHKJ: 2182.0, multiplier: 2, perUnitKJ: 1091, perUnitFrom: '-hyd:H+' },
      { id: 'neutralization', kind: 'ionization', equation: '2 H⁺ (г) + 2e⁻ → 2 H (г)', dHKJ: -2624.0, multiplier: 2, perUnitKJ: -1312.0, perUnitFrom: '-ie1:H' },
      // −2·ΔH°f(H, г) = −436.0 (NIST-JANAF); bondData H–H 435.8 — CRC, разница 0.2 между компиляциями
      { id: 'recombination', kind: 'bond', equation: '2 H (г) → H₂ (г)', dHKJ: -436.0, multiplier: 2, perUnitKJ: -218.0, perUnitFrom: '-dHf:H(g)' },
    ],
  },
}

/**
 * Энтальпии гидратации отдельных ионов, кДж/моль (298 K, бесконечное разбавление).
 *
 * ШКАЛА ОТНОСИТЕЛЬНАЯ: принято ΔH_гидр(H⁺) = −1091 кДж/моль (Smith, J. Chem. Educ. 54 (1977) 540).
 * Другие компиляции берут −1103 или −1150 и тогда СДВИГАЮТ все остальные ионы на ту же
 * величину — сравнивать значения из разных источников напрямую нельзя. В любом
 * электронейтральном уравнении выбор опорной точки сокращается.
 */
export const HYDRATION_ENTHALPY_KJ: Readonly<Record<string, number>> = {
  'H+': -1091,
  'Zn2+': -2046,
  'Na+': -406,
  'Cl-': -364,
}

// ─────────────────────────────────────────────────────────────────────────────
// Стандартные электродные потенциалы (водный раствор, 298 K, шкала СВЭ)
// ─────────────────────────────────────────────────────────────────────────────

export type RedoxCouple = {
  readonly id: string
  /** Полуреакция ВОССТАНОВЛЕНИЯ, как её пишут в таблице. */
  readonly half: string
  /** E°, вольты, относительно стандартного водородного электрода. */
  readonly e0V: number
  /** Число электронов в полуреакции. */
  readonly n: number
  readonly note?: string
}

export const STANDARD_POTENTIALS_V: Readonly<Record<string, RedoxCouple>> = {
  'Zn2+/Zn': { id: 'Zn2+/Zn', half: 'Zn²⁺ (водн) + 2e⁻ ⇌ Zn (тв)', e0V: -0.7618, n: 2 },
  'H+/H2': { id: 'H+/H2', half: '2 H⁺ (водн) + 2e⁻ ⇌ H₂ (г)', e0V: 0, n: 2, note: 'ноль шкалы ПО ОПРЕДЕЛЕНИЮ (стандартный водородный электрод)' },
  'Cu2+/Cu': { id: 'Cu2+/Cu', half: 'Cu²⁺ (водн) + 2e⁻ ⇌ Cu (тв)', e0V: 0.3419, n: 2 },
  'Fe2+/Fe': { id: 'Fe2+/Fe', half: 'Fe²⁺ (водн) + 2e⁻ ⇌ Fe (тв)', e0V: -0.447, n: 2 },
  'Mg2+/Mg': { id: 'Mg2+/Mg', half: 'Mg²⁺ (водн) + 2e⁻ ⇌ Mg (тв)', e0V: -2.372, n: 2 },
}

export function standardPotentialV(id: string): number {
  const c = STANDARD_POTENTIALS_V[id]
  if (!c) throw new Error(`thermoData: нет пары «${id}» в таблице стандартных потенциалов`)
  return c.e0V
}

/**
 * ЭДС реакции: E° = E°(окислителя) − E°(восстановителя).
 * E° > 0 — реакция идёт самопроизвольно (ΔG° = −nFE° < 0).
 */
export function cellPotentialV(oxidizer: string, reducer: string): number {
  return Math.round((standardPotentialV(oxidizer) - standardPotentialV(reducer)) * 10000) / 10000
}

/** Сумма ступеней цикла, кДж/моль — по закону Гесса равна ΔH°f. */
export function bornHaberSumKJ(cycleId: string): number {
  const cycle = BORN_HABER[cycleId]
  if (!cycle) throw new Error(`thermoData: нет цикла Борна — Габера «${cycleId}»`)
  let sum = 0
  for (const stage of cycle.stages) sum += stage.dHKJ
  return Math.round(sum * 1000) / 1000
}

/** Расхождение суммы цикла с табличной ΔH°f, кДж/моль (должно быть в пределах ±5). */
export function bornHaberResidualKJ(cycleId: string): number {
  const cycle = BORN_HABER[cycleId]!
  return Math.round((bornHaberSumKJ(cycleId) - cycle.dHfTableKJ) * 1000) / 1000
}

// ─────────────────────────────────────────────────────────────────────────────
// Тепловые эффекты молекулярных реакций — два независимых расчёта
// ─────────────────────────────────────────────────────────────────────────────

export type BondTerm = { readonly bond: BondKey; readonly n: number }
/** Коэффициент в уравнении: < 0 — реагент, > 0 — продукт. */
export type SpeciesTerm = { readonly key: string; readonly coef: number }

export type MolecularReaction = {
  readonly id: string
  readonly equation: string
  readonly nameRu: string
  /** Связи, которые рвутся (вклад > 0). */
  readonly bondsBroken: readonly BondTerm[]
  /** Связи, которые образуются (вклад < 0). */
  readonly bondsFormed: readonly BondTerm[]
  /** Те же реагенты и продукты для расчёта по ΔH°f. */
  readonly species: readonly SpeciesTerm[]
  readonly note?: string
}

export const MOLECULAR_REACTIONS: Readonly<Record<string, MolecularReaction>> = {
  water_g: {
    id: 'water_g',
    equation: 'H₂ (г) + ½ O₂ (г) → H₂O (г)',
    nameRu: 'образование воды из простых веществ',
    bondsBroken: [
      { bond: 'H-H', n: 1 },
      { bond: 'O=O', n: 0.5 },
    ],
    bondsFormed: [{ bond: 'O-H', n: 2 }],
    species: [
      { key: 'H2(g)', coef: -1 },
      { key: 'O2(g)', coef: -0.5 },
      { key: 'H2O(g)', coef: 1 },
    ],
    note: 'по связям −241, по ΔH°f −241.8 кДж/моль',
  },
  water_g_2mol: {
    id: 'water_g_2mol',
    equation: '2 H₂ (г) + O₂ (г) → 2 H₂O (г)',
    nameRu: 'горение водорода',
    bondsBroken: [
      { bond: 'H-H', n: 2 },
      { bond: 'O=O', n: 1 },
    ],
    bondsFormed: [{ bond: 'O-H', n: 4 }],
    species: [
      { key: 'H2(g)', coef: -2 },
      { key: 'O2(g)', coef: -1 },
      { key: 'H2O(g)', coef: 2 },
    ],
  },
  hcl_g: {
    id: 'hcl_g',
    equation: '½ H₂ (г) + ½ Cl₂ (г) → HCl (г)',
    nameRu: 'образование хлороводорода',
    bondsBroken: [
      { bond: 'H-H', n: 0.5 },
      { bond: 'Cl-Cl', n: 0.5 },
    ],
    bondsFormed: [{ bond: 'H-Cl', n: 1 }],
    species: [
      { key: 'H2(g)', coef: -0.5 },
      { key: 'Cl2(g)', coef: -0.5 },
      { key: 'HCl(g)', coef: 1 },
    ],
  },
  hcl_g_2mol: {
    id: 'hcl_g_2mol',
    equation: 'H₂ (г) + Cl₂ (г) → 2 HCl (г)',
    nameRu: 'цепной синтез хлороводорода',
    bondsBroken: [
      { bond: 'H-H', n: 1 },
      { bond: 'Cl-Cl', n: 1 },
    ],
    bondsFormed: [{ bond: 'H-Cl', n: 2 }],
    species: [
      { key: 'H2(g)', coef: -1 },
      { key: 'Cl2(g)', coef: -1 },
      { key: 'HCl(g)', coef: 2 },
    ],
  },
  ammonia: {
    id: 'ammonia',
    equation: '½ N₂ (г) + 1½ H₂ (г) → NH₃ (г)',
    nameRu: 'синтез аммиака (Габер — Бош)',
    bondsBroken: [
      { bond: 'N#N', n: 0.5 },
      { bond: 'H-H', n: 1.5 },
    ],
    bondsFormed: [{ bond: 'N-H', n: 3 }],
    species: [
      { key: 'N2(g)', coef: -0.5 },
      { key: 'H2(g)', coef: -1.5 },
      { key: 'NH3(g)', coef: 1 },
    ],
  },
  ammonia_2mol: {
    id: 'ammonia_2mol',
    equation: 'N₂ (г) + 3 H₂ (г) → 2 NH₃ (г)',
    nameRu: 'синтез аммиака, полное уравнение',
    bondsBroken: [
      { bond: 'N#N', n: 1 },
      { bond: 'H-H', n: 3 },
    ],
    bondsFormed: [{ bond: 'N-H', n: 6 }],
    species: [
      { key: 'N2(g)', coef: -1 },
      { key: 'H2(g)', coef: -3 },
      { key: 'NH3(g)', coef: 2 },
    ],
  },
  methane_combustion: {
    id: 'methane_combustion',
    equation: 'CH₄ (г) + 2 O₂ (г) → CO₂ (г) + 2 H₂O (г)',
    nameRu: 'горение метана',
    bondsBroken: [
      { bond: 'C-H', n: 4 },
      { bond: 'O=O', n: 2 },
    ],
    bondsFormed: [
      { bond: 'C=O(CO2)', n: 2 },
      { bond: 'O-H', n: 4 },
    ],
    species: [
      { key: 'CH4(g)', coef: -1 },
      { key: 'O2(g)', coef: -2 },
      { key: 'CO2(g)', coef: 1 },
      { key: 'H2O(g)', coef: 2 },
    ],
    note: 'по связям −802, по ΔH°f −802.5 кДж — редкое совпадение до 0.5 кДж',
  },
  so2_from_elements: {
    id: 'so2_from_elements',
    equation: '⅛ S₈ (тв.) + O₂ (г) → SO₂ (г)',
    nameRu: 'горение серы',
    // В короне S₈ у каждого атома две связи S–S, но каждая принадлежит двум атомам:
    // на один атом серы приходится ровно одна связь S–S.
    bondsBroken: [
      { bond: 'S-S', n: 1 },
      { bond: 'O=O', n: 1 },
    ],
    bondsFormed: [{ bond: 'S=O', n: 2 }],
    species: [
      { key: 'S8(s)', coef: -0.125 },
      { key: 'O2(g)', coef: -1 },
      { key: 'SO2(g)', coef: 1 },
    ],
    note:
      'по связям −280, по ΔH°f −296.8 кДж/моль. Разница 16.8 кДж складывается из ТРЁХ вкладов, и главный — ' +
      'усреднение S=O: 522 кДж/моль это СРЕДНЯЯ энергия S=O по многим соединениям, а в самой SO₂ обе связи ' +
      'прочнее (1072.4 / 2 = 536.2 кДж/моль), так как π-электронная плотность делокализована между ними — ' +
      'это даёт 2·(536.2 − 522) = +28.4 кДж. Навстречу работает S–S: табличные 266 кДж/моль занижены против ' +
      '277.2 кДж/моль в самой короне S₈ (= ΔH°f(S, г)), это −11.2 кДж. Ещё −0.4 кДж даёт округление O=O ' +
      '(498 против 498.4 = 2·ΔH°f(O, г)). Итого 28.4 − 11.2 − 0.4 = 16.8 кДж.',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Контрольные тепловые эффекты по ΔH°f (закон Гесса) — для лестниц и текстов сцен
// ─────────────────────────────────────────────────────────────────────────────

export type FormationReaction = {
  readonly id: string
  readonly equation: string
  readonly species: readonly SpeciesTerm[]
  readonly note?: string
}

export const FORMATION_REACTIONS: Readonly<Record<string, FormationReaction>> = {
  // 2·(−395.7) − 2·(−296.8) = −197.8 кДж на уравнение (Le Chatelier: экзо → нагрев мешает)
  so3_contact: {
    id: 'so3_contact',
    equation: '2 SO₂ (г) + O₂ (г) ⇌ 2 SO₃ (г)',
    species: [
      { key: 'SO2(g)', coef: -2 },
      { key: 'O2(g)', coef: -1 },
      { key: 'SO3(g)', coef: 2 },
    ],
  },
  // 2·(−285.8) − 2·(−187.8) = −196.0 кДж (вода ЖИДКАЯ); в документе −196.1 — округление старых таблиц
  h2o2_decomposition: {
    id: 'h2o2_decomposition',
    equation: '2 H₂O₂ (ж) → 2 H₂O (ж) + O₂ (г)',
    species: [
      { key: 'H2O2(l)', coef: -2 },
      { key: 'H2O(l)', coef: 2 },
      { key: 'O2(g)', coef: 1 },
    ],
    note: 'на уравнение −196.0, на моль H₂O₂ −98.0 кДж; ориентир −196.1 отличается на 0.1 из-за округления ΔH°f',
  },
  // 2·(−1675.7) = −3351.4
  al2o3_formation: {
    id: 'al2o3_formation',
    equation: '4 Al (тв) + 3 O₂ (г) → 2 Al₂O₃ (тв)',
    species: [
      { key: 'Al(s)', coef: -4 },
      { key: 'O2(g)', coef: -3 },
      { key: 'Al2O3(s)', coef: 2 },
    ],
  },
  // −1675.7 − (−824.2) = −851.5
  thermite: {
    id: 'thermite',
    equation: 'Fe₂O₃ (тв) + 2 Al (тв) → 2 Fe (тв) + Al₂O₃ (тв)',
    species: [
      { key: 'Fe2O3(s)', coef: -1 },
      { key: 'Al(s)', coef: -2 },
      { key: 'Fe(s)', coef: 2 },
      { key: 'Al2O3(s)', coef: 1 },
    ],
  },
  // 2·(−601.6) = −1203.2
  mgo_formation: {
    id: 'mgo_formation',
    equation: '2 Mg (тв) + O₂ (г) → 2 MgO (тв)',
    species: [
      { key: 'Mg(s)', coef: -2 },
      { key: 'O2(g)', coef: -1 },
      { key: 'MgO(s)', coef: 2 },
    ],
  },
  // 2·(−219.0) = −438.0
  pbo_formation: {
    id: 'pbo_formation',
    equation: '2 Pb (тв) + O₂ (г) → 2 PbO (тв, глёт)',
    species: [
      { key: 'Pb(s)', coef: -2 },
      { key: 'O2(g)', coef: -1 },
      { key: 'PbO(litharge)', coef: 2 },
    ],
  },
  sio2_formation: {
    id: 'sio2_formation',
    equation: 'Si (тв) + O₂ (г) → SiO₂ (тв, α-кварц)',
    species: [
      { key: 'Si(s)', coef: -1 },
      { key: 'O2(g)', coef: -1 },
      { key: 'SiO2(s)', coef: 1 },
    ],
  },
  // уравнение учебника (9 кл., §21), формально для чистых веществ, без теплот растворения
  h2o2_from_na2o2: {
    id: 'h2o2_from_na2o2',
    equation: 'Na₂O₂ (тв) + H₂SO₄ (ж) → Na₂SO₄ (тв) + H₂O₂ (ж)',
    species: [
      { key: 'Na2O2(s)', coef: -1 },
      { key: 'H2SO4(l)', coef: -1 },
      { key: 'Na2SO4(s)', coef: 1 },
      { key: 'H2O2(l)', coef: 1 },
    ],
    note: 'формально для чистых веществ; в опыте кислота разбавлена и охлаждена, теплоты растворения не учтены',
  },
  // уравнение учебника (9 кл., с. 154); ОЦЕНОЧНО — ΔH°f(Mn₂O₇) из вторичного источника
  mn2o7_textbook: {
    id: 'mn2o7_textbook',
    equation: '2 KMnO₄ (тв) + H₂SO₄ (ж) → Mn₂O₇ (ж) + K₂SO₄ (тв) + H₂O (ж)',
    species: [
      { key: 'KMnO4(s)', coef: -2 },
      { key: 'H2SO4(l)', coef: -1 },
      { key: 'Mn2O7(l)', coef: 1 },
      { key: 'K2SO4(s)', coef: 1 },
      { key: 'H2O(l)', coef: 1 },
    ],
    note: 'оценочно (Mn₂O₇ estimated); в концентрированной кислоте реально образуется KHSO₄, а не K₂SO₄',
  },
  // ——— этап 11: стадии, которые показывают сцены (все числа — из ΔH°f этой таблицы) ———
  // Цепная реакция H₂ + O₂ (гремучий газ). Радикалы: H·, ·OH и атом O(³P) с ДВУМЯ неспаренными электронами.
  // Инициирование (формально): разрыв H–H требует 2·218.0 = +436.0
  h2_dissociation: {
    id: 'h2_dissociation',
    equation: 'H₂ (г) → 2 H· (г)',
    species: [
      { key: 'H2(g)', coef: -1 },
      { key: 'H(g)', coef: 2 },
    ],
    note: 'формальная ступень инициирования; реально искра даёт радикалы многими путями',
  },
  // разветвление: 37.3 + 249.2 − 218.0 = +68.5 (из одного радикала — два)
  h2o_chain_branch_h: {
    id: 'h2o_chain_branch_h',
    equation: 'H· (г) + O₂ (г) → ·OH (г) + O (г)',
    species: [
      { key: 'H(g)', coef: -1 },
      { key: 'O2(g)', coef: -1 },
      { key: 'OH(g)', coef: 1 },
      { key: 'O(g)', coef: 1 },
    ],
    note: 'разветвление цепи: эндотермично (+68.5), поэтому гремучий газ без поджига устойчив',
  },
  // разветвление: 37.3 + 218.0 − 249.2 = +6.1
  h2o_chain_branch_o: {
    id: 'h2o_chain_branch_o',
    equation: 'O (г) + H₂ (г) → ·OH (г) + H· (г)',
    species: [
      { key: 'O(g)', coef: -1 },
      { key: 'H2(g)', coef: -1 },
      { key: 'OH(g)', coef: 1 },
      { key: 'H(g)', coef: 1 },
    ],
    note: 'второе разветвление: атом O(³P) — бирадикал, из него выходят два радикала',
  },
  // продолжение: −241.8 + 218.0 − 37.3 = −61.1
  h2o_chain_propagation: {
    id: 'h2o_chain_propagation',
    equation: '·OH (г) + H₂ (г) → H₂O (г) + H· (г)',
    species: [
      { key: 'OH(g)', coef: -1 },
      { key: 'H2(g)', coef: -1 },
      { key: 'H2O(g)', coef: 1 },
      { key: 'H(g)', coef: 1 },
    ],
    note: 'продолжение цепи: именно здесь рождается вода и выделяется тепло',
  },
  // итог: 2·(−241.8) = −483.6
  h2o_formation_g: {
    id: 'h2o_formation_g',
    equation: '2 H₂ (г) + O₂ (г) → 2 H₂O (г)',
    species: [
      { key: 'H2(g)', coef: -2 },
      { key: 'O2(g)', coef: -1 },
      { key: 'H2O(g)', coef: 2 },
    ],
  },
  // Горение графита. C (графит) + ½ O₂ → CO: −110.5
  co_formation: {
    id: 'co_formation',
    equation: 'C (графит) + ½ O₂ (г) → CO (г)',
    species: [
      { key: 'C(graphite)', coef: -1 },
      { key: 'O2(g)', coef: -0.5 },
      { key: 'CO(g)', coef: 1 },
    ],
    note: 'с края графитового слоя десорбируется CO — первая стадия горения угля',
  },
  // CO + ½ O₂ → CO₂: −393.5 + 110.5 = −283.0
  co_combustion: {
    id: 'co_combustion',
    equation: 'CO (г) + ½ O₂ (г) → CO₂ (г)',
    species: [
      { key: 'CO(g)', coef: -1 },
      { key: 'O2(g)', coef: -0.5 },
      { key: 'CO2(g)', coef: 1 },
    ],
  },
  // дожигание CO через гидроксил: −393.5 + 218.0 + 110.5 − 37.3 = −102.3
  co_oh_oxidation: {
    id: 'co_oh_oxidation',
    equation: 'CO (г) + ·OH (г) → CO₂ (г) + H· (г)',
    species: [
      { key: 'CO(g)', coef: -1 },
      { key: 'OH(g)', coef: -1 },
      { key: 'CO2(g)', coef: 1 },
      { key: 'H(g)', coef: 1 },
    ],
    note: 'главный путь дожигания CO в пламени: сухой CO почти не горит, нужны следы воды (радикалы ·OH)',
  },
  // C (графит) + O₂ → CO₂: −393.5
  co2_formation: {
    id: 'co2_formation',
    equation: 'C (графит) + O₂ (г) → CO₂ (г)',
    species: [
      { key: 'C(graphite)', coef: -1 },
      { key: 'O2(g)', coef: -1 },
      { key: 'CO2(g)', coef: 1 },
    ],
  },
  // Школьная схема катализа V₂O₅: V₂O₅ + SO₂ → V₂O₄ + SO₃
  // 2·(−713.4) − 395.7 + 1550.6 + 296.8 = +24.9
  so3_cat_v2o5_reduction: {
    id: 'so3_cat_v2o5_reduction',
    equation: 'V₂O₅ (тв) + SO₂ (г) → V₂O₄ (тв) + SO₃ (г)',
    species: [
      { key: 'V2O5(s)', coef: -1 },
      { key: 'SO2(g)', coef: -1 },
      { key: 'VO2(s)', coef: 2 },
      { key: 'SO3(g)', coef: 1 },
    ],
    note:
      'СХЕМА: V₂O₄ = 2 VO₂; рабочий катализатор — расплав V₂O₅/K₂S₂O₇ на кремнезёме, редокс V(V)/V(IV) идёт через ' +
      'сульфато-ванадиевые комплексы. Сумма двух стадий = ½ so3_contact (катализатор не меняет ΔH)',
  },
  // V₂O₄ + ½ O₂ → V₂O₅: −1550.6 + 1426.8 = −123.8
  so3_cat_v2o4_reoxidation: {
    id: 'so3_cat_v2o4_reoxidation',
    equation: 'V₂O₄ (тв) + ½ O₂ (г) → V₂O₅ (тв)',
    species: [
      { key: 'VO2(s)', coef: -2 },
      { key: 'O2(g)', coef: -0.5 },
      { key: 'V2O5(s)', coef: 1 },
    ],
    note: 'СХЕМА: кислород «ходит» через ванадий; см. so3_cat_v2o5_reduction',
  },
  // SO₃ + H₂O (ж) → H₂SO₄ (ж): −814.0 + 395.7 + 285.8 = −132.5 (ориентир документа −132)
  so3_hydration: {
    id: 'so3_hydration',
    equation: 'SO₃ (г) + H₂O (ж) → H₂SO₄ (ж)',
    species: [
      { key: 'SO3(g)', coef: -1 },
      { key: 'H2O(l)', coef: -1 },
      { key: 'H2SO4(l)', coef: 1 },
    ],
    note: 'бурно и с туманом — поэтому в контактном способе SO₃ поглощают 98 % H₂SO₄ (олеум), а не водой',
  },
  // ОЦЕНОЧНО: 4·(−520.0) − 2·(−743) = −594
  mn2o7_decomposition: {
    id: 'mn2o7_decomposition',
    equation: '2 Mn₂O₇ (ж) → 4 MnO₂ (тв) + 3 O₂ (г)',
    species: [
      { key: 'Mn2O7(l)', coef: -2 },
      { key: 'MnO2(s)', coef: 4 },
      { key: 'O2(g)', coef: 3 },
    ],
    note: 'оценочно (ΔH°f Mn₂O₇ из вторичного источника); медленно уже при 25 °C, со взрывом при нагреве',
  },
  // оговорка к PbO (способ учебника): 2·(−219.0) + 4·33.2 + 2·451.9 = +598.6
  pbno3_decomposition: {
    id: 'pbno3_decomposition',
    equation: '2 Pb(NO₃)₂ (тв) → 2 PbO (тв, глёт) + 4 NO₂ (г) + O₂ (г)',
    species: [
      { key: 'Pb(NO3)2(s)', coef: -2 },
      { key: 'PbO(litharge)', coef: 2 },
      { key: 'NO2(g)', coef: 4 },
      { key: 'O2(g)', coef: 1 },
    ],
    note: 'эндотермично — идёт только при прокаливании; NO₂ ядовит',
  },
  // историческая сноска (метод Тенара): −1473.2 − 187.8 + 634.3 + 814.0 = −212.7
  h2o2_from_bao2: {
    id: 'h2o2_from_bao2',
    equation: 'BaO₂ (тв) + H₂SO₄ (ж) → BaSO₄ (тв) + H₂O₂ (ж)',
    species: [
      { key: 'BaO2(s)', coef: -1 },
      { key: 'H2SO4(l)', coef: -1 },
      { key: 'BaSO4(s)', coef: 1 },
      { key: 'H2O2(l)', coef: 1 },
    ],
    note: 'метод Тенара — историческая сноска; формально для чистых веществ, без теплот растворения',
  },
  // формальная ступень Гесса (не реальный синтез): −187.8
  h2o2_from_elements: {
    id: 'h2o2_from_elements',
    equation: 'H₂ (г) + O₂ (г) → H₂O₂ (ж)',
    species: [
      { key: 'H2(g)', coef: -1 },
      { key: 'O2(g)', coef: -1 },
      { key: 'H2O2(l)', coef: 1 },
    ],
    note: 'ФОРМАЛЬНАЯ ступень закона Гесса: прямой синтез не селективен и так не проводится',
  },
  // запись учебника как формальная сводка: 238.1 − 285.8 + 2·40.6 = +33.5
  cl2o7_textbook_formal: {
    id: 'cl2o7_textbook_formal',
    equation: '2 HClO₄ (ж) → Cl₂O₇ (ж) + H₂O (ж)',
    species: [
      { key: 'HClO4(l)', coef: -2 },
      { key: 'Cl2O7(l)', coef: 1 },
      { key: 'H2O(l)', coef: 1 },
    ],
    note:
      'формальная сводка учебника: сама по себе эндотермична (+33.5) и не идёт — воду отнимает P₄O₁₀ ' +
      '(4 HClO₄ + P₄O₁₀ → 2 Cl₂O₇ + 4 HPO₃; ΔH°f (HPO₃)ₙ в ядро не внесена, поэтому числа для полного уравнения нет)',
  },
  // Cl₂O₇ эндотермичен: распад на простые вещества выделяет энергию
  cl2o7_decomposition: {
    id: 'cl2o7_decomposition',
    equation: '2 Cl₂O₇ (ж) → 2 Cl₂ (г) + 7 O₂ (г)',
    species: [
      { key: 'Cl2O7(l)', coef: -2 },
      { key: 'Cl2(g)', coef: 2 },
      { key: 'O2(g)', coef: 7 },
    ],
  },
}

/**
 * Цепочки стадий, которые показывают сцены: id записей FORMATION_REACTIONS в порядке показа.
 * Число каждой стадии — formationReactionKJ(id); своих чисел сцена не хранит.
 */
export const REACTION_STEP_CHAINS = {
  /** 2 H₂ + O₂: инициирование → два разветвления → продолжение цепи */
  h2_o2: ['h2_dissociation', 'h2o_chain_branch_h', 'h2o_chain_branch_o', 'h2o_chain_propagation'],
  /** горение графита: C → CO на краю слоя, дожигание CO через ·OH */
  c_o2: ['co_formation', 'co_oh_oxidation'],
  /** школьная схема катализа V₂O₅ в контактном способе */
  so2_v2o5: ['so3_cat_v2o5_reduction', 'so3_cat_v2o4_reoxidation'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** ΔH контрольной реакции по ΔH°f, кДж на уравнение. */
export function formationReactionKJ(id: string): number {
  const r = FORMATION_REACTIONS[id]
  if (!r) throw new Error(`thermoData: нет контрольной реакции «${id}»`)
  let sum = 0
  for (const t of r.species) sum += t.coef * dHfKJ(t.key)
  return Math.round(sum * 1000) / 1000
}

/** Есть ли среди участников оценочные ΔH°f (тогда число — оценка). */
export function formationReactionIsEstimated(id: string): boolean {
  return FORMATION_REACTIONS[id]!.species.some((t) => FORMATION_ENTHALPY[t.key]?.estimated === true)
}

/** ΔH реакции по средним энергиям связей: разорвать минус образовать, кДж. */
export function reactionEnthalpyFromBondsKJ(id: string): number {
  const r = MOLECULAR_REACTIONS[id]
  if (!r) throw new Error(`thermoData: нет реакции «${id}»`)
  let broken = 0
  for (const t of r.bondsBroken) broken += t.n * bondEnthalpyKJ(t.bond)
  let formed = 0
  for (const t of r.bondsFormed) formed += t.n * bondEnthalpyKJ(t.bond)
  return Math.round((broken - formed) * 1000) / 1000
}

/** ΔH реакции по закону Гесса: Σ ΔH°f(продукты) − Σ ΔH°f(реагенты), кДж. */
export function reactionEnthalpyFromFormationKJ(id: string): number {
  const r = MOLECULAR_REACTIONS[id]
  if (!r) throw new Error(`thermoData: нет реакции «${id}»`)
  let sum = 0
  for (const t of r.species) sum += t.coef * dHfKJ(t.key)
  return Math.round(sum * 1000) / 1000
}

/** Оба значения сразу — сцена показывает их рядом и объясняет разницу. */
export function reactionEnthalpyBothKJ(id: string): {
  fromBonds: number
  fromFormation: number
  deltaKJ: number
} {
  const fromBonds = reactionEnthalpyFromBondsKJ(id)
  const fromFormation = reactionEnthalpyFromFormationKJ(id)
  return { fromBonds, fromFormation, deltaKJ: Math.round((fromBonds - fromFormation) * 1000) / 1000 }
}

/** Экзотермична ли реакция (по надёжному расчёту через ΔH°f). */
export function isExothermic(id: string): boolean {
  return reactionEnthalpyFromFormationKJ(id) < 0
}
