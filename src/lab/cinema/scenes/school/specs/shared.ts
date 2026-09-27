/**
 * Общие части спецификаций: атомы, частицы-реагенты (O₂, H₂, N₂, Cl₂, H₂O, SO₂, NO…) и ссылки на учебники.
 * Числа (заряды ядер, слои, длины) — из ядра через ./core.
 */
import { atomSpec } from './core'
import type { AtomSpec, ParticleSpec, TextbookRef } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Учебники (рус. издание Kimyo; номера страниц = страницы PDF)
// ─────────────────────────────────────────────────────────────────────────────

export const T7_VALENCE: TextbookRef = {
  grade: 7,
  pages: [51, 52],
  section: '§ 2.6',
  title: 'Химическая формула. Валентность',
  what: 'валентность — число связей атома (графическая формула воды); таблица: C, Si — II, IV; N — I, II, III, IV; S — II, IV, VI',
}

export const T7_VALENCE_EXERCISES: TextbookRef = {
  grade: 7,
  pages: [63],
  section: '§ 2.10',
  title: 'Выполнение упражнений по теме валентность',
  what: 'валентность по формуле оксида: число атомов O × 2 / число атомов элемента; «K (I), C (II), N (III), Si (IV), S (VI)»',
}

export const T7_STRUCTURAL_FORMULA: TextbookRef = {
  grade: 7,
  pages: [53],
  section: '§ 2.6',
  title: 'Химическая формула. Валентность',
  what: 'структурная (графическая) формула: каждая черта — валентность или пара электронов; шаростержневые модели H₂O, CO₂',
}

export const T7_OXYGEN_PROPS: TextbookRef = {
  grade: 7,
  pages: [95, 96],
  section: '§ 4.5',
  title: 'Химические свойства кислорода',
  what: 'S + O₂ → SO₂; C + O₂ → CO₂; 2H₂ + O₂ → 2H₂O (при нагревании); N₂ + O₂ → 2NO – Q; 2CO + O₂; 2SO₂ + O₂ (t, V₂O₅); 2NO + O₂ → 2NO₂',
}

export const T7_OXIDES: TextbookRef = {
  grade: 7,
  pages: [106, 107],
  section: '§ 4.10',
  title: 'Оксиды',
  what: 'названия оксидов (N₂O₅ — оксид азота (V), SO₃ — оксид серы (VI)); несолеобразующие N₂O, NO, CO; кислотные оксиды + вода → кислоты',
}

export const T8_LEVELS: TextbookRef = {
  grade: 8,
  pages: [41, 48],
  section: '§ 9, § 11',
  title: 'Строение электронных слоёв атомов; строение атомов элементов малых периодов',
  what: 'электроны на энергетических уровнях; таблица 1s² 2s² 2p… для Li…Ne и 3-го периода',
}

export const T8_COVALENT: TextbookRef = {
  grade: 8,
  pages: [66, 67, 68],
  section: '§ 15',
  title: 'Виды химической связи. Полярная и неполярная ковалентная связь',
  what: 'ковалентная связь — через общие электронные пары; O₂: O=O (у атома 2 неспаренных), N₂: N≡N (3 неспаренных); черта = общая пара; по числу пар — валентность',
}

export const T8_DATIVE: TextbookRef = {
  grade: 8,
  pages: [69, 70],
  section: '§ 15',
  title: 'Донорно-акцепторная связь',
  what: 'свободная электронная пара одного атома (донора) и свободная орбиталь другого (акцептора): NH₃ + H⁺ → NH₄⁺',
}

export const T8_IONIC: TextbookRef = {
  grade: 8,
  pages: [71, 72, 73],
  section: '§ 16',
  title: 'Ионная связь',
  what: 'Cl +17 2)8)7) принимает электрон → Cl⁻ 2)8)8); K отдаёт → K⁺; противоположно заряженные ионы притягиваются',
}

export const T9_CARBON_EXCITED: TextbookRef = {
  grade: 9,
  pages: [10],
  section: '§ 1',
  title: 'Повторение важнейших тем курса химии 8 класса (изменение свойств элементов в периодах и группах)',
  what: 'внешний слой углерода s²p², в возбуждённом состоянии s¹p³',
}

// ─────────────────────────────────────────────────────────────────────────────
// Атомы
// ─────────────────────────────────────────────────────────────────────────────

export const ATOM_H: AtomSpec = atomSpec('H', { unpaired: 1, config: '1s¹', schoolValences: [1] })
export const ATOM_O: AtomSpec = atomSpec('O', { unpaired: 2, config: '2s² 2p⁴', schoolValences: [2] })
export const ATOM_N: AtomSpec = atomSpec('N', { unpaired: 3, config: '2s² 2p³', schoolValences: [1, 2, 3, 4] })
export const ATOM_S: AtomSpec = atomSpec('S', { unpaired: 2, config: '3s² 3p⁴', schoolValences: [2, 4, 6] })
export const ATOM_NA: AtomSpec = atomSpec('Na', { unpaired: 1, config: '3s¹', schoolValences: [1] })
export const ATOM_CL: AtomSpec = atomSpec('Cl', { unpaired: 1, config: '3s² 3p⁵', schoolValences: [1, 3, 5, 7] })
export const ATOM_C: AtomSpec = atomSpec('C', {
  unpaired: 2,
  config: '2s² 2p²',
  schoolValences: [2, 4],
  excited: {
    config: '2s¹ 2p³',
    unpaired: 4,
    source: T9_CARBON_EXCITED,
    why: {
      ru: 'В основном состоянии у углерода два неспаренных электрона. Чтобы образовать четыре связи (CO₂, CH₄), один электрон 2s переходит на свободную 2p-орбиталь — неспаренных становится четыре. Затраты на это окупаются двумя лишними связями.',
      en: 'In its ground state carbon has two unpaired electrons. To form four bonds (CO₂, CH₄) one 2s electron moves to the empty 2p orbital, so four electrons become unpaired. The cost is repaid by the two extra bonds.',
      uz: 'Asosiy holatda uglerodda ikkita juftlashmagan elektron bor. Toʻrtta bogʻ hosil qilish uchun (CO₂, CH₄) bitta 2s elektron boʻsh 2p orbitalga oʻtadi — juftlashmagan elektronlar toʻrtta boʻladi. Bunga ketgan sarf ikkita qoʻshimcha bogʻ hisobiga qoplanadi.',
    },
  },
})

// ─────────────────────────────────────────────────────────────────────────────
// Частицы
// ─────────────────────────────────────────────────────────────────────────────

export const P_O2: ParticleSpec = {
  id: 'O2',
  formula: 'O₂',
  name: { ru: 'кислород', en: 'oxygen', uz: 'kislorod' },
  role: 'reactant',
  phase: 'г',
  kind: 'molecule',
  atoms: [
    { id: 'Oa', element: 'O' },
    { id: 'Ob', element: 'O' },
  ],
  bonds: [{ a: 'Oa', b: 'Ob', pairs: 2, polar: false, length: { bond: 'O=O' } }],
  lonePairs: { Oa: 2, Ob: 2 },
  unpaired: {},
  charge: 0,
  shape: 'diatomic',
  dipoleKey: 'O2',
  polarity: 'nonpolar',
  resonance: {
    show: {
      ru: 'Школьная формула O=O: две общие пары, у каждого атома две неподелённые пары.',
      en: 'School formula O=O: two shared pairs, two lone pairs on each atom.',
      uz: 'Maktab formulasi O=O: ikkita umumiy juft, har bir atomda ikkitadan boʻlinmagan juft.',
    },
    real: {
      ru: 'Порядок связи 2 верен, но на самом деле два электрона молекулы O₂ не спарены — поэтому жидкий кислород притягивается магнитом. Формула с чёрточками этого показать не может.',
      en: 'The bond order of 2 is right, but in reality two electrons of O₂ are unpaired — that is why liquid oxygen is attracted by a magnet. A dash formula cannot show this.',
      uz: 'Bogʻ tartibi 2 toʻgʻri, lekin aslida O₂ molekulasining ikkita elektroni juftlashmagan — shuning uchun suyuq kislorod magnitga tortiladi. Chiziqchali formula buni koʻrsata olmaydi.',
    },
  },
}

export const P_H2: ParticleSpec = {
  id: 'H2',
  formula: 'H₂',
  name: { ru: 'водород', en: 'hydrogen', uz: 'vodorod' },
  role: 'reactant',
  phase: 'г',
  kind: 'molecule',
  atoms: [
    { id: 'Ha', element: 'H' },
    { id: 'Hb', element: 'H' },
  ],
  bonds: [{ a: 'Ha', b: 'Hb', pairs: 1, polar: false, length: { bond: 'H-H' } }],
  lonePairs: {},
  unpaired: {},
  charge: 0,
  shape: 'diatomic',
  dipoleKey: 'H2',
  polarity: 'nonpolar',
}

export const P_N2: ParticleSpec = {
  id: 'N2',
  formula: 'N₂',
  name: { ru: 'азот', en: 'nitrogen', uz: 'azot' },
  role: 'reactant',
  phase: 'г',
  kind: 'molecule',
  atoms: [
    { id: 'Na1', element: 'N' },
    { id: 'Na2', element: 'N' },
  ],
  bonds: [{ a: 'Na1', b: 'Na2', pairs: 3, polar: false, length: { bond: 'N#N' } }],
  lonePairs: { Na1: 1, Na2: 1 },
  unpaired: {},
  charge: 0,
  shape: 'diatomic',
  dipoleKey: 'N2',
  polarity: 'nonpolar',
}

export const P_CL2: ParticleSpec = {
  id: 'Cl2',
  formula: 'Cl₂',
  name: { ru: 'хлор', en: 'chlorine', uz: 'xlor' },
  role: 'reactant',
  phase: 'г',
  kind: 'molecule',
  atoms: [
    { id: 'Cla', element: 'Cl' },
    { id: 'Clb', element: 'Cl' },
  ],
  bonds: [{ a: 'Cla', b: 'Clb', pairs: 1, polar: false, length: { bond: 'Cl-Cl' } }],
  lonePairs: { Cla: 3, Clb: 3 },
  unpaired: {},
  charge: 0,
  shape: 'diatomic',
  dipoleKey: 'Cl2',
  polarity: 'nonpolar',
}

export const P_H2O: ParticleSpec = {
  id: 'H2O',
  formula: 'H₂O',
  name: { ru: 'вода', en: 'water', uz: 'suv' },
  role: 'product',
  phase: 'ж',
  kind: 'molecule',
  atoms: [
    { id: 'Ow', element: 'O' },
    { id: 'Hw1', element: 'H' },
    { id: 'Hw2', element: 'H' },
  ],
  bonds: [
    { a: 'Ow', b: 'Hw1', pairs: 1, polar: true, length: { bond: 'O-H' } },
    { a: 'Ow', b: 'Hw2', pairs: 1, polar: true, length: { bond: 'O-H' } },
  ],
  lonePairs: { Ow: 2 },
  unpaired: {},
  charge: 0,
  shape: 'bent',
  angles: [{ atoms: ['Hw1', 'Ow', 'Hw2'], ref: { angle: 'water' } }],
  dipoleKey: 'H2O',
  polarity: 'polar',
}

export const P_SO2: ParticleSpec = {
  id: 'SO2',
  formula: 'SO₂',
  name: { ru: 'оксид серы(IV), сернистый газ', en: 'sulfur(IV) oxide, sulfur dioxide', uz: 'oltingugurt(IV) oksidi' },
  role: 'product',
  phase: 'г',
  kind: 'molecule',
  atoms: [
    { id: 'S', element: 'S' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
  ],
  bonds: [
    { a: 'S', b: 'O1', pairs: 2, polar: true, length: { bond: 'S=O' } },
    { a: 'S', b: 'O2', pairs: 2, polar: true, length: { bond: 'S=O' } },
  ],
  lonePairs: { S: 1, O1: 2, O2: 2 },
  unpaired: {},
  charge: 0,
  shape: 'bent',
  angles: [{ atoms: ['O1', 'S', 'O2'], ref: { angle: 'sulfurDioxide' } }],
  dipoleKey: 'SO2',
  polarity: 'polar',
  resonance: {
    show: {
      ru: 'Показываем O=S=O: у серы валентность IV (две двойные связи) и одна неподелённая пара, из-за которой молекула изогнута.',
      en: 'We show O=S=O: sulfur has valence IV (two double bonds) and one lone pair, which bends the molecule.',
      uz: 'O=S=O koʻrsatiladi: oltingugurtning valentligi IV (ikkita qoʻsh bogʻ) va bitta boʻlinmagan jufti bor, shu juft molekulani egadi.',
    },
    real: {
      ru: 'Обе связи S–O одинаковые (одна длина), но «чистыми» двойными их считать нельзя: они сильно полярны, и часть электронной плотности смещена к кислороду. Формулу O=S=O используют как удобную модель; альтернативная запись — наложение структур с одинарной и двойной связью.',
      en: 'Both S–O bonds are identical (one length), yet they are not «pure» double bonds: they are strongly polar and part of the electron density is shifted to oxygen. O=S=O is a convenient model; the alternative is a blend of structures with one single and one double bond.',
      uz: 'Ikkala S–O bogʻi bir xil (uzunligi bitta), lekin ularni «sof» qoʻsh bogʻ deb boʻlmaydi: ular kuchli qutbli, elektron zichligining bir qismi kislorodga siljigan. O=S=O — qulay model; boshqa yozuv — bitta oddiy va bitta qoʻsh bogʻli tuzilmalarning ustma-ust tushishi.',
    },
  },
}

export const P_NO: ParticleSpec = {
  id: 'NO',
  formula: 'NO',
  name: { ru: 'оксид азота(II)', en: 'nitrogen(II) oxide, nitric oxide', uz: 'azot(II) oksidi' },
  role: 'product',
  phase: 'г',
  kind: 'molecule',
  atoms: [
    { id: 'N', element: 'N' },
    { id: 'O', element: 'O' },
  ],
  bonds: [{ a: 'N', b: 'O', pairs: 2, realOrder: 2.5, polar: true, length: { bond: 'N=O' } }],
  lonePairs: { N: 1, O: 2 },
  unpaired: { N: 1 },
  charge: 0,
  shape: 'diatomic',
  dipoleKey: 'NO',
  polarity: 'polar',
  resonance: {
    show: {
      ru: 'Показываем N=O: две общие пары, у азота одна неподелённая пара и один неспаренный электрон.',
      en: 'We show N=O: two shared pairs; nitrogen has one lone pair and one unpaired electron.',
      uz: 'N=O koʻrsatiladi: ikkita umumiy juft, azotda bitta boʻlinmagan juft va bitta juftlashmagan elektron.',
    },
    real: {
      ru: 'В молекуле 11 внешних электронов — нечётное число, поэтому один электрон обязательно без пары. Он не сидит только на азоте: он «размазан» по обоим атомам и частично связывает их, поэтому связь прочнее двойной — её порядок два с половиной.',
      en: 'The molecule has 11 outer electrons — an odd number, so one electron must stay unpaired. It does not sit on nitrogen alone: it is spread over both atoms and partly bonds them, so the bond is stronger than a double one — its order is two and a half.',
      uz: 'Molekulada 11 ta tashqi elektron bor — toq son, shuning uchun bitta elektron albatta juftsiz qoladi. U faqat azotda turmaydi: ikkala atom boʻylab «yoyilgan» va ularni qisman bogʻlaydi, shuning uchun bogʻ qoʻsh bogʻdan mustahkamroq — uning tartibi ikki yarim.',
    },
  },
}

/** Один атом углерода из графита (угля) — схема. */
export const P_C_GRAPHITE: ParticleSpec = {
  id: 'C',
  formula: 'C',
  name: { ru: 'углерод (уголь, графит)', en: 'carbon (charcoal, graphite)', uz: 'uglerod (koʻmir, grafit)' },
  role: 'reactant',
  phase: 'тв',
  kind: 'atom-sample',
  atoms: [{ id: 'C', element: 'C' }],
  bonds: [],
  lonePairs: { C: 1 },
  unpaired: { C: 2 },
  charge: 0,
  shape: 'atom',
  polarity: 'nonpolar',
  schematic: {
    ru: 'В сцене — один атом углерода. Настоящий уголь и графит — твёрдые вещества: слои из атомов C, каждый связан с тремя соседями.',
    en: 'The scene shows one carbon atom. Real charcoal and graphite are solids: layers of C atoms, each bonded to three neighbours.',
    uz: 'Sahnada bitta uglerod atomi. Haqiqiy koʻmir va grafit qattiq moddalar: C atomlaridan iborat qatlamlar, har bir atom uchta qoʻshnisi bilan bogʻlangan.',
  },
}

/** Один атом серы из кольца S₈ — схема. */
export const P_S_SOLID: ParticleSpec = {
  id: 'S',
  formula: 'S',
  name: { ru: 'сера', en: 'sulfur', uz: 'oltingugurt' },
  role: 'reactant',
  phase: 'тв',
  kind: 'atom-sample',
  atoms: [{ id: 'S', element: 'S' }],
  bonds: [],
  lonePairs: { S: 2 },
  unpaired: { S: 2 },
  charge: 0,
  shape: 'atom',
  polarity: 'nonpolar',
  schematic: {
    ru: 'В сцене — один атом серы. Твёрдая сера состоит из колец по восемь атомов S₈; при горении связи S–S рвутся.',
    en: 'The scene shows one sulfur atom. Solid sulfur is made of rings of eight atoms, S₈; on burning the S–S bonds break.',
    uz: 'Sahnada bitta oltingugurt atomi. Qattiq oltingugurt sakkiz atomli S₈ halqalaridan iborat; yonishda S–S bogʻlari uziladi.',
  },
}

export const P_NA_METAL: ParticleSpec = {
  id: 'Na',
  formula: 'Na',
  name: { ru: 'натрий', en: 'sodium', uz: 'natriy' },
  role: 'reactant',
  phase: 'тв',
  kind: 'metal',
  atoms: [{ id: 'Na', element: 'Na' }],
  bonds: [],
  lonePairs: {},
  unpaired: {},
  delocalized: { Na: 1 },
  charge: 0,
  shape: 'lattice',
  polarity: 'metallic',
  schematic: {
    ru: 'Металл натрий: атомы уложены в решётку, их внешние электроны общие для всего кусочка металла.',
    en: 'Sodium metal: atoms are packed in a lattice, their outer electrons are shared by the whole piece of metal.',
    uz: 'Natriy metali: atomlar panjaraga joylashgan, ularning tashqi elektronlari butun metall boʻlagi uchun umumiy.',
  },
}
