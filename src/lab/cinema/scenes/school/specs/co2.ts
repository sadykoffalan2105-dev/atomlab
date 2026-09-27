/**
 * CO₂ — C + O₂ → CO₂ (Kimyo 7, § 4.5, с. 95; опыт § 4.7, с. 101).
 * Две двойные связи O=C=O, 180°, неполярная молекула с полярными связями (ядро: C=O(CO2) 116,0 пм).
 */
import { ref } from './core'
import { ATOM_C, ATOM_O, P_C_GRAPHITE, P_O2, T7_OXYGEN_PROPS, T7_STRUCTURAL_FORMULA, T7_VALENCE, T8_COVALENT, T8_LEVELS, T9_CARBON_EXCITED, LEGEND } from './shared'
import type { ParticleSpec, SchoolScienceSpec, TextbookRef } from './types'

const T7_FLAME_PRACTICE: TextbookRef = {
  grade: 7,
  pages: [101],
  section: '§ 4.7',
  title: 'Практическое занятие. Строение пламени и горение веществ в кислороде',
  what: 'опыт 3: тлеющий уголь в кислороде; после сгорания — известковая вода',
}

const T7_CO_EXAMPLE: TextbookRef = {
  grade: 7,
  pages: [69, 70],
  section: '§ 2.12',
  title: 'Составление уравнений химических реакций',
  what: 'углерод с ограниченным количеством кислорода: 2C + O₂ → 2CO',
}

const T7_LIMEWATER: TextbookRef = {
  grade: 7,
  pages: [107],
  section: '§ 4.10',
  title: 'Оксиды',
  what: 'CO₂ + Ca(OH)₂ → CaCO₃ + H₂O — известковая вода мутнеет',
}

const T9_CARBON_OXIDES: TextbookRef = {
  grade: 9,
  pages: [50, 51, 52],
  section: '§ 10',
  title: 'Важнейшие соединения углерода',
  what: 'CO₂ — бесцветный газ без запаха, тяжелее воздуха; сухой лёд; применение: сода, огнетушители, газированные напитки',
}

const P_CO2: ParticleSpec = {
  id: 'CO2',
  formula: 'CO₂',
  name: { ru: 'оксид углерода(IV), углекислый газ', en: 'carbon(IV) oxide, carbon dioxide', uz: 'uglerod(IV) oksidi, karbonat angidrid' },
  role: 'product',
  phase: 'г',
  kind: 'molecule',
  atoms: [
    { id: 'C', element: 'C' },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O' },
  ],
  bonds: [
    { a: 'C', b: 'O1', pairs: 2, polar: true, length: { bond: 'C=O(CO2)' } },
    { a: 'C', b: 'O2', pairs: 2, polar: true, length: { bond: 'C=O(CO2)' } },
  ],
  lonePairs: { O1: 2, O2: 2 },
  unpaired: {},
  charge: 0,
  shape: 'linear',
  angles: [{ atoms: ['O1', 'C', 'O2'], ref: { angle: 'carbonDioxide' } }],
  dipoleKey: 'CO2',
  polarity: 'nonpolar',
}

export const CO2_SPEC: SchoolScienceSpec = {
  id: 'co2',
  substance: 'CO₂',
  focus: 'CO2',
  name: { ru: 'Углекислый газ', en: 'Carbon dioxide', uz: 'Karbonat angidrid' },
  bondType: 'covalent-polar',
  reaction: {
    equation: 'C + O₂ → CO₂',
    reactants: [
      { formula: 'C', coef: 1, phase: 'тв', particle: 'C' },
      { formula: 'O₂', coef: 1, phase: 'г', particle: 'O2' },
    ],
    products: [{ formula: 'CO₂', coef: 1, phase: 'г', particle: 'CO2' }],
    reversible: false,
    kind: 'combustion',
    bankId: 'c-o2-co2',
    sources: [T7_OXYGEN_PROPS, T7_FLAME_PRACTICE],
    conditions: {
      heating: true,
      oxygen: 'excess',
      text: {
        ru: 'нагревание; уголь горит в избытке кислорода',
        en: 'heating; charcoal burns in excess oxygen',
        uz: 'qizdirish; koʻmir ortiqcha kislorodda yonadi',
      },
    },
    heat: 'exo',
    heatSource: T7_OXYGEN_PROPS,
  },
  atoms: [ATOM_C, ATOM_O],
  particles: [P_C_GRAPHITE, P_O2, P_CO2],
  mechanism: {
    splitElectrons: [
      {
        particle: 'C',
        atom: 'C',
        lone: 0,
        unpaired: 4,
        why: {
          ru: 'возбуждённый углерод: пара 2s распарена, четыре неспаренных электрона для четырёх связей',
          en: 'excited carbon: the 2s pair is unpaired, four unpaired electrons for four bonds',
          uz: 'qoʻzgʻalgan uglerod: 2s jufti ajralgan, toʻrtta bogʻ uchun toʻrtta juftlashmagan elektron',
        },
      },
    ],    breaks: [
      {
        particle: 'O2',
        a: 'Oa',
        b: 'Ob',
        why: { ru: 'две общие пары O=O расходятся', en: 'the two O=O shared pairs split', uz: 'ikkita O=O umumiy jufti ajraladi' },
      },
    ],
    forms: [
      {
        particle: 'CO2',
        a: 'C',
        b: 'O1',
        how: 'shared-pair',
        why: { ru: 'два электрона C + два неспаренных электрона O', en: 'two C electrons + two unpaired O electrons', uz: 'C ning ikki elektroni + O ning ikki juftlashmagan elektroni' },
      },
      {
        particle: 'CO2',
        a: 'C',
        b: 'O2',
        how: 'shared-pair',
        why: { ru: 'остальные два электрона C + второй атом O', en: 'the other two C electrons + the second O atom', uz: 'C ning qolgan ikki elektroni + ikkinchi O atomi' },
      },
    ],
  },
  valence: {
    particle: 'CO2',
    school: { C: 4, O: 2 },
    schoolSource: T7_VALENCE,
    oxidation: { C: 4, O: -2 },
    verdict: { C: 'match', O: 'match' },
    explain: {
      ru: 'В CO₂ углерод четырёхвалентен: у него четыре общие пары, по две с каждым кислородом. Кислород двухвалентен — две общие пары. Школьная валентность совпадает с числом связей.',
      en: 'In CO₂ carbon has valence IV: it has four shared pairs, two with each oxygen. Oxygen has valence II — two shared pairs. The school valence equals the number of bonds.',
      uz: 'CO₂ da uglerod toʻrt valentli: unda toʻrtta umumiy juft bor, har bir kislorod bilan ikkitadan. Kislorod ikki valentli — ikkita umumiy juft. Maktab valentligi bogʻlar soniga teng.',
    },
  },
  observations: [
    {
      text: {
        ru: 'Тлеющий уголь в кислороде вспыхивает и горит ярко; после сгорания известковая вода в сосуде мутнеет — так узнают углекислый газ.',
        en: 'Smouldering charcoal flares up in oxygen and burns brightly; after burning, limewater in the vessel turns milky — this is how carbon dioxide is detected.',
        uz: 'Choʻgʻlangan koʻmir kislorodda alangalanib yorqin yonadi; yonib boʻlgach idishdagi ohakli suv loyqalanadi — karbonat angidrid shunday aniqlanadi.',
      },
      source: T7_FLAME_PRACTICE,
    },
    {
      text: {
        ru: 'Углекислый газ — бесцветный газ без запаха, тяжелее воздуха, горение не поддерживает.',
        en: 'Carbon dioxide is a colourless odourless gas, heavier than air; it does not support burning.',
        uz: 'Karbonat angidrid — rangsiz, hidsiz gaz, havodan ogʻir, yonishni quvvatlamaydi.',
      },
      source: T9_CARBON_OXIDES,
    },
    {
      text: {
        ru: 'Качественная реакция: CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O — известковая вода мутнеет.',
        en: 'Test reaction: CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O — limewater turns milky.',
        uz: 'Sifat reaksiyasi: CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O — ohakli suv loyqalanadi.',
      },
      source: T7_LIMEWATER,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Огнетушители, газированные напитки, производство соды; твёрдый CO₂ — «сухой лёд» для охлаждения продуктов.',
        en: 'Fire extinguishers, fizzy drinks, soda production; solid CO₂ is «dry ice» for cooling food.',
        uz: 'Oʻt oʻchirgichlar, gazlangan ichimliklar, soda ishlab chiqarish; qattiq CO₂ — mahsulotlarni sovitish uchun «quruq muz».',
      },
      source: T9_CARBON_OXIDES,
    },
  ],
  intro: {
    title: { ru: 'Горение угля', en: 'Burning charcoal', uz: 'Koʻmirning yonishi' },
    speak: {
      ru: 'Посмотрим, как углерод сгорает в кислороде и почему молекула углекислого газа прямая.',
      en: 'Let us see how carbon burns in oxygen and why the carbon dioxide molecule is straight.',
      uz: 'Uglerod kislorodda qanday yonishini va karbonat angidrid molekulasi nega toʻgʻri chiziqli ekanini koʻramiz.',
    },
  },
  safety: {
    ru: 'Горение в чистом кислороде идёт очень ярко; опыт проводят в колбе с кислородом только под руководством учителя.',
    en: 'Burning in pure oxygen is very bright; the experiment is done in a flask of oxygen only under the teacher’s guidance.',
    uz: 'Toza kislorodda yonish juda yorqin boradi; tajriba kislorodli kolbada faqat oʻqituvchi rahbarligida oʻtkaziladi.',
  },
  legend: LEGEND,
  captions: {
    reactants: { ru: 'уголь + кислород', en: 'charcoal + oxygen', uz: 'koʻmir + kislorod' },
    result: { ru: 'O=C=O, 180°, неполярная', en: 'O=C=O, 180°, non-polar', uz: 'O=C=O, 180°, qutbsiz' },
    condition: { ru: 't°', en: 't°', uz: 't°' },
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 4.5,
      show: ['кусочек угля (тёмный графит), из него выделен один атом C', 'молекула O₂ (O=O: две пары)', 'подпись «C + O₂»'],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Уголь — это углерод C, твёрдое чёрное вещество. Кислород O₂ — бесцветный газ; в его молекуле два атома связаны двумя общими парами электронов. Раскалённый уголь в кислороде горит ярко.',
          equation: 'C + O₂',
          note: 'В сцене — один атом углерода. Настоящий уголь и графит — твёрдые вещества: слои из атомов C, каждый связан с тремя соседями.',
          speak: 'Слева углерод из угля, справа молекула кислорода из двух атомов.',
        },
        en: {
          title: 'Starting substances',
          body: 'Charcoal is carbon C, a black solid. Oxygen O₂ is a colourless gas; in its molecule two atoms are joined by two shared electron pairs. Red-hot charcoal burns brightly in oxygen.',
          equation: 'C + O₂',
          note: 'The scene shows one carbon atom. Real charcoal and graphite are solids: layers of C atoms, each bonded to three neighbours.',
          speak: 'On the left carbon from charcoal, on the right an oxygen molecule of two atoms.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Koʻmir — bu uglerod C, qattiq qora modda. Kislorod O₂ — rangsiz gaz; uning molekulasida ikki atom ikkita umumiy elektron jufti bilan bogʻlangan. Choʻgʻlangan koʻmir kislorodda yorqin yonadi.',
          equation: 'C + O₂',
          note: 'Sahnada bitta uglerod atomi. Haqiqiy koʻmir va grafit qattiq moddalar: C atomlaridan iborat qatlamlar, har bir atom uchta qoʻshnisi bilan bogʻlangan.',
          speak: 'Chapda koʻmirdagi uglerod, oʻngda ikki atomli kislorod molekulasi.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 6,
      show: [
        'облако внешнего слоя C: 4 точки (сначала 1 пара + 2 одиночных, затем 4 одиночных — возбуждение)',
        'облака O: 6 точек (2 пары + 2 одиночных)',
        'схема слоёв C (+6): 2, 4; O (+8): 2, 6',
      ],
      sources: [T8_LEVELS, T9_CARBON_EXCITED],
      text: {
        ru: {
          title: 'Строение атомов углерода и кислорода',
          body: 'Заряд ядра углерода +6, электроны: 2, 4 — на внешнем уровне четыре электрона. Два из них спарены, два нет; перед образованием связей пара «распаривается», и неспаренных становится четыре — углерод может образовать четыре связи. Заряд ядра кислорода +8: 2, 6 — у кислорода два неспаренных электрона.',
          equation: 'C (+6): 2, 4      O (+8): 2, 6',
          note: 'Строение слоёв — материал 8 класса, «возбуждённое состояние» углерода (один электрон переходит на свободное место) — 9 класса. Крупные точки облака — внешние электроны: у C четыре, у O шесть.',
          speak: 'У углерода четыре электрона для связей, у каждого атома кислорода — два.',
        },
        en: {
          title: 'Structure of carbon and oxygen atoms',
          body: 'The nuclear charge of carbon is +6, electrons: 2, 4 — four electrons on the outer level. Two of them are paired, two are not; before bonding the pair «unpairs», so four electrons become unpaired — carbon can form four bonds. The nuclear charge of oxygen is +8: 2, 6 — oxygen has two unpaired electrons.',
          equation: 'C (+6): 2, 4      O (+8): 2, 6',
          note: 'Electron shells are grade 8 material, the «excited state» of carbon (one electron moves to a free place) is grade 9. The large dots of a cloud are the outer electrons: four on C, six on O.',
          speak: 'Carbon has four electrons for bonding, each oxygen atom has two.',
        },
        uz: {
          title: 'Uglerod va kislorod atomlarining tuzilishi',
          body: 'Uglerod yadrosining zaryadi +6, elektronlari: 2, 4 — tashqi pogʻonada toʻrtta elektron. Ulardan ikkitasi juftlashgan, ikkitasi yoʻq; bogʻ hosil qilishdan oldin juft «ajraladi» va juftlashmagan elektronlar toʻrtta boʻladi — uglerod toʻrtta bogʻ hosil qila oladi. Kislorod yadrosining zaryadi +8: 2, 6 — kislorodda ikkita juftlashmagan elektron bor.',
          equation: 'C (+6): 2, 4      O (+8): 2, 6',
          note: 'Pogʻonalar tuzilishi — 8-sinf materiali, uglerodning «qoʻzgʻalgan holati» (bitta elektron boʻsh joyga oʻtadi) — 9-sinf materiali. Bulutning katta nuqtalari — tashqi elektronlar: C da toʻrtta, O da oltita.',
          speak: 'Uglerodda bogʻ uchun toʻrtta elektron bor, har bir kislorod atomida — ikkita.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 4.5,
      show: ['две черты O=O гаснут, пары расходятся к атомам O', 'атом C отделяется от угля'],
      text: {
        ru: {
          title: 'Связи рвутся',
          body: 'При нагревании обе общие пары в молекуле O₂ расходятся: получаются два атома кислорода, у каждого по два неспаренных электрона. Атом углерода отрывается от угля.',
          equation: 'O=O → O + O',
          note: 'Схема: на самом деле кислород реагирует прямо на поверхности раскалённого угля, отдельных атомов C и O в пламени почти нет. Сцена показывает, какие связи рвутся.',
          speak: 'Молекула кислорода распалась на два атома — теперь каждый может соединиться с углеродом.',
        },
        en: {
          title: 'Bonds break',
          body: 'On heating both shared pairs of the O₂ molecule split: two oxygen atoms appear, each with two unpaired electrons. A carbon atom leaves the charcoal.',
          equation: 'O=O → O + O',
          note: 'A scheme: in reality oxygen reacts right on the surface of red-hot charcoal, and there are almost no free C and O atoms in the flame. The scene shows which bonds break.',
          speak: 'The oxygen molecule has split into two atoms — now each can join carbon.',
        },
        uz: {
          title: 'Bogʻlar uziladi',
          body: 'Qizdirilganda O₂ molekulasidagi ikkala umumiy juft ajraladi: ikkita kislorod atomi hosil boʻladi, har birida ikkitadan juftlashmagan elektron. Uglerod atomi koʻmirdan ajraladi.',
          equation: 'O=O → O + O',
          note: 'Sxema: aslida kislorod choʻgʻlangan koʻmir sirtida reaksiyaga kirishadi, alangada erkin C va O atomlari deyarli yoʻq. Sahna qaysi bogʻlar uzilishini koʻrsatadi.',
          speak: 'Kislorod molekulasi ikki atomga ajraldi — endi har biri uglerod bilan birika oladi.',
        },
      },
    },
    {
      id: 'pairs',
      level: 8,
      seconds: 6,
      show: [
        'облака C и O перекрываются: с каждым O — по две пары между ядрами',
        'у C все 4 точки ушли в связи; точки пар ближе к O (полярные связи)',
      ],
      sources: [T8_COVALENT],
      text: {
        ru: {
          title: 'Двойные связи',
          body: 'Каждый атом кислорода образует с углеродом две общие пары — двойную связь C=O. У углерода получается четыре общие пары: все четыре его внешних электрона участвуют в связях. Кислород притягивает общие пары сильнее — связи ковалентные полярные.',
          equation: 'O + C + O → O=C=O',
          note: 'Две пары между ядрами — двойная связь, две черты в формуле. У каждого атома кислорода остаются две неподелённые пары.',
          speak: 'Две общие пары — две черты. Углерод образует две двойные связи, всего четыре.',
        },
        en: {
          title: 'Double bonds',
          body: 'Each oxygen atom forms two shared pairs with carbon — a C=O double bond. Carbon ends up with four shared pairs: all four of its outer electrons take part in bonds. Oxygen attracts the shared pairs more strongly — the bonds are polar covalent.',
          equation: 'O + C + O → O=C=O',
          note: 'Two pairs between the nuclei are a double bond, two dashes in the formula. Each oxygen atom keeps two lone pairs.',
          speak: 'Two shared pairs are two dashes. Carbon forms two double bonds, four bonds in all.',
        },
        uz: {
          title: 'Qoʻsh bogʻlar',
          body: 'Har bir kislorod atomi uglerod bilan ikkita umumiy juft — C=O qoʻsh bogʻini hosil qiladi. Uglerodda toʻrtta umumiy juft boʻladi: uning toʻrttala tashqi elektroni bogʻlarda qatnashadi. Kislorod umumiy juftlarni kuchliroq tortadi — bogʻlar qutbli kovalent.',
          equation: 'O + C + O → O=C=O',
          note: 'Yadrolar orasidagi ikki juft — qoʻsh bogʻ, formulada ikki chiziqcha. Har bir kislorod atomida ikkitadan boʻlinmagan juft qoladi.',
          speak: 'Ikki umumiy juft — ikki chiziqcha. Uglerod ikkita qoʻsh bogʻ, jami toʻrtta bogʻ hosil qiladi.',
        },
      },
    },
    {
      id: 'molecule',
      level: 7,
      seconds: 5.5,
      show: ['молекула O=C=O на одной прямой, дуга 180°', 'стрелки полярности связей направлены в разные стороны и гасят друг друга'],
      sources: [T7_STRUCTURAL_FORMULA],
      text: {
        ru: {
          title: 'Молекула углекислого газа',
          body: 'У углерода не осталось неподелённых пар, и две двойные связи расходятся в противоположные стороны: молекула CO₂ прямая, угол O=C=O равен 180°. Каждая связь полярна, но две одинаковые связи тянут в разные стороны — молекула в целом неполярная.',
          equation: 'O=C=O   ∠ 180°',
          note: 'Длина связи C=O в CO₂ — 116,0 пм. Такую же прямую молекулу показывает шаростержневая модель CO₂ в учебнике (с. 53).',
          speak: 'Молекула углекислого газа прямая: два кислорода по разные стороны от углерода.',
        },
        en: {
          title: 'The carbon dioxide molecule',
          body: 'Carbon has no lone pairs left, and the two double bonds point in opposite directions: the CO₂ molecule is straight, the O=C=O angle is 180°. Each bond is polar, but two equal bonds pull in opposite directions — the molecule as a whole is non-polar.',
          equation: 'O=C=O   ∠ 180°',
          note: 'The C=O bond length in CO₂ is 116.0 pm. The ball-and-stick model of CO₂ in the textbook (p. 53) shows the same straight molecule.',
          speak: 'The carbon dioxide molecule is straight: the two oxygens are on opposite sides of carbon.',
        },
        uz: {
          title: 'Karbonat angidrid molekulasi',
          body: 'Uglerodda boʻlinmagan juft qolmadi va ikkita qoʻsh bogʻ qarama-qarshi tomonlarga yoʻnaladi: CO₂ molekulasi toʻgʻri chiziqli, O=C=O burchagi 180°. Har bir bogʻ qutbli, lekin ikkita bir xil bogʻ qarama-qarshi tomonga tortadi — molekula umuman qutbsiz.',
          equation: 'O=C=O   ∠ 180°',
          note: 'CO₂ dagi C=O bogʻ uzunligi — 116,0 pm. Darslikdagi CO₂ ning shar-sterjenli modeli (53-bet) ham xuddi shunday toʻgʻri chiziqli molekulani koʻrsatadi.',
          speak: 'Karbonat angidrid molekulasi toʻgʻri chiziqli: ikki kislorod ugleroddan qarama-qarshi tomonlarda.',
        },
      },
    },
    {
      id: 'result',
      level: 7,
      seconds: 4.5,
      show: ['молекула CO₂', 'уравнение C + O₂ → CO₂, подсчёт атомов; стакан известковой воды мутнеет'],
      text: {
        ru: {
          title: 'Итог: углекислый газ',
          body: 'Атом углерода и молекула кислорода дали молекулу углекислого газа CO₂. Углерод в ней четырёхвалентен, кислород двухвалентен. Углекислый газ узнают по помутнению известковой воды.',
          equation: 'C + O₂ → CO₂',
          note: 'Баланс: слева 1 атом C и 2 атома O, справа столько же. Если кислорода мало, уголь сгорает до угарного газа CO (учебник, с. 69–70).',
          speak: 'Углерод сгорел в кислороде — получился углекислый газ. Атомов до и после поровну.',
        },
        en: {
          title: 'Result: carbon dioxide',
          body: 'A carbon atom and an oxygen molecule have given a molecule of carbon dioxide, CO₂. In it carbon has valence IV and oxygen valence II. Carbon dioxide is detected by limewater turning milky.',
          equation: 'C + O₂ → CO₂',
          note: 'Balance: on the left 1 C atom and 2 O atoms, on the right the same. With little oxygen, charcoal burns to carbon monoxide CO (textbook, pp. 69–70).',
          speak: 'Carbon has burned in oxygen — carbon dioxide has formed. There are as many atoms after as before.',
        },
        uz: {
          title: 'Xulosa: karbonat angidrid',
          body: 'Uglerod atomi va kislorod molekulasi karbonat angidrid CO₂ molekulasini berdi. Unda uglerod toʻrt valentli, kislorod ikki valentli. Karbonat angidrid ohakli suvning loyqalanishidan aniqlanadi.',
          equation: 'C + O₂ → CO₂',
          note: 'Balans: chapda 1 ta C va 2 ta O atomi, oʻngda ham shuncha. Kislorod kam boʻlsa, koʻmir is gazi CO gacha yonadi (darslik, 69–70-betlar).',
          speak: 'Uglerod kislorodda yondi — karbonat angidrid hosil boʻldi. Atomlar oldin va keyin teng.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'co2-one-atom',
      kind: 'scene-simplification',
      source: ref('CRYSTAL_DATA.graphite (ядро): слой графита, C–C 142,1 пм'),
      text: {
        ru: 'Уголь — не отдельные атомы: это твёрдое вещество, в графите атомы C соединены в слои. Сцена берёт один атом, чтобы показать его электроны; настоящая реакция идёт на поверхности угля.',
        en: 'Charcoal is not separate atoms: it is a solid, and in graphite the C atoms are joined in layers. The scene takes one atom to show its electrons; the real reaction takes place on the charcoal surface.',
        uz: 'Koʻmir alohida atomlar emas: bu qattiq modda, grafitda C atomlari qatlamlarga birlashgan. Sahna uning elektronlarini koʻrsatish uchun bitta atomni oladi; haqiqiy reaksiya koʻmir sirtida boradi.',
      },
    },
    {
      id: 'co2-excited-carbon',
      kind: 'model-limit',
      source: T9_CARBON_EXCITED,
      text: {
        ru: '«Возбуждённое состояние» углерода (9 кл., с. 10) — удобная модель подсчёта электронов для связей, а не отдельная стадия реакции, которую можно увидеть.',
        en: 'The «excited state» of carbon (grade 9, p. 10) is a convenient model for counting bonding electrons, not a separate stage of the reaction that can be observed.',
        uz: 'Uglerodning «qoʻzgʻalgan holati» (9-sinf, 10-bet) — bogʻ elektronlarini sanash uchun qulay model, kuzatish mumkin boʻlgan alohida reaksiya bosqichi emas.',
      },
    },
    {
      id: 'co2-lack-oxygen',
      kind: 'textbook-simplification',
      source: T7_CO_EXAMPLE,
      text: {
        ru: 'Уголь сгорает до CO₂ только при достатке кислорода; при недостатке образуется угарный газ CO: 2C + O₂ → 2CO (с. 69–70). Сцена показывает полное сгорание, как в § 4.5.',
        en: 'Charcoal burns to CO₂ only with enough oxygen; with too little, carbon monoxide forms: 2C + O₂ → 2CO (pp. 69–70). The scene shows complete burning, as in § 4.5.',
        uz: 'Koʻmir faqat kislorod yetarli boʻlganda CO₂ gacha yonadi; kislorod kam boʻlsa, is gazi hosil boʻladi: 2C + O₂ → 2CO (69–70-betlar). Sahna 4.5-§ dagidek toʻliq yonishni koʻrsatadi.',
      },
    },
  ],
}
