/**
 * SO₃ — 2SO₂ + O₂ ⇄ 2SO₃ (t, V₂O₅) (Kimyo 7, § 4.5, с. 96; обратимость и катализатор — Kimyo 8, § 31, с. 136; § 35, с. 147).
 * Плоский правильный треугольник, 120°, μ = 0; S=O 141,98 пм (ядро: 'S=O(SO3)'); сера VI.
 */
import { ref } from './core'
import { ATOM_O, ATOM_S, P_O2, P_SO2, T7_OXIDES, T7_OXYGEN_PROPS, T7_VALENCE, T8_COVALENT, T8_LEVELS, T8_SULFUR_OXIDES, LEGEND } from './shared'
import type { ParticleSpec, SchoolSceneSpec, TextbookRef } from './types'

const T8_CONTACT_PROCESS: TextbookRef = {
  grade: 8,
  pages: [147],
  section: '§ 35',
  title: 'Промышленное производство серной кислоты',
  what: 'окисление SO₂ в присутствии катализатора V₂O₅: 2SO₂ + O₂ ⇄ 2SO₃ + Q; при 400 °C выход SO₃ 99,2 %, при 600 °C — 73 %; температуру понижают до 400–450 °C',
}

const T7_GASEOUS_OXIDES: TextbookRef = {
  grade: 7,
  pages: [140],
  section: '§ 6.5',
  title: 'Практическое занятие. Взаимодействие воды с оксидами',
  what: '«оксиды большинства неметаллов являются газообразными веществами (CO₂, NO₂, SO₃)»',
}

const P_SO3: ParticleSpec = {
  id: 'SO3',
  formula: 'SO₃',
  name: { ru: 'оксид серы(VI), серный ангидрид', en: 'sulfur(VI) oxide, sulfur trioxide', uz: 'oltingugurt(VI) oksidi, sulfat angidrid' },
  role: 'product',
  phase: 'г',
  kind: 'molecule',
  atoms: [
    { id: 'S', element: 'S' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
    { id: 'O3', element: 'O' },
  ],
  bonds: [
    { a: 'S', b: 'O1', pairs: 2, polar: true, length: { bond: 'S=O(SO3)' } },
    { a: 'S', b: 'O2', pairs: 2, polar: true, length: { bond: 'S=O(SO3)' } },
    { a: 'S', b: 'O3', pairs: 2, polar: true, length: { bond: 'S=O(SO3)' } },
  ],
  lonePairs: { O1: 2, O2: 2, O3: 2 },
  unpaired: {},
  charge: 0,
  shape: 'trigonal-planar',
  angles: [
    { atoms: ['O1', 'S', 'O2'], ref: { angle: 'sulfurTrioxide' } },
    { atoms: ['O2', 'S', 'O3'], ref: { angle: 'sulfurTrioxide' } },
    { atoms: ['O3', 'S', 'O1'], ref: { angle: 'sulfurTrioxide' } },
  ],
  dipoleKey: 'SO3',
  polarity: 'nonpolar',
  resonance: {
    show: {
      ru: 'Показываем три одинаковые двойные связи S=O: сера шестивалентна, неподелённых пар у неё нет.',
      en: 'We show three identical S=O double bonds: sulfur has valence VI and no lone pairs.',
      uz: 'Uchta bir xil S=O qoʻsh bogʻi koʻrsatiladi: oltingugurt olti valentli, unda boʻlinmagan juft yoʻq.',
    },
    real: {
      ru: 'Все три связи действительно одинаковы (одна длина, углы по 120°). Но это не «чистые» двойные связи: они сильно полярны, электроны смещены к кислороду; двенадцать электронов вокруг серы — удобный школьный подсчёт, а не точная картина.',
      en: 'All three bonds really are identical (one length, angles of 120°). But they are not «pure» double bonds: they are strongly polar, with electrons shifted to oxygen; twelve electrons around sulfur is a convenient school count, not an exact picture.',
      uz: 'Uchala bogʻ haqiqatan bir xil (uzunligi bitta, burchaklari 120° dan). Lekin ular «sof» qoʻsh bogʻ emas: kuchli qutbli, elektronlar kislorodga siljigan; oltingugurt atrofidagi oʻn ikki elektron — aniq manzara emas, qulay maktab sanogʻi.',
    },
  },
}

export const SO3_SPEC: SchoolSceneSpec = {
  id: 'so3',
  substance: 'SO₃',
  focus: 'SO3',
  name: { ru: 'Серный ангидрид', en: 'Sulfur trioxide', uz: 'Sulfat angidrid' },
  bondType: 'covalent-polar',
  reaction: {
    equation: '2SO₂ + O₂ ⇄ 2SO₃',
    reactants: [
      { formula: 'SO₂', coef: 2, phase: 'г', particle: 'SO2' },
      { formula: 'O₂', coef: 1, phase: 'г', particle: 'O2' },
    ],
    products: [{ formula: 'SO₃', coef: 2, phase: 'г', particle: 'SO3' }],
    reversible: true,
    kind: 'combination',
    bankId: 'so2-o2-so3',
    sources: [T7_OXYGEN_PROPS, T8_SULFUR_OXIDES, T8_CONTACT_PROCESS],
    conditions: {
      heating: true,
      catalyst: 'V₂O₅',
      text: {
        ru: 'нагревание (в промышленности 400–450 °C) и катализатор — оксид ванадия(V) V₂O₅',
        en: 'heating (400–450 °C in industry) and a catalyst — vanadium(V) oxide V₂O₅',
        uz: 'qizdirish (sanoatda 400–450 °C) va katalizator — vanadiy(V) oksidi V₂O₅',
      },
    },
    heat: 'exo',
    heatSource: T8_SULFUR_OXIDES,
  },
  atoms: [ATOM_S, ATOM_O],
  particles: [{ ...P_SO2, role: 'reactant' }, P_O2, P_SO3],
  mechanism: {
    breaks: [
      {
        particle: 'O2',
        a: 'Oa',
        b: 'Ob',
        why: { ru: 'на поверхности катализатора молекула O₂ распадается на атомы', en: 'on the catalyst surface the O₂ molecule splits into atoms', uz: 'katalizator sirtida O₂ molekulasi atomlarga ajraladi' },
      },
    ],
    kept: [
      { particle: 'SO2', a: 'S', b: 'O1', why: { ru: 'связь S=O сохраняется', en: 'the S=O bond is kept', uz: 'S=O bogʻi saqlanadi' } },
      { particle: 'SO2', a: 'S', b: 'O2', why: { ru: 'связь S=O сохраняется', en: 'the S=O bond is kept', uz: 'S=O bogʻi saqlanadi' } },
      { particle: 'SO3', a: 'S', b: 'O1', why: { ru: 'перешла из SO₂', en: 'carried over from SO₂', uz: 'SO₂ dan oʻtdi' } },
      { particle: 'SO3', a: 'S', b: 'O2', why: { ru: 'перешла из SO₂', en: 'carried over from SO₂', uz: 'SO₂ dan oʻtdi' } },
    ],
    forms: [
      {
        particle: 'SO3',
        a: 'S',
        b: 'O3',
        how: 'shared-pair',
        why: {
          ru: 'бывшая неподелённая пара серы и два неспаренных электрона O образуют третью двойную связь',
          en: 'the former lone pair of sulfur and two unpaired O electrons form the third double bond',
          uz: 'oltingugurtning sobiq boʻlinmagan jufti va O ning ikki juftlashmagan elektroni uchinchi qoʻsh bogʻni hosil qiladi',
        },
      },
    ],
  },
  valence: {
    particle: 'SO3',
    school: { S: 6, O: 2 },
    schoolSource: T7_VALENCE,
    oxidation: { S: 6, O: -2 },
    verdict: { S: 'match', O: 'match' },
    explain: {
      ru: 'Учебник выводит формулу SO₃ из валентности серы VI (с. 52: S₂O₆ → SO₃). В формуле с тремя двойными связями у серы шесть общих пар — совпадает: в связях участвуют все шесть её внешних электронов.',
      en: 'The textbook derives the formula SO₃ from sulfur valence VI (p. 52: S₂O₆ → SO₃). In the formula with three double bonds sulfur has six shared pairs — this matches: all six of its outer electrons take part in bonds.',
      uz: 'Darslik SO₃ formulasini oltingugurtning VI valentligidan chiqaradi (52-bet: S₂O₆ → SO₃). Uchta qoʻsh bogʻli formulada oltingugurtda oltita umumiy juft — mos keladi: bogʻlarda uning oltita tashqi elektronining hammasi qatnashadi.',
    },
  },
  observations: [
    {
      text: {
        ru: 'Оксид серы(VI) при комнатной температуре — бесцветная жидкость, кипит при 45 °C, а ниже 17 °C превращается в белую кристаллическую массу.',
        en: 'At room temperature sulfur(VI) oxide is a colourless liquid; it boils at 45 °C and below 17 °C turns into a white crystalline mass.',
        uz: 'Xona haroratida oltingugurt(VI) oksidi — rangsiz suyuqlik, 45 °C da qaynaydi, 17 °C dan past haroratda oq kristall massaga aylanadi.',
      },
      source: T8_SULFUR_OXIDES,
    },
    {
      text: {
        ru: 'SO₃ бурно реагирует с водой, образуя серную кислоту: SO₃ + H₂O → H₂SO₄.',
        en: 'SO₃ reacts vigorously with water, forming sulfuric acid: SO₃ + H₂O → H₂SO₄.',
        uz: 'SO₃ suv bilan shiddatli reaksiyaga kirishib, sulfat kislota hosil qiladi: SO₃ + H₂O → H₂SO₄.',
      },
      source: T7_OXIDES,
    },
    {
      text: {
        ru: 'Чем выше температура, тем меньше SO₃ получается: при 400 °C — 99,2 %, при 600 °C — только 73 %.',
        en: 'The higher the temperature, the less SO₃ forms: 99.2 % at 400 °C, only 73 % at 600 °C.',
        uz: 'Harorat qancha yuqori boʻlsa, SO₃ shuncha kam hosil boʻladi: 400 °C da — 99,2 %, 600 °C da — atigi 73 %.',
      },
      source: T8_CONTACT_PROCESS,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Почти весь SO₃ идёт на производство серной кислоты — главного продукта химической промышленности.',
        en: 'Almost all SO₃ goes into making sulfuric acid, the main product of the chemical industry.',
        uz: 'Deyarli barcha SO₃ kimyo sanoatining asosiy mahsuloti — sulfat kislota ishlab chiqarishga ketadi.',
      },
      source: T8_CONTACT_PROCESS,
    },
  ],
  intro: {
    title: { ru: 'Катализатор и обратимая реакция', en: 'A catalyst and a reversible reaction', uz: 'Katalizator va qaytar reaksiya' },
    speak: {
      ru: 'Сернистый газ можно окислить дальше — до оксида серы(VI). Для этого нужен катализатор.',
      en: 'Sulfur dioxide can be oxidized further — to sulfur(VI) oxide. This needs a catalyst.',
      uz: 'Sulfit angidridni yana oksidlash mumkin — oltingugurt(VI) oksidigacha. Buning uchun katalizator kerak.',
    },
  },
  safety: {
    ru: 'SO₃ и его пары едкие: с влагой воздуха образуют туман серной кислоты. Опыт в школе не проводят — только показ и видео.',
    en: 'SO₃ and its vapour are corrosive: with moisture in the air they form a mist of sulfuric acid. The experiment is not done at school — only shown or on video.',
    uz: 'SO₃ va uning bugʻlari oʻyuvchi: havo namligi bilan sulfat kislota tumanini hosil qiladi. Tajriba maktabda oʻtkazilmaydi — faqat namoyish va video.',
  },
  legend: LEGEND,
  captions: {
    reactants: { ru: '2SO₂ + O₂ на катализаторе', en: '2SO₂ + O₂ on the catalyst', uz: '2SO₂ + O₂ katalizatorda' },
    result: { ru: 'SO₃ — плоский треугольник, 120°', en: 'SO₃ — flat triangle, 120°', uz: 'SO₃ — yassi uchburchak, 120°' },
    condition: { ru: 't°, кат. V₂O₅', en: 't°, cat. V₂O₅', uz: 't°, kat. V₂O₅' },
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 4.5,
      show: ['две молекулы SO₂ (изогнутые, пара у S) и молекула O₂', 'внизу — подложка катализатора V₂O₅ (тёмно-оранжевая решётка)', 'подпись «2SO₂ + O₂»'],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Оксид серы(IV) SO₂ — изогнутая молекула O=S=O с неподелённой парой у серы. Кислород O₂ — молекула с двумя общими парами. Сами по себе они реагируют очень медленно; реакцию ведут при нагревании на катализаторе — оксиде ванадия(V) V₂O₅.',
          equation: '2SO₂ + O₂',
          note: 'Катализатор показан подложкой под молекулами: он ускоряет реакцию и сам при этом не расходуется.',
          speak: 'Две молекулы сернистого газа и молекула кислорода. Внизу — катализатор.',
        },
        en: {
          title: 'Starting substances',
          body: 'Sulfur(IV) oxide SO₂ is a bent O=S=O molecule with a lone pair on sulfur. Oxygen O₂ is a molecule with two shared pairs. On their own they react very slowly; the reaction is run with heating on a catalyst — vanadium(V) oxide V₂O₅.',
          equation: '2SO₂ + O₂',
          note: 'The catalyst is shown as a base under the molecules: it speeds up the reaction and is not used up.',
          speak: 'Two sulfur dioxide molecules and an oxygen molecule. Below is the catalyst.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Oltingugurt(IV) oksidi SO₂ — oltingugurtda boʻlinmagan jufti bor egilgan O=S=O molekulasi. Kislorod O₂ — ikkita umumiy juftli molekula. Oʻz-oʻzidan ular juda sekin reaksiyaga kirishadi; reaksiya qizdirib, katalizator — vanadiy(V) oksidi V₂O₅ ustida olib boriladi.',
          equation: '2SO₂ + O₂',
          note: 'Katalizator molekulalar ostidagi taglik sifatida koʻrsatilgan: u reaksiyani tezlashtiradi va oʻzi sarflanmaydi.',
          speak: 'Ikkita sulfit angidrid molekulasi va kislorod molekulasi. Pastda — katalizator.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5,
      show: ['у S в SO₂: четыре электрона в связях + одна неподелённая пара', 'схема S (+16): 2, 8, 6; O (+8): 2, 6'],
      sources: [T8_LEVELS],
      text: {
        ru: {
          title: 'Сколько электронов у серы',
          body: 'Заряд ядра серы +16, электроны: 2, 8, 6. В SO₂ четыре внешних электрона серы уже заняты в двух двойных связях, а два образуют неподелённую пару. Заряд ядра кислорода +8, электроны: 2, 6 — у атома кислорода два неспаренных электрона.',
          equation: 'S (+16): 2, 8, 6      O (+8): 2, 6',
          note: 'Строение слоёв — материал 8 класса. Неподелённая пара серы в SO₂ подсвечена: именно она будет участвовать в новой связи.',
          speak: 'У серы в сернистом газе ещё осталась свободная пара электронов.',
        },
        en: {
          title: 'How many electrons sulfur has',
          body: 'The nuclear charge of sulfur is +16, electrons: 2, 8, 6. In SO₂ four outer electrons of sulfur are already used in two double bonds, and two form a lone pair. The nuclear charge of oxygen is +8, electrons: 2, 6 — an oxygen atom has two unpaired electrons.',
          equation: 'S (+16): 2, 8, 6      O (+8): 2, 6',
          note: 'Electron shells are grade 8 material. The lone pair of sulfur in SO₂ is highlighted: it is the one that will take part in the new bond.',
          speak: 'Sulfur in sulfur dioxide still has a free pair of electrons.',
        },
        uz: {
          title: 'Oltingugurtda nechta elektron',
          body: 'Oltingugurt yadrosining zaryadi +16, elektronlari: 2, 8, 6. SO₂ da oltingugurtning toʻrtta tashqi elektroni ikkita qoʻsh bogʻda band, ikkitasi boʻlinmagan juft hosil qiladi. Kislorod yadrosining zaryadi +8, elektronlari: 2, 6 — kislorod atomida ikkita juftlashmagan elektron bor.',
          equation: 'S (+16): 2, 8, 6      O (+8): 2, 6',
          note: 'Pogʻonalar tuzilishi — 8-sinf materiali. SO₂ dagi oltingugurtning boʻlinmagan jufti ajratib koʻrsatilgan: aynan u yangi bogʻda qatnashadi.',
          speak: 'Sulfit angidriddagi oltingugurtda hali boʻsh elektron jufti qolgan.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 4.5,
      show: ['O₂ садится на катализатор и распадается на два атома O', 'связи S=O в SO₂ не рвутся'],
      text: {
        ru: {
          title: 'Кислород распадается на катализаторе',
          body: 'На поверхности катализатора молекула O₂ распадается на два атома кислорода. Связи в молекулах SO₂ не рвутся: каждая молекула SO₂ получит один атом кислорода.',
          equation: 'O=O → O + O',
          note: 'Схема. На деле катализатор работает по кругу: V₂O₅ отдаёт свой кислород молекуле SO₂, а потом забирает кислород из O₂ и снова становится V₂O₅.',
          speak: 'Молекула кислорода распалась на атомы, а сернистый газ остался целым.',
        },
        en: {
          title: 'Oxygen splits on the catalyst',
          body: 'On the catalyst surface the O₂ molecule splits into two oxygen atoms. The bonds in the SO₂ molecules do not break: each SO₂ molecule will get one oxygen atom.',
          equation: 'O=O → O + O',
          note: 'A scheme. In reality the catalyst works in a cycle: V₂O₅ gives its own oxygen to an SO₂ molecule, then takes oxygen from O₂ and becomes V₂O₅ again.',
          speak: 'The oxygen molecule has split into atoms, while sulfur dioxide stays whole.',
        },
        uz: {
          title: 'Kislorod katalizatorda parchalanadi',
          body: 'Katalizator sirtida O₂ molekulasi ikkita kislorod atomiga ajraladi. SO₂ molekulalaridagi bogʻlar uzilmaydi: har bir SO₂ molekulasi bitta kislorod atomini oladi.',
          equation: 'O=O → O + O',
          note: 'Sxema. Aslida katalizator aylanma ishlaydi: V₂O₅ oʻz kislorodini SO₂ molekulasiga beradi, soʻng O₂ dan kislorod olib, yana V₂O₅ ga aylanadi.',
          speak: 'Kislorod molekulasi atomlarga ajraldi, sulfit angidrid esa butunligicha qoldi.',
        },
      },
    },
    {
      id: 'pairs',
      level: 8,
      seconds: 6,
      show: ['атом O подходит к S со стороны неподелённой пары', 'пара S и два электрона O встают двумя парами между ядрами — третья S=O'],
      sources: [T8_COVALENT],
      text: {
        ru: {
          title: 'Третья двойная связь',
          body: 'Атом кислорода подходит к сере со стороны её неподелённой пары. Эти два электрона серы и два неспаренных электрона кислорода образуют две общие пары — третью двойную связь S=O. Теперь в связях участвуют все шесть внешних электронов серы: сера шестивалентна.',
          equation: 'SO₂ + O → SO₃',
          note: 'Две пары между ядрами — двойная связь. После образования все три связи S=O становятся одинаковыми: по ним уже не узнать, какая была «новой».',
          speak: 'Свободная пара серы ушла в новую связь с кислородом. Все шесть электронов серы теперь в связях.',
        },
        en: {
          title: 'The third double bond',
          body: 'An oxygen atom approaches sulfur from the side of its lone pair. These two sulfur electrons and the two unpaired electrons of oxygen form two shared pairs — a third S=O double bond. Now all six outer electrons of sulfur take part in bonds: sulfur has valence VI.',
          equation: 'SO₂ + O → SO₃',
          note: 'Two pairs between the nuclei are a double bond. Once formed, all three S=O bonds become identical: you can no longer tell which one was «new».',
          speak: 'Sulfur’s free pair went into a new bond with oxygen. All six sulfur electrons are now in bonds.',
        },
        uz: {
          title: 'Uchinchi qoʻsh bogʻ',
          body: 'Kislorod atomi oltingugurtga uning boʻlinmagan jufti tomonidan yaqinlashadi. Oltingugurtning bu ikki elektroni va kislorodning ikki juftlashmagan elektroni ikkita umumiy juft — uchinchi S=O qoʻsh bogʻini hosil qiladi. Endi oltingugurtning oltita tashqi elektronining hammasi bogʻlarda: oltingugurt olti valentli.',
          equation: 'SO₂ + O → SO₃',
          note: 'Yadrolar orasidagi ikki juft — qoʻsh bogʻ. Hosil boʻlgach, uchala S=O bogʻi bir xil boʻlib qoladi: qaysi biri «yangi» boʻlganini endi bilib boʻlmaydi.',
          speak: 'Oltingugurtning boʻsh jufti kislorod bilan yangi bogʻga ketdi. Endi oltingugurtning oltita elektroni ham bogʻlarda.',
        },
      },
    },
    {
      id: 'molecule',
      level: 7,
      seconds: 5.5,
      show: ['молекула SO₃ — плоский правильный треугольник, три дуги по 120°', 'три стрелки полярности гасят друг друга'],
      text: {
        ru: {
          title: 'Молекула оксида серы(VI)',
          body: 'Неподелённых пар у серы не осталось, и три одинаковые связи расходятся на равные углы: молекула SO₃ — плоский правильный треугольник с серой в центре, все углы O–S–O по 120°. Связи полярные, но три одинаковые связи гасят друг друга — молекула неполярная.',
          equation: 'SO₃   ∠ 120°',
          note: 'Связь S=O в SO₃ (141,98 пм) чуть короче, чем в SO₂ (143,1 пм). Изогнутую форму SO₂ давала неподелённая пара; в SO₃ её нет — молекула плоская.',
          speak: 'Оксид серы шесть — плоский треугольник с углами по сто двадцать градусов.',
        },
        en: {
          title: 'The sulfur(VI) oxide molecule',
          body: 'Sulfur has no lone pairs left, and the three identical bonds spread at equal angles: the SO₃ molecule is a flat equilateral triangle with sulfur in the centre, all O–S–O angles are 120°. The bonds are polar, but the three identical bonds cancel each other — the molecule is non-polar.',
          equation: 'SO₃   ∠ 120°',
          note: 'The S=O bond in SO₃ (141.98 pm) is slightly shorter than in SO₂ (143.1 pm). The bent shape of SO₂ came from the lone pair; SO₃ has none — the molecule is flat.',
          speak: 'Sulfur six oxide is a flat triangle with angles of one hundred and twenty degrees.',
        },
        uz: {
          title: 'Oltingugurt(VI) oksidi molekulasi',
          body: 'Oltingugurtda boʻlinmagan juft qolmadi va uchta bir xil bogʻ teng burchaklarga tarqaladi: SO₃ molekulasi — markazida oltingugurt boʻlgan yassi muntazam uchburchak, barcha O–S–O burchaklari 120° dan. Bogʻlar qutbli, lekin uchta bir xil bogʻ bir-birini soʻndiradi — molekula qutbsiz.',
          equation: 'SO₃   ∠ 120°',
          note: 'SO₃ dagi S=O bogʻi (141,98 pm) SO₂ dagidan (143,1 pm) biroz qisqaroq. SO₂ ning egilgan shaklini boʻlinmagan juft berardi; SO₃ da u yoʻq — molekula yassi.',
          speak: 'Oltingugurt olti oksidi — burchaklari bir yuz yigirma gradusdan boʻlgan yassi uchburchak.',
        },
      },
    },
    {
      id: 'result',
      level: 7,
      seconds: 5,
      show: ['две молекулы SO₃ над катализатором', 'уравнение 2SO₂ + O₂ ⇄ 2SO₃ с двойной стрелкой; катализатор остался прежним'],
      sources: [T8_CONTACT_PROCESS],
      text: {
        ru: {
          title: 'Итог: оксид серы(VI)',
          body: 'Две молекулы SO₂ и молекула кислорода дали две молекулы SO₃; катализатор остался прежним. Реакция обратимая: при сильном нагревании часть SO₃ снова распадается, поэтому температуру держат умеренной. С водой SO₃ даёт серную кислоту.',
          equation: '2SO₂ + O₂ ⇄ 2SO₃',
          note: 'Баланс: слева 2 атома S и 6 атомов O, справа столько же. В учебнике 7 класса (с. 96) реакция записана одной стрелкой; обратимость и катализатор разбирают в 8 классе (с. 136, 147).',
          speak: 'Сернистый газ окислился до оксида серы шесть. Реакция идёт в обе стороны — поэтому стрелка двойная.',
        },
        en: {
          title: 'Result: sulfur(VI) oxide',
          body: 'Two SO₂ molecules and an oxygen molecule have given two SO₃ molecules; the catalyst is unchanged. The reaction is reversible: on strong heating some SO₃ breaks down again, so the temperature is kept moderate. With water SO₃ gives sulfuric acid.',
          equation: '2SO₂ + O₂ ⇄ 2SO₃',
          note: 'Balance: on the left 2 S atoms and 6 O atoms, on the right the same. The grade 7 textbook (p. 96) writes the reaction with a single arrow; reversibility and the catalyst are studied in grade 8 (pp. 136, 147).',
          speak: 'Sulfur dioxide has been oxidized to sulfur six oxide. The reaction goes both ways — so the arrow is double.',
        },
        uz: {
          title: 'Xulosa: oltingugurt(VI) oksidi',
          body: 'Ikkita SO₂ molekulasi va kislorod molekulasi ikkita SO₃ molekulasini berdi; katalizator oʻzgarmadi. Reaksiya qaytar: kuchli qizdirilganda SO₃ ning bir qismi yana parchalanadi, shuning uchun harorat moʻtadil ushlanadi. SO₃ suv bilan sulfat kislota beradi.',
          equation: '2SO₂ + O₂ ⇄ 2SO₃',
          note: 'Balans: chapda 2 ta S va 6 ta O atomi, oʻngda ham shuncha. 7-sinf darsligida (96-bet) reaksiya bitta strelka bilan yozilgan; qaytarlik va katalizator 8-sinfda oʻrganiladi (136, 147-betlar).',
          speak: 'Sulfit angidrid oltingugurt olti oksidigacha oksidlandi. Reaksiya ikki tomonga boradi — shuning uchun strelka qoʻsh.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'so3-reversible',
      kind: 'textbook-simplification',
      source: T7_OXYGEN_PROPS,
      text: {
        ru: 'В 7 кл. (с. 96) реакция записана «2SO₂ + O₂ = 2SO₃ (t, V₂O₅)» — как необратимая. На деле она обратимая (8 кл., с. 136: ⇄), поэтому в сцене двойная стрелка.',
        en: 'Grade 7 (p. 96) writes the reaction as «2SO₂ + O₂ = 2SO₃ (t, V₂O₅)» — as irreversible. In reality it is reversible (grade 8, p. 136: ⇄), so the scene uses a double arrow.',
        uz: '7-sinfda (96-bet) reaksiya «2SO₂ + O₂ = 2SO₃ (t, V₂O₅)» — qaytmas qilib yozilgan. Aslida u qaytar (8-sinf, 136-bet: ⇄), shuning uchun sahnada qoʻsh strelka.',
      },
    },
    {
      id: 'so3-not-gas',
      kind: 'textbook-error',
      source: T7_GASEOUS_OXIDES,
      evidence: T8_SULFUR_OXIDES,
      text: {
        ru: 'В 7 кл. (с. 140) SO₃ назван газообразным оксидом. При комнатной температуре SO₃ — жидкость (кипит при 45 °C, ниже 17 °C — твёрдый; 8 кл., с. 136). Газом он бывает в реакторе при нагревании — таким его и показывает сцена.',
        en: 'Grade 7 (p. 140) calls SO₃ a gaseous oxide. At room temperature SO₃ is a liquid (boils at 45 °C, solid below 17 °C; grade 8, p. 136). It is a gas in the heated reactor — and that is how the scene shows it.',
        uz: '7-sinfda (140-bet) SO₃ gazsimon oksid deb atalgan. Xona haroratida SO₃ — suyuqlik (45 °C da qaynaydi, 17 °C dan past — qattiq; 8-sinf, 136-bet). U qizdirilgan reaktorda gaz boʻladi — sahna uni shunday koʻrsatadi.',
      },
    },
    {
      id: 'so3-catalytic-cycle',
      kind: 'scene-simplification',
      source: ref('Greenwood & Earnshaw (1997), § 15.2.5: окисление SO₂ на V₂O₅ (цикл V⁵⁺/V⁴⁺)'),
      text: {
        ru: 'Сцена показывает распад O₂ на поверхности и присоединение атома O к SO₂. Настоящий катализ — круговорот: V₂O₅ окисляет SO₂ своим кислородом и восстанавливается, затем снова окисляется кислородом O₂.',
        en: 'The scene shows O₂ splitting on the surface and an O atom joining SO₂. Real catalysis is a cycle: V₂O₅ oxidizes SO₂ with its own oxygen and is reduced, then is oxidized again by O₂.',
        uz: 'Sahna O₂ ning sirtda ajralishini va O atomining SO₂ ga birikishini koʻrsatadi. Haqiqiy kataliz — aylanma jarayon: V₂O₅ SO₂ ni oʻz kislorodi bilan oksidlaydi va qaytariladi, soʻng yana O₂ bilan oksidlanadi.',
      },
    },
    {
      id: 'so3-expanded',
      kind: 'model-limit',
      source: ref('Greenwood & Earnshaw (1997), § 15.2.5'),
      text: {
        ru: 'Три двойные связи дают вокруг серы двенадцать электронов — это школьная модель валентности VI. Современная химия описывает связи S–O как сильно полярные с участием только s- и p-электронов серы; равенство трёх связей и угол 120° сцена передаёт точно.',
        en: 'Three double bonds put twelve electrons around sulfur — this is the school model of valence VI. Modern chemistry describes the S–O bonds as strongly polar, using only the s and p electrons of sulfur; the equality of the three bonds and the 120° angle the scene shows exactly.',
        uz: 'Uchta qoʻsh bogʻ oltingugurt atrofida oʻn ikki elektron beradi — bu VI valentlikning maktab modeli. Zamonaviy kimyo S–O bogʻlarini faqat oltingugurtning s- va p-elektronlari ishtirokidagi kuchli qutbli bogʻlar deb taʼriflaydi; uchala bogʻning tengligi va 120° burchakni sahna aniq koʻrsatadi.',
      },
    },
  ],
}
