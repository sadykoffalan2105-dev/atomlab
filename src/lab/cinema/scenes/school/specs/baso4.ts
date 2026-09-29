/**
 * BaSO₄ — BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl: школьная сцена «на уровне частиц» (обмен в растворе).
 *
 * Главный источник — Kimyo 7, гл. II, тема 12, с. 67: пример признака реакции «образование осадка».
 * Та же реакция: 8 кл., § 32, с. 138–139 (качественная реакция на серную кислоту и сульфаты) и 9 кл., § 6,
 * с. 28–31 (ионообменные реакции, Ba²⁺ + SO₄²⁻ → BaSO₄↓). Исследование химии со ссылками —
 * docs/plans/g7-baso4-scene.md.
 *
 * Что показывает сцена (и чего НЕ рисует):
 *   • в растворах — только гидратированные ионы: Ba²⁺, 2Cl⁻ | 2H₃O⁺, SO₄²⁻ (молекул BaCl₂, H₂SO₄, HCl нет);
 *   • протон — всегда на молекуле воды (H₃O⁺, пирамидка), голого H⁺ нет;
 *   • SO₄²⁻ — жёсткий правильный тетраэдр: 4 одинаковые палочки S–O (147 пм, 109,5°) и скобка [ ]²⁻,
 *     резонансные двойные не рисуются; группа переходит целиком, связи S–O не рвутся;
 *   • электроны не переходят (не ОВР), заряды подписаны, точек-электронов на ионах нет;
 *   • BaSO₄ — ионный кристалл барит (Hill 1977): у Ba²⁺ 12 соседних O из 7 групп SO₄, палочек Ba–O нет;
 *   • H₃O⁺ и Cl⁻ — ионы-наблюдатели, остаются в растворе (соляная кислота).
 * Числа в текстах — только из ядра (радиусы, длины, углы), страниц учебника или facts со ссылкой.
 * Проверка: scripts/test-school-specs.mts (раздел «Обмен в растворе») и scripts/test-solution-scene.mts.
 */
import { ref } from './core'
import type { Caveat, ParticleSpec, SolutionScienceSpec, TextbookRef } from './types'

// ─── Учебники ────────────────────────────────────────────────────────────────

const T7_P67: TextbookRef = {
  grade: 7,
  pages: [66, 67],
  section: '§ 2.12',
  title: 'Составление уравнений химических реакций',
  what: 'признаки химической реакции (цвет, осадок, газ, свет, тепло); пример признака «образование осадка»',
  asInBook: 'Образование осадка: BaCl2 +H2SO4→ BaSO4↓+2HCl',
}
const T8_P32: TextbookRef = {
  grade: 8,
  pages: [138, 139],
  section: '§ 32',
  title: 'Серная кислота',
  what: 'определение серной кислоты и сульфатов растворимой солью бария: белый осадок, не растворимый ни в воде, ни в азотной кислоте; H₂SO₄ + BaCl₂ = BaSO₄↓ + 2HCl',
}
const T9_P6: TextbookRef = {
  grade: 9,
  pages: [28, 29, 30, 31],
  section: '§ 6',
  title: 'Ионообменные реакции',
  what: 'если продукт нерастворим, реакция идёт до конца; сокращённое ионное Ba²⁺ + SO₄²⁻ = BaSO₄↓; табл. 7 — белый осадок; «сульфат бария не растворяется в воде и не распадается на ионы»',
}
const T9_P3: TextbookRef = {
  grade: 9,
  pages: [20, 21, 22, 23],
  section: '§ 3',
  title: 'Электролиты и неэлектролиты',
  what: 'электролитическая диссоциация; гидратированные ионы; кислоты в воде дают ион гидроксония H₃O⁺; H₂SO₄ → 2H⁺ + SO₄²⁻',
}
const T9_P4: TextbookRef = {
  grade: 9,
  pages: [24, 25],
  section: '§ 4',
  title: 'Диссоциация кислот, щелочей и солей',
  what: 'ступенчатая диссоциация: H₂SO₄ → H⁺ + HSO₄⁻, HSO₄⁻ → H⁺ + SO₄²⁻',
}
const T9_P5: TextbookRef = {
  grade: 9,
  pages: [26, 27],
  section: '§ 5',
  title: 'Сильные и слабые электролиты',
  what: 'степень диссоциации 0,05 М раствора серной кислоты при 18 °С равна 58 %',
}
const T8_P15: TextbookRef = {
  grade: 8,
  pages: [69, 70],
  section: '§ 15',
  title: 'Донорно-акцепторная связь',
  what: 'кислород молекулы воды присоединяет ион H⁺ своей свободной электронной парой — ион гидроксония H₃O⁺',
}
const T8_P16: TextbookRef = {
  grade: 8,
  pages: [71, 72, 73],
  section: '§ 16',
  title: 'Ионная связь',
  what: 'ионы — заряженные частицы; противоположно заряженные ионы притягиваются; соли — ионные соединения',
}
const T8_P17: TextbookRef = {
  grade: 8,
  pages: [73, 74, 75, 76],
  section: '§ 17',
  title: 'Кристаллическая решётка',
  what: 'ионная решётка: в узлах — ионы противоположного знака (соли); в NaCl у иона шесть соседей',
}
const T8_P34: TextbookRef = {
  grade: 8,
  pages: [143, 144, 145],
  section: '§ 34',
  title: 'Химическое равновесие',
  what: 'равновесие сдвигается в сторону расходования вещества, концентрацию которого изменили',
}
const T7_P54: TextbookRef = {
  grade: 7,
  pages: [54],
  section: '§ 2.7',
  title: 'Молекула',
  what: 'броуновское движение и диффузия; «молекула – это мельчайшая частица любого сложного вещества»',
}
const T7_P119: TextbookRef = {
  grade: 7,
  pages: [119],
  section: '§ 5.4',
  title: 'Кислоты',
  what: 'кислота = водород + кислотный остаток; валентность остатка = числу атомов H (SO₄ — II)',
}
const T7_P142: TextbookRef = {
  grade: 7,
  pages: [142],
  section: '§ 6.6',
  title: 'Реакции нейтрализации',
  what: '«реакции, в которых два сложных вещества обмениваются компонентами, называются реакциями обмена»',
}
const T7_P14: TextbookRef = {
  grade: 7,
  pages: [14, 15],
  section: '§ 1.3',
  title: 'Правила техники безопасности',
  what: 'остатки веществ не выливать в раковину — в специальную ёмкость',
}

// ─── Справочники ─────────────────────────────────────────────────────────────

const SRC_HILL = ref('R. J. Hill, Can. Mineral. 15 (1977) 522 (барит, Pnma; COD 9004122): у Ba²⁺ 12 атомов O из 7 групп SO₄; Jacobsen et al., Can. Mineral. 36 (1998) 1053 — SO₄ жёсткая группа')
const SRC_KSP = ref('CRC Handbook, «Solubility product constants»: Ksp(BaSO₄) = 1,08·10⁻¹⁰ при 25 °C → s ≈ 2,4 мг/л (M = 233,38 г/моль)')
const SRC_PKA = ref('CRC Handbook, «Dissociation constants of inorganic acids»: pKa₂(H₂SO₄) = 1,99 (25 °C); расчёт: в 0,05 М кислоте в виде SO₄²⁻ 15–30 % сульфата (без и с поправкой Дэвиса)')
const SRC_WATER = ref('расчёт: 55,5 моль H₂O в 1 л / 0,3 моль ионов в 0,1 М BaCl₂ ≈ 185 молекул воды на ион')
const SRC_BA_AQ = ref('Persson et al., Z. Naturforsch. 50a (1995) 21 (LAXS/EXAFS): Ba²⁺ в воде — 8 молекул H₂O (Ba–O 282 пм); D’Angelo, Migliorati et al., Inorg. Chem. 58 (2019): 8 ⇄ 9')
const SRC_CL_AQ = ref('Ohtaki & Radnai, Chem. Rev. 93 (1993) 1157: Cl⁻ в воде — около 6 молекул H₂O (по методам 4–8), к иону обращены атомы H')
const SRC_SO4_AQ = ref('Vchirawongkwin, Rode, Persson, J. Phys. Chem. B 111 (2007) 4150 (QMCF MD + LAXS): SO₄²⁻ принимает водородные связи примерно от 12 молекул воды')
const SRC_H3O_AQ = ref('Agmon, Chem. Phys. Lett. 244 (1995) 456: катион Эйгена H₉O₄⁺ — H₃O⁺ отдаёт три водородные связи трём молекулам воды')
const SRC_HEAT = ref('NBS Tables (1982): реакция слабо экзотермическая; при 0,05 М смесь теплеет на доли градуса — тепло незаметно')
const SRC_SAFETY = ref('паспорта безопасности: BaCl₂·2H₂O — GHS H301, H332 (токсично при проглатывании и вдыхании); H₂SO₄ — H314 (вызывает тяжёлые ожоги)')

// ─── Частицы ─────────────────────────────────────────────────────────────────

const P_BA: ParticleSpec = {
  id: 'Ba',
  formula: 'Ba²⁺',
  name: { ru: 'ион бария', en: 'barium ion', uz: 'bariy ioni' },
  role: 'reactant',
  phase: 'р-р',
  kind: 'ion',
  atoms: [{ id: 'Ba', element: 'Ba', charge: 2 }],
  bonds: [],
  lonePairs: {},
  unpaired: {},
  charge: 2,
  shape: 'atom',
  polarity: 'ionic',
}

const P_CL: ParticleSpec = {
  id: 'Cl',
  formula: 'Cl⁻',
  name: { ru: 'хлорид-ион', en: 'chloride ion', uz: 'xlorid ioni' },
  role: 'reactant',
  phase: 'р-р',
  kind: 'ion',
  atoms: [{ id: 'Cl', element: 'Cl', charge: -1 }],
  bonds: [],
  lonePairs: { Cl: 4 },
  unpaired: {},
  charge: -1,
  shape: 'atom',
  polarity: 'ionic',
}

const SO_BOND = { reagent: 'sulfate', name: 'S–O' } as const
const P_SO4: ParticleSpec = {
  id: 'SO4',
  formula: 'SO₄²⁻',
  name: { ru: 'сульфат-ион', en: 'sulfate ion', uz: 'sulfat ioni' },
  role: 'reactant',
  phase: 'р-р',
  kind: 'ion',
  atoms: [
    { id: 'S', element: 'S', charge: 2 },
    { id: 'O1', element: 'O', charge: -1 },
    { id: 'O2', element: 'O', charge: -1 },
    { id: 'O3', element: 'O', charge: -1 },
    { id: 'O4', element: 'O', charge: -1 },
  ],
  bonds: [
    { a: 'S', b: 'O1', pairs: 1, realOrder: 1.5, polar: true, length: SO_BOND },
    { a: 'S', b: 'O2', pairs: 1, realOrder: 1.5, polar: true, length: SO_BOND },
    { a: 'S', b: 'O3', pairs: 1, realOrder: 1.5, polar: true, length: SO_BOND },
    { a: 'S', b: 'O4', pairs: 1, realOrder: 1.5, polar: true, length: SO_BOND },
  ],
  lonePairs: { O1: 3, O2: 3, O3: 3, O4: 3 },
  unpaired: {},
  charge: -2,
  shape: 'tetrahedral',
  angles: [{ atoms: ['O1', 'S', 'O2'], ref: { reagent: 'sulfate', name: '∠O–S–O' } }],
  polarity: 'ionic',
  resonance: {
    show: {
      ru: 'Четыре одинаковые палочки S–O и скобка [SO₄]²⁻: заряд 2− общий для всей группы.',
      en: 'Four identical S–O sticks and the bracket [SO₄]²⁻: the 2− charge belongs to the whole group.',
      uz: 'Toʻrtta bir xil S–O tayoqchasi va [SO₄]²⁻ qavsi: 2− zaryad butun guruhga tegishli.',
    },
    real: {
      ru: 'Все четыре связи S–O одинаковые (147 пм), промежуточные между одинарной и двойной; заряд размазан по четырём атомам O. Две двойные и две одинарные связи — как в молекуле H₂SO₄ — у иона не рисуем.',
      en: 'All four S–O bonds are identical (147 pm), between single and double; the charge is spread over the four O atoms. Two double and two single bonds — as in the H₂SO₄ molecule — are not drawn for the ion.',
      uz: 'Toʻrtala S–O bogʻi bir xil (147 pm), oddiy va qoʻsh bogʻ oraligʻida; zaryad toʻrtta O atomiga taqsimlangan. H₂SO₄ molekulasidagidek ikkita qoʻsh va ikkita oddiy bogʻ ionda chizilmaydi.',
    },
  },
}

const OH_BOND = { reagent: 'hydronium', name: 'O–H' } as const
const P_H3O: ParticleSpec = {
  id: 'H3O',
  formula: 'H₃O⁺',
  name: { ru: 'ион гидроксония', en: 'hydronium ion', uz: 'gidroksoniy ioni' },
  role: 'reactant',
  phase: 'р-р',
  kind: 'ion',
  atoms: [
    { id: 'O', element: 'O', charge: 1 },
    { id: 'H1', element: 'H' },
    { id: 'H2', element: 'H' },
    { id: 'H3', element: 'H' },
  ],
  bonds: [
    { a: 'O', b: 'H1', pairs: 1, polar: true, length: OH_BOND },
    { a: 'O', b: 'H2', pairs: 1, polar: true, length: OH_BOND },
    { a: 'O', b: 'H3', pairs: 1, polar: true, length: OH_BOND },
  ],
  lonePairs: { O: 1 },
  unpaired: {},
  charge: 1,
  shape: 'pyramidal',
  angles: [{ atoms: ['H1', 'O', 'H2'], ref: { reagent: 'hydronium', name: '∠H–O–H' } }],
  polarity: 'ionic',
  schematic: {
    ru: 'Ион водорода в воде показан как H₃O⁺ — протон на молекуле воды (пирамидка, геометрия газа). На деле протон перескакивает между молекулами воды, бывают и более крупные гидраты.',
    en: 'The hydrogen ion in water is shown as H₃O⁺ — a proton on a water molecule (a pyramid, gas geometry). In reality the proton hops between water molecules; larger hydrates also exist.',
    uz: 'Suvdagi vodorod ioni H₃O⁺ koʻrinishida — suv molekulasidagi proton (piramida, gaz geometriyasi). Aslida proton suv molekulalari orasida sakraydi, kattaroq gidratlar ham boʻladi.',
  },
}

const P_H2O: ParticleSpec = {
  id: 'H2O',
  formula: 'H₂O',
  name: { ru: 'вода', en: 'water', uz: 'suv' },
  role: 'reactant',
  phase: 'ж',
  kind: 'molecule',
  atoms: [
    { id: 'O', element: 'O' },
    { id: 'H1', element: 'H' },
    { id: 'H2', element: 'H' },
  ],
  bonds: [
    { a: 'O', b: 'H1', pairs: 1, polar: true, length: { bond: 'O-H' } },
    { a: 'O', b: 'H2', pairs: 1, polar: true, length: { bond: 'O-H' } },
  ],
  lonePairs: { O: 2 },
  unpaired: {},
  charge: 0,
  shape: 'bent',
  angles: [{ atoms: ['H1', 'O', 'H2'], ref: { angle: 'water' } }],
  dipoleKey: 'H2O',
  polarity: 'polar',
}

const P_BASO4: ParticleSpec = {
  id: 'BaSO4',
  formula: 'BaSO₄',
  name: { ru: 'сульфат бария (барит)', en: 'barium sulfate (barite)', uz: 'bariy sulfat (barit)' },
  role: 'product',
  phase: 'тв',
  kind: 'precipitate',
  atoms: [
    { id: 'Ba', element: 'Ba', charge: 2 },
    { id: 'S', element: 'S', charge: 2 },
    { id: 'O1', element: 'O', charge: -1 },
    { id: 'O2', element: 'O', charge: -1 },
    { id: 'O3', element: 'O', charge: -1 },
    { id: 'O4', element: 'O', charge: -1 },
  ],
  bonds: [
    { a: 'S', b: 'O1', pairs: 1, realOrder: 1.5, polar: true, length: SO_BOND },
    { a: 'S', b: 'O2', pairs: 1, realOrder: 1.5, polar: true, length: SO_BOND },
    { a: 'S', b: 'O3', pairs: 1, realOrder: 1.5, polar: true, length: SO_BOND },
    { a: 'S', b: 'O4', pairs: 1, realOrder: 1.5, polar: true, length: SO_BOND },
  ],
  lonePairs: { O1: 3, O2: 3, O3: 3, O4: 3 },
  unpaired: {},
  charge: 0,
  shape: 'lattice',
  polarity: 'ionic',
  schematic: {
    ru: 'Формульная единица BaSO₄: один ион Ba²⁺ и один сульфат-ион. В кристалле барита каждый Ba²⁺ окружён 12 атомами O из 7 разных групп SO₄; отдельных молекул BaSO₄ нет.',
    en: 'The formula unit BaSO₄: one Ba²⁺ ion and one sulfate ion. In the barite crystal every Ba²⁺ is surrounded by 12 O atoms of 7 different SO₄ groups; there are no separate BaSO₄ molecules.',
    uz: 'BaSO₄ formula birligi: bitta Ba²⁺ ioni va bitta sulfat ioni. Barit kristallida har bir Ba²⁺ 7 ta turli SO₄ guruhining 12 ta O atomi bilan oʻralgan; alohida BaSO₄ molekulalari yoʻq.',
  },
}

// ─── Оговорки ────────────────────────────────────────────────────────────────

const CAVEATS: readonly Caveat[] = [
  {
    id: 'molecules-p67',
    kind: 'textbook-simplification',
    source: T7_P67,
    text: {
      ru: 'На с. 67 сказано, что для реакции «молекулы должны столкнуться». У соли и кислоты в растворе молекул нет — встречаются ионы, окружённые водой.',
      en: 'Page 67 says that «molecules must collide» for a reaction. A salt and an acid in solution have no molecules — the ions surrounded by water meet.',
      uz: '67-betda reaksiya uchun «molekulalar toʻqnashishi kerak» deyilgan. Eritmadagi tuz va kislotada molekula yoʻq — suv bilan oʻralgan ionlar uchrashadi.',
    },
  },
  {
    id: 'molecule-definition',
    kind: 'textbook-simplification',
    source: T7_P54,
    evidence: T8_P17,
    text: {
      ru: '«Молекула — мельчайшая частица сложного вещества» (7 кл.) — упрощение: у солей мельчайшие частицы — ионы, а BaSO₄ — ионный кристалл без молекул (8 кл. § 17).',
      en: '«A molecule is the smallest particle of a compound» (grade 7) is a simplification: in salts the smallest particles are ions, and BaSO₄ is an ionic crystal without molecules (grade 8 § 17).',
      uz: '«Molekula — murakkab moddaning eng kichik zarrachasi» (7-sinf) — soddalashtirish: tuzlarda eng kichik zarrachalar ionlar, BaSO₄ esa molekulasiz ionli kristall (8-sinf § 17).',
    },
  },
  {
    id: 'no-baso4-molecule',
    kind: 'model-limit',
    evidence: SRC_HILL,
    text: {
      ru: 'Молекулы BaSO₄ не бывает: это ионный кристалл барит, у каждого Ba²⁺ 12 соседних атомов O из 7 групп SO₄. Палочек Ba–O нет — ионы держит притяжение зарядов.',
      en: 'There is no BaSO₄ molecule: it is the ionic crystal barite; every Ba²⁺ has 12 neighbouring O atoms of 7 SO₄ groups. There are no Ba–O sticks — the ions are held by the attraction of charges.',
      uz: 'BaSO₄ molekulasi yoʻq: bu barit ionli kristali, har bir Ba²⁺ atrofida 7 ta SO₄ guruhining 12 ta qoʻshni O atomi bor. Ba–O tayoqchalari yoʻq — ionlarni zaryadlar tortishuvi ushlab turadi.',
    },
  },
  {
    id: 'hso4',
    kind: 'textbook-simplification',
    source: T9_P5,
    evidence: SRC_PKA,
    text: {
      ru: 'Вторая ступень диссоциации серной кислоты неполная (pKa₂ = 1,99): в 0,05 М кислоте в виде SO₄²⁻ только 15–30 % сульфата, остальное — HSO₄⁻. Поэтому учебник 9 кл. даёт для такого раствора степень диссоциации 58 %. В сцене для простоты показан SO₄²⁻; осадок забирает его, равновесие сдвигается, и в осадок уходит весь сульфат.',
      en: 'The second dissociation step of sulfuric acid is incomplete (pKa₂ = 1.99): in 0.05 M acid only 15–30 % of the sulfate is SO₄²⁻, the rest is HSO₄⁻. That is why the grade 9 textbook gives a degree of dissociation of 58 % for this solution. The scene shows SO₄²⁻ for simplicity; the precipitate removes it, the equilibrium shifts and all the sulfate ends up in the precipitate.',
      uz: 'Sulfat kislotaning ikkinchi dissotsilanish bosqichi toʻliq emas (pKa₂ = 1,99): 0,05 M kislotada sulfatning faqat 15–30 % i SO₄²⁻ holida, qolgani HSO₄⁻. Shuning uchun 9-sinf darsligi bu eritma uchun dissotsilanish darajasini 58 % deb beradi. Sahnada soddalik uchun SO₄²⁻ koʻrsatilgan; choʻkma uni oladi, muvozanat siljiydi va butun sulfat choʻkmaga oʻtadi.',
    },
  },
  {
    id: 'water-amount',
    kind: 'scene-simplification',
    evidence: SRC_WATER,
    text: {
      ru: 'В кадре только ближние молекулы воды и несколько фоновых. На самом деле на каждый ион около 185 молекул воды (0,1 М раствор), и ионы в растворе гораздо дальше друг от друга.',
      en: 'The frame shows only the nearest water molecules and a few in the background. In reality there are about 185 water molecules per ion (0.1 M solution), and the ions are much farther apart.',
      uz: 'Kadrda faqat yaqin suv molekulalari va bir nechta fondagilari bor. Aslida har bir ionga taxminan 185 ta suv molekulasi toʻgʻri keladi (0,1 M eritma), ionlar bir-biridan ancha uzoqda.',
    },
  },
  {
    id: 'not-dissociate',
    kind: 'textbook-simplification',
    source: T9_P6,
    evidence: SRC_KSP,
    text: {
      ru: '«Сульфат бария не распадается на ионы» (9 кл.) — упрощение: кристалл сам состоит из ионов, он просто почти не растворяется — около 2,4 мг в литре воды.',
      en: '«Barium sulfate does not break up into ions» (grade 9) is a simplification: the crystal itself is made of ions, it just hardly dissolves — about 2.4 mg per litre of water.',
      uz: '«Bariy sulfat ionlarga ajralmaydi» (9-sinf) — soddalashtirish: kristallning oʻzi ionlardan iborat, u shunchaki deyarli erimaydi — bir litr suvda taxminan 2,4 mg.',
    },
  },
  {
    id: 'no-heat',
    kind: 'scene-simplification',
    evidence: SRC_HEAT,
    text: {
      ru: 'Нагревание не нужно: реакция идёт сразу при сливании растворов, тепла выделяется так мало, что пробирка не теплеет. Чисел энергии сцена не показывает.',
      en: 'No heating is needed: the reaction happens as soon as the solutions are mixed, and so little heat is released that the tube does not warm up. The scene shows no energy numbers.',
      uz: 'Qizdirish kerak emas: eritmalar qoʻshilishi bilan reaksiya darhol boradi, shunchalik kam issiqlik ajraladiki, probirka isimaydi. Sahna energiya sonlarini koʻrsatmaydi.',
    },
  },
]

// ─── Спецификация ────────────────────────────────────────────────────────────

export const BASO4_SPEC: SolutionScienceSpec = {
  id: 'baso4',
  substance: 'BaSO₄',
  focus: 'BaSO4',
  name: { ru: 'Сульфат бария', en: 'Barium sulfate', uz: 'Bariy sulfat' },
  bondType: 'ionic',
  reaction: {
    equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
    reactants: [
      { formula: 'BaCl₂', coef: 1, phase: 'р-р', particles: [{ particle: 'Ba', count: 1 }, { particle: 'Cl', count: 2 }] },
      { formula: 'H₂SO₄', coef: 1, phase: 'р-р', particles: [{ particle: 'H3O', count: 2 }, { particle: 'SO4', count: 1 }], water: 2 },
    ],
    products: [
      { formula: 'BaSO₄', coef: 1, phase: 'тв', precipitate: true, particles: [{ particle: 'BaSO4', count: 1 }] },
      { formula: 'HCl', coef: 2, phase: 'р-р', particles: [{ particle: 'H3O', count: 1 }, { particle: 'Cl', count: 1 }], water: 1 },
    ],
    ionicFull: 'Ba²⁺ + 2Cl⁻ + 2H⁺ + SO₄²⁻ → BaSO₄↓ + 2H⁺ + 2Cl⁻',
    ionicShort: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓',
    kind: 'exchange',
    bankId: 'bacl2-h2so4',
    sources: [T7_P67, T8_P32, T9_P6, T9_P3, T9_P4],
    conditions: {
      heating: false,
      text: {
        ru: 'комнатная температура, без нагревания: растворы просто сливают',
        en: 'room temperature, no heating: the solutions are simply mixed',
        uz: 'xona harorati, qizdirilmaydi: eritmalar shunchaki qoʻshiladi',
      },
    },
    heat: 'exo',
    heatSource: SRC_HEAT,
  },
  particles: [P_BA, P_CL, P_SO4, P_H3O, P_H2O, P_BASO4],
  hydration: [
    { particle: 'Ba', realCount: 8, shown: 6, facing: 'O', source: SRC_BA_AQ },
    { particle: 'Cl', realCount: 6, shown: 4, facing: 'H', source: SRC_CL_AQ },
    { particle: 'SO4', realCount: 12, shown: 4, facing: 'H', source: SRC_SO4_AQ },
    { particle: 'H3O', realCount: 3, shown: 3, facing: 'O', source: SRC_H3O_AQ },
  ],
  facts: [
    { id: 'water-per-ion', value: 185, what: 'молекул воды на ион в 0,1 М BaCl₂', source: SRC_WATER },
    { id: 'conc', value: 0.1, what: 'концентрация раствора для оценки воды, моль/л', source: SRC_WATER },
    { id: 'pka2', value: 1.99, what: 'pKa₂ серной кислоты', source: SRC_PKA },
    { id: 'ksp', value: 1.08, what: 'Ksp(BaSO₄) = 1,08·10⁻¹⁰', source: SRC_KSP },
    { id: 'solubility', value: 2.4, what: 'растворимость BaSO₄, мг/л', source: SRC_KSP },
    { id: 't25', value: 25, what: 'температура для Ksp, °C', source: SRC_KSP },
  ],
  observations: [
    {
      text: {
        ru: 'Растворы хлорида бария и серной кислоты бесцветные; при сливании сразу выпадает белый осадок, который не растворяется ни в воде, ни в азотной кислоте.',
        en: 'The barium chloride and sulfuric acid solutions are colourless; on mixing a white precipitate forms at once, which dissolves neither in water nor in nitric acid.',
        uz: 'Bariy xlorid va sulfat kislota eritmalari rangsiz; qoʻshilganda darhol oq choʻkma tushadi, u na suvda, na nitrat kislotada eriydi.',
      },
      source: T8_P32,
    },
    {
      text: {
        ru: 'Ион бария и сульфат-ион дают белый осадок (таблица 7).',
        en: 'The barium ion and the sulfate ion give a white precipitate (table 7).',
        uz: 'Bariy ioni va sulfat ioni oq choʻkma beradi (7-jadval).',
      },
      source: T9_P6,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Растворимая соль бария — реактив на серную кислоту и сульфаты (качественная реакция на сульфат-ион).',
        en: 'A soluble barium salt is the reagent for sulfuric acid and sulfates (the qualitative test for the sulfate ion).',
        uz: 'Bariyning eruvchan tuzi — sulfat kislota va sulfatlar uchun reaktiv (sulfat ioniga sifat reaksiyasi).',
      },
      source: T8_P32,
    },
  ],
  intro: {
    title: {
      ru: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl: белый осадок',
      en: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl: a white precipitate',
      uz: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl: oq choʻkma',
    },
    speak: {
      ru: 'Сольём два бесцветных раствора и посмотрим, что при этом происходит с частицами.',
      en: 'Let us mix two colourless solutions and see what happens to the particles.',
      uz: 'Ikkita rangsiz eritmani qoʻshamiz va zarrachalar bilan nima boʻlishini koʻramiz.',
    },
  },
  safety: {
    ru: 'Хлорид бария ядовит, серная кислота едкая. Опыт только с учителем, в очках и перчатках; ничего не пробовать на вкус. Кислоту разбавляют, вливая её в воду, а не наоборот. Отходы с барием — в отдельную ёмкость, не в раковину. BaSO₄ для рентгена — только чистый медицинский препарат.',
    en: 'Barium chloride is poisonous, sulfuric acid is corrosive. Only with the teacher, in goggles and gloves; never taste anything. Acid is diluted by pouring it into water, not the other way round. Barium waste goes into a separate container, not down the sink. BaSO₄ for X-rays is only the pure medical product.',
    uz: 'Bariy xlorid zaharli, sulfat kislota oʻyuvchi. Tajriba faqat oʻqituvchi bilan, koʻzoynak va qoʻlqopda; hech narsani tatib koʻrmang. Kislota suvga quyib suyultiriladi, aksincha emas. Bariyli chiqindilar alohida idishga, rakovinaga emas. Rentgen uchun BaSO₄ — faqat toza tibbiy preparat.',
  },
  legend: {
    ion: {
      ru: 'Шар с символом внутри — ион, заряд подписан рядом: Ba²⁺, Cl⁻, H₃O⁺, [SO₄]²⁻. Зелёный цвет Ba — условный цвет элемента: растворы бесцветные.',
      en: 'A ball with the symbol inside is an ion, its charge is written next to it: Ba²⁺, Cl⁻, H₃O⁺, [SO₄]²⁻. The green colour of Ba is only the element colour: the solutions are colourless.',
      uz: 'Ichida belgisi bor shar — ion, zaryadi yonida yozilgan: Ba²⁺, Cl⁻, H₃O⁺, [SO₄]²⁻. Ba ning yashil rangi — element sharti rangi: eritmalar rangsiz.',
    },
    sharedPair: {
      ru: 'Серая палочка — связь внутри частицы: S–O в сульфат-ионе, O–H в воде и в H₃O⁺. Между Ba²⁺ и SO₄²⁻ палочек нет.',
      en: 'A grey stick is a bond inside a particle: S–O in the sulfate ion, O–H in water and in H₃O⁺. There are no sticks between Ba²⁺ and SO₄²⁻.',
      uz: 'Kulrang tayoqcha — zarracha ichidagi bogʻ: sulfat ionidagi S–O, suvdagi va H₃O⁺ dagi O–H. Ba²⁺ va SO₄²⁻ orasida tayoqcha yoʻq.',
    },
    water: {
      ru: 'Уголок O + 2H — молекула воды: к катиону она повёрнута кислородом, к аниону — водородом.',
      en: 'The O + 2H corner is a water molecule: it turns its oxygen to a cation and its hydrogen to an anion.',
      uz: 'O + 2H burchagi — suv molekulasi: kationga kislorodi bilan, anionga vodorodi bilan qaraydi.',
    },
    precipitate: {
      ru: 'Белая муть и слой на дне — осадок BaSO₄.',
      en: 'The white cloudiness and the layer at the bottom are the BaSO₄ precipitate.',
      uz: 'Oq loyqa va tubdagi qatlam — BaSO₄ choʻkmasi.',
    },
  },
  captions: {
    tubeA: { ru: 'BaCl₂ (р-р)', en: 'BaCl₂ (solution)', uz: 'BaCl₂ (eritma)' },
    tubeB: { ru: 'H₂SO₄ (разб.)', en: 'H₂SO₄ (dilute)', uz: 'H₂SO₄ (suyult.)' },
    solutionA: { ru: 'раствор BaCl₂', en: 'BaCl₂ solution', uz: 'BaCl₂ eritmasi' },
    solutionB: { ru: 'раствор H₂SO₄', en: 'H₂SO₄ solution', uz: 'H₂SO₄ eritmasi' },
    crystal: { ru: 'кристалл BaSO₄', en: 'BaSO₄ crystal', uz: 'BaSO₄ kristali' },
    neighbors: { ru: 'у Ba²⁺ — 12 соседних O', en: 'Ba²⁺ has 12 neighbouring O', uz: 'Ba²⁺ atrofida 12 ta O' },
    precipitate: { ru: 'BaSO₄↓ — белый осадок', en: 'BaSO₄↓ — white precipitate', uz: 'BaSO₄↓ — oq choʻkma' },
    acid: { ru: 'соляная кислота: H₃O⁺ + Cl⁻', en: 'hydrochloric acid: H₃O⁺ + Cl⁻', uz: 'xlorid kislota: H₃O⁺ + Cl⁻' },
    nitric: { ru: '+ HNO₃ — осадок не растворяется', en: '+ HNO₃ — the precipitate stays', uz: '+ HNO₃ — choʻkma erimaydi' },
    hydronium: {
      ru: 'H₃O⁺ — это ион водорода H⁺,\nкоторый сидит на молекуле воды:\nH₂O + H⁺ → H₃O⁺\nСвободных H⁺ в воде не бывает.',
      en: 'H₃O⁺ is a hydrogen ion H⁺\nsitting on a water molecule:\nH₂O + H⁺ → H₃O⁺\nThere are no free H⁺ in water.',
      uz: 'H₃O⁺ — bu suv molekulasiga\noʻtirgan vodorod ioni H⁺:\nH₂O + H⁺ → H₃O⁺\nSuvda erkin H⁺ boʻlmaydi.',
    },
    attract: { ru: '+ и − притягиваются', en: '+ and − attract', uz: '+ va − tortishadi' },
    spectators: { ru: 'H₃O⁺ и Cl⁻ не соединяются', en: 'H₃O⁺ and Cl⁻ do not join', uz: 'H₃O⁺ va Cl⁻ birikmaydi' },
    balance: {
      ru: 'слева и справа: 1 Ba · 2 Cl · 2 H · 1 S · 4 O',
      en: 'left and right: 1 Ba · 2 Cl · 2 H · 1 S · 4 O',
      uz: 'chapda va oʻngda: 1 Ba · 2 Cl · 2 H · 1 S · 4 O',
    },
  },
  steps: [
    {
      id: 'tubes',
      level: 7,
      seconds: 5,
      show: ['две пробирки с бесцветными растворами BaCl₂ и H₂SO₄ (разб.)', 'сливают — белая муть, осадок оседает', 'без горелки и значка нагрева'],
      sources: [T7_P67, T8_P32],
      text: {
        ru: {
          title: 'Что видно в пробирке',
          body: 'Два прозрачных бесцветных раствора: хлорид бария BaCl₂ и разбавленная серная кислота H₂SO₄. Сливаем их — сразу появляется белая муть, а потом на дно оседает белый осадок. Выпадение осадка — признак химической реакции.',
          equation: 'BaCl₂ + H₂SO₄ → ?',
          note: 'Нагревать не нужно: реакция идёт сразу при сливании растворов, пробирка на ощупь не теплеет. Осадок белый (8 кл., с. 139; 9 кл., табл. 7).',
          speak: 'Смотри: два прозрачных раствора дали белый осадок — значит, получилось новое вещество.',
        },
        en: {
          title: 'What we see in the test tube',
          body: 'Two clear colourless solutions: barium chloride BaCl₂ and dilute sulfuric acid H₂SO₄. We pour them together — a white cloudiness appears at once, and then a white precipitate settles to the bottom. Formation of a precipitate is a sign of a chemical reaction.',
          equation: 'BaCl₂ + H₂SO₄ → ?',
          note: 'No heating is needed: the reaction starts as soon as the solutions are mixed, the tube does not feel warm. The precipitate is white (grade 8, p. 139; grade 9, table 7).',
          speak: 'Look: two clear solutions gave a white precipitate — so a new substance has formed.',
        },
        uz: {
          title: 'Probirkada nima koʻrinadi',
          body: 'Ikkita tiniq rangsiz eritma: bariy xlorid BaCl₂ va suyultirilgan sulfat kislota H₂SO₄. Ularni qoʻshamiz — darhol oq loyqa paydo boʻladi, keyin tubga oq choʻkma tushadi. Choʻkma tushishi — kimyoviy reaksiya belgisi.',
          equation: 'BaCl₂ + H₂SO₄ → ?',
          note: 'Qizdirish kerak emas: eritmalar qoʻshilishi bilan reaksiya darhol boradi, probirka qoʻlga iliq tuyulmaydi. Choʻkma oq (8-sinf, 139-bet; 9-sinf, 7-jadval).',
          speak: 'Qara: ikkita tiniq eritma oq choʻkma berdi — demak, yangi modda hosil boʻldi.',
        },
      },
    },
    {
      id: 'ions',
      level: 9,
      seconds: 6,
      show: [
        'наезд в каплю: слева Ba²⁺ и 2 Cl⁻, справа [SO₄]²⁻ и 2 H₃O⁺',
        'ближние молекулы воды: O к катиону, H к аниону; несколько фоновых',
        'заряды — подписями, точек-электронов нет',
      ],
      sources: [T9_P3, T9_P4, T7_P119, T8_P15],
      text: {
        ru: {
          title: 'Из чего состоят растворы',
          body: 'В растворе нет «молекул BaCl₂». Хлорид бария распался на заряженные частицы — ионы: один ион бария Ba²⁺ и два хлорид-иона Cl⁻. Серная кислота дала два иона водорода — каждый сидит на молекуле воды, это H₃O⁺ — и сульфат-ион SO₄²⁻: атом серы и четыре атома кислорода с общим зарядом 2−. Каждый ион окружён молекулами воды.',
          equation: 'BaCl₂ → Ba²⁺ + 2Cl⁻;  H₂SO₄ → 2H⁺ + SO₄²⁻',
          note: 'Ион — атом или группа атомов, у которой электронов больше или меньше, чем протонов. Заряды равны валентностям: барий II, кислотный остаток SO₄ II. На самом деле вокруг иона сотни молекул воды (около 185 на ион в 0,1 М растворе), в кадре — только ближние. Все четыре связи S–O одинаковые: 147 пм, угол 109,5°.',
          speak: 'Вода растаскивает соль и кислоту на ионы — у каждого иона своя «шубка» из молекул воды.',
        },
        en: {
          title: 'What the solutions are made of',
          body: 'There are no «BaCl₂ molecules» in the solution. Barium chloride has broken up into charged particles — ions: one barium ion Ba²⁺ and two chloride ions Cl⁻. Sulfuric acid gave two hydrogen ions — each sits on a water molecule, that is H₃O⁺ — and the sulfate ion SO₄²⁻: a sulfur atom and four oxygen atoms with a common charge of 2−. Every ion is surrounded by water molecules.',
          equation: 'BaCl₂ → Ba²⁺ + 2Cl⁻;  H₂SO₄ → 2H⁺ + SO₄²⁻',
          note: 'An ion is an atom or a group of atoms with more or fewer electrons than protons. The charges equal the valences: barium II, the acid residue SO₄ II. In reality an ion has hundreds of water molecules around it (about 185 per ion in a 0.1 M solution); the frame shows only the nearest ones. All four S–O bonds are identical: 147 pm, angle 109.5°.',
          speak: 'Water pulls the salt and the acid apart into ions — every ion wears its own «coat» of water molecules.',
        },
        uz: {
          title: 'Eritmalar nimadan iborat',
          body: 'Eritmada «BaCl₂ molekulalari» yoʻq. Bariy xlorid zaryadli zarrachalar — ionlarga ajralgan: bitta bariy ioni Ba²⁺ va ikkita xlorid ioni Cl⁻. Sulfat kislota ikkita vodorod ioni berdi — har biri suv molekulasida oʻtiradi, bu H₃O⁺ — va sulfat ioni SO₄²⁻: bitta oltingugurt atomi va umumiy zaryadi 2− boʻlgan toʻrtta kislorod atomi. Har bir ion suv molekulalari bilan oʻralgan.',
          equation: 'BaCl₂ → Ba²⁺ + 2Cl⁻;  H₂SO₄ → 2H⁺ + SO₄²⁻',
          note: 'Ion — elektronlari protonlaridan koʻp yoki kam boʻlgan atom yoki atomlar guruhi. Zaryadlar valentliklarga teng: bariy II, SO₄ kislota qoldigʻi II. Aslida ion atrofida yuzlab suv molekulasi bor (0,1 M eritmada bir ionga taxminan 185 ta), kadrda faqat yaqinlari. Toʻrtala S–O bogʻi bir xil: 147 pm, burchak 109,5°.',
          speak: 'Suv tuz va kislotani ionlarga ajratadi — har bir ionning suv molekulalaridan oʻz «poʻstini» bor.',
        },
      },
    },
    {
      id: 'meet',
      level: 8,
      seconds: 5,
      show: ['ионы блуждают зигзагами', 'Ba²⁺ и SO₄²⁻ сближаются (пунктир притяжения), вода между ними отходит', 'H₃O⁺ проходит мимо Cl⁻ и остаётся в растворе'],
      sources: [T7_P54, T8_P16, T8_P34],
      text: {
        ru: {
          title: 'Ионы находят друг друга',
          body: 'Частицы в растворе всё время хаотично движутся, как при диффузии. Противоположные заряды притягиваются: ион бария Ba²⁺ и сульфат-ион SO₄²⁻ сближаются, вода между ними отходит. Ионы H₃O⁺ и Cl⁻ тоже встречаются, но остаются поодиночке, каждый в своей водной оболочке.',
          equation: 'Ba²⁺ + SO₄²⁻ → …;  H₃O⁺ и Cl⁻ остаются в растворе',
          note: 'Электроны не переходят, заряды и степени окисления не меняются, связи S–O не рвутся — сульфат-группа целиком переходит к новому партнёру. В разбавленной кислоте часть сульфата — HSO₄⁻ (pKa₂ = 1,99); осадок забирает SO₄²⁻, равновесие сдвигается (8 кл., § 34), и в осадок уходит весь сульфат.',
          speak: 'Сульфат-группа не разваливается на атомы — она переходит к барию целиком.',
        },
        en: {
          title: 'The ions find each other',
          body: 'The particles in a solution are always moving at random, as in diffusion. Opposite charges attract: the barium ion Ba²⁺ and the sulfate ion SO₄²⁻ come closer, and the water between them moves aside. The H₃O⁺ and Cl⁻ ions also meet, but stay apart, each in its own water shell.',
          equation: 'Ba²⁺ + SO₄²⁻ → …;  H₃O⁺ and Cl⁻ stay in the solution',
          note: 'No electrons move, charges and oxidation states do not change, S–O bonds do not break — the sulfate group moves to its new partner as a whole. In dilute acid part of the sulfate is HSO₄⁻ (pKa₂ = 1.99); the precipitate removes SO₄²⁻, the equilibrium shifts (grade 8, § 34) and all the sulfate ends up in the precipitate.',
          speak: 'The sulfate group does not fall apart into atoms — it goes over to barium as a whole.',
        },
        uz: {
          title: 'Ionlar bir-birini topadi',
          body: 'Eritmadagi zarrachalar diffuziyadagidek doimo tartibsiz harakatlanadi. Qarama-qarshi zaryadlar tortishadi: bariy ioni Ba²⁺ va sulfat ioni SO₄²⁻ yaqinlashadi, ular orasidagi suv chetga chiqadi. H₃O⁺ va Cl⁻ ionlari ham uchrashadi, lekin har biri oʻz suv qobigʻida alohida qoladi.',
          equation: 'Ba²⁺ + SO₄²⁻ → …;  H₃O⁺ va Cl⁻ eritmada qoladi',
          note: 'Elektronlar oʻtmaydi, zaryadlar va oksidlanish darajalari oʻzgarmaydi, S–O bogʻlari uzilmaydi — sulfat guruhi yangi sherigiga butunligicha oʻtadi. Suyultirilgan kislotada sulfatning bir qismi HSO₄⁻ (pKa₂ = 1,99); choʻkma SO₄²⁻ ni oladi, muvozanat siljiydi (8-sinf, § 34) va butun sulfat choʻkmaga oʻtadi.',
          speak: 'Sulfat guruhi atomlarga ajralmaydi — u bariyga butunligicha oʻtadi.',
        },
      },
    },
    {
      id: 'nucleus',
      level: 8,
      seconds: 6,
      show: ['пара садится на зародыш барита, за ней — новые пары', 'шары касаются, палочек Ba–O нет, вода сброшена', 'Ba²⁺ меняет радиус 142 → 161 пм при посадке', 'подписи «кристалл BaSO₄», «у Ba²⁺ — 12 соседних O»'],
      sources: [T8_P17, T9_P6],
      text: {
        ru: {
          title: 'Растёт кристаллик',
          body: 'Ион бария и сульфат-ион садятся на крошечный зародыш кристалла, за ними — новые пары. Ионы укладываются в строгом порядке, вода отходит. Отдельных «молекул BaSO₄» не бывает: каждый ион бария касается атомов кислорода сразу нескольких сульфат-групп.',
          equation: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓',
          note: 'Это ионная кристаллическая решётка, как у поваренной соли (8 кл., § 17), только у барита вокруг Ba²⁺ 12 атомов O из 7 групп SO₄. В воде вокруг иона бария 8 молекул воды, в кристалле — 12 атомов O, поэтому его шар чуть крупнее: 142 → 161 пм (радиусы Шеннона). В кадре — фрагмент кристалла.',
          speak: 'Пары ионов встают в решётку ряд за рядом — так из невидимых частиц растёт видимый кристаллик.',
        },
        en: {
          title: 'A tiny crystal grows',
          body: 'The barium ion and the sulfate ion settle on a tiny crystal seed, and new pairs follow them. The ions line up in a strict order, and the water moves away. There are no separate «BaSO₄ molecules»: every barium ion touches oxygen atoms of several sulfate groups at once.',
          equation: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓',
          note: 'This is an ionic crystal lattice, like that of table salt (grade 8, § 17), but in barite Ba²⁺ is surrounded by 12 O atoms of 7 SO₄ groups. In water the barium ion has 8 water molecules around it, in the crystal 12 O atoms, so its ball is a little larger: 142 → 161 pm (Shannon radii). The frame shows a fragment of the crystal.',
          speak: 'Pairs of ions join the lattice row by row — this is how invisible particles grow into a visible crystal.',
        },
        uz: {
          title: 'Kristallcha oʻsadi',
          body: 'Bariy ioni va sulfat ioni kichkina kristall kurtagiga oʻtiradi, ulardan keyin yangi juftlar keladi. Ionlar qatʼiy tartibda joylashadi, suv chetga chiqadi. Alohida «BaSO₄ molekulalari» boʻlmaydi: har bir bariy ioni bir vaqtda bir nechta sulfat guruhining kislorod atomlariga tegib turadi.',
          equation: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓',
          note: 'Bu osh tuzidagidek ionli kristall panjara (8-sinf, § 17), faqat baritda Ba²⁺ atrofida 7 ta SO₄ guruhining 12 ta O atomi bor. Suvda bariy ioni atrofida 8 ta suv molekulasi, kristallda 12 ta O atomi, shuning uchun uning shari biroz kattaroq: 142 → 161 pm (Shennon radiuslari). Kadrda kristall boʻlagi.',
          speak: 'Ion juftlari panjaraga qator-qator joylashadi — koʻrinmas zarrachalardan koʻrinadigan kristallcha shunday oʻsadi.',
        },
      },
    },
    {
      id: 'settle',
      level: 8,
      seconds: 5,
      show: ['отъезд к пробирке: муть оседает белым слоем на дно', 'над осадком — прозрачный раствор: соляная кислота (H₃O⁺ и Cl⁻)', 'плашка «+ HNO₃ — осадок не растворяется»'],
      sources: [T8_P32, T9_P6],
      text: {
        ru: {
          title: 'Осадок и соляная кислота',
          body: 'Кристаллики растут, и их становится видно — это белая муть. Они тяжёлые и оседают на дно. Сульфат бария почти не растворяется ни в воде, ни в разбавленных кислотах — например, в азотной (8 кл., с. 139). А ионы водорода и хлора остались в растворе — это соляная кислота.',
          equation: 'над осадком: H₃O⁺ + Cl⁻ (соляная кислота)',
          note: 'В литре воды растворяется всего около 2,4 мг BaSO₄ (Ksp = 1,08·10⁻¹⁰ при 25 °C). «Не распадается на ионы» (9 кл.) значит «почти не растворяется»: сам кристалл состоит из ионов. Молекул HCl в растворе нет — «2HCl» это 2H₃O⁺ и 2Cl⁻.',
          speak: 'Белый осадок не исчезает даже в кислоте — поэтому хлорид бария служит реактивом на серную кислоту и сульфаты.',
        },
        en: {
          title: 'The precipitate and hydrochloric acid',
          body: 'The tiny crystals grow and become visible — this is the white cloudiness. They are heavy and settle to the bottom. Barium sulfate hardly dissolves in water or in dilute acids such as nitric acid (grade 8, p. 139). The hydrogen and chloride ions stayed in the solution — this is hydrochloric acid.',
          equation: 'above the precipitate: H₃O⁺ + Cl⁻ (hydrochloric acid)',
          note: 'Only about 2.4 mg of BaSO₄ dissolves in a litre of water (Ksp = 1.08·10⁻¹⁰ at 25 °C). «Does not break up into ions» (grade 9) means «hardly dissolves»: the crystal itself is made of ions. There are no HCl molecules in the solution — «2HCl» means 2H₃O⁺ and 2Cl⁻.',
          speak: 'The white precipitate does not disappear even in acid — that is why barium chloride is the reagent for sulfuric acid and sulfates.',
        },
        uz: {
          title: 'Choʻkma va xlorid kislota',
          body: 'Kristallchalar oʻsadi va koʻrinadigan boʻladi — bu oq loyqa. Ular ogʻir va tubga choʻkadi. Bariy sulfat na suvda, na suyultirilgan kislotalarda (masalan, nitrat kislotada) deyarli erimaydi (8-sinf, 139-bet). Vodorod va xlor ionlari esa eritmada qoldi — bu xlorid kislota.',
          equation: 'choʻkma ustida: H₃O⁺ + Cl⁻ (xlorid kislota)',
          note: 'Bir litr suvda atigi 2,4 mg ga yaqin BaSO₄ eriydi (Ksp = 1,08·10⁻¹⁰, 25 °C da). «Ionlarga ajralmaydi» (9-sinf) degani «deyarli erimaydi»: kristallning oʻzi ionlardan iborat. Eritmada HCl molekulalari yoʻq — «2HCl» bu 2H₃O⁺ va 2Cl⁻.',
          speak: 'Oq choʻkma hatto kislotada ham yoʻqolmaydi — shuning uchun bariy xlorid sulfat kislota va sulfatlar uchun reaktiv.',
        },
      },
    },
    {
      id: 'result',
      level: 7,
      seconds: 5,
      show: ['кристаллик BaSO₄ и ионы H₃O⁺, Cl⁻ в воде', 'уравнение 7 кл. и сверка атомов', 'плашка 9 кл.: полное и сокращённое ионные уравнения'],
      sources: [T7_P67, T7_P142, T9_P6],
      text: {
        ru: {
          title: 'Итог: реакция обмена',
          body: 'Два сложных вещества обменялись составными частями: барий соединился с сульфатной группой, а ионы водорода и хлора остались в растворе поодиночке — это соляная кислота. Такие реакции называют реакциями обмена. Признак — белый осадок.',
          equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
          note: '9 класс: полное ионное уравнение Ba²⁺ + 2Cl⁻ + 2H⁺ + SO₄²⁻ → BaSO₄↓ + 2H⁺ + 2Cl⁻, сокращённое Ba²⁺ + SO₄²⁻ → BaSO₄↓. Слева и справа по 1 Ba, 2 Cl, 2 H, 1 S и 4 O.',
          speak: 'Барий и сульфат ушли в осадок, водород и хлор остались в растворе — вот и весь обмен.',
        },
        en: {
          title: 'Summary: an exchange reaction',
          body: 'Two compounds exchanged their parts: barium joined the sulfate group, while the hydrogen and chloride ions stayed separate in the solution — this is hydrochloric acid. Such reactions are called exchange reactions. The sign is a white precipitate.',
          equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
          note: 'Grade 9: the full ionic equation Ba²⁺ + 2Cl⁻ + 2H⁺ + SO₄²⁻ → BaSO₄↓ + 2H⁺ + 2Cl⁻, the short one Ba²⁺ + SO₄²⁻ → BaSO₄↓. On each side: 1 Ba, 2 Cl, 2 H, 1 S and 4 O.',
          speak: 'Barium and sulfate went into the precipitate, hydrogen and chlorine stayed in the solution — that is the whole exchange.',
        },
        uz: {
          title: 'Xulosa: almashinish reaksiyasi',
          body: 'Ikkita murakkab modda tarkibiy qismlari bilan almashdi: bariy sulfat guruhi bilan birikdi, vodorod va xlor ionlari esa eritmada alohida qoldi — bu xlorid kislota. Bunday reaksiyalar almashinish reaksiyalari deyiladi. Belgisi — oq choʻkma.',
          equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
          note: '9-sinf: toʻliq ionli tenglama Ba²⁺ + 2Cl⁻ + 2H⁺ + SO₄²⁻ → BaSO₄↓ + 2H⁺ + 2Cl⁻, qisqasi Ba²⁺ + SO₄²⁻ → BaSO₄↓. Chapda va oʻngda 1 Ba, 2 Cl, 2 H, 1 S va 4 O dan.',
          speak: 'Bariy va sulfat choʻkmaga oʻtdi, vodorod va xlor eritmada qoldi — almashinish shu.',
        },
      },
    },
  ],
  caveats: CAVEATS,
}

/** Источники сцены (для теста и панели): учебники по классам. */
export const BASO4_TEXTBOOK_REFS: readonly TextbookRef[] = [T7_P67, T8_P32, T9_P6, T9_P3, T9_P4, T9_P5, T8_P15, T8_P16, T8_P17, T8_P34, T7_P54, T7_P119, T7_P142, T7_P14]
export { SRC_SAFETY as BASO4_SAFETY_SOURCE }
