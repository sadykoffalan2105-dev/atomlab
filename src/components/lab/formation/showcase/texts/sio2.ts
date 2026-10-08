/**
 * Тексты showcase SiO₂ (кварц): подписи этапов панели и HUD-карточки фактов (RU / EN / UZ).
 * Источники: Kimyo 8 § 17 п. 2 (атомная кристаллическая решётка, с. 74–75); Kimyo 9 § 1–2 (s²p² → s¹p³, с. 10;
 * Si 3s²3p²3d⁰, с. 14), § «Кремний» (с. 62–64: Si + O₂ = SiO₂ при сильном нагревании; SiO₂ — твёрдое, тугоплавкое,
 * нерастворимое, атомная решётка; кварц, горный хрусталь, кремень, агат, яшма, песок; SiO₂ + 4HF; SiO₂ + 2NaOH при
 * сплавлении; кварцевое стекло из расплава). Справочные значения: Si–O 0,161 нм, ∠O–Si–O 109,5°, ∠Si–O–Si ≈ 144°
 * (α-кварц, crystalData), ЭО по Полингу Si 1,90 / O 3,44, E(O=O) 498 кДж/моль, E(Si–O) ≈ 450 кДж/моль.
 */
import type { ShowcaseTexts } from './index'

export const SIO2_TEXTS: ShowcaseTexts = {
  stages: {
    reagents: {
      title: ['Исходные: кремний и кислород', 'Reactants: silicon and oxygen', 'Dastlabki moddalar: kremniy va kislorod'],
      main: [
        'Кремний — атомный кристалл: каждый атом Si держит четырёх соседей ковалентными связями. Кислород — молекулы O₂ с двойной связью (σ + π).',
        'Silicon is an atomic crystal: every Si atom holds four neighbours by covalent bonds. Oxygen comes as O₂ molecules with a double bond (σ + π).',
        'Kremniy — atom kristall: har bir Si atomi to‘rtta qo‘shnisini kovalent bog‘lar bilan ushlab turadi. Kislorod — qo‘sh bog‘li (σ + π) O₂ molekulalari.',
      ],
      sub: ['Kimyo 8, § 17 п. 2; Kimyo 9, § «Кремний»: Si + O₂ = SiO₂ при сильном нагревании', 'Kimyo 8, § 17 (2); Kimyo 9, “Silicon”: Si + O₂ = SiO₂ on strong heating', 'Kimyo 8, § 17 (2); Kimyo 9, «Kremniy»: kuchli qizdirilganda Si + O₂ = SiO₂'],
    },
    break: {
      title: ['Сильный нагрев', 'Strong heating', 'Kuchli qizdirish'],
      main: [
        'Кремний сгорает только при сильном нагревании: нужно разорвать прочную двойную связь O=O (498 кДж/моль) и вырвать атомы Si из кристалла.',
        'Silicon burns only on strong heating: the sturdy O=O double bond (498 kJ/mol) must break and Si atoms must be pulled out of the crystal.',
        'Kremniy faqat kuchli qizdirilganda yonadi: mustahkam O=O qo‘sh bog‘ni (498 kJ/mol) uzish va Si atomlarini kristalldan ajratish kerak.',
      ],
      sub: ['Kimyo 9, с. 62: «при сильном нагревании кремний сгорает в воздухе»', 'Kimyo 9, p. 62: silicon burns in air on strong heating', 'Kimyo 9, 62-bet: kremniy kuchli qizdirilganda havoda yonadi'],
    },
    approach: {
      title: ['Атомы сближаются', 'Atoms approach', 'Atomlar yaqinlashadi'],
      main: [
        'Атом кремния крупнее атома углерода, но валентных электронов у него столько же — четыре (3s²3p²). Атомы кислорода подходят со всех сторон.',
        'A silicon atom is larger than carbon, yet it has the same four valence electrons (3s²3p²). Oxygen atoms close in from every side.',
        'Kremniy atomi uglerod atomidan yirikroq, lekin valent elektronlari xuddi shuncha — to‘rtta (3s²3p²). Kislorod atomlari har tomondan yaqinlashadi.',
      ],
    },
    valence: {
      title: ['Валентные электроны', 'Valence electrons', 'Valent elektronlar'],
      main: [
        'Si: 3s²3p² — четыре электрона на внешнем уровне. При возбуждении один 3s-электрон переходит на свободную 3p-орбиталь: 3s¹3p³ — четыре неспаренных. У каждого O — два неспаренных электрона и две пары.',
        'Si: 3s²3p² — four outer electrons. On excitation one 3s electron jumps to the empty 3p orbital: 3s¹3p³ — four unpaired. Each O has two unpaired electrons and two lone pairs.',
        'Si: 3s²3p² — tashqi qavatda to‘rtta elektron. Uyg‘onganda bitta 3s-elektron bo‘sh 3p-orbitalga o‘tadi: 3s¹3p³ — to‘rtta juftlashmagan. Har bir O da ikkita juftlashmagan elektron va ikkita juft bor.',
      ],
      sub: ['Kimyo 9, § 1–2: s²p² → s¹p³; ΔЭО = 3,44 − 1,90 = 1,54 → ковалентная полярная связь', 'Kimyo 9, § 1–2: s²p² → s¹p³; ΔEN = 3.44 − 1.90 = 1.54 → polar covalent bond', 'Kimyo 9, § 1–2: s²p² → s¹p³; ΔEM = 3,44 − 1,90 = 1,54 → qutbli kovalent bog‘'],
    },
    pairs: {
      title: ['Четыре общие пары', 'Four shared pairs', 'To‘rtta umumiy juft'],
      main: [
        'Каждый неспаренный электрон Si спаривается с электроном кислорода — четыре полярные ковалентные связи Si–O. Пары смещены к кислороду: на Si — δ+, на каждом O — δ−.',
        'Each unpaired Si electron pairs with an oxygen electron — four polar covalent Si–O bonds. The pairs are shifted towards oxygen: δ+ on Si, δ− on each O.',
        'Si ning har bir juftlashmagan elektroni kislorod elektroni bilan juftlashadi — to‘rtta qutbli kovalent Si–O bog‘. Juftlar kislorod tomon siljigan: Si da δ+, har bir O da δ−.',
      ],
    },
    bonds: {
      title: ['Тетраэдр SiO₄ → каркас', 'SiO₄ tetrahedron → framework', 'SiO₄ tetraedri → karkas'],
      main: [
        'Вокруг Si четыре O по вершинам тетраэдра (∠O–Si–O 109,5°, Si–O 0,161 нм). Каждый O — мостик между двумя Si: тетраэдры сцепляются вершинами, и каркас растёт во все стороны.',
        'Four O sit at the corners of a tetrahedron around Si (∠O–Si–O 109.5°, Si–O 0.161 nm). Every O bridges two Si: the tetrahedra link corner to corner and the framework grows in all directions.',
        'Si atrofida to‘rtta O tetraedr uchlarida (∠O–Si–O 109,5°, Si–O 0,161 nm). Har bir O ikkita Si orasida ko‘prik: tetraedrlar uchlari bilan tutashadi va karkas har tomonga o‘sadi.',
      ],
      sub: ['SiO₂ — простейшее соотношение атомов: на один Si приходится 4 · ½ = 2 O. Отдельных молекул нет', 'SiO₂ is the simplest atom ratio: 4 · ½ = 2 O per Si. There are no separate molecules', 'SiO₂ — atomlarning eng sodda nisbati: bitta Si ga 4 · ½ = 2 O to‘g‘ri keladi. Alohida molekulalar yo‘q'],
    },
    assemble: {
      title: ['Атомная решётка кварца', 'Atomic lattice of quartz', 'Kvartsning atom panjarasi'],
      main: [
        'Это атомная кристаллическая решётка: в узлах — атомы, между ними — ковалентные связи. Чтобы расплавить кварц, нужно рвать сами связи Si–O — поэтому он твёрдый и тугоплавкий.',
        'This is an atomic crystal lattice: atoms at the nodes, covalent bonds between them. Melting quartz means breaking Si–O bonds themselves — that is why it is hard and refractory.',
        'Bu atom kristall panjara: tugunlarda atomlar, ular orasida kovalent bog‘lar. Kvartsni eritish uchun Si–O bog‘larning o‘zini uzish kerak — shuning uchun u qattiq va qiyin eriydi.',
      ],
      sub: ['Kimyo 8, § 17 п. 2 (с. 74): атомная решётка — алмаз, графит, кремний; из соединений — кварц', 'Kimyo 8, § 17 (2), p. 74: atomic lattice — diamond, graphite, silicon; among compounds — quartz', 'Kimyo 8, § 17 (2), 74-bet: atom panjara — olmos, grafit, kremniy; birikmalardan — kvarts'],
    },
    final: {
      title: ['Кварц, песок, стекло', 'Quartz, sand, glass', 'Kvarts, qum, shisha'],
      main: [
        'Горный хрусталь, кремень, агат, яшма и песок — разновидности кварца. Из расплава кварца получают кварцевое стекло: те же тетраэдры SiO₄, но без дальнего порядка.',
        'Rock crystal, flint, agate, jasper and sand are varieties of quartz. Molten quartz gives quartz glass: the same SiO₄ tetrahedra, but without long-range order.',
        'Tog‘ billuri, chaqmoqtosh, agat, yashma va qum — kvartsning turlari. Kvarts suyuqlanmasidan kvarts shishasi olinadi: o‘sha SiO₄ tetraedrlari, lekin uzoq tartibsiz.',
      ],
      sub: ['Kimyo 9, с. 63–64: SiO₂ + 4HF = SiF₄ + 2H₂O; при сплавлении SiO₂ + 2NaOH = Na₂SiO₃ + H₂O', 'Kimyo 9, pp. 63–64: SiO₂ + 4HF = SiF₄ + 2H₂O; on fusion SiO₂ + 2NaOH = Na₂SiO₃ + H₂O', 'Kimyo 9, 63–64-betlar: SiO₂ + 4HF = SiF₄ + 2H₂O; suyuqlantirilganda SiO₂ + 2NaOH = Na₂SiO₃ + H₂O'],
    },
  },
  hud: [
    {
      stage: 'valence',
      from: 0.08,
      to: 0.98,
      title: ['Si: 3s²3p² → 3s¹3p³', 'Si: 3s²3p² → 3s¹3p³', 'Si: 3s²3p² → 3s¹3p³'],
      lines: [
        ['4 валентных e⁻, 3d-подуровень свободен', '4 valence e⁻, the 3d sublevel is empty', '4 ta valent e⁻, 3d-pog‘onacha bo‘sh'],
        ['возбуждение → 4 неспаренных e⁻', 'excitation → 4 unpaired e⁻', 'uyg‘onish → 4 ta juftlashmagan e⁻'],
        ['ΔЭО = 3,44 − 1,90 = 1,54', 'ΔEN = 3.44 − 1.90 = 1.54', 'ΔEM = 3,44 − 1,90 = 1,54'],
      ],
      tone: 'route',
    },
    {
      stage: 'pairs',
      from: 0.12,
      to: 1,
      title: ['Полярные связи Si–O', 'Polar Si–O bonds', 'Qutbli Si–O bog‘lar'],
      lines: [
        ['общая пара смещена к O', 'the shared pair is shifted to O', 'umumiy juft O tomon siljigan'],
        ['Si δ+ · O δ−', 'Si δ+ · O δ−', 'Si δ+ · O δ−'],
        ['E(Si–O) ≈ 450 кДж/моль', 'E(Si–O) ≈ 450 kJ/mol', 'E(Si–O) ≈ 450 kJ/mol'],
      ],
      tone: 'route',
    },
    {
      stage: 'bonds',
      from: 0.1,
      to: 0.6,
      title: ['Тетраэдр SiO₄', 'SiO₄ tetrahedron', 'SiO₄ tetraedri'],
      lines: [
        ['∠O–Si–O = 109,5°', '∠O–Si–O = 109.5°', '∠O–Si–O = 109,5°'],
        ['Si–O = 0,161 нм', 'Si–O = 0.161 nm', 'Si–O = 0,161 nm'],
        ['∠Si–O–Si ≈ 144° (кварц)', '∠Si–O–Si ≈ 144° (quartz)', '∠Si–O–Si ≈ 144° (kvarts)'],
      ],
      tone: 'route',
    },
    {
      stage: 'bonds',
      from: 0.6,
      to: 1,
      title: ['SiO₂ — простейшая формула', 'SiO₂ is the simplest formula', 'SiO₂ — eng sodda formula'],
      lines: [
        ['каждый O делится между двумя Si', 'each O is shared by two Si', 'har bir O ikkita Si o‘rtasida'],
        ['на 1 Si: 4 · ½ = 2 O', 'per Si: 4 · ½ = 2 O', '1 Si ga: 4 · ½ = 2 O'],
        ['молекул SiO₂ нет', 'there are no SiO₂ molecules', 'SiO₂ molekulalari yo‘q'],
      ],
      tone: 'check',
    },
    {
      stage: 'final',
      from: 0.03,
      to: 0.5,
      title: ['Почему CO₂ — газ, а SiO₂ — камень?', 'Why is CO₂ a gas and SiO₂ a stone?', 'Nega CO₂ — gaz, SiO₂ esa — tosh?'],
      lines: [
        ['C: O=C=O — молекула с двойными связями', 'C: O=C=O — a molecule with double bonds', 'C: O=C=O — qo‘sh bog‘li molekula'],
        ['Si крупнее: боковое (π) перекрывание 3p слабое', 'Si is larger: sideways (π) overlap of 3p is weak', 'Si yirikroq: 3p ning yon (π) qoplanishi kuchsiz'],
        ['выгоднее 4 одинарные Si–O → каркас', '4 single Si–O bonds win → framework', '4 ta oddiy Si–O foydaliroq → karkas'],
      ],
      tone: 'check',
    },
    {
      stage: 'final',
      from: 0.5,
      to: 0.97,
      title: ['Свойства кварца', 'Properties of quartz', 'Kvarts xossalari'],
      lines: [
        ['твёрдый, тугоплавкий (≈ 1700 °C), нерастворим', 'hard, refractory (≈ 1700 °C), insoluble', 'qattiq, qiyin eriydi (≈ 1700 °C), erimaydi'],
        ['SiO₂ + 4HF = SiF₄ + 2H₂O', 'SiO₂ + 4HF = SiF₄ + 2H₂O', 'SiO₂ + 4HF = SiF₄ + 2H₂O'],
        ['SiO₂ + 2NaOH → Na₂SiO₃ + H₂O (сплавление)', 'SiO₂ + 2NaOH → Na₂SiO₃ + H₂O (fusion)', 'SiO₂ + 2NaOH → Na₂SiO₃ + H₂O (suyuqlantirish)'],
      ],
      tone: 'check',
    },
  ],
}
