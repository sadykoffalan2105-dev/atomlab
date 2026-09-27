/**
 * NaCl — 2Na + Cl₂ → 2NaCl (Kimyo 7, § 2.12, с. 70 — задание; ионная связь — Kimyo 8, § 16, с. 71–73).
 * Эталонная школьная сцена уже есть (scenes/nacl); спецификация — её научная опора для сверки и пояснений.
 */
import { ref } from './core'
import { ATOM_CL, ATOM_NA, P_CL2, P_NA_METAL, T7_VALENCE, T8_IONIC, T8_LEVELS } from './shared'
import type { ParticleSpec, SchoolSceneSpec, TextbookRef } from './types'

const T7_NACL_TASK: TextbookRef = {
  grade: 7,
  pages: [70],
  section: '§ 2.12',
  title: 'Составление уравнений химических реакций',
  what: 'задание по составлению уравнения: натрий + хлор (в разметке учебника проекта — «Na и Cl₂», equations-g7 r21)',
  asInBook: 'Na и Cl₂',
}

const T7_SALT_PURE: TextbookRef = {
  grade: 7,
  pages: [20],
  section: '§ 1.5',
  title: 'Чистое вещество и смеси',
  what: 'поваренная соль по составу — хлорид натрия, чистое вещество',
}

const T7_NEUTRALIZATION: TextbookRef = {
  grade: 7,
  pages: [142],
  section: '§ 6.6',
  title: 'Реакции нейтрализации',
  what: 'HCl + NaOH → NaCl + H₂O; при выпаривании остаётся поваренная соль',
}

const P_NACL: ParticleSpec = {
  id: 'NaCl',
  formula: 'NaCl',
  name: { ru: 'хлорид натрия, поваренная соль', en: 'sodium chloride, table salt', uz: 'natriy xlorid, osh tuzi' },
  role: 'product',
  phase: 'тв',
  kind: 'ionic-crystal',
  atoms: [
    { id: 'Na', element: 'Na', charge: 1 },
    { id: 'Cl', element: 'Cl', charge: -1 },
  ],
  bonds: [],
  lonePairs: { Cl: 4 },
  unpaired: {},
  charge: 0,
  shape: 'lattice',
  polarity: 'ionic',
  schematic: {
    ru: 'Формульная единица NaCl: один ион Na⁺ и один ион Cl⁻. В кристалле каждый ион окружён шестью ионами противоположного знака; отдельных молекул NaCl нет.',
    en: 'The formula unit NaCl: one Na⁺ ion and one Cl⁻ ion. In the crystal every ion is surrounded by six ions of opposite charge; there are no separate NaCl molecules.',
    uz: 'NaCl formula birligi: bitta Na⁺ ioni va bitta Cl⁻ ioni. Kristallda har bir ion qarama-qarshi ishorali oltita ion bilan oʻralgan; alohida NaCl molekulalari yoʻq.',
  },
}

export const NACL_SPEC: SchoolSceneSpec = {
  id: 'nacl',
  substance: 'NaCl',
  focus: 'NaCl',
  name: { ru: 'Хлорид натрия', en: 'Sodium chloride', uz: 'Natriy xlorid' },
  bondType: 'ionic',
  reaction: {
    equation: '2Na + Cl₂ → 2NaCl',
    reactants: [
      { formula: 'Na', coef: 2, phase: 'тв', particle: 'Na' },
      { formula: 'Cl₂', coef: 1, phase: 'г', particle: 'Cl2' },
    ],
    products: [{ formula: 'NaCl', coef: 2, phase: 'тв', particle: 'NaCl' }],
    reversible: false,
    kind: 'combination',
    bankId: 'na-cl-nacl',
    sources: [T7_NACL_TASK, T8_IONIC],
    conditions: {
      heating: true,
      text: {
        ru: 'слегка нагретый (расплавленный) натрий вносят в хлор — он сгорает ярким жёлтым пламенем',
        en: 'slightly heated (molten) sodium is put into chlorine — it burns with a bright yellow flame',
        uz: 'biroz qizdirilgan (suyuqlangan) natriy xlorga kiritiladi — u yorqin sariq alanga bilan yonadi',
      },
    },
    heat: 'exo',
    heatSource: ref('NIST-JANAF / CRC: ΔH°f(NaCl, тв) < 0 (в ядре — thermoData)'),
  },
  atoms: [ATOM_NA, ATOM_CL],
  particles: [P_NA_METAL, P_CL2, P_NACL],
  mechanism: {
    breaks: [
      {
        particle: 'Cl2',
        a: 'Cla',
        b: 'Clb',
        why: { ru: 'общая пара Cl–Cl расходится: по одному электрону каждому атому', en: 'the Cl–Cl shared pair splits: one electron to each atom', uz: 'Cl–Cl umumiy jufti ajraladi: har bir atomga bittadan elektron' },
      },
    ],
    forms: [],
    electronTransfer: { from: 'Na', to: 'Cl', perAtom: 1 },
  },
  valence: {
    particle: 'NaCl',
    school: { Na: 1, Cl: 1 },
    schoolSource: T7_VALENCE,
    oxidation: { Na: 1, Cl: -1 },
    verdict: { Na: 'ionic', Cl: 'ionic' },
    explain: {
      ru: 'По учебнику натрий и хлор здесь одновалентны. В ионном веществе общих пар нет: натрий отдал один электрон (ион Na⁺), хлор принял один (ион Cl⁻) — «валентность I» равна заряду иона.',
      en: 'By the textbook sodium and chlorine have valence I here. An ionic substance has no shared pairs: sodium gave away one electron (Na⁺ ion), chlorine took one (Cl⁻ ion) — «valence I» equals the charge of the ion.',
      uz: 'Darslik boʻyicha bu yerda natriy va xlor bir valentli. Ionli moddada umumiy juftlar yoʻq: natriy bitta elektron berdi (Na⁺ ioni), xlor bittasini qabul qildi (Cl⁻ ioni) — «I valentlik» ion zaryadiga teng.',
    },
  },
  observations: [
    {
      text: {
        ru: 'Натрий — мягкий серебристый металл, режется ножом; хлор — жёлто-зелёный ядовитый газ с резким запахом.',
        en: 'Sodium is a soft silvery metal that can be cut with a knife; chlorine is a yellow-green poisonous gas with a sharp smell.',
        uz: 'Natriy — pichoq bilan kesiladigan yumshoq kumushrang metall; xlor — oʻtkir hidli sargʻish-yashil zaharli gaz.',
      },
      source: ref('Greenwood & Earnshaw, «Chemistry of the Elements», 2nd ed. (1997), гл. 4 и 17'),
    },
    {
      text: {
        ru: 'Поваренная соль (хлорид натрия) — белое кристаллическое чистое вещество, хорошо растворимое в воде.',
        en: 'Table salt (sodium chloride) is a white crystalline pure substance, readily soluble in water.',
        uz: 'Osh tuzi (natriy xlorid) — oq kristall toza modda, suvda yaxshi eriydi.',
      },
      source: T7_SALT_PURE,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Приправа и консервант; сырьё для получения хлора, натрия и гидроксида натрия. В 7 классе хлорид натрия получают и нейтрализацией: HCl + NaOH → NaCl + H₂O.',
        en: 'Seasoning and preservative; raw material for chlorine, sodium and sodium hydroxide. In grade 7 sodium chloride is also obtained by neutralization: HCl + NaOH → NaCl + H₂O.',
        uz: 'Ziravor va konservant; xlor, natriy va natriy gidroksid olish uchun xomashyo. 7-sinfda natriy xlorid neytrallanish orqali ham olinadi: HCl + NaOH → NaCl + H₂O.',
      },
      source: T7_NEUTRALIZATION,
    },
  ],
  intro: {
    title: { ru: 'Ионная связь', en: 'Ionic bond', uz: 'Ion bogʻlanish' },
    speak: {
      ru: 'Посмотрим, как натрий и хлор превращаются в поваренную соль: электрон переходит от одного атома к другому.',
      en: 'Let us see how sodium and chlorine turn into table salt: an electron passes from one atom to another.',
      uz: 'Natriy va xlor qanday qilib osh tuziga aylanishini koʻramiz: elektron bir atomdan boshqasiga oʻtadi.',
    },
  },
  safety: {
    ru: 'Хлор ядовит, натрий загорается от воды. Опыт «натрий в хлоре» показывает только учитель под тягой.',
    en: 'Chlorine is poisonous, sodium catches fire with water. Only the teacher shows the «sodium in chlorine» experiment, in a fume hood.',
    uz: 'Xlor zaharli, natriy suvdan olov oladi. «Natriy xlorda» tajribasini faqat oʻqituvchi tortuv shkafida koʻrsatadi.',
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 4.5,
      show: ['ячейка металлического натрия (матовый серебристый металл)', 'молекула Cl₂ (одна черта, одна общая пара)', 'подпись «2Na + Cl₂»'],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Натрий — мягкий серебристый металл, в его кристалле атомы Na плотно уложены. Хлор — жёлто-зелёный ядовитый газ из молекул Cl₂, в которых два атома связаны одной общей парой электронов. Натрий сгорает в хлоре — образуется поваренная соль.',
          equation: '2Na + Cl₂',
          note: 'Символ внутри шара — химический знак элемента. Показаны кусочек металла и одна молекула хлора.',
          speak: 'Слева металл натрий, справа молекула хлора. Хлор всегда состоит из двух атомов.',
        },
        en: {
          title: 'Starting substances',
          body: 'Sodium is a soft silvery metal; in its crystal Na atoms are packed closely. Chlorine is a yellow-green poisonous gas of Cl₂ molecules, in which two atoms are joined by one shared pair of electrons. Sodium burns in chlorine — table salt forms.',
          equation: '2Na + Cl₂',
          note: 'The symbol inside a ball is the chemical symbol of the element. A piece of metal and one chlorine molecule are shown.',
          speak: 'On the left sodium metal, on the right a chlorine molecule. Chlorine always consists of two atoms.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Natriy — yumshoq kumushrang metall, uning kristallida Na atomlari zich joylashgan. Xlor — sargʻish-yashil zaharli gaz, u Cl₂ molekulalaridan iborat, ulardagi ikki atom bitta umumiy elektron jufti bilan bogʻlangan. Natriy xlorda yonadi — osh tuzi hosil boʻladi.',
          equation: '2Na + Cl₂',
          note: 'Shar ichidagi belgi — elementning kimyoviy belgisi. Metall boʻlagi va bitta xlor molekulasi koʻrsatilgan.',
          speak: 'Chapda natriy metali, oʻngda xlor molekulasi. Xlor doim ikki atomdan iborat.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5,
      show: ['облака внешнего слоя: Na — 1 электрон, Cl — 7 (3 пары + 1 одиночный, «окно»)', 'схема слоёв Na (+11): 2, 8, 1; Cl (+17): 2, 8, 7'],
      sources: [T8_LEVELS, T8_IONIC],
      text: {
        ru: {
          title: 'Строение атомов натрия и хлора',
          body: 'Заряд ядра натрия +11, электроны расположены на трёх уровнях: 2, 8, 1 — на внешнем уровне один электрон. Заряд ядра хлора +17, электроны: 2, 8, 7 — до завершённого внешнего уровня из восьми электронов хлору не хватает одного.',
          equation: 'Na (+11): 2, 8, 1      Cl (+17): 2, 8, 7',
          note: 'Строение слоёв и ионная связь — материал 8 класса (§ 16). Облако у натрия редкое (один электрон), у хлора плотное (семь электронов) с «окошком» на месте недостающего.',
          speak: 'У натрия на внешнем уровне один электрон, у хлора семь. Хлору не хватает одного до восьми.',
        },
        en: {
          title: 'Structure of sodium and chlorine atoms',
          body: 'The nuclear charge of sodium is +11; its electrons are on three levels: 2, 8, 1 — one electron on the outer level. The nuclear charge of chlorine is +17, electrons: 2, 8, 7 — chlorine lacks one electron to complete an outer level of eight.',
          equation: 'Na (+11): 2, 8, 1      Cl (+17): 2, 8, 7',
          note: 'Electron shells and the ionic bond are grade 8 material (§ 16). The sodium cloud is sparse (one electron), the chlorine cloud dense (seven electrons) with a «window» where one is missing.',
          speak: 'Sodium has one electron on the outer level, chlorine has seven. Chlorine lacks one to reach eight.',
        },
        uz: {
          title: 'Natriy va xlor atomlarining tuzilishi',
          body: 'Natriy yadrosining zaryadi +11, elektronlari uchta pogʻonada: 2, 8, 1 — tashqi pogʻonada bitta elektron. Xlor yadrosining zaryadi +17, elektronlari: 2, 8, 7 — sakkiz elektronli tugallangan tashqi pogʻonagacha xlorga bitta elektron yetishmaydi.',
          equation: 'Na (+11): 2, 8, 1      Cl (+17): 2, 8, 7',
          note: 'Pogʻonalar tuzilishi va ion bogʻlanish — 8-sinf materiali (16-§). Natriy buluti siyrak (bitta elektron), xlorniki zich (yettita elektron), yetishmayotgan elektron oʻrnida «darcha» bor.',
          speak: 'Natriyning tashqi pogʻonasida bitta elektron, xlorda yettita. Xlorga sakkiztagacha bitta yetishmaydi.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 4.5,
      show: ['черта Cl–Cl гаснет, пара расходится — по электрону каждому атому Cl', 'два атома Na выходят из металла'],
      text: {
        ru: {
          title: 'Молекула хлора распадается',
          body: 'Общая пара в молекуле Cl₂ расходится: каждому атому хлора достаётся по одному электрону, и у каждого снова семь внешних электронов. Два атома натрия выходят из металла навстречу атомам хлора.',
          equation: 'Cl–Cl → Cl + Cl',
          note: 'Схема: на самом деле хлор реагирует прямо на поверхности натрия, свободных атомов почти нет. Сцена разбирает реакцию «по атомам», чтобы было видно, куда идёт каждый электрон.',
          speak: 'Молекула хлора распалась на два атома. Каждый готов принять один электрон.',
        },
        en: {
          title: 'The chlorine molecule splits',
          body: 'The shared pair of the Cl₂ molecule splits: each chlorine atom gets one electron, and each again has seven outer electrons. Two sodium atoms leave the metal towards the chlorine atoms.',
          equation: 'Cl–Cl → Cl + Cl',
          note: 'A scheme: in reality chlorine reacts right on the sodium surface, and there are almost no free atoms. The scene takes the reaction apart «atom by atom» to show where each electron goes.',
          speak: 'The chlorine molecule has split into two atoms. Each is ready to take one electron.',
        },
        uz: {
          title: 'Xlor molekulasi parchalanadi',
          body: 'Cl₂ molekulasidagi umumiy juft ajraladi: har bir xlor atomiga bittadan elektron tegadi va har birida yana yettita tashqi elektron boʻladi. Ikkita natriy atomi metalldan xlor atomlari tomon chiqadi.',
          equation: 'Cl–Cl → Cl + Cl',
          note: 'Sxema: aslida xlor natriy sirtida reaksiyaga kirishadi, erkin atomlar deyarli yoʻq. Sahna har bir elektron qayerga borishi koʻrinishi uchun reaksiyani «atomma-atom» ajratadi.',
          speak: 'Xlor molekulasi ikki atomga ajraldi. Har biri bitta elektron qabul qilishga tayyor.',
        },
      },
    },
    {
      id: 'bonding',
      level: 8,
      seconds: 7,
      show: ['электрон летит от Na к «окну» облака Cl (по одному на каждую пару атомов)', 'в кадр поглощения: Na → Na⁺ (меньше), Cl → Cl⁻ (больше)'],
      sources: [T8_IONIC],
      text: {
        ru: {
          title: 'Переход электрона',
          body: 'Натрию проще отдать один внешний электрон, чем принять семь; хлору проще принять один, чем отдать семь. Электрон переходит от атома натрия к атому хлора. Натрий стал ионом Na⁺ — снаружи у него теперь завершённый уровень (2, 8). Хлор стал ионом Cl⁻ — его внешний уровень заполнен до восьми (2, 8, 8).',
          equation: 'Na⁰ − 1e⁻ → Na⁺      Cl⁰ + 1e⁻ → Cl⁻',
          note: 'Ион Na⁺ меньше атома Na — у него на один уровень меньше; ион Cl⁻ больше атома Cl. Полёт электрона по дуге — наглядная схема: на самом деле электрон перескакивает, когда атомы сближаются.',
          speak: 'Натрий отдаёт электрон и становится положительным ионом, хлор принимает и становится отрицательным.',
        },
        en: {
          title: 'Electron transfer',
          body: 'It is easier for sodium to give away one outer electron than to take seven; it is easier for chlorine to take one than to give away seven. The electron passes from the sodium atom to the chlorine atom. Sodium has become an Na⁺ ion — its outer level is now complete (2, 8). Chlorine has become a Cl⁻ ion — its outer level is filled to eight (2, 8, 8).',
          equation: 'Na⁰ − 1e⁻ → Na⁺      Cl⁰ + 1e⁻ → Cl⁻',
          note: 'The Na⁺ ion is smaller than the Na atom — it has one level fewer; the Cl⁻ ion is larger than the Cl atom. The flight of the electron along an arc is a visual scheme: in reality the electron jumps as the atoms approach.',
          speak: 'Sodium gives away an electron and becomes a positive ion, chlorine takes it and becomes a negative one.',
        },
        uz: {
          title: 'Elektronning oʻtishi',
          body: 'Natriy uchun yettita elektron olgandan koʻra bitta tashqi elektronni berish oson; xlor uchun yettitasini bergandan koʻra bittasini olish oson. Elektron natriy atomidan xlor atomiga oʻtadi. Natriy Na⁺ ioniga aylandi — endi uning tashqi pogʻonasi tugallangan (2, 8). Xlor Cl⁻ ioniga aylandi — tashqi pogʻonasi sakkiztagacha toʻldi (2, 8, 8).',
          equation: 'Na⁰ − 1e⁻ → Na⁺      Cl⁰ + 1e⁻ → Cl⁻',
          note: 'Na⁺ ioni Na atomidan kichik — unda bitta pogʻona kam; Cl⁻ ioni Cl atomidan katta. Elektronning yoy boʻylab uchishi — koʻrgazmali sxema: aslida elektron atomlar yaqinlashganda sakraydi.',
          speak: 'Natriy elektron beradi va musbat ionga aylanadi, xlor uni qabul qiladi va manfiy ionga aylanadi.',
        },
      },
    },
    {
      id: 'product',
      level: 8,
      seconds: 5.5,
      show: ['ионы Na⁺ и Cl⁻ притягиваются', 'фрагмент кубической решётки: у иона шесть соседей противоположного знака'],
      sources: [T8_IONIC],
      text: {
        ru: {
          title: 'Ионная связь и кристалл',
          body: 'Положительные ионы Na⁺ и отрицательные ионы Cl⁻ притягиваются — это ионная связь. Каждый ион притягивает всех соседей противоположного знака, поэтому ионы выстраиваются в кубическую решётку: вокруг каждого иона шесть ионов другого знака. Отдельных молекул NaCl в кристалле нет.',
          equation: 'Na⁺ + Cl⁻ → NaCl (кристалл)',
          note: 'Общей электронной пары у ионов нет: электрон целиком перешёл к хлору. Показан маленький кусочек кристалла; тонкие линии — рёбра куба, а не связи.',
          speak: 'Плюс и минус притягиваются. Ионы укладываются в кубическую решётку.',
        },
        en: {
          title: 'Ionic bond and crystal',
          body: 'Positive Na⁺ ions and negative Cl⁻ ions attract each other — this is the ionic bond. Each ion attracts all neighbours of opposite charge, so the ions line up in a cubic lattice: around every ion there are six ions of the other charge. There are no separate NaCl molecules in the crystal.',
          equation: 'Na⁺ + Cl⁻ → NaCl (crystal)',
          note: 'The ions have no shared electron pair: the electron has passed completely to chlorine. A small piece of the crystal is shown; the thin lines are cube edges, not bonds.',
          speak: 'Plus and minus attract. The ions pack into a cubic lattice.',
        },
        uz: {
          title: 'Ion bogʻlanish va kristall',
          body: 'Musbat Na⁺ ionlari va manfiy Cl⁻ ionlari bir-biriga tortiladi — bu ion bogʻlanish. Har bir ion qarama-qarshi ishorali barcha qoʻshnilarini tortadi, shuning uchun ionlar kub panjaraga tiziladi: har bir ion atrofida boshqa ishorali oltita ion bor. Kristallda alohida NaCl molekulalari yoʻq.',
          equation: 'Na⁺ + Cl⁻ → NaCl (kristall)',
          note: 'Ionlarda umumiy elektron jufti yoʻq: elektron butunlay xlorga oʻtgan. Kristallning kichik boʻlagi koʻrsatilgan; ingichka chiziqlar — kub qirralari, bogʻlanishlar emas.',
          speak: 'Musbat va manfiy tortishadi. Ionlar kub panjaraga joylashadi.',
        },
      },
    },
    {
      id: 'summary',
      level: 7,
      seconds: 4.5,
      show: ['решётка NaCl медленно поворачивается', 'уравнение 2Na + Cl₂ → 2NaCl и баланс электронов'],
      text: {
        ru: {
          title: 'Итог: поваренная соль',
          body: 'Каждый атом натрия отдал один электрон, каждый атом хлора принял один. Образовались ионы Na⁺ и Cl⁻, которые удерживает ионная связь, — это хлорид натрия, поваренная соль. Вещества с ионной решёткой твёрдые и плавятся при высокой температуре.',
          equation: '2Na + Cl₂ → 2NaCl',
          note: 'Сколько электронов отдано, столько и принято: два атома натрия отдали два электрона, молекула хлора приняла два. Баланс атомов: слева 2 Na и 2 Cl, справа столько же.',
          speak: 'Натрий отдал электроны, хлор их принял. Получилась поваренная соль с ионной связью.',
        },
        en: {
          title: 'Result: table salt',
          body: 'Each sodium atom gave away one electron, each chlorine atom took one. Na⁺ and Cl⁻ ions have formed, held by the ionic bond — this is sodium chloride, table salt. Substances with an ionic lattice are solid and melt at a high temperature.',
          equation: '2Na + Cl₂ → 2NaCl',
          note: 'As many electrons are given as are taken: two sodium atoms gave two electrons, the chlorine molecule took two. Atom balance: on the left 2 Na and 2 Cl, on the right the same.',
          speak: 'Sodium gave away electrons, chlorine took them. Table salt with an ionic bond has formed.',
        },
        uz: {
          title: 'Xulosa: osh tuzi',
          body: 'Har bir natriy atomi bitta elektron berdi, har bir xlor atomi bittasini qabul qildi. Ion bogʻlanish ushlab turadigan Na⁺ va Cl⁻ ionlari hosil boʻldi — bu natriy xlorid, osh tuzi. Ion panjarali moddalar qattiq va yuqori haroratda suyuqlanadi.',
          equation: '2Na + Cl₂ → 2NaCl',
          note: 'Qancha elektron berilgan boʻlsa, shuncha qabul qilingan: ikki natriy atomi ikki elektron berdi, xlor molekulasi ikkitasini oldi. Atomlar balansi: chapda 2 ta Na va 2 ta Cl, oʻngda ham shuncha.',
          speak: 'Natriy elektronlarini berdi, xlor ularni qabul qildi. Ion bogʻlanishli osh tuzi hosil boʻldi.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'nacl-atom-path',
      kind: 'scene-simplification',
      source: ref('Polanyi, «Atomic Reactions» (1932); Herschbach, Nobel Lecture (1986): «гарпунный» механизм M + X₂'),
      text: {
        ru: 'Отдельные атомы Na и Cl — мысленный путь реакции (как в цикле расчёта энергии), а не то, что происходит в колбе: хлор реагирует на поверхности натрия. В газе электрон «перепрыгивает» от натрия к хлору ещё до касания атомов.',
        en: 'Separate Na and Cl atoms are an imagined path of the reaction (as in an energy cycle), not what happens in the flask: chlorine reacts on the surface of sodium. In the gas the electron «jumps» from sodium to chlorine even before the atoms touch.',
        uz: 'Alohida Na va Cl atomlari — reaksiyaning xayoliy yoʻli (energiya hisobi siklidagidek), kolbada sodir boʻladigan narsa emas: xlor natriy sirtida reaksiyaga kirishadi. Gazda elektron atomlar tegishidan oldinroq natriydan xlorga «sakraydi».',
      },
    },
    {
      id: 'nacl-grade',
      kind: 'textbook-simplification',
      source: T7_NEUTRALIZATION,
      text: {
        ru: 'В 7 классе хлорид натрия встречается как поваренная соль и продукт нейтрализации HCl + NaOH (с. 142); ионную связь изучают в 8 классе (§ 16). Поэтому шаги со строением атома и ионами помечены уровнем 8.',
        en: 'In grade 7 sodium chloride appears as table salt and as the product of neutralization HCl + NaOH (p. 142); the ionic bond is studied in grade 8 (§ 16). That is why the steps with atomic structure and ions are marked level 8.',
        uz: '7-sinfda natriy xlorid osh tuzi va HCl + NaOH neytrallanish mahsuloti sifatida uchraydi (142-bet); ion bogʻlanish 8-sinfda oʻrganiladi (16-§). Shuning uchun atom tuzilishi va ionlar qadamlari 8-daraja deb belgilangan.',
      },
    },
  ],
}
