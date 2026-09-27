/**
 * N₂O — NH₄NO₃ → N₂O + 2H₂O (Kimyo 8, § 39, с. 168). Запись 7 кл. (§ 4.8, с. 102) «N₂ + O₃ = N₂O + O₂» на деле
 * не идёт — она в оговорках. Молекула линейная и НЕсимметричная: N–N–O (ядро: 'N-N(N2O)' 112,8 пм,
 * 'N-O(N2O)' 118,4 пм, угол 180°). Показанная структура N≡N→O: тройная связь и донорно-акцепторная пара от
 * центрального азота к кислороду. Концевой N — из иона аммония, центральный — из нитрат-иона (метка ¹⁵N).
 */
import { ref } from './core'
import { ATOM_H, ATOM_N, ATOM_O, P_H2O, T7_OXIDES, T7_VALENCE_EXERCISES, T8_DATIVE, T8_LEVELS } from './shared'
import type { ParticleSpec, SchoolSceneSpec, TextbookRef } from './types'

const T8_AMMONIUM_NITRATE: TextbookRef = {
  grade: 8,
  pages: [167, 168],
  section: '§ 39',
  title: 'Азотная кислота',
  what: 'NH₃ + HNO₃ = NH₄NO₃ (с. 167); «при расщеплении нитрата аммония образуется оксид азота(I)»: NH₄NO₃ → N₂O + 2H₂O при нагревании (с. 168)',
}

const T7_OZONE: TextbookRef = {
  grade: 7,
  pages: [102],
  section: '§ 4.8',
  title: 'Озон и его применение',
  what: 'реакции озона с неметаллами: «N₂ + O₃ = N₂O + O₂»',
  asInBook: 'N₂ + O₃ = N₂O + O₂',
}

const P_NH4NO3: ParticleSpec = {
  id: 'NH4NO3',
  formula: 'NH₄NO₃',
  name: { ru: 'нитрат аммония (аммиачная селитра)', en: 'ammonium nitrate', uz: 'ammoniy nitrat (ammiakli selitra)' },
  role: 'reactant',
  phase: 'тв',
  kind: 'ionic-crystal',
  atoms: [
    { id: 'Nam', element: 'N', charge: 1 },
    { id: 'H1', element: 'H' },
    { id: 'H2', element: 'H' },
    { id: 'H3', element: 'H' },
    { id: 'H4', element: 'H' },
    { id: 'Nni', element: 'N', charge: 1 },
    { id: 'Ox1', element: 'O' },
    { id: 'Ox2', element: 'O', charge: -1 },
    { id: 'Ox3', element: 'O', charge: -1 },
  ],
  bonds: [
    { a: 'Nam', b: 'H1', pairs: 1, polar: true, length: { bond: 'N-H' } },
    { a: 'Nam', b: 'H2', pairs: 1, polar: true, length: { bond: 'N-H' } },
    { a: 'Nam', b: 'H3', pairs: 1, polar: true, length: { bond: 'N-H' } },
    { a: 'Nam', b: 'H4', pairs: 1, polar: true, length: { bond: 'N-H' } },
    { a: 'Nni', b: 'Ox1', pairs: 2, realOrder: 4 / 3, polar: true, length: { reagent: 'n2o5Crystal', name: 'N–O(NO₃⁻)' } },
    { a: 'Nni', b: 'Ox2', pairs: 1, realOrder: 4 / 3, polar: true, length: { reagent: 'n2o5Crystal', name: 'N–O(NO₃⁻)' } },
    { a: 'Nni', b: 'Ox3', pairs: 1, realOrder: 4 / 3, polar: true, length: { reagent: 'n2o5Crystal', name: 'N–O(NO₃⁻)' } },
  ],
  lonePairs: { Ox1: 2, Ox2: 3, Ox3: 3 },
  unpaired: {},
  charge: 0,
  shape: 'ions',
  angles: [
    { atoms: ['H1', 'Nam', 'H2'], ref: { angle: 'tetrahedral' } },
    { atoms: ['Ox1', 'Nni', 'Ox2'], ref: { reagent: 'n2o5Crystal', name: '∠O–N–O(NO₃⁻)' } },
  ],
  polarity: 'ionic',
  schematic: {
    ru: 'Одна пара ионов: тетраэдр NH₄⁺ и плоский треугольник NO₃⁻. Длины N–H взяты как в аммиаке, N–O — как в нитрат-ионе кристалла N₂O₅: это схема строения ионов, а не расстояния в кристалле селитры.',
    en: 'One pair of ions: the NH₄⁺ tetrahedron and the flat NO₃⁻ triangle. N–H lengths are taken as in ammonia, N–O as in the nitrate ion of the N₂O₅ crystal: a scheme of the ions, not distances in the ammonium nitrate crystal.',
    uz: 'Bir juft ion: NH₄⁺ tetraedri va yassi NO₃⁻ uchburchagi. N–H uzunliklari ammiakdagidek, N–O esa N₂O₅ kristalidagi nitrat ionidagidek olingan: bu selitra kristalidagi masofalar emas, ionlar tuzilishining sxemasi.',
  },
  resonance: {
    show: {
      ru: 'В нитрат-ионе рисуем три одинаковые связи N–O (чёрта + пунктир).',
      en: 'In the nitrate ion we draw three identical N–O bonds (a line plus a dashed line).',
      uz: 'Nitrat ionida uchta bir xil N–O bogʻi chiziladi (chiziq + punktir).',
    },
    real: {
      ru: 'Все три связи N–O нитрат-иона одинаковы: одна «двойная» распределена между тремя кислородами.',
      en: 'All three N–O bonds of the nitrate ion are identical: one «double» bond is shared among the three oxygens.',
      uz: 'Nitrat ionining uchala N–O bogʻi bir xil: bitta «qoʻsh» bogʻ uchta kislorod orasida taqsimlangan.',
    },
  },
}

const P_N2O: ParticleSpec = {
  id: 'N2O',
  formula: 'N₂O',
  name: { ru: 'оксид азота(I), «веселящий газ»', en: 'nitrogen(I) oxide, nitrous oxide («laughing gas»)', uz: 'azot(I) oksidi, «kuldiruvchi gaz»' },
  role: 'product',
  phase: 'г',
  kind: 'molecule',
  // формальные заряды N≡N⁺–O⁻ — не рисуются в 7 классе
  atoms: [
    { id: 'N1', element: 'N' },
    { id: 'N2', element: 'N', charge: 1 },
    { id: 'O', element: 'O', charge: -1 },
  ],
  bonds: [
    { a: 'N1', b: 'N2', pairs: 3, polar: false, length: { bond: 'N-N(N2O)' } },
    { a: 'N2', b: 'O', pairs: 1, dative: { donor: 'N2' }, polar: true, length: { bond: 'N-O(N2O)' } },
  ],
  lonePairs: { N1: 1, O: 3 },
  unpaired: {},
  charge: 0,
  shape: 'linear',
  angles: [{ atoms: ['N1', 'N2', 'O'], ref: { angle: 'nitrousOxide' } }],
  dipoleKey: 'N2O',
  polarity: 'polar',
  resonance: {
    show: {
      ru: 'Показываем N≡N→O: между атомами азота три общие пары, к кислороду — донорно-акцепторная пара центрального азота.',
      en: 'We show N≡N→O: three shared pairs between the nitrogen atoms and a donor-acceptor pair from the central nitrogen to oxygen.',
      uz: 'N≡N→O koʻrsatiladi: azot atomlari orasida uchta umumiy juft, kislorodga esa markaziy azotning donor-akseptor jufti.',
    },
    real: {
      ru: 'Настоящие связи промежуточные: N–N (112,8 пм) — между двойной и тройной, N–O (118,4 пм) — между одинарной и двойной. Молекулу описывают наложением двух структур: N≡N–O и N=N=O.',
      en: 'The real bonds are in between: N–N (112.8 pm) lies between double and triple, N–O (118.4 pm) between single and double. The molecule is described as a blend of two structures: N≡N–O and N=N=O.',
      uz: 'Haqiqiy bogʻlar oraliq: N–N (112,8 pm) — qoʻsh va uchlamchi oraligʻida, N–O (118,4 pm) — oddiy va qoʻsh oraligʻida. Molekula ikki tuzilmaning ustma-ust tushishi bilan tasvirlanadi: N≡N–O va N=N=O.',
    },
  },
}

export const N2O_SPEC: SchoolSceneSpec = {
  id: 'n2o',
  substance: 'N₂O',
  focus: 'N2O',
  name: { ru: 'Оксид азота(I)', en: 'Nitrogen(I) oxide', uz: 'Azot(I) oksidi' },
  bondType: 'covalent-polar',
  reaction: {
    equation: 'NH₄NO₃ → N₂O + 2H₂O',
    reactants: [{ formula: 'NH₄NO₃', coef: 1, phase: 'тв', particle: 'NH4NO3' }],
    products: [
      { formula: 'N₂O', coef: 1, phase: 'г', particle: 'N2O' },
      { formula: 'H₂O', coef: 2, phase: 'г', particle: 'H2O' },
    ],
    reversible: false,
    kind: 'decomposition',
    bankId: null,
    sources: [T8_AMMONIUM_NITRATE, T7_OZONE],
    conditions: {
      heating: true,
      text: {
        ru: 'осторожное нагревание небольшой порции нитрата аммония',
        en: 'careful heating of a small portion of ammonium nitrate',
        uz: 'ammoniy nitratning kichik porsiyasini ehtiyotkorlik bilan qizdirish',
      },
    },
    heat: 'exo',
    heatSource: ref('NIST-JANAF / CRC: ΔH°f(NH₄NO₃, тв) = −365,6; N₂O (г) +82,1; H₂O (г) −241,8 кДж/моль → реакция экзотермична'),
  },
  atoms: [ATOM_N, ATOM_H, ATOM_O],
  particles: [P_NH4NO3, P_N2O, { ...P_H2O, phase: 'г' }],
  mechanism: {
    breaks: [
      ...(['H1', 'H2', 'H3', 'H4'] as const).map((h) => ({
        particle: 'NH4NO3',
        a: 'Nam',
        b: h,
        why: { ru: 'ион аммония отдаёт атомы водорода', en: 'the ammonium ion gives up its hydrogen atoms', uz: 'ammoniy ioni vodorod atomlarini beradi' },
      })),
      ...(['Ox2', 'Ox3'] as const).map((o) => ({
        particle: 'NH4NO3',
        a: 'Nni',
        b: o,
        why: { ru: 'нитрат-ион отдаёт два атома кислорода', en: 'the nitrate ion gives up two oxygen atoms', uz: 'nitrat ioni ikkita kislorod atomini beradi' },
      })),
    ],
    kept: [
      { particle: 'NH4NO3', a: 'Nni', b: 'Ox1', why: { ru: 'одна связь N–O нитрата сохраняется', en: 'one N–O bond of the nitrate is kept', uz: 'nitratning bitta N–O bogʻi saqlanadi' } },
      { particle: 'N2O', a: 'N2', b: 'O', why: { ru: 'кислород остаётся у «нитратного» азота', en: 'the oxygen stays on the «nitrate» nitrogen', uz: 'kislorod «nitrat» azotida qoladi' } },
    ],
    forms: [
      {
        particle: 'N2O',
        a: 'N1',
        b: 'N2',
        how: 'shared-pair',
        why: {
          ru: 'азот иона аммония и азот нитрат-иона соединяются тремя общими парами',
          en: 'the nitrogen of the ammonium ion and the nitrogen of the nitrate ion join with three shared pairs',
          uz: 'ammoniy ioni azoti va nitrat ioni azoti uchta umumiy juft bilan birikadi',
        },
      },
      {
        particle: 'H2O',
        a: 'Ow',
        b: 'Hw1',
        how: 'shared-pair',
        why: { ru: 'водород аммония + кислород нитрата → вода', en: 'ammonium hydrogen + nitrate oxygen → water', uz: 'ammoniy vodorodi + nitrat kislorodi → suv' },
      },
      {
        particle: 'H2O',
        a: 'Ow',
        b: 'Hw2',
        how: 'shared-pair',
        why: { ru: 'вторая связь O–H воды', en: 'the second O–H bond of water', uz: 'suvning ikkinchi O–H bogʻi' },
      },
    ],
  },
  valence: {
    particle: 'N2O',
    school: { N: 1, O: 2 },
    schoolSource: T7_VALENCE_EXERCISES,
    oxidation: { N: 1, O: -2 },
    verdict: { N: 'formal', O: 'formal' },
    explain: {
      ru: 'По формуле N₂O валентность азота выходит I — как будто кислород стоит посередине и связан с двумя атомами азота (N–O–N). На деле порядок атомов N–N–O: концевой азот образует три связи, центральный — четыре, у кислорода одна. «I» — средняя степень окисления азота +1 (у концевого 0, у центрального +2).',
      en: 'From the formula N₂O the valence of nitrogen comes out as I — as if oxygen were in the middle, bonded to two nitrogen atoms (N–O–N). In reality the atom order is N–N–O: the end nitrogen forms three bonds, the central one four, oxygen one. «I» is the average oxidation state of nitrogen, +1 (0 at the end nitrogen, +2 at the central one).',
      uz: 'N₂O formulasi boʻyicha azot valentligi I chiqadi — goʻyo kislorod oʻrtada turib, ikki azot atomi bilan bogʻlangandek (N–O–N). Aslida atomlar tartibi N–N–O: chetki azot uchta bogʻ, markaziy azot toʻrtta bogʻ hosil qiladi, kislorodda bitta bogʻ. «I» — azotning oʻrtacha +1 oksidlanish darajasi (chetkisida 0, markaziysida +2).',
    },
  },
  observations: [
    {
      text: {
        ru: 'Оксид азота(I) — бесцветный газ со слабым сладковатым запахом («веселящий газ»). Тлеющая лучинка в нём вспыхивает — почти как в кислороде.',
        en: 'Nitrogen(I) oxide is a colourless gas with a faint sweetish smell («laughing gas»). A glowing splint flares up in it — almost as in oxygen.',
        uz: 'Azot(I) oksidi — kuchsiz shirinroq hidli rangsiz gaz («kuldiruvchi gaz»). Choʻgʻlangan choʻp unda alangalanadi — xuddi kisloroddagidek.',
      },
      source: ref('Greenwood & Earnshaw, «Chemistry of the Elements», 2nd ed. (1997), гл. 11 (оксиды азота)'),
    },
    {
      text: {
        ru: 'N₂O — несолеобразующий оксид.',
        en: 'N₂O is a non-salt-forming oxide.',
        uz: 'N₂O — tuz hosil qilmaydigan oksid.',
      },
      source: T7_OXIDES,
    },
    {
      text: {
        ru: 'Нитрат аммония — белое кристаллическое вещество, азотное удобрение; его получают из аммиака и азотной кислоты: NH₃ + HNO₃ → NH₄NO₃.',
        en: 'Ammonium nitrate is a white crystalline substance, a nitrogen fertilizer; it is made from ammonia and nitric acid: NH₃ + HNO₃ → NH₄NO₃.',
        uz: 'Ammoniy nitrat — oq kristall modda, azotli oʻgʻit; u ammiak va nitrat kislotadan olinadi: NH₃ + HNO₃ → NH₄NO₃.',
      },
      source: T8_AMMONIUM_NITRATE,
    },
  ],
  uses: [
    {
      text: {
        ru: 'В смеси с кислородом — для обезболивания в медицине; в баллончиках для взбитых сливок.',
        en: 'Mixed with oxygen — for pain relief in medicine; in whipped-cream canisters.',
        uz: 'Kislorod bilan aralashmada — tibbiyotda ogʻriqsizlantirish uchun; koʻpirtirilgan qaymoq ballonchalarida.',
      },
      source: ref('Greenwood & Earnshaw (1997), гл. 11'),
    },
  ],
  intro: {
    title: { ru: 'Веселящий газ', en: 'Laughing gas', uz: 'Kuldiruvchi gaz' },
    speak: {
      ru: 'Посмотрим, как из удобрения — нитрата аммония — получается оксид азота один и почему его формулу пишут N₂O, а атомы стоят в порядке N–N–O.',
      en: 'Let us see how a fertilizer, ammonium nitrate, gives nitrogen one oxide, and why its formula is N₂O while the atoms stand in the order N–N–O.',
      uz: 'Oʻgʻit — ammoniy nitratdan azot bir oksidi qanday olinishini va uning formulasi N₂O boʻlsa-da, atomlar nega N–N–O tartibida turishini koʻramiz.',
    },
  },
  safety: {
    ru: 'Нитрат аммония при сильном нагревании или в большом количестве может взорваться. Опыт проводит только учитель, с маленькой порцией и под тягой.',
    en: 'Ammonium nitrate can explode when strongly heated or in large amounts. Only the teacher does the experiment, with a small portion and in a fume hood.',
    uz: 'Ammoniy nitrat kuchli qizdirilganda yoki koʻp miqdorda portlashi mumkin. Tajribani faqat oʻqituvchi, kichik porsiya bilan va tortuv shkafida oʻtkazadi.',
  },
  steps: [
    {
      id: 'reactants',
      level: 8,
      seconds: 5,
      show: ['пара ионов: тетраэдр NH₄⁺ (N в центре, 4 H) и плоский треугольник NO₃⁻', 'подписи зарядов ионов «+» и «−»; подпись «NH₄NO₃»'],
      text: {
        ru: {
          title: 'Исходное вещество',
          body: 'Нитрат аммония NH₄NO₃ — белое кристаллическое вещество, азотное удобрение. Он состоит из ионов: аммония NH₄⁺ и нитрата NO₃⁻. В каждом ионе есть атом азота, но устроены эти атомы по-разному: один окружён водородами, другой — кислородами.',
          equation: 'NH₄NO₃',
          note: 'Показана одна пара ионов. В учебнике 7 класса (с. 102) N₂O получают из азота и озона — такая реакция на деле не идёт, поэтому сцена берёт способ из учебника 8 класса (с. 168).',
          speak: 'Нитрат аммония — два иона. В каждом по атому азота.',
        },
        en: {
          title: 'The starting substance',
          body: 'Ammonium nitrate NH₄NO₃ is a white crystalline substance, a nitrogen fertilizer. It consists of ions: ammonium NH₄⁺ and nitrate NO₃⁻. Each ion has a nitrogen atom, but these atoms are arranged differently: one is surrounded by hydrogens, the other by oxygens.',
          equation: 'NH₄NO₃',
          note: 'One pair of ions is shown. The grade 7 textbook (p. 102) obtains N₂O from nitrogen and ozone — that reaction does not really happen, so the scene takes the method from the grade 8 textbook (p. 168).',
          speak: 'Ammonium nitrate is two ions. Each has one nitrogen atom.',
        },
        uz: {
          title: 'Dastlabki modda',
          body: 'Ammoniy nitrat NH₄NO₃ — oq kristall modda, azotli oʻgʻit. U ionlardan iborat: ammoniy NH₄⁺ va nitrat NO₃⁻. Har bir ionda azot atomi bor, lekin bu atomlar turlicha joylashgan: biri vodorodlar bilan, ikkinchisi kislorodlar bilan oʻralgan.',
          equation: 'NH₄NO₃',
          note: 'Bir juft ion koʻrsatilgan. 7-sinf darsligida (102-bet) N₂O azot va ozondan olinadi — bunday reaksiya aslida bormaydi, shuning uchun sahna 8-sinf darsligidagi usulni oladi (168-bet).',
          speak: 'Ammoniy nitrat — ikkita ion. Har birida bittadan azot atomi.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5,
      show: ['облака внешнего слоя N (5), H (1), O (6)', 'схема N (+7): 2, 5; H (+1): 1; O (+8): 2, 6'],
      sources: [T8_LEVELS],
      text: {
        ru: {
          title: 'Строение атомов',
          body: 'Заряд ядра азота +7, электроны: 2, 5 — три неспаренных электрона и одна пара. Водород +1: один электрон. Кислород +8: 2, 6 — два неспаренных электрона и две пары. Азот в ионе аммония связан с четырьмя водородами, азот в нитрат-ионе — с тремя кислородами.',
          equation: 'N (+7): 2, 5      H (+1): 1      O (+8): 2, 6',
          note: 'Строение слоёв — материал 8 класса. Два атома азота подсвечены разными оттенками, чтобы было видно, откуда какой пришёл.',
          speak: 'Следим за двумя атомами азота: один из аммония, другой из нитрата.',
        },
        en: {
          title: 'Structure of the atoms',
          body: 'The nuclear charge of nitrogen is +7, electrons: 2, 5 — three unpaired electrons and one pair. Hydrogen +1: one electron. Oxygen +8: 2, 6 — two unpaired electrons and two pairs. The nitrogen in the ammonium ion is bonded to four hydrogens, the nitrogen in the nitrate ion to three oxygens.',
          equation: 'N (+7): 2, 5      H (+1): 1      O (+8): 2, 6',
          note: 'Electron shells are grade 8 material. The two nitrogen atoms are lit in different shades so that you can see where each came from.',
          speak: 'Watch the two nitrogen atoms: one from ammonium, the other from nitrate.',
        },
        uz: {
          title: 'Atomlar tuzilishi',
          body: 'Azot yadrosining zaryadi +7, elektronlari: 2, 5 — uchta juftlashmagan elektron va bitta juft. Vodorod +1: bitta elektron. Kislorod +8: 2, 6 — ikkita juftlashmagan elektron va ikkita juft. Ammoniy ionidagi azot toʻrtta vodorod bilan, nitrat ionidagi azot esa uchta kislorod bilan bogʻlangan.',
          equation: 'N (+7): 2, 5      H (+1): 1      O (+8): 2, 6',
          note: 'Pogʻonalar tuzilishi — 8-sinf materiali. Ikki azot atomi qayerdan kelganini koʻrish uchun turli tuslarda ajratilgan.',
          speak: 'Ikki azot atomini kuzatamiz: biri ammoniydan, ikkinchisi nitratdan.',
        },
      },
    },
    {
      id: 'breaking',
      level: 8,
      seconds: 5,
      show: ['четыре черты N–H гаснут, атомы H отходят', 'две связи N–O нитрата гаснут, два атома O отходят; одна N–O остаётся'],
      text: {
        ru: {
          title: 'При нагревании связи рвутся',
          body: 'При нагревании ион аммония теряет все четыре атома водорода, а нитрат-ион — два из трёх атомов кислорода. Одна связь N–O нитрата сохраняется. Освободившиеся атомы водорода и кислорода соберутся в две молекулы воды.',
          equation: 'NH₄NO₃ → N + NO + 4H + 2O',
          note: 'Схема подсчёта атомов. На деле в расплаве сначала ион NH₄⁺ передаёт ион водорода нитрат-иону, и дальше реагируют аммиак и азотная кислота; свободных атомов не бывает.',
          speak: 'Водороды уходят от одного азота, два кислорода — от другого.',
        },
        en: {
          title: 'Bonds break on heating',
          body: 'On heating the ammonium ion loses all four hydrogen atoms, and the nitrate ion loses two of its three oxygen atoms. One N–O bond of the nitrate is kept. The freed hydrogen and oxygen atoms will gather into two water molecules.',
          equation: 'NH₄NO₃ → N + NO + 4H + 2O',
          note: 'A scheme for counting atoms. In reality, in the melt the NH₄⁺ ion first passes a hydrogen ion to the nitrate ion, and then ammonia and nitric acid react; there are no free atoms.',
          speak: 'The hydrogens leave one nitrogen, two oxygens leave the other.',
        },
        uz: {
          title: 'Qizdirilganda bogʻlar uziladi',
          body: 'Qizdirilganda ammoniy ioni toʻrttala vodorod atomini, nitrat ioni esa uchta kislorod atomidan ikkitasini yoʻqotadi. Nitratning bitta N–O bogʻi saqlanadi. Boʻshagan vodorod va kislorod atomlari ikkita suv molekulasiga yigʻiladi.',
          equation: 'NH₄NO₃ → N + NO + 4H + 2O',
          note: 'Atomlarni sanash sxemasi. Aslida suyuqlanmada avval NH₄⁺ ioni nitrat ioniga vodorod ionini beradi, soʻng ammiak va nitrat kislota reaksiyaga kirishadi; erkin atomlar boʻlmaydi.',
          speak: 'Vodorodlar bir azotdan, ikkita kislorod esa boshqasidan ketadi.',
        },
      },
    },
    {
      id: 'bonding',
      level: 8,
      seconds: 6.5,
      show: ['азот из NH₄⁺ и азот из NO₃⁻ сходятся: три пары между ними (N≡N)', 'у «нитратного» азота к кислороду — стрелка N→O (пару отдал азот)', 'атомы H и O собираются в две молекулы H₂O'],
      sources: [T8_DATIVE],
      text: {
        ru: {
          title: 'Азот соединяется с азотом',
          body: 'Азот из иона аммония и азот из нитрат-иона соединяются тремя общими парами — тройная связь N≡N, как в молекуле азота. У «нитратного» азота остался один кислород: с ним азот связан парой, которую отдал сам, — донорно-акцепторной связью. Атомы водорода и кислорода образуют две молекулы воды.',
          equation: 'N + NO → N₂O      4H + 2O → 2H₂O',
          note: 'Опыты с «мечеными» атомами азота показали: концевой атом N в N₂O пришёл из иона аммония, центральный — из нитрат-иона. Стрелка N→O показывает, что обе точки пары — от азота.',
          speak: 'Два разных атома азота нашли друг друга и связались тройной связью.',
        },
        en: {
          title: 'Nitrogen joins nitrogen',
          body: 'The nitrogen from the ammonium ion and the nitrogen from the nitrate ion join with three shared pairs — an N≡N triple bond, as in the nitrogen molecule. The «nitrate» nitrogen keeps one oxygen: it is bonded to it by a pair it gave itself — a donor-acceptor bond. The hydrogen and oxygen atoms form two water molecules.',
          equation: 'N + NO → N₂O      4H + 2O → 2H₂O',
          note: 'Experiments with «labelled» nitrogen atoms showed: the end N atom of N₂O came from the ammonium ion, the central one from the nitrate ion. The arrow N→O shows that both dots of the pair are from nitrogen.',
          speak: 'Two different nitrogen atoms have found each other and joined with a triple bond.',
        },
        uz: {
          title: 'Azot azot bilan birikadi',
          body: 'Ammoniy ionidagi azot va nitrat ionidagi azot uchta umumiy juft bilan birikadi — xuddi azot molekulasidagidek N≡N uchlamchi bogʻ. «Nitrat» azotida bitta kislorod qoldi: azot u bilan oʻzi bergan juft orqali — donor-akseptor bogʻ bilan bogʻlangan. Vodorod va kislorod atomlari ikkita suv molekulasini hosil qiladi.',
          equation: 'N + NO → N₂O      4H + 2O → 2H₂O',
          note: '«Nishonlangan» azot atomlari bilan tajribalar koʻrsatdi: N₂O dagi chetki N atomi ammoniy ionidan, markaziysi esa nitrat ionidan kelgan. N→O strelka juftning ikkala nuqtasi azotdan ekanini koʻrsatadi.',
          speak: 'Ikki xil azot atomi bir-birini topdi va uchlamchi bogʻ bilan birikdi.',
        },
      },
    },
    {
      id: 'product',
      level: 8,
      seconds: 5.5,
      show: ['линейная молекула N–N–O, дуга 180°', 'длины N–N 112,8 пм и N–O 118,4 пм; кислород — с краю'],
      text: {
        ru: {
          title: 'Молекула оксида азота(I)',
          body: 'Молекула N₂O прямая: атомы стоят в порядке N–N–O, угол 180°. Кислород находится с краю, а не посередине. Молекула несимметричная, поэтому немного полярная. Длины связей: N–N — 112,8 пм, N–O — 118,4 пм.',
          equation: 'N–N–O   ∠ 180°',
          note: 'Настоящие связи промежуточные: N–N — между двойной и тройной, N–O — между одинарной и двойной. Молекулу описывают наложением структур N≡N–O и N=N=O.',
          speak: 'Оксид азота один — прямая молекула: азот, азот, кислород.',
        },
        en: {
          title: 'The nitrogen(I) oxide molecule',
          body: 'The N₂O molecule is straight: the atoms stand in the order N–N–O, the angle is 180°. Oxygen is at the end, not in the middle. The molecule is not symmetric, so it is slightly polar. Bond lengths: N–N 112.8 pm, N–O 118.4 pm.',
          equation: 'N–N–O   ∠ 180°',
          note: 'The real bonds are in between: N–N between double and triple, N–O between single and double. The molecule is described as a blend of the structures N≡N–O and N=N=O.',
          speak: 'Nitrogen one oxide is a straight molecule: nitrogen, nitrogen, oxygen.',
        },
        uz: {
          title: 'Azot(I) oksidi molekulasi',
          body: 'N₂O molekulasi toʻgʻri chiziqli: atomlar N–N–O tartibida turadi, burchak 180°. Kislorod oʻrtada emas, chekkada joylashgan. Molekula nosimmetrik, shuning uchun biroz qutbli. Bogʻ uzunliklari: N–N — 112,8 pm, N–O — 118,4 pm.',
          equation: 'N–N–O   ∠ 180°',
          note: 'Haqiqiy bogʻlar oraliq: N–N — qoʻsh va uchlamchi oraligʻida, N–O — oddiy va qoʻsh oraligʻida. Molekula N≡N–O va N=N=O tuzilmalarining ustma-ust tushishi bilan tasvirlanadi.',
          speak: 'Azot bir oksidi — toʻgʻri chiziqli molekula: azot, azot, kislorod.',
        },
      },
    },
    {
      id: 'summary',
      level: 8,
      seconds: 4.5,
      show: ['молекула N₂O и две молекулы H₂O', 'уравнение NH₄NO₃ → N₂O + 2H₂O, подсчёт атомов'],
      sources: [T8_AMMONIUM_NITRATE],
      text: {
        ru: {
          title: 'Итог: оксид азота(I)',
          body: 'Из одной формульной единицы нитрата аммония получились молекула оксида азота(I) и две молекулы воды. Оксид азота(I) — бесцветный газ со сладковатым запахом, «веселящий газ»; в нём, как в кислороде, вспыхивает тлеющая лучинка.',
          equation: 'NH₄NO₃ → N₂O + 2H₂O',
          note: 'Баланс: слева 2 атома N, 4 атома H и 3 атома O, справа столько же. Азот аммония отдал три электрона, азот нитрата принял три — электронный баланс сходится.',
          speak: 'Нитрат аммония при нагревании дал веселящий газ и воду.',
        },
        en: {
          title: 'Result: nitrogen(I) oxide',
          body: 'One formula unit of ammonium nitrate has given a molecule of nitrogen(I) oxide and two water molecules. Nitrogen(I) oxide is a colourless gas with a sweetish smell, «laughing gas»; a glowing splint flares up in it, as in oxygen.',
          equation: 'NH₄NO₃ → N₂O + 2H₂O',
          note: 'Balance: on the left 2 N atoms, 4 H atoms and 3 O atoms, on the right the same. The ammonium nitrogen gave away three electrons, the nitrate nitrogen took three — the electron balance holds.',
          speak: 'On heating, ammonium nitrate has given laughing gas and water.',
        },
        uz: {
          title: 'Xulosa: azot(I) oksidi',
          body: 'Ammoniy nitratning bitta formula birligidan azot(I) oksidi molekulasi va ikkita suv molekulasi hosil boʻldi. Azot(I) oksidi — shirinroq hidli rangsiz gaz, «kuldiruvchi gaz»; unda xuddi kisloroddagidek choʻgʻlangan choʻp alangalanadi.',
          equation: 'NH₄NO₃ → N₂O + 2H₂O',
          note: 'Balans: chapda 2 ta N, 4 ta H va 3 ta O atomi, oʻngda ham shuncha. Ammoniy azoti uchta elektron berdi, nitrat azoti uchtasini oldi — elektron balans mos keladi.',
          speak: 'Ammoniy nitrat qizdirilganda kuldiruvchi gaz va suv berdi.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'n2o-ozone',
      kind: 'textbook-error',
      source: T7_OZONE,
      text: {
        ru: 'В 7 кл. (с. 102) среди реакций озона записано «N₂ + O₃ = N₂O + O₂». Уравнение уравнено, но на деле азот с озоном практически не реагирует, и N₂O так не получают. Лабораторный способ — разложение нитрата аммония (8 кл., с. 168); его и показывает сцена.',
        en: 'Grade 7 (p. 102) lists «N₂ + O₃ = N₂O + O₂» among the reactions of ozone. The equation is balanced, but in reality nitrogen practically does not react with ozone, and N₂O is not made this way. The laboratory method is decomposing ammonium nitrate (grade 8, p. 168); that is what the scene shows.',
        uz: '7-sinfda (102-bet) ozon reaksiyalari orasida «N₂ + O₃ = N₂O + O₂» yozilgan. Tenglama tenglashtirilgan, lekin aslida azot ozon bilan deyarli reaksiyaga kirishmaydi va N₂O bunday olinmaydi. Laboratoriya usuli — ammoniy nitratni parchalash (8-sinf, 168-bet); sahna aynan shuni koʻrsatadi.',
      },
    },
    {
      id: 'n2o-valence',
      kind: 'textbook-simplification',
      source: T7_VALENCE_EXERCISES,
      text: {
        ru: 'Валентность азота I по формуле N₂O (7 кл., с. 63) предполагает строение N–O–N. Настоящая молекула — N–N–O: атомы азота неодинаковы (три и четыре связи), средняя степень окисления +1 — у концевого 0, у центрального +2.',
        en: 'Nitrogen valence I from the formula N₂O (grade 7, p. 63) assumes the structure N–O–N. The real molecule is N–N–O: the nitrogen atoms are not the same (three and four bonds); the average oxidation state is +1 — 0 at the end one, +2 at the central one.',
        uz: 'N₂O formulasi boʻyicha azotning I valentligi (7-sinf, 63-bet) N–O–N tuzilishini nazarda tutadi. Haqiqiy molekula — N–N–O: azot atomlari bir xil emas (uchta va toʻrtta bogʻ); oʻrtacha oksidlanish darajasi +1 — chetkisida 0, markaziysida +2.',
      },
    },
    {
      id: 'n2o-label',
      kind: 'model-limit',
      source: ref('Friedman & Bigeleisen, J. Chem. Phys. 18 (1950) 1325: разложение NH₄NO₃ с меткой ¹⁵N'),
      text: {
        ru: 'Происхождение атомов проверено опытом с изотопом азота: концевой N в N₂O — из иона аммония, центральный — из нитрат-иона. Азот аммония окисляется (отдаёт три электрона), азот нитрата восстанавливается (принимает три).',
        en: 'The origin of the atoms was checked by an experiment with a nitrogen isotope: the end N of N₂O comes from the ammonium ion, the central one from the nitrate ion. The ammonium nitrogen is oxidized (gives three electrons), the nitrate nitrogen is reduced (takes three).',
        uz: 'Atomlarning kelib chiqishi azot izotopi bilan tajribada tekshirilgan: N₂O dagi chetki N — ammoniy ionidan, markaziysi — nitrat ionidan. Ammoniy azoti oksidlanadi (uchta elektron beradi), nitrat azoti qaytariladi (uchtasini oladi).',
      },
    },
    {
      id: 'n2o-mechanism',
      kind: 'scene-simplification',
      source: ref('Greenwood & Earnshaw (1997), гл. 11: термическое разложение NH₄NO₃ через NH₃ + HNO₃ и NO₂⁺'),
      text: {
        ru: 'Сцена разбирает ионы «по атомам». На деле в расплаве идут стадии с участием аммиака, азотной кислоты и иона NO₂⁺; итоговое уравнение то же.',
        en: 'The scene takes the ions apart «atom by atom». In reality the melt goes through stages involving ammonia, nitric acid and the NO₂⁺ ion; the overall equation is the same.',
        uz: 'Sahna ionlarni «atomma-atom» ajratadi. Aslida suyuqlanmada ammiak, nitrat kislota va NO₂⁺ ioni ishtirokidagi bosqichlar boradi; umumiy tenglama bir xil.',
      },
    },
  ],
}
