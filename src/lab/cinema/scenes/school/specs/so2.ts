/**
 * SO₂ — S + O₂ → SO₂ (Kimyo 7, § 4.5, с. 95; опыт § 4.7, с. 101; свойства — Kimyo 8, § 31, с. 136).
 * Показываем O=S=O (сера IV) с неподелённой парой у S; угол 119,5°, S=O 143,1 пм (ядро), полярная молекула.
 */
import { ref } from './core'
import { ATOM_O, ATOM_S, P_O2, P_S_SOLID, P_SO2, T7_FLAME_PRACTICE, T7_OXYGEN_PROPS, T7_VALENCE, T8_COVALENT, T8_LEVELS, T8_SULFUR_OXIDES, LEGEND } from './shared'
import type { SchoolScienceSpec, TextbookRef } from './types'

const T7_ACID_RAIN: TextbookRef = {
  grade: 7,
  pages: [126],
  section: '§ 5.7',
  title: 'Кислотные дожди',
  what: 'оксид азота (IV) NO₂ и оксид серы (IV) SO₂ в атмосфере превращаются в кислоты',
}

const T7_WATER_CHEM: TextbookRef = {
  grade: 7,
  pages: [138],
  section: '§ 6.4',
  title: 'Химические свойства воды',
  what: 'SO₂ + H₂O = H₂SO₃; SO₃ + H₂O = H₂SO₄; CO₂ + H₂O = H₂CO₃',
}

export const SO2_SPEC: SchoolScienceSpec = {
  id: 'so2',
  substance: 'SO₂',
  focus: 'SO2',
  name: { ru: 'Сернистый газ', en: 'Sulfur dioxide', uz: 'Sulfit angidrid' },
  bondType: 'covalent-polar',
  reaction: {
    equation: 'S + O₂ → SO₂',
    reactants: [
      { formula: 'S', coef: 1, phase: 'тв', particle: 'S' },
      { formula: 'O₂', coef: 1, phase: 'г', particle: 'O2' },
    ],
    products: [{ formula: 'SO₂', coef: 1, phase: 'г', particle: 'SO2' }],
    reversible: false,
    kind: 'combustion',
    bankId: 's-o2-so2',
    sources: [T7_OXYGEN_PROPS, T7_FLAME_PRACTICE, T8_SULFUR_OXIDES],
    conditions: {
      heating: true,
      text: {
        ru: 'серу нагревают в ложечке до загорания и вносят в кислород',
        en: 'sulfur is heated in a spoon until it ignites and is put into oxygen',
        uz: 'oltingugurt qoshiqchada yonguncha qizdiriladi va kislorodga kiritiladi',
      },
    },
    heat: 'exo',
    heatSource: ref('NIST-JANAF: ΔH°f(SO₂, г) < 0 (ядро: thermoData «SO2(g)»)'),
  },
  atoms: [ATOM_S, ATOM_O],
  particles: [P_S_SOLID, P_O2, P_SO2],
  mechanism: {
    splitElectrons: [
      {
        particle: 'S',
        atom: 'S',
        lone: 1,
        unpaired: 4,
        why: {
          ru: 'для двух двойных связей сере нужны четыре электрона; одна пара остаётся неподелённой',
          en: 'for two double bonds sulfur needs four electrons; one pair stays unshared',
          uz: 'ikkita qoʻsh bogʻ uchun oltingugurtga toʻrtta elektron kerak; bitta juft boʻlinmagan qoladi',
        },
      },
    ],
    breaks: [
      {
        particle: 'O2',
        a: 'Oa',
        b: 'Ob',
        why: { ru: 'две общие пары O=O расходятся', en: 'the two O=O shared pairs split', uz: 'ikkita O=O umumiy jufti ajraladi' },
      },
    ],
    forms: [
      {
        particle: 'SO2',
        a: 'S',
        b: 'O1',
        how: 'shared-pair',
        why: { ru: 'два электрона S + два неспаренных электрона O', en: 'two S electrons + two unpaired O electrons', uz: 'S ning ikki elektroni + O ning ikki juftlashmagan elektroni' },
      },
      {
        particle: 'SO2',
        a: 'S',
        b: 'O2',
        how: 'shared-pair',
        why: { ru: 'ещё два электрона S + второй атом O; пара S остаётся неподелённой', en: 'two more S electrons + the second O atom; one S pair stays unshared', uz: 'S ning yana ikki elektroni + ikkinchi O atomi; S ning bitta jufti boʻlinmagan qoladi' },
      },
    ],
  },
  valence: {
    particle: 'SO2',
    school: { S: 4, O: 2 },
    schoolSource: T7_VALENCE,
    oxidation: { S: 4, O: -2 },
    verdict: { S: 'match', O: 'match' },
    explain: {
      ru: 'Учебник: у серы валентности II, IV, VI (с. 52); в SO₂ — IV. В формуле O=S=O у серы четыре общие пары — совпадает. Пятый и шестой внешние электроны серы остаются неподелённой парой.',
      en: 'Textbook: sulfur has valences II, IV, VI (p. 52); in SO₂ it is IV. In the formula O=S=O sulfur has four shared pairs — this matches. The fifth and sixth outer electrons of sulfur stay as a lone pair.',
      uz: 'Darslik: oltingugurt valentliklari II, IV, VI (52-bet); SO₂ da — IV. O=S=O formulasida oltingugurtda toʻrtta umumiy juft — mos keladi. Oltingugurtning beshinchi va oltinchi tashqi elektronlari boʻlinmagan juft boʻlib qoladi.',
    },
  },
  observations: [
    {
      text: {
        ru: 'Сера горит на воздухе слабым синим пламенем, в кислороде — ярким сине-фиолетовым.',
        en: 'Sulfur burns in air with a faint blue flame and in oxygen with a bright blue-violet one.',
        uz: 'Oltingugurt havoda xira koʻk alanga bilan, kislorodda esa yorqin koʻk-binafsha alanga bilan yonadi.',
      },
      source: ref('Greenwood & Earnshaw, «Chemistry of the Elements», 2nd ed. (1997), § 15.2; опыт 4 учебника 7 кл., с. 101'),
    },
    {
      text: {
        ru: 'Оксид серы(IV) — бесцветный ядовитый газ с резким удушливым запахом; при −10 °C становится жидкостью.',
        en: 'Sulfur(IV) oxide is a colourless poisonous gas with a sharp choking smell; at −10 °C it becomes a liquid.',
        uz: 'Oltingugurt(IV) oksidi — oʻtkir boʻgʻuvchi hidli rangsiz zaharli gaz; −10 °C da suyuqlikka aylanadi.',
      },
      source: T8_SULFUR_OXIDES,
    },
    {
      text: {
        ru: 'С водой даёт сернистую кислоту: SO₂ + H₂O → H₂SO₃; в атмосфере вызывает кислотные дожди.',
        en: 'With water it gives sulfurous acid: SO₂ + H₂O → H₂SO₃; in the atmosphere it causes acid rain.',
        uz: 'Suv bilan sulfit kislota beradi: SO₂ + H₂O → H₂SO₃; atmosferada kislotali yomgʻirlarga sabab boʻladi.',
      },
      source: T7_WATER_CHEM,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Производство серной кислоты; обесцвечивание красителей, консервирование сухофруктов (кураги).',
        en: 'Production of sulfuric acid; bleaching dyes, preserving dried fruit (dried apricots).',
        uz: 'Sulfat kislota ishlab chiqarish; boʻyoqlarni rangsizlantirish, quritilgan mevalarni (qoqi) saqlash.',
      },
      source: T8_SULFUR_OXIDES,
    },
    {
      text: {
        ru: 'Вместе с NO₂ — главный источник кислотных дождей.',
        en: 'Together with NO₂ it is the main source of acid rain.',
        uz: 'NO₂ bilan birga kislotali yomgʻirlarning asosiy manbai.',
      },
      source: T7_ACID_RAIN,
    },
  ],
  intro: {
    title: { ru: 'Горение серы', en: 'Burning sulfur', uz: 'Oltingugurtning yonishi' },
    speak: {
      ru: 'Посмотрим, как сера сгорает в кислороде и почему молекула сернистого газа изогнута.',
      en: 'Let us see how sulfur burns in oxygen and why the sulfur dioxide molecule is bent.',
      uz: 'Oltingugurt kislorodda qanday yonishini va sulfit angidrid molekulasi nega egilganini koʻramiz.',
    },
  },
  safety: {
    ru: 'Сернистый газ ядовит и раздражает дыхательные пути. Опыт проводят в закрытой колбе под тягой, сосуд после опыта закрывают пробкой.',
    en: 'Sulfur dioxide is poisonous and irritates the airways. The experiment is done in a closed flask in a fume hood, and the vessel is stoppered afterwards.',
    uz: 'Sulfit angidrid zaharli va nafas yoʻllarini qitiqlaydi. Tajriba tortuv shkafida yopiq kolbada oʻtkaziladi, idish tajribadan keyin tiqin bilan yopiladi.',
  },
  legend: LEGEND,
  captions: {
    reactants: { ru: 'сера + кислород', en: 'sulfur + oxygen', uz: 'oltingugurt + kislorod' },
    result: { ru: 'O=S=O, 119,5°', en: 'O=S=O, 119.5°', uz: 'O=S=O, 119,5°' },
    condition: { ru: 't°', en: 't°', uz: 't°' },
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 4.5,
      show: ['кусочек серы (жёлтый), из кольца S₈ выделен один атом S', 'молекула O₂ (O=O)', 'подпись «S + O₂»'],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Сера — жёлтое твёрдое вещество, кислород O₂ — бесцветный газ, в его молекуле две общие пары. Нагретая сера загорается и в кислороде горит ярким синим пламенем.',
          equation: 'S + O₂',
          note: 'В сцене — один атом серы. Твёрдая сера состоит из колец по восемь атомов S₈; при горении связи S–S рвутся.',
          speak: 'Слева сера, справа молекула кислорода.',
        },
        en: {
          title: 'Starting substances',
          body: 'Sulfur is a yellow solid, oxygen O₂ is a colourless gas with two shared pairs in its molecule. Heated sulfur catches fire and burns in oxygen with a bright blue flame.',
          equation: 'S + O₂',
          note: 'The scene shows one sulfur atom. Solid sulfur is made of rings of eight atoms, S₈; on burning the S–S bonds break.',
          speak: 'On the left sulfur, on the right an oxygen molecule.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Oltingugurt — sariq qattiq modda, kislorod O₂ — rangsiz gaz, uning molekulasida ikkita umumiy juft bor. Qizdirilgan oltingugurt alangalanadi va kislorodda yorqin koʻk alanga bilan yonadi.',
          equation: 'S + O₂',
          note: 'Sahnada bitta oltingugurt atomi. Qattiq oltingugurt sakkiz atomli S₈ halqalaridan iborat; yonishda S–S bogʻlari uziladi.',
          speak: 'Chapda oltingugurt, oʻngda kislorod molekulasi.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5.5,
      show: ['облако S: 6 точек (2 пары + 2 одиночных), третий слой', 'облако O: 6 точек', 'схема S (+16): 2, 8, 6; O (+8): 2, 6'],
      sources: [T8_LEVELS],
      text: {
        ru: {
          title: 'Строение атомов серы и кислорода',
          body: 'Заряд ядра серы +16, электроны расположены на трёх уровнях: 2, 8, 6. Заряд ядра кислорода +8: 2, 6. У обоих атомов на внешнем уровне шесть электронов — сера и кислород стоят в одной группе. Но у серы внешний уровень дальше от ядра, и она может отдавать в связи больше электронов: её валентность бывает II, IV и VI.',
          equation: 'S (+16): 2, 8, 6      O (+8): 2, 6',
          note: 'Строение слоёв — материал 8 класса. Облака внешнего уровня у S и O выглядят одинаково по числу точек (шесть), но облако серы больше.',
          speak: 'У серы и у кислорода по шесть внешних электронов. Но сера больше и может образовать больше связей.',
        },
        en: {
          title: 'Structure of sulfur and oxygen atoms',
          body: 'The nuclear charge of sulfur is +16; its electrons are on three levels: 2, 8, 6. The nuclear charge of oxygen is +8: 2, 6. Both atoms have six electrons on the outer level — sulfur and oxygen are in the same group. But sulfur’s outer level is farther from the nucleus, and it can use more electrons in bonds: its valence can be II, IV and VI.',
          equation: 'S (+16): 2, 8, 6      O (+8): 2, 6',
          note: 'Electron shells are grade 8 material. The outer-level clouds of S and O have the same number of dots (six), but the sulfur cloud is larger.',
          speak: 'Sulfur and oxygen each have six outer electrons. But sulfur is bigger and can form more bonds.',
        },
        uz: {
          title: 'Oltingugurt va kislorod atomlarining tuzilishi',
          body: 'Oltingugurt yadrosining zaryadi +16, elektronlari uchta pogʻonada: 2, 8, 6. Kislorod yadrosining zaryadi +8: 2, 6. Ikkala atomning tashqi pogʻonasida oltitadan elektron — oltingugurt va kislorod bitta guruhda. Lekin oltingugurtning tashqi pogʻonasi yadrodan uzoqroq va u bogʻlarga koʻproq elektron bera oladi: uning valentligi II, IV va VI boʻladi.',
          equation: 'S (+16): 2, 8, 6      O (+8): 2, 6',
          note: 'Pogʻonalar tuzilishi — 8-sinf materiali. S va O tashqi pogʻona bulutlaridagi nuqtalar soni bir xil (oltita), lekin oltingugurt buluti kattaroq.',
          speak: 'Oltingugurt va kislorodda oltitadan tashqi elektron bor. Lekin oltingugurt kattaroq va koʻproq bogʻ hosil qila oladi.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 4.5,
      show: ['связи S–S кольца у выделенного атома гаснут', 'O=O гаснет, атомы O расходятся'],
      text: {
        ru: {
          title: 'Связи рвутся',
          body: 'При горении рвутся связи между атомами серы в кольце и обе общие пары в молекуле кислорода. Атом серы и два атома кислорода свободны и готовы соединиться.',
          equation: 'O=O → O + O',
          note: 'Схема: сера плавится и испаряется, в пламени реагируют молекулы серы с молекулами кислорода; сцена показывает только, какие связи рвутся.',
          speak: 'Связи в сере и в кислороде рвутся — атомы готовы соединиться по-новому.',
        },
        en: {
          title: 'Bonds break',
          body: 'On burning, the bonds between the sulfur atoms of the ring and both shared pairs of the oxygen molecule break. A sulfur atom and two oxygen atoms are free and ready to join.',
          equation: 'O=O → O + O',
          note: 'A scheme: sulfur melts and evaporates, and in the flame sulfur molecules react with oxygen molecules; the scene shows only which bonds break.',
          speak: 'The bonds in sulfur and in oxygen break — the atoms are ready to join in a new way.',
        },
        uz: {
          title: 'Bogʻlar uziladi',
          body: 'Yonishda halqadagi oltingugurt atomlari orasidagi bogʻlar va kislorod molekulasidagi ikkala umumiy juft uziladi. Oltingugurt atomi va ikkita kislorod atomi erkin va birikishga tayyor.',
          equation: 'O=O → O + O',
          note: 'Sxema: oltingugurt suyuqlanadi va bugʻlanadi, alangada oltingugurt molekulalari kislorod molekulalari bilan reaksiyaga kirishadi; sahna faqat qaysi bogʻlar uzilishini koʻrsatadi.',
          speak: 'Oltingugurt va kisloroddagi bogʻlar uzildi — atomlar yangicha birikishga tayyor.',
        },
      },
    },
    {
      id: 'pairs',
      level: 8,
      seconds: 6,
      show: ['с каждым атомом O — по две пары между ядрами (двойные связи)', 'у S остаётся одна неподелённая пара (две точки сверху)'],
      sources: [T8_COVALENT],
      text: {
        ru: {
          title: 'Двойные связи и неподелённая пара',
          body: 'Каждый атом кислорода образует с серой две общие пары — двойную связь S=O. В связях участвуют четыре внешних электрона серы, а два оставшихся — неподелённая пара. Кислород притягивает общие пары сильнее — связи полярные.',
          equation: 'O + S + O → O=S=O',
          note: 'Как сера «освобождает» четыре электрона для связей, подробно объясняют в старших классах; сцена показывает подсчёт: четыре электрона серы в связях и одна неподелённая пара.',
          speak: 'У серы четыре электрона ушли в две двойные связи, а одна пара осталась свободной.',
        },
        en: {
          title: 'Double bonds and a lone pair',
          body: 'Each oxygen atom forms two shared pairs with sulfur — an S=O double bond. Four outer electrons of sulfur take part in bonds, and the remaining two form a lone pair. Oxygen attracts the shared pairs more strongly — the bonds are polar.',
          equation: 'O + S + O → O=S=O',
          note: 'How sulfur «frees» four electrons for bonding is explained in detail in higher grades; the scene shows the count: four sulfur electrons in bonds and one lone pair.',
          speak: 'Four of sulfur’s electrons went into two double bonds, and one pair stayed free.',
        },
        uz: {
          title: 'Qoʻsh bogʻlar va boʻlinmagan juft',
          body: 'Har bir kislorod atomi oltingugurt bilan ikkita umumiy juft — S=O qoʻsh bogʻini hosil qiladi. Bogʻlarda oltingugurtning toʻrtta tashqi elektroni qatnashadi, qolgan ikkitasi — boʻlinmagan juft. Kislorod umumiy juftlarni kuchliroq tortadi — bogʻlar qutbli.',
          equation: 'O + S + O → O=S=O',
          note: 'Oltingugurt bogʻlar uchun toʻrtta elektronni qanday «boʻshatishi» yuqori sinflarda batafsil tushuntiriladi; sahna sanashni koʻrsatadi: oltingugurtning toʻrtta elektroni bogʻlarda va bitta boʻlinmagan juft.',
          speak: 'Oltingugurtning toʻrtta elektroni ikkita qoʻsh bogʻga ketdi, bitta juft esa boʻsh qoldi.',
        },
      },
    },
    {
      id: 'molecule',
      level: 7,
      seconds: 5.5,
      show: ['молекула O=S=O изогнута, дуга 119,5°', 'неподелённая пара S над вершиной угла; δ+ на S, δ− на O'],
      text: {
        ru: {
          title: 'Молекула сернистого газа',
          body: 'Неподелённая пара серы отталкивает связи, поэтому молекула SO₂ изогнута: угол O–S–O равен 119,5°. Связи полярные, а молекула изогнута — SO₂ полярная молекула. Обе связи S=O одинаковые, их длина 143,1 пм.',
          equation: 'O=S=O   ∠ 119,5°',
          note: 'Формула O=S=O — удобная школьная модель: на деле обе связи сильно полярны, и часть электронов сдвинута к кислороду, но длины связей одинаковы, как и показано.',
          speak: 'Молекула сернистого газа изогнута — как молекула воды, только угол больше.',
        },
        en: {
          title: 'The sulfur dioxide molecule',
          body: 'The lone pair of sulfur repels the bonds, so the SO₂ molecule is bent: the O–S–O angle is 119.5°. The bonds are polar and the molecule is bent — SO₂ is a polar molecule. Both S=O bonds are identical, their length is 143.1 pm.',
          equation: 'O=S=O   ∠ 119.5°',
          note: 'The formula O=S=O is a convenient school model: in reality both bonds are strongly polar and some electrons are shifted to oxygen, but the bond lengths are equal, as shown.',
          speak: 'The sulfur dioxide molecule is bent — like a water molecule, only with a wider angle.',
        },
        uz: {
          title: 'Sulfit angidrid molekulasi',
          body: 'Oltingugurtning boʻlinmagan jufti bogʻlarni itaradi, shuning uchun SO₂ molekulasi egilgan: O–S–O burchagi 119,5°. Bogʻlar qutbli, molekula esa egilgan — SO₂ qutbli molekula. Ikkala S=O bogʻi bir xil, uzunligi 143,1 pm.',
          equation: 'O=S=O   ∠ 119,5°',
          note: 'O=S=O formulasi — qulay maktab modeli: aslida ikkala bogʻ kuchli qutbli va elektronlarning bir qismi kislorodga siljigan, lekin bogʻ uzunliklari koʻrsatilgandek bir xil.',
          speak: 'Sulfit angidrid molekulasi egilgan — suv molekulasi kabi, faqat burchagi kattaroq.',
        },
      },
    },
    {
      id: 'result',
      level: 7,
      seconds: 4.5,
      show: ['молекула SO₂', 'уравнение S + O₂ → SO₂, подсчёт атомов'],
      text: {
        ru: {
          title: 'Итог: оксид серы(IV)',
          body: 'Атом серы и молекула кислорода дали молекулу оксида серы(IV) SO₂ — сернистого газа. Сера в нём четырёхвалентна. Это бесцветный ядовитый газ с резким удушливым запахом; с водой он даёт сернистую кислоту.',
          equation: 'S + O₂ → SO₂',
          note: 'Баланс: слева 1 атом S и 2 атома O, справа столько же. Если окислить SO₂ дальше, получится оксид серы(VI) SO₃ — следующая сцена.',
          speak: 'Сера сгорела в кислороде — получился сернистый газ SO₂, сера в нём четырёхвалентна.',
        },
        en: {
          title: 'Result: sulfur(IV) oxide',
          body: 'A sulfur atom and an oxygen molecule have given a molecule of sulfur(IV) oxide, SO₂ — sulfur dioxide. Sulfur in it has valence IV. It is a colourless poisonous gas with a sharp choking smell; with water it gives sulfurous acid.',
          equation: 'S + O₂ → SO₂',
          note: 'Balance: on the left 1 S atom and 2 O atoms, on the right the same. If SO₂ is oxidized further, sulfur(VI) oxide SO₃ forms — the next scene.',
          speak: 'Sulfur has burned in oxygen — sulfur dioxide SO₂ has formed, and sulfur in it has valence IV.',
        },
        uz: {
          title: 'Xulosa: oltingugurt(IV) oksidi',
          body: 'Oltingugurt atomi va kislorod molekulasi oltingugurt(IV) oksidi SO₂ — sulfit angidrid molekulasini berdi. Unda oltingugurt toʻrt valentli. Bu oʻtkir boʻgʻuvchi hidli rangsiz zaharli gaz; suv bilan sulfit kislota beradi.',
          equation: 'S + O₂ → SO₂',
          note: 'Balans: chapda 1 ta S va 2 ta O atomi, oʻngda ham shuncha. SO₂ yana oksidlansa, oltingugurt(VI) oksidi SO₃ hosil boʻladi — keyingi sahna.',
          speak: 'Oltingugurt kislorodda yondi — sulfit angidrid SO₂ hosil boʻldi, unda oltingugurt toʻrt valentli.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'so2-resonance',
      kind: 'model-limit',
      source: ref('Greenwood & Earnshaw (1997), § 15.2.5; современные расчёты: d-орбитали серы в связи почти не участвуют'),
      text: {
        ru: 'O=S=O — школьная модель с валентностью IV. В старых пособиях четыре электрона для связей объясняют «переходом на 3d-подуровень»; современная химия показывает, что d-орбитали почти не участвуют, а связи S–O сильно полярны. Обе связи одинаковы — это сцена показывает точно.',
        en: 'O=S=O is a school model with valence IV. Older books explain the four bonding electrons by «promotion to the 3d sublevel»; modern chemistry shows that d orbitals hardly take part and the S–O bonds are strongly polar. Both bonds are identical — this the scene shows exactly.',
        uz: 'O=S=O — IV valentlikli maktab modeli. Eski qoʻllanmalarda bogʻ uchun toʻrtta elektron «3d-pogʻonachaga oʻtish» bilan tushuntiriladi; zamonaviy kimyo d-orbitallar deyarli qatnashmasligini va S–O bogʻlari kuchli qutbli ekanini koʻrsatadi. Ikkala bogʻ bir xil — buni sahna aniq koʻrsatadi.',
      },
    },
    {
      id: 'so2-s8',
      kind: 'scene-simplification',
      source: ref('BOND_DATA «S-S» (ядро): кольцо S₈'),
      text: {
        ru: 'Твёрдая сера — кольца S₈, а не отдельные атомы; при горении сера плавится и испаряется. Сцена берёт один атом S, чтобы был виден подсчёт электронов.',
        en: 'Solid sulfur consists of S₈ rings, not separate atoms; on burning sulfur melts and evaporates. The scene takes one S atom so that the electron count is visible.',
        uz: 'Qattiq oltingugurt — alohida atomlar emas, S₈ halqalari; yonishda oltingugurt suyuqlanadi va bugʻlanadi. Elektronlar sanogʻi koʻrinishi uchun sahna bitta S atomini oladi.',
      },
    },
  ],
}
