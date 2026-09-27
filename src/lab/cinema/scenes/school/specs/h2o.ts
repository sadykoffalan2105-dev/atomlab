/**
 * H₂O — 2H₂ + O₂ → 2H₂O (Kimyo 7, § 4.5, с. 95; § 5.3, с. 117).
 * Ковалентная полярная связь, две неподелённые пары у O, угол H–O–H 104,5° (ядро: BOND_ANGLES.water, r_0).
 */
import { ref } from './core'
import { ATOM_H, ATOM_O, P_H2, P_H2O, P_O2, T7_OXYGEN_PROPS, T7_VALENCE, T8_COVALENT, T8_LEVELS } from './shared'
import type { SchoolSceneSpec, TextbookRef } from './types'

const T7_HYDROGEN: TextbookRef = {
  grade: 7,
  pages: [117],
  section: '§ 5.3',
  title: 'Свойства и применение водорода',
  what: '2H₂ + O₂ → 2H₂O; смесь 2:1 — «гремучий газ», взрывается; водородное пламя почти бесцветно; выделяется много теплоты',
}

const T7_WATER_COMPOSITION: TextbookRef = {
  grade: 7,
  pages: [132],
  section: '§ 6.1',
  title: 'Состав воды',
  what: '«Молекула воды имеет вид равностороннего треугольника…», поэтому молекула полярна',
}

const T7_WATER_PHYSICAL: TextbookRef = {
  grade: 7,
  pages: [136],
  section: '§ 6.3',
  title: 'Практическое занятие. Физические свойства воды',
  what: 'чистая вода — прозрачное бесцветное жидкое вещество без запаха',
}

export const H2O_SPEC: SchoolSceneSpec = {
  id: 'h2o',
  substance: 'H₂O',
  focus: 'H2O',
  name: { ru: 'Вода', en: 'Water', uz: 'Suv' },
  bondType: 'covalent-polar',
  reaction: {
    equation: '2H₂ + O₂ → 2H₂O',
    reactants: [
      { formula: 'H₂', coef: 2, phase: 'г', particle: 'H2' },
      { formula: 'O₂', coef: 1, phase: 'г', particle: 'O2' },
    ],
    products: [{ formula: 'H₂O', coef: 2, phase: 'ж', particle: 'H2O' }],
    reversible: false,
    kind: 'combustion',
    bankId: 'h2-o2-h2o',
    sources: [T7_OXYGEN_PROPS, T7_HYDROGEN],
    conditions: {
      heating: true,
      text: {
        ru: 'поджигание (искра или пламя); смесь 2 : 1 взрывается',
        en: 'ignition (spark or flame); a 2 : 1 mixture explodes',
        uz: 'yondirish (uchqun yoki alanga); 2 : 1 aralashma portlaydi',
      },
    },
    heat: 'exo',
    heatSource: T7_HYDROGEN,
  },
  atoms: [ATOM_H, ATOM_O],
  particles: [P_H2, P_O2, P_H2O],
  mechanism: {
    breaks: [
      {
        particle: 'H2',
        a: 'Ha',
        b: 'Hb',
        why: { ru: 'одна общая пара H–H расходится', en: 'the single H–H shared pair splits', uz: 'bitta H–H umumiy jufti ajraladi' },
      },
      {
        particle: 'O2',
        a: 'Oa',
        b: 'Ob',
        why: { ru: 'две общие пары O=O расходятся', en: 'the two O=O shared pairs split', uz: 'ikkita O=O umumiy jufti ajraladi' },
      },
    ],
    forms: [
      {
        particle: 'H2O',
        a: 'Ow',
        b: 'Hw1',
        how: 'shared-pair',
        why: { ru: 'электрон H + неспаренный электрон O', en: 'H electron + an unpaired O electron', uz: 'H elektroni + O ning juftlashmagan elektroni' },
      },
      {
        particle: 'H2O',
        a: 'Ow',
        b: 'Hw2',
        how: 'shared-pair',
        why: { ru: 'второй неспаренный электрон O', en: 'the second unpaired O electron', uz: 'O ning ikkinchi juftlashmagan elektroni' },
      },
    ],
  },
  valence: {
    particle: 'H2O',
    school: { H: 1, O: 2 },
    schoolSource: T7_VALENCE,
    oxidation: { H: 1, O: -2 },
    verdict: { H: 'match', O: 'match' },
    explain: {
      ru: 'Учебник объясняет валентность на графической формуле воды: у кислорода две связи — он двухвалентен, у водорода одна. Это совпадает с числом общих пар в молекуле.',
      en: 'The textbook explains valence with the structural formula of water: oxygen has two bonds (valence II), hydrogen one. This matches the number of shared pairs in the molecule.',
      uz: 'Darslik valentlikni suvning grafik formulasi orqali tushuntiradi: kislorodda ikkita bogʻ — u ikki valentli, vodorodda bitta. Bu molekuladagi umumiy juftlar soniga mos keladi.',
    },
  },
  observations: [
    {
      text: {
        ru: 'Водород горит почти бесцветным пламенем с выделением большого количества теплоты; смесь двух объёмов водорода и одного объёма кислорода («гремучий газ») от огня взрывается.',
        en: 'Hydrogen burns with an almost colourless flame, releasing a lot of heat; a mixture of two volumes of hydrogen and one of oxygen («oxyhydrogen») explodes when ignited.',
        uz: 'Vodorod deyarli rangsiz alanga bilan koʻp issiqlik chiqarib yonadi; ikki hajm vodorod va bir hajm kislorod aralashmasi («qaldiroq gaz») olovdan portlaydi.',
      },
      source: T7_HYDROGEN,
    },
    {
      text: {
        ru: 'Чистая вода — прозрачная бесцветная жидкость без запаха.',
        en: 'Pure water is a clear colourless liquid without smell.',
        uz: 'Toza suv — tiniq, rangsiz, hidsiz suyuqlik.',
      },
      source: T7_WATER_PHYSICAL,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Водород — топливо: при его горении образуется только вода.',
        en: 'Hydrogen is a fuel: burning it produces only water.',
        uz: 'Vodorod — yoqilgʻi: u yonganda faqat suv hosil boʻladi.',
      },
      source: T7_HYDROGEN,
    },
  ],
  intro: {
    title: { ru: 'Как получается вода', en: 'How water forms', uz: 'Suv qanday hosil boʻladi' },
    speak: {
      ru: 'Посмотрим, как из водорода и кислорода получается вода и почему её молекула изогнута.',
      en: 'Let us see how hydrogen and oxygen form water and why its molecule is bent.',
      uz: 'Vodorod va kisloroddan suv qanday hosil boʻlishini va uning molekulasi nega egilganini koʻramiz.',
    },
  },
  safety: {
    ru: 'Смесь водорода с кислородом или воздухом взрывоопасна. Опыт показывает только учитель; перед поджиганием чистоту водорода обязательно проверяют.',
    en: 'A mixture of hydrogen with oxygen or air is explosive. Only the teacher performs the experiment; the purity of hydrogen is always tested before ignition.',
    uz: 'Vodorodning kislorod yoki havo bilan aralashmasi portlovchi. Tajribani faqat oʻqituvchi koʻrsatadi; yondirishdan oldin vodorodning tozaligi albatta tekshiriladi.',
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 4.5,
      show: [
        'две молекулы H₂ (H–H: одна черта, одна общая пара) и одна молекула O₂ (O=O: две пары)',
        'символ элемента внутри шара; подпись «2H₂ + O₂»',
      ],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Водород H₂ и кислород O₂ — бесцветные газы. Их молекулы состоят из двух атомов: в H₂ атомы связаны одной общей парой электронов, в O₂ — двумя. Если смесь водорода и кислорода поджечь, получается вода.',
          equation: '2H₂ + O₂',
          note: 'Символ внутри шара — химический знак элемента. Показано столько молекул, сколько в уравнении: две H₂ и одна O₂.',
          speak: 'Две молекулы водорода и одна молекула кислорода. Каждая молекула состоит из двух атомов.',
        },
        en: {
          title: 'Starting substances',
          body: 'Hydrogen H₂ and oxygen O₂ are colourless gases. Their molecules consist of two atoms: in H₂ the atoms are joined by one shared pair of electrons, in O₂ by two. If a mixture of hydrogen and oxygen is ignited, water forms.',
          equation: '2H₂ + O₂',
          note: 'The symbol inside a ball is the chemical symbol of the element. As many molecules are shown as in the equation: two H₂ and one O₂.',
          speak: 'Two hydrogen molecules and one oxygen molecule. Each molecule is made of two atoms.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Vodorod H₂ va kislorod O₂ — rangsiz gazlar. Ularning molekulalari ikki atomdan iborat: H₂ da atomlar bitta umumiy elektron jufti bilan, O₂ da esa ikkita juft bilan bogʻlangan. Vodorod va kislorod aralashmasi yondirilsa, suv hosil boʻladi.',
          equation: '2H₂ + O₂',
          note: 'Shar ichidagi belgi — elementning kimyoviy belgisi. Tenglamadagi qadar molekula koʻrsatilgan: ikkita H₂ va bitta O₂.',
          speak: 'Ikkita vodorod molekulasi va bitta kislorod molekulasi. Har bir molekula ikki atomdan iborat.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5.5,
      show: [
        'облака внешнего слоя: у H — 1 электрон, у O — 6 (2 пары + 2 неспаренных)',
        'схема слоёв: H (+1): 1; O (+8): 2, 6',
      ],
      sources: [T8_LEVELS],
      text: {
        ru: {
          title: 'Строение атомов водорода и кислорода',
          body: 'Заряд ядра водорода +1, у атома один электрон, и он не спарен. Заряд ядра кислорода +8, электроны расположены на двух уровнях: 2, 6. Из шести внешних электронов кислорода четыре образуют две пары, а два не спарены. Неспаренные электроны и образуют связи: водород одновалентен, кислород двухвалентен.',
          equation: 'H (+1): 1      O (+8): 2, 6',
          note: 'Строение электронных слоёв подробно изучают в 8 классе. Облако из светлых точек — электронное облако внешнего уровня; крупные точки — внешние электроны, их можно пересчитать.',
          speak: 'У водорода один неспаренный электрон, у кислорода — два. Столько связей каждый атом и образует.',
        },
        en: {
          title: 'Structure of hydrogen and oxygen atoms',
          body: 'The nuclear charge of hydrogen is +1; the atom has one electron, and it is unpaired. The nuclear charge of oxygen is +8; its electrons are on two levels: 2, 6. Of the six outer electrons of oxygen, four form two pairs and two are unpaired. Unpaired electrons form the bonds: hydrogen has valence I, oxygen valence II.',
          equation: 'H (+1): 1      O (+8): 2, 6',
          note: 'Electron shells are studied in detail in grade 8. The cloud of light dots is the electron cloud of the outer level; the large dots are the outer electrons, and they can be counted.',
          speak: 'Hydrogen has one unpaired electron, oxygen has two. That is how many bonds each atom forms.',
        },
        uz: {
          title: 'Vodorod va kislorod atomlarining tuzilishi',
          body: 'Vodorod yadrosining zaryadi +1, atomda bitta elektron bor va u juftlashmagan. Kislorod yadrosining zaryadi +8, elektronlari ikkita pogʻonada joylashgan: 2, 6. Kislorodning oltita tashqi elektronidan toʻrttasi ikkita juft hosil qiladi, ikkitasi juftlashmagan. Bogʻlarni aynan juftlashmagan elektronlar hosil qiladi: vodorod bir valentli, kislorod ikki valentli.',
          equation: 'H (+1): 1      O (+8): 2, 6',
          note: 'Elektron pogʻonalar tuzilishi 8-sinfda batafsil oʻrganiladi. Yorugʻ nuqtalar buluti — tashqi pogʻonaning elektron buluti; katta nuqtalar — tashqi elektronlar, ularni sanash mumkin.',
          speak: 'Vodorodda bitta juftlashmagan elektron, kislorodda ikkita. Har bir atom shuncha bogʻ hosil qiladi.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 4.5,
      show: ['черта H–H и две черты O=O гаснут, общие пары расходятся к атомам', 'у каждого атома снова видны неспаренные электроны'],
      text: {
        ru: {
          title: 'Связи в молекулах рвутся',
          body: 'При поджигании связи в молекулах H₂ и O₂ рвутся: общие пары расходятся, и у каждого атома снова появляются неспаренные электроны. Нагревание нужно только чтобы начать реакцию — дальше её поддерживает теплота горения.',
          equation: 'H–H → H + H      O=O → O + O',
          note: 'Схема: на самом деле горение водорода — цепочка быстрых стадий с частицами H, O и OH, и молекулы распадаются не одновременно. Сцена показывает главное: какие связи рвутся.',
          speak: 'Связи рвутся — атомы водорода и кислорода свободны и готовы соединиться по-новому.',
        },
        en: {
          title: 'Bonds in the molecules break',
          body: 'On ignition the bonds in the H₂ and O₂ molecules break: the shared pairs split, and every atom again has unpaired electrons. Heating is needed only to start the reaction — after that the heat of burning keeps it going.',
          equation: 'H–H → H + H      O=O → O + O',
          note: 'A scheme: in reality hydrogen burns through a chain of fast stages with H, O and OH particles, and the molecules do not all fall apart at once. The scene shows the main point: which bonds break.',
          speak: 'The bonds break — hydrogen and oxygen atoms are free and ready to join in a new way.',
        },
        uz: {
          title: 'Molekulalardagi bogʻlar uziladi',
          body: 'Yondirilganda H₂ va O₂ molekulalaridagi bogʻlar uziladi: umumiy juftlar ajraladi va har bir atomda yana juftlashmagan elektronlar paydo boʻladi. Qizdirish faqat reaksiyani boshlash uchun kerak — keyin uni yonish issiqligi davom ettiradi.',
          equation: 'H–H → H + H      O=O → O + O',
          note: 'Sxema: aslida vodorodning yonishi H, O va OH zarrachalari ishtirokidagi tez bosqichlar zanjiri, molekulalar bir vaqtda parchalanmaydi. Sahna asosiysini koʻrsatadi: qaysi bogʻlar uziladi.',
          speak: 'Bogʻlar uzildi — vodorod va kislorod atomlari erkin va yangicha birikishga tayyor.',
        },
      },
    },
    {
      id: 'bonding',
      level: 8,
      seconds: 6.5,
      show: [
        'облака H и O перекрываются; электрон H и неспаренный электрон O встают парой между ядрами',
        'две общие пары O–H; точки пары ближе к O (связь полярная)',
      ],
      sources: [T8_COVALENT],
      text: {
        ru: {
          title: 'Общие электронные пары',
          body: 'Электрон каждого атома водорода и один неспаренный электрон кислорода образуют общую пару — так возникают две связи O–H. Кислород притягивает общие пары сильнее водорода, поэтому пары смещены к кислороду: связь ковалентная полярная.',
          equation: 'H + O + H → H–O–H',
          note: 'Две точки между ядрами — общая пара (в формуле — одна черта); две точки у атома — неподелённая пара. Смещение пары к кислороду показано тем, что её точки стоят ближе к O.',
          speak: 'Два электрона — одна общая пара, одна черта в формуле. У воды таких пар две.',
        },
        en: {
          title: 'Shared electron pairs',
          body: 'The electron of each hydrogen atom and one unpaired electron of oxygen form a shared pair — this gives two O–H bonds. Oxygen attracts the shared pairs more strongly than hydrogen, so the pairs are shifted towards oxygen: the bond is polar covalent.',
          equation: 'H + O + H → H–O–H',
          note: 'Two dots between the nuclei are a shared pair (one dash in the formula); two dots next to an atom are a lone pair. The shift of a pair towards oxygen is shown by its dots sitting closer to O.',
          speak: 'Two electrons make one shared pair, one dash in the formula. Water has two such pairs.',
        },
        uz: {
          title: 'Umumiy elektron juftlari',
          body: 'Har bir vodorod atomining elektroni va kislorodning bitta juftlashmagan elektroni umumiy juft hosil qiladi — shunday qilib ikkita O–H bogʻi vujudga keladi. Kislorod umumiy juftlarni vodoroddan kuchliroq tortadi, shuning uchun juftlar kislorod tomonga siljigan: bogʻ qutbli kovalent.',
          equation: 'H + O + H → H–O–H',
          note: 'Yadrolar orasidagi ikki nuqta — umumiy juft (formulada bitta chiziqcha); atom yonidagi ikki nuqta — boʻlinmagan juft. Juftning kislorodga siljishi uning nuqtalari O ga yaqinroq turgani bilan koʻrsatilgan.',
          speak: 'Ikki elektron — bitta umumiy juft, formulada bitta chiziqcha. Suvda bunday juftlar ikkita.',
        },
      },
    },
    {
      id: 'product',
      level: 7,
      seconds: 5.5,
      show: ['молекула H₂O: две черты O–H, две неподелённые пары у O', 'дуга угла 104,5°; δ− у O, δ+ у H'],
      sources: [T7_WATER_COMPOSITION],
      text: {
        ru: {
          title: 'Молекула воды',
          body: 'У кислорода остались две неподелённые пары. Они отталкивают общие пары, поэтому молекула не прямая, а изогнутая: угол H–O–H равен 104,5°. Связи полярные, а молекула изогнута — значит, вода полярная молекула: у кислорода небольшой отрицательный заряд, у водородов — положительный.',
          equation: 'H–O–H   ∠ 104,5°',
          note: 'В учебнике (с. 132) форма названа «равносторонним треугольником». Точнее — равнобедренный: две связи O–H одинаковы (95,8 пм), угол между ними 104,5°, а расстояние между атомами H больше длины связи.',
          speak: 'Молекула воды изогнута, угол — сто четыре с половиной градуса. Поэтому вода — полярная молекула.',
        },
        en: {
          title: 'The water molecule',
          body: 'Oxygen keeps two lone pairs. They repel the shared pairs, so the molecule is not straight but bent: the H–O–H angle is 104.5°. The bonds are polar and the molecule is bent, so water is a polar molecule: oxygen carries a small negative charge, the hydrogens a positive one.',
          equation: 'H–O–H   ∠ 104.5°',
          note: 'The textbook (p. 132) calls the shape an «equilateral triangle». More precisely it is isosceles: the two O–H bonds are equal (95.8 pm), the angle between them is 104.5°, and the distance between the H atoms is larger than the bond length.',
          speak: 'The water molecule is bent, the angle is one hundred and four and a half degrees. That is why water is a polar molecule.',
        },
        uz: {
          title: 'Suv molekulasi',
          body: 'Kislorodda ikkita boʻlinmagan juft qoldi. Ular umumiy juftlarni itaradi, shuning uchun molekula toʻgʻri emas, balki egilgan: H–O–H burchagi 104,5°. Bogʻlar qutbli, molekula esa egilgan — demak, suv qutbli molekula: kislorodda kichik manfiy zaryad, vodorodlarda musbat zaryad bor.',
          equation: 'H–O–H   ∠ 104,5°',
          note: 'Darslikda (132-bet) shakl «teng tomonli uchburchak» deb atalgan. Aniqrogʻi — teng yonli: ikkita O–H bogʻi bir xil (95,8 pm), ular orasidagi burchak 104,5°, H atomlari orasidagi masofa esa bogʻ uzunligidan katta.',
          speak: 'Suv molekulasi egilgan, burchagi bir yuz toʻrt yarim gradus. Shuning uchun suv qutbli molekula.',
        },
      },
    },
    {
      id: 'summary',
      level: 7,
      seconds: 4.5,
      show: ['две молекулы H₂O', 'уравнение 2H₂ + O₂ → 2H₂O и подсчёт атомов слева и справа'],
      text: {
        ru: {
          title: 'Итог: вода',
          body: 'Из двух молекул водорода и одной молекулы кислорода получились две молекулы воды. Атомов водорода и кислорода до и после реакции поровну — атомы не исчезают, а перестраиваются. Водород горит с выделением большого количества теплоты.',
          equation: '2H₂ + O₂ → 2H₂O',
          note: 'Баланс атомов: слева 4 атома H и 2 атома O, справа столько же. В сцене молекулы воды отдельные, как в паре; в жидкой воде они соединены водородными связями.',
          speak: 'Две молекулы водорода и одна кислорода дают две молекулы воды. Атомы не исчезают — они перестраиваются.',
        },
        en: {
          title: 'Result: water',
          body: 'Two hydrogen molecules and one oxygen molecule have given two water molecules. There are as many hydrogen and oxygen atoms after the reaction as before — atoms do not disappear, they rearrange. Hydrogen burns releasing a lot of heat.',
          equation: '2H₂ + O₂ → 2H₂O',
          note: 'Atom balance: on the left 4 H atoms and 2 O atoms, on the right the same. In the scene the water molecules are separate, as in steam; in liquid water they are linked by hydrogen bonds.',
          speak: 'Two molecules of hydrogen and one of oxygen give two molecules of water. Atoms do not disappear — they rearrange.',
        },
        uz: {
          title: 'Xulosa: suv',
          body: 'Ikkita vodorod molekulasi va bitta kislorod molekulasidan ikkita suv molekulasi hosil boʻldi. Reaksiyadan oldin va keyin vodorod va kislorod atomlari teng — atomlar yoʻqolmaydi, balki qayta joylashadi. Vodorod koʻp issiqlik chiqarib yonadi.',
          equation: '2H₂ + O₂ → 2H₂O',
          note: 'Atomlar balansi: chapda 4 ta H va 2 ta O atomi, oʻngda ham shuncha. Sahnada suv molekulalari alohida, xuddi bugʻdagidek; suyuq suvda ular vodorod bogʻlari bilan bogʻlangan.',
          speak: 'Ikkita vodorod va bitta kislorod molekulasi ikkita suv molekulasini beradi. Atomlar yoʻqolmaydi — ular qayta joylashadi.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'h2o-equilateral',
      kind: 'textbook-error',
      source: T7_WATER_COMPOSITION,
      text: {
        ru: 'Учебник 7 кл. (с. 132): «молекула воды имеет вид равностороннего треугольника». Это неточно: треугольник H–O–H равнобедренный, угол при кислороде 104,5°, расстояние H···H больше длины связи O–H. Сцена показывает настоящий угол.',
        en: 'Grade 7 textbook (p. 132): «the water molecule has the shape of an equilateral triangle». This is inaccurate: the H–O–H triangle is isosceles, the angle at oxygen is 104.5°, and the H···H distance is larger than the O–H bond. The scene shows the real angle.',
        uz: '7-sinf darsligi (132-bet): «suv molekulasi teng tomonli uchburchak shaklida». Bu noaniq: H–O–H uchburchagi teng yonli, kisloroddagi burchak 104,5°, H···H masofasi O–H bogʻidan uzunroq. Sahna haqiqiy burchakni koʻrsatadi.',
      },
    },
    {
      id: 'h2o-o2-biradical',
      kind: 'model-limit',
      source: T8_COVALENT,
      text: {
        ru: 'Формула O=O (8 кл., § 15) верно передаёт двойную связь, но не показывает, что у молекулы кислорода два неспаренных электрона (кислород притягивается магнитом). В сцене O₂ нарисован по-школьному.',
        en: 'The formula O=O (grade 8, § 15) correctly shows a double bond but not that the oxygen molecule has two unpaired electrons (oxygen is attracted by a magnet). The scene draws O₂ the school way.',
        uz: 'O=O formulasi (8-sinf, 15-§) qoʻsh bogʻni toʻgʻri koʻrsatadi, lekin kislorod molekulasida ikkita juftlashmagan elektron borligini koʻrsatmaydi (kislorod magnitga tortiladi). Sahnada O₂ maktabdagidek chizilgan.',
      },
    },
    {
      id: 'h2o-chain',
      kind: 'scene-simplification',
      source: ref('Warnatz, Maas & Dibble, «Combustion», 4th ed. (2006): механизм H₂/O₂'),
      text: {
        ru: 'Настоящее горение водорода — цепная реакция через частицы H, O и OH; сцена показывает только итог: какие связи рвутся и какие образуются.',
        en: 'Real hydrogen combustion is a chain reaction through H, O and OH particles; the scene shows only the outcome: which bonds break and which form.',
        uz: 'Vodorodning haqiqiy yonishi H, O va OH zarrachalari orqali boradigan zanjir reaksiya; sahna faqat natijani koʻrsatadi: qaysi bogʻlar uziladi va qaysilari hosil boʻladi.',
      },
    },
  ],
}
