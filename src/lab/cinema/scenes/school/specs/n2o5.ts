/**
 * N₂O₅ — N₂O₅ + H₂O → 2HNO₃ (Kimyo 7, § 6.4, с. 139, задание 3; «оксид азота (V)» — § 4.10, с. 106).
 * Реакции получения N₂O₅ в учебниках нет — сцена «кислотный оксид + вода → кислота».
 * Газовая молекула O₂N–O–NO₂ (ядро: REAGENT_GEOMETRY.n2o5, McClelland 2001): мостиковая N–O 150,5 пм рвётся;
 * у азота ЧЕТЫРЕ общие пары, «валентность V» — степень окисления +5 (Kimyo 8, с. 164: высшая валентность азота — 4).
 */
import { ref } from './core'
import { ATOM_H, ATOM_N, ATOM_O, P_H2O, T7_OXIDES, T7_VALENCE, T8_COVALENT, T8_LEVELS, T8_NITRIC_ACID, LEGEND_DATIVE } from './shared'
import type { ParticleSpec, SchoolScienceSpec, TextbookRef } from './types'

const T7_WATER_CHEM: TextbookRef = {
  grade: 7,
  pages: [138, 139],
  section: '§ 6.4',
  title: 'Химические свойства воды',
  what: 'оксиды неметаллов с водой дают кислоты (SO₃ + H₂O = H₂SO₄, CO₂ + H₂O = H₂CO₃); задание 3 на с. 139: «N₂O₅ + H₂O →»',
  asInBook: 'N₂O₅ + H₂O →',
}

const P_N2O5: ParticleSpec = {
  id: 'N2O5',
  formula: 'N₂O₅',
  name: { ru: 'оксид азота(V), азотный ангидрид', en: 'nitrogen(V) oxide, dinitrogen pentoxide', uz: 'azot(V) oksidi, nitrat angidrid' },
  role: 'reactant',
  phase: 'г',
  kind: 'molecule',
  // формальные заряды O=N⁺(→O⁻)– не рисуются в 7 классе
  atoms: [
    { id: 'N1', element: 'N', charge: 1 },
    { id: 'N2', element: 'N', charge: 1 },
    { id: 'Ob', element: 'O' },
    { id: 'O11', element: 'O' },
    { id: 'O12', element: 'O', charge: -1 },
    { id: 'O21', element: 'O' },
    { id: 'O22', element: 'O', charge: -1 },
  ],
  bonds: [
    { a: 'N1', b: 'O11', pairs: 2, realOrder: 1.5, polar: true, length: { reagent: 'n2o5', name: 'N=O' } },
    { a: 'N1', b: 'O12', pairs: 1, dative: { donor: 'N1' }, realOrder: 1.5, polar: true, length: { reagent: 'n2o5', name: 'N=O' } },
    { a: 'N1', b: 'Ob', pairs: 1, polar: true, length: { reagent: 'n2o5', name: 'N–O(мост)' } },
    { a: 'N2', b: 'O21', pairs: 2, realOrder: 1.5, polar: true, length: { reagent: 'n2o5', name: 'N=O' } },
    { a: 'N2', b: 'O22', pairs: 1, dative: { donor: 'N2' }, realOrder: 1.5, polar: true, length: { reagent: 'n2o5', name: 'N=O' } },
    { a: 'N2', b: 'Ob', pairs: 1, polar: true, length: { reagent: 'n2o5', name: 'N–O(мост)' } },
  ],
  lonePairs: { Ob: 2, O11: 2, O12: 3, O21: 2, O22: 3 },
  unpaired: {},
  charge: 0,
  shape: 'propeller',
  angles: [
    { atoms: ['N1', 'Ob', 'N2'], ref: { reagent: 'n2o5', name: '∠N–O–N' } },
    { atoms: ['O11', 'N1', 'O12'], ref: { reagent: 'n2o5', name: '∠O=N=O' } },
    { atoms: ['O21', 'N2', 'O22'], ref: { reagent: 'n2o5', name: '∠O=N=O' } },
  ],
  polarity: 'polar',
  resonance: {
    show: {
      ru: 'Показываем O₂N–O–NO₂: у каждого азота двойная связь с одним концевым кислородом, донорно-акцепторная — с другим и одинарная — с мостиковым. Две концевые связи каждой группы рисуем одинаковыми.',
      en: 'We show O₂N–O–NO₂: each nitrogen has a double bond to one end oxygen, a donor-acceptor bond to the other and a single bond to the bridging oxygen. The two end bonds of each group are drawn identical.',
      uz: 'O₂N–O–NO₂ koʻrsatiladi: har bir azotda bitta chetki kislorod bilan qoʻsh bogʻ, ikkinchisi bilan donor-akseptor bogʻ va koʻprik kislorod bilan oddiy bogʻ. Har bir guruhning ikkita chetki bogʻi bir xil chiziladi.',
    },
    real: {
      ru: 'Концевые связи N–O каждой группы одинаковы (118,8 пм, «полуторные»), мостиковые — длинные (150,5 пм), угол N–O–N 112,3°. Группы NO₂ повёрнуты «пропеллером». Так устроена молекула в газе; твёрдый N₂O₅ состоит из ионов NO₂⁺ и NO₃⁻.',
      en: 'The end N–O bonds of each group are identical (118.8 pm, «one and a half»), the bridging ones are long (150.5 pm), the N–O–N angle is 112.3°. The NO₂ groups are twisted like a propeller. This is the molecule in the gas; solid N₂O₅ consists of NO₂⁺ and NO₃⁻ ions.',
      uz: 'Har bir guruhning chetki N–O bogʻlari bir xil (118,8 pm, «bir yarimli»), koʻprik bogʻlar uzun (150,5 pm), N–O–N burchagi 112,3°. NO₂ guruhlari «parrak» kabi burilgan. Molekula gazda shunday tuzilgan; qattiq N₂O₅ NO₂⁺ va NO₃⁻ ionlaridan iborat.',
    },
  },
}

const P_HNO3: ParticleSpec = {
  id: 'HNO3',
  formula: 'HNO₃',
  name: { ru: 'азотная кислота', en: 'nitric acid', uz: 'nitrat kislota' },
  role: 'product',
  phase: 'ж',
  kind: 'molecule',
  atoms: [
    { id: 'H', element: 'H' },
    { id: 'Oh', element: 'O' },
    { id: 'N', element: 'N', charge: 1 },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O', charge: -1 },
  ],
  bonds: [
    { a: 'H', b: 'Oh', pairs: 1, polar: true, length: { reagent: 'hno3', name: 'O–H' } },
    { a: 'Oh', b: 'N', pairs: 1, polar: true, length: { reagent: 'hno3', name: 'N–O(H)' } },
    { a: 'N', b: 'O1', pairs: 2, realOrder: 1.5, polar: true, length: { reagent: 'hno3', name: 'N=O(цис)' } },
    { a: 'N', b: 'O2', pairs: 1, dative: { donor: 'N' }, realOrder: 1.5, polar: true, length: { reagent: 'hno3', name: 'N=O(транс)' } },
  ],
  lonePairs: { Oh: 2, O1: 2, O2: 3 },
  unpaired: {},
  charge: 0,
  shape: 'planar',
  angles: [
    { atoms: ['O1', 'N', 'O2'], ref: { reagent: 'hno3', name: '∠O=N=O' } },
    { atoms: ['H', 'Oh', 'N'], ref: { reagent: 'hno3', name: '∠H–O–N' } },
  ],
  polarity: 'polar',
  resonance: {
    show: {
      ru: 'Показываем H–O–NO₂: у азота одинарная связь с группой OH, двойная — с одним кислородом и донорно-акцепторная — с другим; две концевые связи рисуем почти одинаковыми.',
      en: 'We show H–O–NO₂: nitrogen has a single bond to the OH group, a double bond to one oxygen and a donor-acceptor bond to the other; the two end bonds are drawn almost identical.',
      uz: 'H–O–NO₂ koʻrsatiladi: azotda OH guruhi bilan oddiy bogʻ, bitta kislorod bilan qoʻsh bogʻ va ikkinchisi bilan donor-akseptor bogʻ; ikkita chetki bogʻ deyarli bir xil chiziladi.',
    },
    real: {
      ru: 'Концевые связи N–O почти равны (121,1 и 119,9 пм), связь N–OH одинарная (140,6 пм); молекула плоская. У азота четыре связи — больше у него не бывает.',
      en: 'The end N–O bonds are almost equal (121.1 and 119.9 pm), the N–OH bond is single (140.6 pm); the molecule is flat. Nitrogen has four bonds — it never has more.',
      uz: 'Chetki N–O bogʻlari deyarli teng (121,1 va 119,9 pm), N–OH bogʻi oddiy (140,6 pm); molekula yassi. Azotda toʻrtta bogʻ — undan koʻp boʻlmaydi.',
    },
  },
}

export const N2O5_SPEC: SchoolScienceSpec = {
  id: 'n2o5',
  substance: 'N₂O₅',
  focus: 'N2O5',
  name: { ru: 'Оксид азота(V)', en: 'Nitrogen(V) oxide', uz: 'Azot(V) oksidi' },
  bondType: 'covalent-polar',
  reaction: {
    equation: 'N₂O₅ + H₂O → 2HNO₃',
    reactants: [
      { formula: 'N₂O₅', coef: 1, phase: 'г', particle: 'N2O5' },
      { formula: 'H₂O', coef: 1, phase: 'ж', particle: 'H2O' },
    ],
    products: [{ formula: 'HNO₃', coef: 2, phase: 'ж', particle: 'HNO3' }],
    reversible: false,
    kind: 'combination',
    bankId: 'n2o5-h2o-hno3',
    sources: [T7_WATER_CHEM, T7_OXIDES],
    conditions: {
      heating: false,
      text: {
        ru: 'без нагревания: кислотный оксид сразу реагирует с водой',
        en: 'no heating: the acidic oxide reacts with water at once',
        uz: 'qizdirishsiz: kislotali oksid suv bilan darhol reaksiyaga kirishadi',
      },
    },
    heat: 'exo',
    heatSource: ref('NBS Tables (1982): ΔH°f N₂O₅ (тв) −43,1; H₂O (ж) −285,8; HNO₃ (ж) −174,1 кДж/моль → −19,3 кДж'),
  },
  atoms: [ATOM_N, ATOM_O, ATOM_H],
  particles: [P_N2O5, { ...P_H2O, role: 'reactant' }, P_HNO3],
  mechanism: {
    breaks: [
      {
        particle: 'N2O5',
        a: 'N2',
        b: 'Ob',
        why: {
          ru: 'мостиковая связь N–O — самая длинная и слабая в молекуле',
          en: 'the bridging N–O bond is the longest and weakest in the molecule',
          uz: 'koʻprik N–O bogʻi — molekuladagi eng uzun va eng kuchsiz bogʻ',
        },
      },
      {
        particle: 'H2O',
        a: 'Ow',
        b: 'Hw1',
        why: { ru: 'вода отдаёт один атом водорода', en: 'water gives up one hydrogen atom', uz: 'suv bitta vodorod atomini beradi' },
      },
    ],
    kept: [
      ...(['O11', 'O12', 'Ob'] as const).map((o) => ({
        particle: 'N2O5',
        a: 'N1',
        b: o,
        why: { ru: 'первая группа O₂N–O остаётся целой', en: 'the first O₂N–O group stays whole', uz: 'birinchi O₂N–O guruhi butun qoladi' },
      })),
      ...(['O21', 'O22'] as const).map((o) => ({
        particle: 'N2O5',
        a: 'N2',
        b: o,
        why: { ru: 'вторая группа NO₂ остаётся целой', en: 'the second NO₂ group stays whole', uz: 'ikkinchi NO₂ guruhi butun qoladi' },
      })),
      { particle: 'H2O', a: 'Ow', b: 'Hw2', why: { ru: 'группа OH воды остаётся целой', en: 'the OH group of water stays whole', uz: 'suvning OH guruhi butun qoladi' } },
      ...(['O1', 'O2'] as const).map((o) => ({
        particle: 'HNO3',
        a: 'N',
        b: o,
        why: { ru: 'концевые связи перешли из групп NO₂', en: 'the end bonds came from the NO₂ groups', uz: 'chetki bogʻlar NO₂ guruhlaridan oʻtdi' },
      })),
    ],
    forms: [
      {
        particle: 'HNO3',
        a: 'H',
        b: 'Oh',
        how: 'shared-pair',
        why: {
          ru: 'первая молекула: водород воды садится на мостиковый кислород (во второй молекуле эта связь O–H пришла из воды)',
          en: 'first molecule: the hydrogen of water attaches to the bridging oxygen (in the second molecule this O–H bond came from water)',
          uz: 'birinchi molekula: suv vodorodi koʻprik kislorodga birikadi (ikkinchi molekulada bu O–H bogʻi suvdan kelgan)',
        },
      },
      {
        particle: 'HNO3',
        a: 'Oh',
        b: 'N',
        how: 'shared-pair',
        why: {
          ru: 'вторая молекула: группа OH воды соединяется с азотом второй группы NO₂ (в первой молекуле эта связь — бывший мостик)',
          en: 'second molecule: the OH group of water joins the nitrogen of the second NO₂ group (in the first molecule this bond is the former bridge)',
          uz: 'ikkinchi molekula: suvning OH guruhi ikkinchi NO₂ guruhi azotiga birikadi (birinchi molekulada bu bogʻ — sobiq koʻprik)',
        },
      },
    ],
  },
  valence: {
    particle: 'N2O5',
    school: { N: 5, O: 2 },
    schoolSource: T7_OXIDES,
    oxidation: { N: 5, O: -2 },
    verdict: { N: 'formal', O: 'formal' },
    explain: {
      ru: 'Учебник называет N₂O₅ оксидом азота (V). Но у азота на внешнем уровне только четыре орбитали, и больше четырёх связей он образовать не может — в N₂O₅ у каждого азота четыре общие пары. «V» — степень окисления +5. Это прямо сказано в учебнике 8 класса (с. 164): «высшая валентность азота — 4».',
      en: 'The textbook calls N₂O₅ nitrogen (V) oxide. But nitrogen has only four orbitals on its outer level and cannot form more than four bonds — in N₂O₅ each nitrogen has four shared pairs. «V» is the oxidation state, +5. The grade 8 textbook says it directly (p. 164): «the highest valence of nitrogen is 4».',
      uz: 'Darslik N₂O₅ ni azot (V) oksidi deydi. Lekin azotning tashqi pogʻonasida faqat toʻrtta orbital bor va u toʻrttadan ortiq bogʻ hosil qila olmaydi — N₂O₅ da har bir azotda toʻrtta umumiy juft. «V» — +5 oksidlanish darajasi. Buni 8-sinf darsligi toʻgʻridan-toʻgʻri aytadi (164-bet): «azotning eng yuqori valentligi — 4».',
    },
  },
  observations: [
    {
      text: {
        ru: 'Оксид азота(V) — бесцветные (белые) кристаллы, которые возгоняются около 33 °C; вещество неустойчиво и постепенно разлагается.',
        en: 'Nitrogen(V) oxide is colourless (white) crystals that sublime at about 33 °C; the substance is unstable and slowly decomposes.',
        uz: 'Azot(V) oksidi — taxminan 33 °C da sublimatsiyalanadigan rangsiz (oq) kristallar; modda beqaror va asta-sekin parchalanadi.',
      },
      source: ref('Greenwood & Earnshaw (1997), § 11.3.7: N₂O₅ — бесцветные кристаллы, возгоняются при ≈ 33 °C, неустойчив; кристалл NO₂⁺NO₃⁻ — Grison, Eriks & de Vries, Acta Cryst. 3 (1950) 290'),
    },
    {
      text: {
        ru: 'Кислотный оксид: с щёлочью даёт соль — N₂O₅ + 2NaOH → 2NaNO₃ + H₂O.',
        en: 'An acidic oxide: with an alkali it gives a salt — N₂O₅ + 2NaOH → 2NaNO₃ + H₂O.',
        uz: 'Kislotali oksid: ishqor bilan tuz beradi — N₂O₅ + 2NaOH → 2NaNO₃ + H₂O.',
      },
      source: T7_OXIDES,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Ангидрид азотной кислоты; в химии — сильный нитрующий реагент.',
        en: 'The anhydride of nitric acid; in chemistry a strong nitrating reagent.',
        uz: 'Nitrat kislota angidridi; kimyoda kuchli nitrolovchi reagent.',
      },
      source: ref('Greenwood & Earnshaw (1997), § 11.3.7'),
    },
  ],
  intro: {
    title: { ru: 'Кислотный оксид и вода', en: 'An acidic oxide and water', uz: 'Kislotali oksid va suv' },
    speak: {
      ru: 'Кислотный оксид с водой даёт кислоту. Посмотрим, как из оксида азота пять и воды получаются две молекулы азотной кислоты.',
      en: 'An acidic oxide with water gives an acid. Let us see how nitrogen five oxide and water give two molecules of nitric acid.',
      uz: 'Kislotali oksid suv bilan kislota beradi. Azot besh oksidi va suvdan ikkita nitrat kislota molekulasi qanday hosil boʻlishini koʻramiz.',
    },
  },
  safety: {
    ru: 'N₂O₅ и азотная кислота — едкие вещества, сильные окислители. В школе этот опыт не проводят — только показ.',
    en: 'N₂O₅ and nitric acid are corrosive substances and strong oxidizers. This experiment is not done at school — it is only shown.',
    uz: 'N₂O₅ va nitrat kislota — oʻyuvchi moddalar, kuchli oksidlovchilar. Maktabda bu tajriba oʻtkazilmaydi — faqat namoyish qilinadi.',
  },
  legend: LEGEND_DATIVE,
  captions: {
    reactants: { ru: 'кислотный оксид + вода', en: 'acidic oxide + water', uz: 'kislotali oksid + suv' },
    result: { ru: '2HNO₃ — азотная кислота', en: '2HNO₃ — nitric acid', uz: '2HNO₃ — nitrat kislota' },
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 5,
      show: ['молекула O₂N–O–NO₂: две группы NO₂ на мостиковом O, повёрнуты «пропеллером»', 'молекула H₂O', 'подпись «N₂O₅ + H₂O»'],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Оксид азота(V) N₂O₅ — кислотный оксид, белые кристаллы, которые легко переходят в пар. Молекула N₂O₅ в паре — это две группы NO₂, соединённые общим атомом кислорода: O₂N–O–NO₂. Вода H₂O — изогнутая молекула с двумя связями O–H.',
          equation: 'N₂O₅ + H₂O',
          note: 'В твёрдом N₂O₅ молекул нет — он состоит из ионов NO₂⁺ и NO₃⁻; сцена показывает молекулу из пара. Символ внутри шара — химический знак элемента.',
          speak: 'Молекула оксида азота пять похожа на два треугольника NO₂, скреплённых одним кислородом.',
        },
        en: {
          title: 'Starting substances',
          body: 'Nitrogen(V) oxide N₂O₅ is an acidic oxide, white crystals that easily turn into vapour. The N₂O₅ molecule in the vapour is two NO₂ groups joined by a shared oxygen atom: O₂N–O–NO₂. Water H₂O is a bent molecule with two O–H bonds.',
          equation: 'N₂O₅ + H₂O',
          note: 'Solid N₂O₅ has no molecules — it consists of NO₂⁺ and NO₃⁻ ions; the scene shows the molecule from the vapour. The symbol inside a ball is the chemical symbol of the element.',
          speak: 'The nitrogen five oxide molecule looks like two NO₂ triangles held together by one oxygen.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Azot(V) oksidi N₂O₅ — kislotali oksid, bugʻga oson oʻtadigan oq kristallar. Bugʻdagi N₂O₅ molekulasi umumiy kislorod atomi bilan birikkan ikkita NO₂ guruhidan iborat: O₂N–O–NO₂. Suv H₂O — ikkita O–H bogʻli egilgan molekula.',
          equation: 'N₂O₅ + H₂O',
          note: 'Qattiq N₂O₅ da molekulalar yoʻq — u NO₂⁺ va NO₃⁻ ionlaridan iborat; sahna bugʻdagi molekulani koʻrsatadi. Shar ichidagi belgi — elementning kimyoviy belgisi.',
          speak: 'Azot besh oksidi molekulasi bitta kislorod bilan tutashtirilgan ikkita NO₂ uchburchagiga oʻxshaydi.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5.5,
      show: ['облако N: 5 точек и четыре «места» (орбитали) внешнего уровня', 'облака O (6) и H (1)', 'схема N (+7): 2, 5; O (+8): 2, 6; H (+1): 1'],
      sources: [T8_LEVELS, T8_NITRIC_ACID],
      text: {
        ru: {
          title: 'Сколько связей может быть у азота',
          body: 'Заряд ядра азота +7, электроны: 2, 5. На внешнем уровне у азота всего четыре орбитали — четыре «места» для электронных пар, поэтому азот образует не больше четырёх связей. Кислород +8: 2, 6; водород +1: 1.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6      H (+1): 1',
          note: 'Строение слоёв — материал 8 класса; там же (с. 164) сказано, что высшая валентность азота — 4. У азота в N₂O₅ неподелённых пар нет: все пять его электронов — в четырёх общих парах.',
          speak: 'У азота только четыре места для пар — значит, не больше четырёх связей.',
        },
        en: {
          title: 'How many bonds nitrogen can have',
          body: 'The nuclear charge of nitrogen is +7, electrons: 2, 5. Nitrogen has only four orbitals on its outer level — four «places» for electron pairs, so nitrogen forms no more than four bonds. Oxygen +8: 2, 6; hydrogen +1: 1.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6      H (+1): 1',
          note: 'Electron shells are grade 8 material; the same book (p. 164) says the highest valence of nitrogen is 4. Nitrogen in N₂O₅ has no lone pairs: all five of its electrons are in four shared pairs.',
          speak: 'Nitrogen has only four places for pairs — so no more than four bonds.',
        },
        uz: {
          title: 'Azotda nechta bogʻ boʻlishi mumkin',
          body: 'Azot yadrosining zaryadi +7, elektronlari: 2, 5. Azotning tashqi pogʻonasida bor-yoʻgʻi toʻrtta orbital — elektron juftlari uchun toʻrtta «joy», shuning uchun azot toʻrttadan ortiq bogʻ hosil qilmaydi. Kislorod +8: 2, 6; vodorod +1: 1.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6      H (+1): 1',
          note: 'Pogʻonalar tuzilishi — 8-sinf materiali; oʻsha darslikda (164-bet) azotning eng yuqori valentligi 4 ekani aytilgan. N₂O₅ dagi azotda boʻlinmagan juft yoʻq: uning beshta elektronining hammasi toʻrtta umumiy juftda.',
          speak: 'Azotda juftlar uchun faqat toʻrtta joy bor — demak, toʻrttadan ortiq bogʻ yoʻq.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 5,
      show: ['вода подходит к одной группе NO₂ кислородом вперёд', 'гаснет мостиковая связь N–O (подпись 150,5 пм) и одна связь O–H воды'],
      text: {
        ru: {
          title: 'Рвутся две связи',
          body: 'Молекула воды подходит к одной из групп NO₂. Рвутся две связи: мостиковая связь N–O — самая длинная и слабая в молекуле (150,5 пм) — и одна связь O–H в воде.',
          equation: 'O₂N–O–NO₂ + H–O–H',
          note: 'Схема: на деле кислород воды сначала притягивается своей неподелённой парой к азоту, и связи рвутся и образуются почти одновременно.',
          speak: 'Молекула рвётся по самому слабому месту — по мостику.',
        },
        en: {
          title: 'Two bonds break',
          body: 'A water molecule approaches one of the NO₂ groups. Two bonds break: the bridging N–O bond — the longest and weakest in the molecule (150.5 pm) — and one O–H bond of water.',
          equation: 'O₂N–O–NO₂ + H–O–H',
          note: 'A scheme: in reality the oxygen of water is first drawn to nitrogen by its lone pair, and bonds break and form almost at the same time.',
          speak: 'The molecule breaks at its weakest point — the bridge.',
        },
        uz: {
          title: 'Ikkita bogʻ uziladi',
          body: 'Suv molekulasi NO₂ guruhlaridan biriga yaqinlashadi. Ikkita bogʻ uziladi: koʻprik N–O bogʻi — molekuladagi eng uzun va eng kuchsiz bogʻ (150,5 pm) — va suvdagi bitta O–H bogʻi.',
          equation: 'O₂N–O–NO₂ + H–O–H',
          note: 'Sxema: aslida suv kislorodi avval oʻzining boʻlinmagan jufti bilan azotga tortiladi, bogʻlar deyarli bir vaqtda uziladi va hosil boʻladi.',
          speak: 'Molekula eng kuchsiz joyidan — koʻprikdan uziladi.',
        },
      },
    },
    {
      id: 'pairs',
      level: 8,
      seconds: 6,
      show: ['водород воды садится на бывший мостиковый кислород — первая HNO₃', 'группа OH воды соединяется с азотом второй группы NO₂ — вторая HNO₃'],
      sources: [T8_COVALENT],
      text: {
        ru: {
          title: 'Две молекулы кислоты',
          body: 'Атом водорода из воды присоединяется к мостиковому кислороду — получается первая молекула азотной кислоты HO–NO₂. Оставшаяся группа OH воды соединяется с азотом второй группы NO₂ — вторая молекула HO–NO₂. В каждой новой связи — одна общая пара.',
          equation: 'O₂N–O + H → HNO₃      NO₂ + OH → HNO₃',
          note: 'Мостиковый кислород забирает электронную пару разорванной связи и присоединяет водород; кислород воды отдаёт свою неподелённую пару азоту. Итог — две одинаковые молекулы HNO₃.',
          speak: 'Водород ушёл к одной половинке, группа OH — к другой. Получились две молекулы азотной кислоты.',
        },
        en: {
          title: 'Two acid molecules',
          body: 'A hydrogen atom from water attaches to the bridging oxygen — this gives the first nitric acid molecule, HO–NO₂. The remaining OH group of water joins the nitrogen of the second NO₂ group — the second HO–NO₂ molecule. Each new bond is one shared pair.',
          equation: 'O₂N–O + H → HNO₃      NO₂ + OH → HNO₃',
          note: 'The bridging oxygen takes the electron pair of the broken bond and gains a hydrogen; the oxygen of water gives its lone pair to nitrogen. The result is two identical HNO₃ molecules.',
          speak: 'The hydrogen went to one half, the OH group to the other. Two nitric acid molecules have formed.',
        },
        uz: {
          title: 'Ikkita kislota molekulasi',
          body: 'Suvdan vodorod atomi koʻprik kislorodga birikadi — nitrat kislotaning birinchi molekulasi HO–NO₂ hosil boʻladi. Suvning qolgan OH guruhi ikkinchi NO₂ guruhi azotiga birikadi — ikkinchi HO–NO₂ molekulasi. Har bir yangi bogʻda bitta umumiy juft.',
          equation: 'O₂N–O + H → HNO₃      NO₂ + OH → HNO₃',
          note: 'Koʻprik kislorod uzilgan bogʻning elektron juftini oladi va vodorodni biriktiradi; suv kislorodi oʻzining boʻlinmagan juftini azotga beradi. Natijada ikkita bir xil HNO₃ molekulasi hosil boʻladi.',
          speak: 'Vodorod bir yarmiga, OH guruhi ikkinchisiga ketdi. Ikkita nitrat kislota molekulasi hosil boʻldi.',
        },
      },
    },
    {
      id: 'molecule',
      level: 8,
      seconds: 5.5,
      show: ['плоская молекула H–O–NO₂', 'у N четыре связи: O–N, N=O и N→O; концевые N–O почти одинаковы', 'угол O–N–O около 130°'],
      sources: [T8_NITRIC_ACID],
      text: {
        ru: {
          title: 'Молекула азотной кислоты',
          body: 'Молекула HNO₃ плоская: H–O–NO₂. У азота четыре связи: одинарная с группой OH, двойная с одним кислородом и донорно-акцепторная с другим. Две концевые связи N–O почти одинаковы (121,1 и 119,9 пм), угол между ними около 130°.',
          equation: 'H–O–NO₂',
          note: 'Пятой связи у азота нет и быть не может. Поэтому «валентность V» в названии «оксид азота (V)» — формальная: это степень окисления +5. В учебнике 8 класса (с. 164) так и сказано: высшая валентность азота — 4.',
          speak: 'У азота в азотной кислоте четыре связи. Пятой не бывает.',
        },
        en: {
          title: 'The nitric acid molecule',
          body: 'The HNO₃ molecule is flat: H–O–NO₂. Nitrogen has four bonds: a single one to the OH group, a double one to one oxygen and a donor-acceptor one to the other. The two end N–O bonds are almost identical (121.1 and 119.9 pm), the angle between them is about 130°.',
          equation: 'H–O–NO₂',
          note: 'Nitrogen has no fifth bond and cannot have one. So «valence V» in the name «nitrogen (V) oxide» is formal: it is the oxidation state +5. The grade 8 textbook (p. 164) says so: the highest valence of nitrogen is 4.',
          speak: 'Nitrogen in nitric acid has four bonds. There is never a fifth.',
        },
        uz: {
          title: 'Nitrat kislota molekulasi',
          body: 'HNO₃ molekulasi yassi: H–O–NO₂. Azotda toʻrtta bogʻ: OH guruhi bilan oddiy, bitta kislorod bilan qoʻsh va ikkinchisi bilan donor-akseptor bogʻ. Ikkita chetki N–O bogʻi deyarli bir xil (121,1 va 119,9 pm), ular orasidagi burchak taxminan 130°.',
          equation: 'H–O–NO₂',
          note: 'Azotda beshinchi bogʻ yoʻq va boʻlishi mumkin emas. Shuning uchun «azot (V) oksidi» nomidagi «V valentlik» — rasmiy: bu +5 oksidlanish darajasi. 8-sinf darsligida (164-bet) shunday deyilgan: azotning eng yuqori valentligi — 4.',
          speak: 'Nitrat kislotadagi azotda toʻrtta bogʻ bor. Beshinchisi boʻlmaydi.',
        },
      },
    },
    {
      id: 'result',
      level: 7,
      seconds: 4.5,
      show: ['две молекулы HNO₃', 'уравнение N₂O₅ + H₂O → 2HNO₃, подсчёт атомов; схема «кислотный оксид + вода → кислота»'],
      sources: [T7_WATER_CHEM],
      text: {
        ru: {
          title: 'Итог: азотная кислота',
          body: 'Одна молекула N₂O₅ и одна молекула воды дали две молекулы азотной кислоты: кислотный оксид + вода → кислота. Так же реагируют с водой SO₃ и CO₂ — это разобрано в учебнике (с. 138).',
          equation: 'N₂O₅ + H₂O → 2HNO₃',
          note: 'Баланс: слева 2 атома N, 6 атомов O и 2 атома H, справа столько же. Сколько атомов азота было в N₂O₅, столько молекул кислоты и получилось.',
          speak: 'Оксид азота пять и вода дали азотную кислоту — две молекулы.',
        },
        en: {
          title: 'Result: nitric acid',
          body: 'One N₂O₅ molecule and one water molecule have given two nitric acid molecules: acidic oxide + water → acid. SO₃ and CO₂ react with water in the same way — this is covered in the textbook (p. 138).',
          equation: 'N₂O₅ + H₂O → 2HNO₃',
          note: 'Balance: on the left 2 N atoms, 6 O atoms and 2 H atoms, on the right the same. As many nitrogen atoms as there were in N₂O₅, so many acid molecules formed.',
          speak: 'Nitrogen five oxide and water have given nitric acid — two molecules.',
        },
        uz: {
          title: 'Xulosa: nitrat kislota',
          body: 'Bitta N₂O₅ molekulasi va bitta suv molekulasi ikkita nitrat kislota molekulasini berdi: kislotali oksid + suv → kislota. SO₃ va CO₂ ham suv bilan shunday reaksiyaga kirishadi — bu darslikda koʻrib chiqilgan (138-bet).',
          equation: 'N₂O₅ + H₂O → 2HNO₃',
          note: 'Balans: chapda 2 ta N, 6 ta O va 2 ta H atomi, oʻngda ham shuncha. N₂O₅ da nechta azot atomi boʻlsa, shuncha kislota molekulasi hosil boʻldi.',
          speak: 'Azot besh oksidi va suv nitrat kislota berdi — ikkita molekula.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'n2o5-valence-v',
      kind: 'textbook-simplification',
      source: T8_NITRIC_ACID,
      text: {
        ru: '«Оксид азота (V)» (7 кл., с. 106): V — это степень окисления +5, а не число связей. У азота на внешнем уровне четыре орбитали, поэтому связей не больше четырёх; в N₂O₅ и HNO₃ у азота именно четыре общие пары. Учебник 8 кл. (с. 164): «высшая валентность азота — 4».',
        en: '«Nitrogen (V) oxide» (grade 7, p. 106): V is the oxidation state +5, not the number of bonds. Nitrogen has four orbitals on its outer level, so no more than four bonds; in N₂O₅ and HNO₃ nitrogen has exactly four shared pairs. The grade 8 textbook (p. 164): «the highest valence of nitrogen is 4».',
        uz: '«Azot (V) oksidi» (7-sinf, 106-bet): V — bogʻlar soni emas, +5 oksidlanish darajasi. Azotning tashqi pogʻonasida toʻrtta orbital bor, shuning uchun bogʻlar toʻrttadan oshmaydi; N₂O₅ va HNO₃ da azotda aynan toʻrtta umumiy juft. 8-sinf darsligi (164-bet): «azotning eng yuqori valentligi — 4».',
      },
    },
    {
      id: 'n2o5-table',
      kind: 'textbook-error',
      source: T7_VALENCE,
      text: {
        ru: 'Внутри учебника 7 кл. противоречие: в таблице на с. 52 у азота валентности I, II, III, IV, а на с. 106 N₂O₅ назван оксидом азота (V). Верна таблица (как валентность); «V» в названии — степень окисления.',
        en: 'There is a contradiction inside the grade 7 textbook: the table on p. 52 gives nitrogen valences I, II, III, IV, while p. 106 calls N₂O₅ nitrogen (V) oxide. The table is right (as valence); «V» in the name is the oxidation state.',
        uz: '7-sinf darsligining oʻzida qarama-qarshilik bor: 52-betdagi jadvalda azot valentliklari I, II, III, IV, 106-betda esa N₂O₅ azot (V) oksidi deb atalgan. Jadval toʻgʻri (valentlik sifatida); nomdagi «V» — oksidlanish darajasi.',
      },
    },
    {
      id: 'n2o5-solid-ionic',
      kind: 'scene-simplification',
      source: ref('REAGENT_GEOMETRY.n2o5Crystal (ядро): N–O в NO₂⁺ 115 пм, в NO₃⁻ 124 пм — Grison, Eriks & de Vries, Acta Cryst. 3 (1950) 290'),
      text: {
        ru: 'Твёрдый N₂O₅ — ионный кристалл: линейные ионы NO₂⁺ (N–O 115 пм) и плоские ионы NO₃⁻ (N–O 124 пм). Молекула O₂N–O–NO₂ существует в паре; сцена показывает её, потому что на ней видно, какие связи рвутся.',
        en: 'Solid N₂O₅ is an ionic crystal: linear NO₂⁺ ions (N–O 115 pm) and flat NO₃⁻ ions (N–O 124 pm). The O₂N–O–NO₂ molecule exists in the vapour; the scene shows it because it makes clear which bonds break.',
        uz: 'Qattiq N₂O₅ — ionli kristall: chiziqli NO₂⁺ ionlari (N–O 115 pm) va yassi NO₃⁻ ionlari (N–O 124 pm). O₂N–O–NO₂ molekulasi bugʻda mavjud; sahna uni koʻrsatadi, chunki unda qaysi bogʻlar uzilishi yaqqol koʻrinadi.',
      },
    },
    {
      id: 'n2o5-equal-ends',
      kind: 'model-limit',
      source: ref('REAGENT_GEOMETRY.n2o5 (ядро): McClelland et al., Helv. Chim. Acta 84 (2001) 1612'),
      text: {
        ru: 'Запись «двойная + донорно-акцепторная» у каждой группы NO₂ — способ подсчитать электроны. На деле две концевые связи группы одинаковы (118,8 пм) и имеют порядок полтора.',
        en: 'Writing «double + donor-acceptor» for each NO₂ group is a way of counting electrons. In reality the two end bonds of a group are identical (118.8 pm) with a bond order of one and a half.',
        uz: 'Har bir NO₂ guruhi uchun «qoʻsh + donor-akseptor» yozuvi — elektronlarni sanash usuli. Aslida guruhning ikkita chetki bogʻi bir xil (118,8 pm) va tartibi bir yarim.',
      },
    },
  ],
}
