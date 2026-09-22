/**
 * ATOMLAB — единственный источник атомных данных.
 *
 * ИСТОЧНИКИ (по таблице, не по значению):
 *  • Эмпирический (атомный) радиус — J. C. Slater, J. Chem. Phys. 41 (1964) 3199.
 *    Для He/Ne/Ar у Слейтера значений нет — взяты расчётные по Клементи (1963),
 *    это помечено в поле `atomicRadiusNote`.
 *  • Ковалентный радиус — B. Cordero et al., Dalton Trans. (2008) 2832 («Covalent radii revisited»).
 *    Для d-металлов с двумя спиновыми состояниями берётся низкоспиновое, ВС указано в примечании.
 *  • Металлический радиус (КЧ 12) — CRC Handbook of Chemistry and Physics, 97th ed., «Metallic radii».
 *  • Ван-дер-ваальсов радиус — A. Bondi, J. Phys. Chem. 68 (1964) 441; дополнения —
 *    S. Alvarez, Dalton Trans. 42 (2013) 8617.
 *  • Ионные радиусы — R. D. Shannon, Acta Cryst. A32 (1976) 751, «эффективные ионные радиусы»,
 *    КЧ 6, для d-ионов — высокоспиновое состояние (HS), если не указано иное.
 *    Значения, которых у Шеннона нет (H⁻, N³⁻, P³⁻), помечены в `ionicRadiiNote`.
 *  • Электроотрицательность — шкала Полинга, CRC Handbook, 97th ed.
 *  • Энергии ионизации IE1/IE2/IE3 — CRC Handbook, 97th ed., «Ionization energies of atoms».
 *  • Ионные радиусы ПО КЧ (`ionicRadiiByCnPm`) — тот же Shannon 1976, Table 1, столбец «IR»:
 *    размер иона зависит от числа соседей (Pb²⁺: КЧ 4 — 98, КЧ 6 — 119, КЧ 8 — 129 пм),
 *    поэтому сцена берёт радиус при ФАКТИЧЕСКОМ КЧ структуры (глёт — КЧ 4, корунд — Al 6 / O 4).
 *  • Атомные массы — IUPAC 2021, «Standard atomic weights» (Prohaska et al., Pure Appl. Chem. 94 (2022) 573),
 *    сокращённые (conventional) значения; по ним тесты считают рентгеновскую плотность из формулы.
 *  • Сродство к электрону — NIST/CRC. ЗНАК: экзотермический процесс отрицателен
 *    (Cl + e⁻ → Cl⁻, ΔH = −348.6 кДж/моль). Несвязанные анионы (He, Ne, Ar, Mg, Zn, Mn)
 *    записаны как 0 с примечанием, азот — +7 (процесс эндотермический).
 *  • Цвета — палитра CPK/Jmol, адаптированная под неоновый микромир ATOMLAB.
 *
 * Модуль не импортирует ни three, ни React: его читают сцены, панели и тесты в Node.
 */

export type ElementSymbol =
  | 'H'
  | 'He'
  | 'C'
  | 'N'
  | 'O'
  | 'F'
  | 'Ne'
  | 'Na'
  | 'Mg'
  | 'Al'
  | 'Si'
  | 'P'
  | 'S'
  | 'Cl'
  | 'Ar'
  | 'K'
  | 'Ca'
  | 'V'
  | 'Cr'
  | 'Mn'
  | 'Fe'
  | 'Cu'
  | 'Zn'
  | 'Br'
  | 'Ag'
  | 'I'
  | 'Cs'
  | 'Ba'
  | 'Pb'

/** Ионные радиусы: ключ — заряд иона (строка, чтобы «+2» читалось в коде), значение — пм. */
export type IonicRadiiPm = Readonly<Record<string, number>>

/**
 * Ионные радиусы по координационному числу (Shannon 1976): заряд ('+2') → КЧ ('4') → пм.
 * Запись для КЧ 6 обязана совпадать с `ionicRadiiPm` (это проверяет test-chem-data).
 */
export type IonicRadiiByCnPm = Readonly<Record<string, Readonly<Record<string, number>>>>

/** Модель радиуса для radiusForSpecies. */
export type RadiusModel = 'ionic' | 'covalent' | 'metallic'

export type AtomicDatum = {
  readonly symbol: ElementSymbol
  readonly z: number
  /** Стандартный атомный вес, а. е. м. — IUPAC 2021 (conventional). */
  readonly atomicMassU: number
  /** Русское название — для подписей сцен через t(), здесь только справочно. */
  readonly nameRu: string
  /** Эмпирический (атомный) радиус, пм — Slater 1964. */
  readonly atomicRadiusPm: number
  readonly atomicRadiusNote?: string
  /** Ковалентный радиус, пм — Cordero 2008. */
  readonly covalentRadiusPm: number
  readonly covalentRadiusNote?: string
  /** Металлический радиус, КЧ 12, пм — только для металлов. */
  readonly metallicRadiusPm?: number
  /** Ван-дер-ваальсов радиус, пм — Bondi 1964 / Alvarez 2013. */
  readonly vdwRadiusPm: number
  /** Эффективные ионные радиусы, КЧ 6, пм — Shannon 1976. */
  readonly ionicRadiiPm: IonicRadiiPm
  /** Эффективные ионные радиусы по КЧ, пм — Shannon 1976 (там, где сцене нужен не только КЧ 6). */
  readonly ionicRadiiByCnPm?: IonicRadiiByCnPm
  readonly ionicRadiiNote?: string
  /** Цвет CPK, 0xRRGGBB. */
  readonly cpk: number
  /** Электроотрицательность по Полингу; null — для благородных газов He/Ne/Ar. */
  readonly electronegativity: number | null
  /** Первая энергия ионизации, кДж/моль (> 0). */
  readonly ie1KJ: number
  /** Вторая энергия ионизации, кДж/моль (> 0); нет у H. */
  readonly ie2KJ?: number
  /** Третья энергия ионизации, кДж/моль — CRC 97th; задана там, где её требует цикл (Al₂O₃) или урок. */
  readonly ie3KJ?: number
  /** Сродство к электрону, кДж/моль. Экзотермическое — отрицательное. */
  readonly electronAffinityKJ: number
  readonly electronAffinityNote?: string
  /** Электронная конфигурация основного состояния. */
  readonly configuration: string
  /**
   * Число валентных электронов — тех, что РЕАЛЬНО могут участвовать в связи:
   *  • p-элементы — s+p внешнего слоя (заполненная d¹⁰ под ними НЕ считается: Br 7, Pb 4);
   *  • d-металлы — s+d, НО только пока d-оболочка незаполнена или раскрывается (Cr 6, Mn 7, Fe 8,
   *    Cu 11, Ag 11 — у Cu и Ag есть Cu(II)/Ag(II), т.е. d-электрон действительно уходит);
   *  • у Zn 3d¹⁰ закрыта наглухо — см. valenceElectronsNote.
   */
  readonly valenceElectrons: number
  /** Почему число не совпадает с простым подсчётом по конфигурации. */
  readonly valenceElectronsNote?: string
}

export const ATOMIC_DATA: Readonly<Record<ElementSymbol, AtomicDatum>> = {
  H: {
    symbol: 'H',
    z: 1,
    atomicMassU: 1.008,
    nameRu: 'водород',
    atomicRadiusPm: 25,
    covalentRadiusPm: 31,
    vdwRadiusPm: 120,
    ionicRadiiPm: { '-1': 146 },
    ionicRadiiNote:
      'H⁻ у Шеннона отсутствует; 146 пм — эффективный радиус гидрид-иона в ионных гидридах (LiH…CsH, 130–150 пм).',
    cpk: 0xffffff,
    electronegativity: 2.2,
    ie1KJ: 1312.0,
    electronAffinityKJ: -72.8,
    configuration: '1s¹',
    valenceElectrons: 1,
  },
  He: {
    symbol: 'He',
    z: 2,
    atomicMassU: 4.0026,
    nameRu: 'гелий',
    atomicRadiusPm: 31,
    atomicRadiusNote: 'расчётный радиус по Клементи 1963 — у Слейтера благородные газы не приведены',
    covalentRadiusPm: 28,
    vdwRadiusPm: 140,
    ionicRadiiPm: {},
    cpk: 0xd9ffff,
    electronegativity: null,
    ie1KJ: 2372.3,
    ie2KJ: 5250.5,
    electronAffinityKJ: 0,
    electronAffinityNote: 'He⁻ не существует: анион несвязан, процесс эндотермичен (оценка ≈ +48 кДж/моль)',
    configuration: '1s²',
    valenceElectrons: 2,
  },
  C: {
    symbol: 'C',
    z: 6,
    atomicMassU: 12.011,
    nameRu: 'углерод',
    atomicRadiusPm: 70,
    covalentRadiusPm: 76,
    covalentRadiusNote: 'sp³; sp² 73 пм, sp 69 пм (Cordero 2008)',
    vdwRadiusPm: 170,
    ionicRadiiPm: { '+4': 16 },
    cpk: 0x2a2a32,
    electronegativity: 2.55,
    ie1KJ: 1086.5,
    ie2KJ: 2352.6,
    electronAffinityKJ: -121.8,
    configuration: '[He] 2s² 2p²',
    valenceElectrons: 4,
  },
  N: {
    symbol: 'N',
    z: 7,
    atomicMassU: 14.007,
    nameRu: 'азот',
    atomicRadiusPm: 65,
    covalentRadiusPm: 71,
    vdwRadiusPm: 155,
    ionicRadiiPm: { '-3': 146, '+3': 16, '+5': 13 },
    ionicRadiiNote: 'N³⁻ 146 пм приведён Шенноном для КЧ 4 (нитриды); для КЧ 6 значения нет.',
    cpk: 0x3050f8,
    electronegativity: 3.04,
    ie1KJ: 1402.3,
    ie2KJ: 2856,
    electronAffinityKJ: 7,
    electronAffinityNote: 'N⁻ несвязан: присоединение электрона эндотермично (≈ +7 кДж/моль), знак положительный',
    configuration: '[He] 2s² 2p³',
    valenceElectrons: 5,
  },
  O: {
    symbol: 'O',
    z: 8,
    atomicMassU: 15.999,
    nameRu: 'кислород',
    atomicRadiusPm: 60,
    covalentRadiusPm: 66,
    vdwRadiusPm: 152,
    ionicRadiiPm: { '-2': 140 },
    // Shannon 1976: O²⁻ КЧ 2 — 135 (мостик Si–O–Si), КЧ 4 — 138 (корунд, глёт), КЧ 6 — 140 (MgO)
    ionicRadiiByCnPm: { '-2': { '2': 135, '4': 138, '6': 140 } },
    cpk: 0xff0040,
    electronegativity: 3.44,
    ie1KJ: 1313.9,
    ie2KJ: 3388.3,
    electronAffinityKJ: -141.0,
    electronAffinityNote:
      'EA₁ = −141; вторая, O⁻ + e⁻ → O²⁻, эндотермична: EA₂ = +744 кДж/моль (см. thermoData.OXIDE_SECOND_EA_KJ)',
    configuration: '[He] 2s² 2p⁴',
    valenceElectrons: 6,
  },
  F: {
    symbol: 'F',
    z: 9,
    atomicMassU: 18.998,
    nameRu: 'фтор',
    atomicRadiusPm: 50,
    covalentRadiusPm: 57,
    vdwRadiusPm: 147,
    ionicRadiiPm: { '-1': 133 },
    cpk: 0x90e050,
    electronegativity: 3.98,
    ie1KJ: 1681.0,
    ie2KJ: 3374.2,
    electronAffinityKJ: -328.0,
    configuration: '[He] 2s² 2p⁵',
    valenceElectrons: 7,
  },
  Ne: {
    symbol: 'Ne',
    z: 10,
    atomicMassU: 20.18,
    nameRu: 'неон',
    atomicRadiusPm: 38,
    atomicRadiusNote: 'расчётный радиус по Клементи 1963',
    covalentRadiusPm: 58,
    vdwRadiusPm: 154,
    ionicRadiiPm: {},
    cpk: 0xb3e3f5,
    electronegativity: null,
    ie1KJ: 2080.7,
    ie2KJ: 3952.3,
    electronAffinityKJ: 0,
    electronAffinityNote: 'Ne⁻ несвязан',
    configuration: '[He] 2s² 2p⁶',
    valenceElectrons: 8,
  },
  Na: {
    symbol: 'Na',
    z: 11,
    atomicMassU: 22.99,
    nameRu: 'натрий',
    atomicRadiusPm: 180,
    covalentRadiusPm: 166,
    metallicRadiusPm: 186,
    vdwRadiusPm: 227,
    ionicRadiiPm: { '+1': 102 },
    ionicRadiiByCnPm: { '+1': { '6': 102 } },
    cpk: 0x8a2be2,
    electronegativity: 0.93,
    ie1KJ: 495.8,
    ie2KJ: 4562.4,
    ie3KJ: 6910.3,
    electronAffinityKJ: -52.8,
    configuration: '[Ne] 3s¹',
    valenceElectrons: 1,
  },
  Mg: {
    symbol: 'Mg',
    z: 12,
    atomicMassU: 24.305,
    nameRu: 'магний',
    atomicRadiusPm: 150,
    covalentRadiusPm: 141,
    metallicRadiusPm: 160,
    vdwRadiusPm: 173,
    ionicRadiiPm: { '+2': 72 },
    // Shannon 1976: Mg²⁺ КЧ 4 — 57, КЧ 6 — 72
    ionicRadiiByCnPm: { '+2': { '4': 57, '6': 72 } },
    cpk: 0x8aff00,
    electronegativity: 1.31,
    ie1KJ: 737.7,
    ie2KJ: 1450.7,
    ie3KJ: 7732.7,
    electronAffinityKJ: 0,
    electronAffinityNote: 'Mg⁻ несвязан (оболочка 3s² заполнена), процесс эндотермичен',
    configuration: '[Ne] 3s²',
    valenceElectrons: 2,
  },
  Al: {
    symbol: 'Al',
    z: 13,
    atomicMassU: 26.982,
    nameRu: 'алюминий',
    atomicRadiusPm: 125,
    covalentRadiusPm: 121,
    metallicRadiusPm: 143,
    vdwRadiusPm: 184,
    ionicRadiiPm: { '+3': 53.5 },
    // Shannon 1976: Al³⁺ КЧ 4 — 39, КЧ 6 — 53.5 (корунд)
    ionicRadiiByCnPm: { '+3': { '4': 39, '6': 53.5 } },
    cpk: 0xbfa6a6,
    electronegativity: 1.61,
    ie1KJ: 577.5,
    ie2KJ: 1816.7,
    ie3KJ: 2744.8,
    electronAffinityKJ: -42.5,
    configuration: '[Ne] 3s² 3p¹',
    valenceElectrons: 3,
  },
  Si: {
    symbol: 'Si',
    z: 14,
    atomicMassU: 28.085,
    nameRu: 'кремний',
    atomicRadiusPm: 110,
    covalentRadiusPm: 111,
    vdwRadiusPm: 210,
    ionicRadiiPm: { '+4': 40 },
    // Shannon 1976: Si⁴⁺ КЧ 4 — 26 (кварц — формально), КЧ 6 — 40 (стишовит)
    ionicRadiiByCnPm: { '+4': { '4': 26, '6': 40 } },
    cpk: 0xf0c8a0,
    electronegativity: 1.9,
    ie1KJ: 786.5,
    ie2KJ: 1577.1,
    electronAffinityKJ: -134.1,
    configuration: '[Ne] 3s² 3p²',
    valenceElectrons: 4,
  },
  P: {
    symbol: 'P',
    z: 15,
    atomicMassU: 30.974,
    nameRu: 'фосфор',
    atomicRadiusPm: 100,
    covalentRadiusPm: 107,
    vdwRadiusPm: 180,
    ionicRadiiPm: { '-3': 212, '+3': 44, '+5': 38 },
    ionicRadiiNote: 'P³⁻ 212 пм — кристаллический радиус по Полингу, у Шеннона не приведён.',
    cpk: 0xff8000,
    electronegativity: 2.19,
    ie1KJ: 1011.8,
    ie2KJ: 1907,
    electronAffinityKJ: -72.0,
    configuration: '[Ne] 3s² 3p³',
    valenceElectrons: 5,
  },
  S: {
    symbol: 'S',
    z: 16,
    atomicMassU: 32.06,
    nameRu: 'сера',
    atomicRadiusPm: 100,
    covalentRadiusPm: 105,
    vdwRadiusPm: 180,
    ionicRadiiPm: { '-2': 184, '+4': 37, '+6': 29 },
    // Shannon 1976: S⁶⁺ КЧ 4 — 12 (SO₄²⁻), КЧ 6 — 29
    ionicRadiiByCnPm: { '+6': { '4': 12, '6': 29 } },
    cpk: 0xffff30,
    electronegativity: 2.58,
    ie1KJ: 999.6,
    ie2KJ: 2252,
    electronAffinityKJ: -200.4,
    configuration: '[Ne] 3s² 3p⁴',
    valenceElectrons: 6,
  },
  Cl: {
    symbol: 'Cl',
    z: 17,
    atomicMassU: 35.45,
    nameRu: 'хлор',
    atomicRadiusPm: 100,
    covalentRadiusPm: 102,
    vdwRadiusPm: 175,
    ionicRadiiPm: { '-1': 181, '+5': 12, '+7': 27 },
    // Shannon 1976: Cl⁷⁺ КЧ 4 — 8 (ClO₄⁻), КЧ 6 — 27
    ionicRadiiByCnPm: { '+7': { '4': 8, '6': 27 } },
    // канонический Jmol/CPK для хлора — зелёный #1FF01F; жёлто-зелёный сливался с магнием (#8AFF00)
    cpk: 0x1ff01f,
    electronegativity: 3.16,
    ie1KJ: 1251.2,
    ie2KJ: 2298,
    electronAffinityKJ: -348.6,
    configuration: '[Ne] 3s² 3p⁵',
    valenceElectrons: 7,
  },
  Ar: {
    symbol: 'Ar',
    z: 18,
    atomicMassU: 39.95,
    nameRu: 'аргон',
    atomicRadiusPm: 71,
    atomicRadiusNote: 'расчётный радиус по Клементи 1963',
    covalentRadiusPm: 106,
    vdwRadiusPm: 188,
    ionicRadiiPm: {},
    cpk: 0x80d1e3,
    electronegativity: null,
    ie1KJ: 1520.6,
    ie2KJ: 2665.8,
    electronAffinityKJ: 0,
    electronAffinityNote: 'Ar⁻ несвязан',
    configuration: '[Ne] 3s² 3p⁶',
    valenceElectrons: 8,
  },
  K: {
    symbol: 'K',
    z: 19,
    atomicMassU: 39.098,
    nameRu: 'калий',
    atomicRadiusPm: 220,
    covalentRadiusPm: 203,
    metallicRadiusPm: 227,
    vdwRadiusPm: 275,
    ionicRadiiPm: { '+1': 138 },
    cpk: 0x8f40d4,
    electronegativity: 0.82,
    ie1KJ: 418.8,
    ie2KJ: 3052,
    electronAffinityKJ: -48.4,
    configuration: '[Ar] 4s¹',
    valenceElectrons: 1,
  },
  Ca: {
    symbol: 'Ca',
    z: 20,
    atomicMassU: 40.078,
    nameRu: 'кальций',
    atomicRadiusPm: 180,
    covalentRadiusPm: 176,
    metallicRadiusPm: 197,
    vdwRadiusPm: 231,
    ionicRadiiPm: { '+2': 100 },
    cpk: 0x228b22,
    electronegativity: 1.0,
    ie1KJ: 589.8,
    ie2KJ: 1145.4,
    electronAffinityKJ: -2.4,
    configuration: '[Ar] 4s²',
    valenceElectrons: 2,
  },
  V: {
    symbol: 'V',
    z: 23,
    atomicMassU: 50.942,
    nameRu: 'ванадий',
    // Slater 1964
    atomicRadiusPm: 135,
    // Cordero 2008
    covalentRadiusPm: 153,
    // CRC 97th, «Metallic radii», КЧ 12
    metallicRadiusPm: 134,
    // у Bondi ванадия нет — Alvarez 2013 (Dalton Trans. 42, 8617)
    vdwRadiusPm: 242,
    // Shannon 1976, КЧ 6
    ionicRadiiPm: { '+2': 79, '+3': 64, '+4': 58, '+5': 54 },
    // Shannon 1976: V⁵⁺ в тетраэдре VO₄ (ванадаты, сульфато-ванадиевые комплексы катализатора) — КЧ 4, 35.5 пм
    ionicRadiiByCnPm: { '+5': { '4': 35.5, '6': 54 } },
    ionicRadiiNote:
      'V²⁺ (d³) и V³⁺ (d²) в октаэдре спиновых состояний не различают. В самом V₂O₅ ванадий имеет КЧ 5 ' +
      '(квадратная пирамида, Shannon 46 пм); в таблице — КЧ 4 и 6.',
    // Jmol: #A6A6AB
    cpk: 0xa6a6ab,
    electronegativity: 1.63,
    // CRC 97th: 6.746 / 15.48 / 29.31 эВ
    ie1KJ: 650.9,
    ie2KJ: 1414,
    ie3KJ: 2828,
    // CRC 97th, «Electron affinities»: 0.5277 эВ = 50.9 кДж/моль, процесс экзотермичен
    electronAffinityKJ: -50.9,
    configuration: '[Ar] 3d³ 4s²',
    valenceElectrons: 5,
  },
  Cr: {
    symbol: 'Cr',
    z: 24,
    atomicMassU: 51.996,
    nameRu: 'хром',
    atomicRadiusPm: 140,
    covalentRadiusPm: 139,
    metallicRadiusPm: 128,
    vdwRadiusPm: 206,
    ionicRadiiPm: { '+2': 80, '+3': 61.5, '+6': 44 },
    ionicRadiiNote:
      'Cr²⁺ — высокоспиновый (НС 73 пм). У Cr³⁺ (d³, октаэдр) спиновых состояний не два — ' +
      'три электрона и так сидят по одному на t₂g, поэтому деление на ВС/НС к нему неприменимо. Cr⁶⁺ (КЧ 6) 44 пм.',
    cpk: 0x8a99c7,
    electronegativity: 1.66,
    ie1KJ: 652.9,
    ie2KJ: 1590.6,
    electronAffinityKJ: -64.3,
    configuration: '[Ar] 3d⁵ 4s¹',
    valenceElectrons: 6,
  },
  Mn: {
    symbol: 'Mn',
    z: 25,
    atomicMassU: 54.938,
    nameRu: 'марганец',
    atomicRadiusPm: 140,
    covalentRadiusPm: 139,
    covalentRadiusNote: 'низкоспиновое состояние; высокоспиновое 161 пм (Cordero 2008)',
    metallicRadiusPm: 127,
    vdwRadiusPm: 205,
    ionicRadiiPm: { '+2': 83, '+3': 64.5, '+4': 53, '+7': 46 },
    // Shannon 1976: Mn⁷⁺ КЧ 4 — 25 (MnO₄⁻, Mn₂O₇), КЧ 6 — 46
    ionicRadiiByCnPm: { '+7': { '4': 25, '6': 46 } },
    ionicRadiiNote:
      'Mn²⁺/Mn³⁺ — высокоспиновые (НС 67 и 58 пм). Mn⁷⁺ 46 пм — КЧ 6, как и вся таблица; ' +
      'для КЧ 4 Шеннон даёт 25 пм.',
    cpk: 0x9c7ac7,
    electronegativity: 1.55,
    ie1KJ: 717.3,
    ie2KJ: 1509.0,
    electronAffinityKJ: 0,
    electronAffinityNote: 'Mn⁻ несвязан (полузаполненная оболочка 3d⁵4s²)',
    configuration: '[Ar] 3d⁵ 4s²',
    valenceElectrons: 7,
  },
  Fe: {
    symbol: 'Fe',
    z: 26,
    atomicMassU: 55.845,
    nameRu: 'железо',
    atomicRadiusPm: 140,
    covalentRadiusPm: 132,
    covalentRadiusNote: 'низкоспиновое состояние; высокоспиновое 152 пм (Cordero 2008)',
    metallicRadiusPm: 126,
    vdwRadiusPm: 204,
    ionicRadiiPm: { '+2': 78, '+3': 64.5 },
    ionicRadiiNote: 'высокоспиновые Fe²⁺/Fe³⁺; низкоспиновые 61 и 55 пм.',
    cpk: 0xe06633,
    electronegativity: 1.83,
    ie1KJ: 762.5,
    ie2KJ: 1561.9,
    electronAffinityKJ: -15.7,
    configuration: '[Ar] 3d⁶ 4s²',
    valenceElectrons: 8,
  },
  Cu: {
    symbol: 'Cu',
    z: 29,
    atomicMassU: 63.546,
    nameRu: 'медь',
    atomicRadiusPm: 135,
    covalentRadiusPm: 132,
    metallicRadiusPm: 128,
    vdwRadiusPm: 140,
    ionicRadiiPm: { '+1': 77, '+2': 73 },
    cpk: 0xc88033,
    electronegativity: 1.9,
    ie1KJ: 745.5,
    ie2KJ: 1957.9,
    electronAffinityKJ: -119.2,
    configuration: '[Ar] 3d¹⁰ 4s¹',
    valenceElectrons: 11,
    valenceElectronsNote:
      'Здесь s+d оправдано, в отличие от Zn: у меди d-оболочка раскрывается — Cu(II) (3d⁹) устойчивее Cu(I), ' +
      'а IE₂ = 1957.9 кДж/моль всего втрое больше IE₁, а не скачок на порядок, как у цинка на IE₃.',
  },
  Zn: {
    symbol: 'Zn',
    z: 30,
    atomicMassU: 65.38,
    nameRu: 'цинк',
    atomicRadiusPm: 135,
    covalentRadiusPm: 122,
    metallicRadiusPm: 134,
    vdwRadiusPm: 139,
    ionicRadiiPm: { '+2': 74 },
    // Shannon 1976: Zn²⁺ КЧ 4 — 60 (ZnS, ZnCl₂), КЧ 6 — 74
    ionicRadiiByCnPm: { '+2': { '4': 60, '6': 74 } },
    ionicRadiiNote: 'Zn²⁺ КЧ 6 — 74 пм; в тетраэдрическом окружении (ZnS, ZnCl₂) КЧ 4 — 60 пм.',
    cpk: 0x7d80b0,
    electronegativity: 1.65,
    ie1KJ: 906.4,
    ie2KJ: 1733.3,
    ie3KJ: 3833,
    electronAffinityKJ: 0,
    electronAffinityNote: 'Zn⁻ несвязан (оболочка 3d¹⁰4s² заполнена)',
    configuration: '[Ar] 3d¹⁰ 4s²',
    valenceElectrons: 2,
    valenceElectronsNote:
      'Правило «s+d» к цинку НЕ применимо: 3d¹⁰ заполнена и не раскрывается, поэтому валентные ' +
      'только два электрона 4s². Цинк всегда Zn(II): IE₃ = 3833 кДж/моль (CRC 97th ed.) — вдвое больше IE₂, ' +
      'третий электрон рвётся уже из замкнутой d¹⁰. Учебник Kimyo 7–9 даёт цинку ровно 2, как и магнию. ' +
      'Тот же счёт, что и у Br (3d¹⁰ 4s² 4p⁵ → 7) и Pb (5d¹⁰ 6s² 6p² → 4): закрытая d¹⁰ в валентные не идёт.',
  },
  Br: {
    symbol: 'Br',
    z: 35,
    atomicMassU: 79.904,
    nameRu: 'бром',
    atomicRadiusPm: 115,
    covalentRadiusPm: 120,
    vdwRadiusPm: 185,
    ionicRadiiPm: { '-1': 196, '+7': 39 },
    cpk: 0xa62929,
    electronegativity: 2.96,
    ie1KJ: 1139.9,
    ie2KJ: 2103,
    electronAffinityKJ: -324.6,
    configuration: '[Ar] 3d¹⁰ 4s² 4p⁵',
    valenceElectrons: 7,
  },
  Ag: {
    symbol: 'Ag',
    z: 47,
    atomicMassU: 107.87,
    nameRu: 'серебро',
    atomicRadiusPm: 160,
    covalentRadiusPm: 145,
    metallicRadiusPm: 144,
    vdwRadiusPm: 172,
    ionicRadiiPm: { '+1': 115, '+2': 94 },
    cpk: 0xc0c0c0,
    electronegativity: 1.93,
    ie1KJ: 731.0,
    ie2KJ: 2070,
    electronAffinityKJ: -125.6,
    configuration: '[Kr] 4d¹⁰ 5s¹',
    valenceElectrons: 11,
    valenceElectronsNote:
      'Как и у меди: 4d-оболочка раскрывается — помимо обычного Ag(I) существуют Ag(II) (AgF₂) и Ag(III) (KAgF₄), ' +
      'поэтому s+d здесь формально верно.',
  },
  I: {
    symbol: 'I',
    z: 53,
    atomicMassU: 126.9,
    nameRu: 'иод',
    atomicRadiusPm: 140,
    covalentRadiusPm: 139,
    vdwRadiusPm: 198,
    ionicRadiiPm: { '-1': 220, '+5': 95, '+7': 53 },
    cpk: 0x940094,
    electronegativity: 2.66,
    ie1KJ: 1008.4,
    ie2KJ: 1845.9,
    electronAffinityKJ: -295.2,
    configuration: '[Kr] 4d¹⁰ 5s² 5p⁵',
    valenceElectrons: 7,
  },
  // Cs нужен ядру ради CsCl (crystalData.cscl): рентгеновская плотность считается из формулы
  Cs: {
    symbol: 'Cs',
    z: 55,
    atomicMassU: 132.91,
    nameRu: 'цезий',
    // Slater 1964
    atomicRadiusPm: 260,
    // Cordero 2008
    covalentRadiusPm: 244,
    // CRC 97th, КЧ 12
    metallicRadiusPm: 265,
    // Bondi 1964
    vdwRadiusPm: 343,
    // Shannon 1976, КЧ 6; в CsCl КЧ 8 — 174 пм
    ionicRadiiPm: { '+1': 167 },
    ionicRadiiByCnPm: { '+1': { '6': 167, '8': 174 } },
    // Jmol: #57178F
    cpk: 0x57178f,
    electronegativity: 0.79,
    // CRC 97th
    ie1KJ: 375.7,
    ie2KJ: 2234.3,
    // CRC 97th: 0.4716 эВ
    electronAffinityKJ: -45.5,
    configuration: '[Xe] 6s¹',
    valenceElectrons: 1,
  },
  Ba: {
    symbol: 'Ba',
    z: 56,
    atomicMassU: 137.33,
    nameRu: 'барий',
    atomicRadiusPm: 215,
    covalentRadiusPm: 215,
    metallicRadiusPm: 222,
    vdwRadiusPm: 268,
    ionicRadiiPm: { '+2': 135 },
    cpk: 0x00c900,
    electronegativity: 0.89,
    ie1KJ: 502.9,
    ie2KJ: 965.2,
    electronAffinityKJ: -14.0,
    configuration: '[Xe] 6s²',
    valenceElectrons: 2,
  },
  Pb: {
    symbol: 'Pb',
    z: 82,
    atomicMassU: 207.2,
    nameRu: 'свинец',
    atomicRadiusPm: 180,
    covalentRadiusPm: 146,
    metallicRadiusPm: 175,
    vdwRadiusPm: 202,
    ionicRadiiPm: { '+2': 119, '+4': 77.5 },
    // Shannon 1976: Pb²⁺ КЧ 4 — 98 (глёт, квадратная пирамида PbO₄), КЧ 6 — 119, КЧ 8 — 129
    ionicRadiiByCnPm: { '+2': { '4': 98, '6': 119, '8': 129 } },
    cpk: 0x575961,
    electronegativity: 2.33,
    ie1KJ: 715.6,
    ie2KJ: 1450.5,
    electronAffinityKJ: -35.1,
    configuration: '[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²',
    valenceElectrons: 4,
  },
}

export const ELEMENT_SYMBOLS = Object.keys(ATOMIC_DATA) as readonly ElementSymbol[]

export function isElementSymbol(value: string): value is ElementSymbol {
  return Object.prototype.hasOwnProperty.call(ATOMIC_DATA, value)
}

export function getElement(symbol: ElementSymbol): AtomicDatum {
  return ATOMIC_DATA[symbol]
}

/** Нормализует заряд к ключу таблицы: 1 → '+1', −2 → '-2', 0 → '0'. */
export function chargeKey(charge: number): string {
  if (charge === 0) return '0'
  return charge > 0 ? `+${charge}` : `${charge}`
}

/**
 * Ионный радиус (Шеннон), пм; null — если такого иона (или такого КЧ) в таблице нет.
 * Без `cn` — КЧ 6, как было всегда (обратная совместимость). С `cn` — радиус при этом КЧ
 * из `ionicRadiiByCnPm` (для КЧ 6 — основная таблица). Подмены чужим КЧ НЕТ: честный null.
 */
export function ionicRadiusPm(symbol: ElementSymbol, charge: number, cn?: number): number | null {
  if (charge === 0) return null
  const datum = ATOMIC_DATA[symbol]
  const key = chargeKey(charge)
  if (cn == null || cn === 6) return datum.ionicRadiiPm[key] ?? datum.ionicRadiiByCnPm?.[key]?.['6'] ?? null
  return datum.ionicRadiiByCnPm?.[key]?.[String(cn)] ?? null
}

/** Координационные числа, для которых у иона есть радиус по Шеннону (по возрастанию). */
export function ionicRadiusCnsOf(symbol: ElementSymbol, charge: number): readonly number[] {
  const key = chargeKey(charge)
  const datum = ATOMIC_DATA[symbol]
  const set = new Set<number>(Object.keys(datum.ionicRadiiByCnPm?.[key] ?? {}).map(Number))
  if (datum.ionicRadiiPm[key] != null) set.add(6)
  return [...set].sort((x, y) => x - y)
}

/** Стандартный атомный вес (IUPAC 2021), а. е. м. */
export function atomicMassU(symbol: ElementSymbol): number {
  return ATOMIC_DATA[symbol].atomicMassU
}

/**
 * Молярная масса по составу, г/моль: { Si: 1, O: 2 } → 60.083.
 * Тесты и сцены считают массу отсюда, а не из захардкоженных таблиц.
 */
export function molarMassGMol(composition: Readonly<Partial<Record<ElementSymbol, number>>>): number {
  let m = 0
  for (const [el, n] of Object.entries(composition)) m += ATOMIC_DATA[el as ElementSymbol].atomicMassU * (n as number)
  return m
}

/** Разбор простой формулы без скобок и индексов-надстрочников: 'Al2O3' → { Al: 2, O: 3 }. */
export function parseFormula(formula: string): Partial<Record<ElementSymbol, number>> {
  const SUB = '₀₁₂₃₄₅₆₇₈₉'
  const plain = [...formula].map((ch) => (SUB.includes(ch) ? String(SUB.indexOf(ch)) : ch)).join('')
  const out: Partial<Record<ElementSymbol, number>> = {}
  for (const m of plain.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!isElementSymbol(m[1])) throw new Error(`atomicData: неизвестный элемент «${m[1]}» в формуле «${formula}»`)
    out[m[1]] = (out[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1)
  }
  return out
}

/** Атомный (эмпирический) радиус, пм. */
export function atomicRadiusPm(symbol: ElementSymbol): number {
  return ATOMIC_DATA[symbol].atomicRadiusPm
}

/** Ковалентный радиус (Cordero 2008), пм. */
export function covalentRadiusPm(symbol: ElementSymbol): number {
  return ATOMIC_DATA[symbol].covalentRadiusPm
}

/** Металлический радиус (КЧ 12), пм; null — у неметаллов. */
export function metallicRadiusPm(symbol: ElementSymbol): number | null {
  return ATOMIC_DATA[symbol].metallicRadiusPm ?? null
}

/** Цвет CPK, 0xRRGGBB. */
export function cpkColor(symbol: ElementSymbol): number {
  return ATOMIC_DATA[symbol].cpk
}

/** Цвет CPK строкой '#rrggbb' — для DOM-подписей и CSS. */
export function cpkCss(symbol: ElementSymbol): string {
  return `#${ATOMIC_DATA[symbol].cpk.toString(16).padStart(6, '0')}`
}

/**
 * Радиус частицы, пм, с правильной физикой размера:
 *  • катион — ионный радиус (МЕНЬШЕ атома: Na⁰ 186 → Na⁺ 102);
 *  • анион — ионный радиус (БОЛЬШЕ атома: Cl⁰ 102 (ковал., Cordero 2008) → Cl⁻ 181);
 *    Старое значение 99 пм — это Полинг, в таблице его нет;
 *  • нейтральный металл — металлический радиус (атом в решётке);
 *  • нейтральный неметалл — ковалентный радиус.
 *
 * opts.cn — фактическое КЧ в структуре (Pb²⁺ в глёте КЧ 4 → 98 пм, а не 119). Если радиуса при
 * этом КЧ у Шеннона нет — берётся КЧ 6 (как без opts), чтобы сцена не получила пустоту.
 * opts.model — принудительная модель: 'covalent' для полярно-ковалентных каркасов (SiO₂ — δ±,
 * а не «Si⁴⁺ 26 пм»), 'metallic' — атом в металле, 'ionic' — ионный радиус по заряду и КЧ.
 * Без opts поведение прежнее (КЧ 6).
 */
export function radiusForSpecies(
  symbol: ElementSymbol,
  charge = 0,
  opts?: { readonly cn?: number; readonly model?: RadiusModel },
): number {
  const datum = ATOMIC_DATA[symbol]
  const model = opts?.model
  if (model === 'covalent') return datum.covalentRadiusPm
  if (model === 'metallic') return datum.metallicRadiusPm ?? datum.covalentRadiusPm
  if (charge !== 0) {
    const ionic = ionicRadiusPm(symbol, charge, opts?.cn) ?? ionicRadiusPm(symbol, charge)
    if (ionic != null) return ionic
  }
  return datum.metallicRadiusPm ?? datum.covalentRadiusPm
}

/** Полный набор ионов элемента, отсортированный по заряду. */
export function ionChargesOf(symbol: ElementSymbol): readonly number[] {
  return Object.keys(ATOMIC_DATA[symbol].ionicRadiiPm)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
}

// ─────────────────────────────────────────────────────────────────────────────
// Спектральные линии (этап 11): цвет пламени — не «краска», а переход электрона
// ─────────────────────────────────────────────────────────────────────────────

export type SpectralLine = {
  readonly id: string
  readonly el: ElementSymbol
  /** Подпись линии, как в спектроскопии. */
  readonly label: string
  /** Переход (верхний → нижний уровень). */
  readonly transition: string
  /** Длина волны в ВОЗДУХЕ, нм (NIST ASD даёт воздушные для 200–2000 нм). */
  readonly airNm: number
  readonly source: string
}

/**
 * NIST Atomic Spectra Database (Kramida, Ralchenko, Reader & NIST ASD Team), Na I:
 * резонансный дублет 3p → 3s, «жёлтые линии D». Расщепление 0,597 нм — спин-орбитальное (3p₃/₂ и 3p₁/₂).
 */
export const SPECTRAL_LINES: Readonly<Record<string, SpectralLine>> = {
  'Na-D2': { id: 'Na-D2', el: 'Na', label: 'D₂', transition: '3p ²P₃/₂ → 3s ²S₁/₂', airNm: 588.995, source: 'NIST ASD, Na I' },
  'Na-D1': { id: 'Na-D1', el: 'Na', label: 'D₁', transition: '3p ²P₁/₂ → 3s ²S₁/₂', airNm: 589.592, source: 'NIST ASD, Na I' },
}

/** Длина волны линии в воздухе, нм; бросает, если линии нет. */
export function spectralLineNm(id: string): number {
  const line = SPECTRAL_LINES[id]
  if (!line) throw new Error(`atomicData: нет спектральной линии «${id}»`)
  return line.airNm
}

/**
 * Энергия фотона линии, кДж/моль: E = N_A·h·c/λ. λ в воздухе переводится в вакуум через показатель
 * преломления воздуха n ≈ 1,000277 (Edlén; для оценки энергии этой точности хватает).
 */
export function photonEnergyKJPerMol(airNm: number): number {
  const h = 6.62607015e-34
  const c = 299792458
  const nA = 6.02214076e23
  const nAir = 1.000277
  const vacM = airNm * nAir * 1e-9
  return (nA * h * c) / vacM / 1000
}
