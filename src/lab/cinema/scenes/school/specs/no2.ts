/**
 * NO₂ — 2NO + O₂ → 2NO₂ (Kimyo 7, § 4.5, с. 96; § 2.13, с. 71; свойства — Kimyo 8, § 38, с. 163).
 * 17 внешних электронов — один неспаренный (в основном на азоте); две равные связи N–O порядка 1½
 * (ядро: 'N-O(NO2)' 119,3 пм, угол 134,1° — один набор CCCBDB). Показанная структура: N=O и N→O
 * (донорно-акцепторная от азота), как в школьном объяснении азота IV.
 */
import { ref } from './core'
import { ATOM_N, ATOM_O, P_NO, P_O2, T7_OXYGEN_PROPS, T8_DATIVE, T8_LEVELS, T8_NITROGEN_OXIDES } from './shared'
import type { ParticleSpec, SchoolSceneSpec, TextbookRef } from './types'

const T7_LIGHTNING: TextbookRef = {
  grade: 7,
  pages: [71],
  section: '§ 2.13',
  title: 'Выполнение упражнений по составлению уравнений химических реакций',
  what: 'задание 5: «при грозовых токах»: N₂ + O₂ → 2NO; 2NO + O₂ → 2NO₂',
}

const T7_ACID_RAIN: TextbookRef = {
  grade: 7,
  pages: [126, 127],
  section: '§ 5.7',
  title: 'Кислотные дожди',
  what: 'NO₂ и SO₂ в атмосфере превращаются в кислоты: 4NO₂ + 2H₂O + O₂ → 4HNO₃',
}

const T7_NITROGEN_IV: TextbookRef = {
  grade: 7,
  pages: [64, 126],
  section: '§ 2.10, § 5.7',
  title: 'Выполнение упражнений по теме валентность; Кислотные дожди',
  what: '«составьте формулу кислородного соединения азота (IV)» (с. 64); «оксид азота (IV) NO₂» (с. 126)',
}

const T7_OXIDE_OBTAINING: TextbookRef = {
  grade: 7,
  pages: [107],
  section: '§ 4.10',
  title: 'Оксиды',
  what: '«3. При горении сложных веществ: … 2NO + O₂ → 2NO₂↑»',
}

const P_NO2: ParticleSpec = {
  id: 'NO2',
  formula: 'NO₂',
  name: { ru: 'оксид азота(IV), бурый газ', en: 'nitrogen(IV) oxide, nitrogen dioxide', uz: 'azot(IV) oksidi, qoʻngʻir gaz' },
  role: 'product',
  phase: 'г',
  kind: 'molecule',
  // формальные заряды O=N⁺–O⁻ — не рисуются в 7 классе
  atoms: [
    { id: 'N', element: 'N', charge: 1 },
    { id: 'O1', element: 'O' },
    { id: 'O2', element: 'O', charge: -1 },
  ],
  bonds: [
    { a: 'N', b: 'O1', pairs: 2, realOrder: 1.5, polar: true, length: { bond: 'N-O(NO2)' } },
    { a: 'N', b: 'O2', pairs: 1, dative: { donor: 'N' }, realOrder: 1.5, polar: true, length: { bond: 'N-O(NO2)' } },
  ],
  lonePairs: { O1: 2, O2: 3 },
  unpaired: { N: 1 },
  charge: 0,
  shape: 'bent',
  angles: [{ atoms: ['O1', 'N', 'O2'], ref: { angle: 'nitrogenDioxide' } }],
  dipoleKey: 'NO2',
  polarity: 'polar',
  resonance: {
    show: {
      ru: 'Показываем две ОДИНАКОВЫЕ связи N–O («полуторные»: сплошная черта + пунктир) и неспаренный электрон у азота. Для подсчёта электронов — одна из двух равноправных структур: N=O и N→O (пару отдал азот).',
      en: 'We show two IDENTICAL N–O bonds («one and a half»: a solid line plus a dashed one) and an unpaired electron at nitrogen. For counting electrons — one of two equivalent structures: N=O and N→O (the pair given by nitrogen).',
      uz: 'Ikkita BIR XIL N–O bogʻi («bir yarimli»: yaxlit chiziq + punktir) va azotdagi juftlashmagan elektron koʻrsatiladi. Elektronlarni sanash uchun — ikkita teng huquqli tuzilmadan biri: N=O va N→O (juftni azot bergan).',
    },
    real: {
      ru: 'Обе связи N–O одинаковы (119,3 пм) — двойная связь «перескакивает» между кислородами. Неспаренный электрон находится в основном на азоте, частично — на кислородах. Две молекулы NO₂ соединяются неспаренными электронами азота в бесцветную N₂O₄ (связь N–N) — это подтверждает, что электрон в основном у азота.',
      en: 'Both N–O bonds are identical (119.3 pm) — the double bond «jumps» between the oxygens. The unpaired electron is mostly on nitrogen, partly on the oxygens. Two NO₂ molecules join through the unpaired electrons of nitrogen into colourless N₂O₄ (an N–N bond) — which confirms the electron is mostly on nitrogen.',
      uz: 'Ikkala N–O bogʻi bir xil (119,3 pm) — qoʻsh bogʻ kislorodlar orasida «sakraydi». Juftlashmagan elektron asosan azotda, qisman kislorodlarda. Ikkita NO₂ molekulasi azotning juftlashmagan elektronlari orqali rangsiz N₂O₄ ga birikadi (N–N bogʻi) — bu elektron asosan azotda ekanini tasdiqlaydi.',
    },
  },
}

export const NO2_SPEC: SchoolSceneSpec = {
  id: 'no2',
  substance: 'NO₂',
  focus: 'NO2',
  name: { ru: 'Оксид азота(IV)', en: 'Nitrogen(IV) oxide', uz: 'Azot(IV) oksidi' },
  bondType: 'covalent-polar',
  reaction: {
    equation: '2NO + O₂ → 2NO₂',
    reactants: [
      { formula: 'NO', coef: 2, phase: 'г', particle: 'NO' },
      { formula: 'O₂', coef: 1, phase: 'г', particle: 'O2' },
    ],
    products: [{ formula: 'NO₂', coef: 2, phase: 'г', particle: 'NO2' }],
    reversible: false,
    kind: 'combination',
    bankId: 'no-o2-no2',
    sources: [T7_OXYGEN_PROPS, T7_LIGHTNING, T8_NITROGEN_OXIDES],
    conditions: {
      heating: false,
      text: {
        ru: 'без нагревания: NO соединяется с кислородом воздуха сразу при обычной температуре',
        en: 'no heating: NO combines with oxygen of the air at once at ordinary temperature',
        uz: 'qizdirishsiz: NO oddiy haroratda havo kislorodi bilan darhol birikadi',
      },
    },
    heat: 'exo',
    heatSource: ref('NIST-JANAF: 2ΔH°f(NO₂) − 2ΔH°f(NO) < 0 (ядро: thermoData «NO2(g)», «NO(g)»)'),
  },
  atoms: [ATOM_N, ATOM_O],
  particles: [{ ...P_NO, role: 'reactant' }, P_O2, P_NO2],
  mechanism: {
    breaks: [
      {
        particle: 'O2',
        a: 'Oa',
        b: 'Ob',
        why: { ru: 'каждой молекуле NO достаётся один атом кислорода', en: 'each NO molecule gets one oxygen atom', uz: 'har bir NO molekulasiga bitta kislorod atomi tegadi' },
      },
    ],
    kept: [
      { particle: 'NO', a: 'N', b: 'O', why: { ru: 'связь N=O сохраняется', en: 'the N=O bond is kept', uz: 'N=O bogʻi saqlanadi' } },
      { particle: 'NO2', a: 'N', b: 'O1', why: { ru: 'перешла из NO', en: 'carried over from NO', uz: 'NO dan oʻtdi' } },
    ],
    forms: [
      {
        particle: 'NO2',
        a: 'N',
        b: 'O2',
        how: 'dative',
        why: {
          ru: 'неподелённая пара азота становится общей с новым атомом кислорода; неспаренный электрон азота остаётся',
          en: 'the lone pair of nitrogen becomes shared with the new oxygen atom; nitrogen’s unpaired electron remains',
          uz: 'azotning boʻlinmagan jufti yangi kislorod atomi bilan umumiy boʻladi; azotning juftlashmagan elektroni qoladi',
        },
      },
    ],
  },
  valence: {
    particle: 'NO2',
    school: { N: 4, O: 2 },
    schoolSource: T7_NITROGEN_IV,
    oxidation: { N: 4, O: -2 },
    verdict: { N: 'formal', O: 'formal' },
    explain: {
      ru: 'Учебник называет NO₂ оксидом азота (IV). «Четыре» — это степень окисления азота +4. Общих пар у азота три (одна из них донорно-акцепторная) и ещё неспаренный электрон; обе связи N–O одинаковые, «полуторные», поэтому и у каждого кислорода в среднем полторы связи, а не две.',
      en: 'The textbook calls NO₂ nitrogen (IV) oxide. «Four» is the oxidation state of nitrogen, +4. Nitrogen has three shared pairs (one of them donor-acceptor) plus an unpaired electron; both N–O bonds are identical, «one and a half», so each oxygen also has one and a half bonds on average, not two.',
      uz: 'Darslik NO₂ ni azot (IV) oksidi deydi. «Toʻrt» — azotning +4 oksidlanish darajasi. Azotda uchta umumiy juft (bittasi donor-akseptor) va yana juftlashmagan elektron bor; ikkala N–O bogʻi bir xil, «bir yarimli», shuning uchun har bir kislorodda ham oʻrtacha ikkita emas, bir yarimta bogʻ.',
    },
  },
  observations: [
    {
      text: {
        ru: 'Оксид азота(IV) — удушливый красно-бурый газ с резким запахом, ядовит, хорошо растворяется в воде.',
        en: 'Nitrogen(IV) oxide is a choking red-brown gas with a sharp smell, poisonous, readily soluble in water.',
        uz: 'Azot(IV) oksidi — oʻtkir hidli, boʻgʻuvchi qizgʻish-qoʻngʻir gaz, zaharli, suvda yaxshi eriydi.',
      },
      source: T8_NITROGEN_OXIDES,
    },
    {
      text: {
        ru: 'Бесцветный NO на воздухе сразу буреет — это и есть образование NO₂. При охлаждении бурая окраска бледнеет: молекулы NO₂ соединяются попарно в бесцветный N₂O₄.',
        en: 'Colourless NO turns brown in air at once — that is NO₂ forming. On cooling the brown colour fades: NO₂ molecules join in pairs into colourless N₂O₄.',
        uz: 'Rangsiz NO havoda darhol qoʻngʻir tus oladi — bu NO₂ hosil boʻlishi. Sovitilganda qoʻngʻir rang oqaradi: NO₂ molekulalari juft-juft boʻlib rangsiz N₂O₄ ga birikadi.',
      },
      source: T8_NITROGEN_OXIDES,
    },
    {
      text: {
        ru: 'С водой и кислородом NO₂ даёт азотную кислоту: 4NO₂ + 2H₂O + O₂ → 4HNO₃ — так возникают кислотные дожди.',
        en: 'With water and oxygen NO₂ gives nitric acid: 4NO₂ + 2H₂O + O₂ → 4HNO₃ — this is how acid rain forms.',
        uz: 'Suv va kislorod bilan NO₂ nitrat kislota beradi: 4NO₂ + 2H₂O + O₂ → 4HNO₃ — kislotali yomgʻirlar shunday paydo boʻladi.',
      },
      source: T7_ACID_RAIN,
    },
  ],
  uses: [
    {
      text: {
        ru: 'Промежуточный продукт производства азотной кислоты и азотных удобрений.',
        en: 'An intermediate in the production of nitric acid and nitrogen fertilizers.',
        uz: 'Nitrat kislota va azotli oʻgʻitlar ishlab chiqarishda oraliq mahsulot.',
      },
      source: T8_NITROGEN_OXIDES,
    },
  ],
  intro: {
    title: { ru: 'Бурый газ', en: 'The brown gas', uz: 'Qoʻngʻir gaz' },
    speak: {
      ru: 'Бесцветный оксид азота на воздухе сразу становится бурым. Посмотрим, что происходит с молекулами.',
      en: 'Colourless nitrogen oxide turns brown in air at once. Let us see what happens to the molecules.',
      uz: 'Rangsiz azot oksidi havoda darhol qoʻngʻir tus oladi. Molekulalar bilan nima sodir boʻlishini koʻramiz.',
    },
  },
  safety: {
    ru: 'NO₂ очень ядовит: вдыхать его нельзя даже в малых количествах. В школе его получают только под тягой, опыт показывает учитель.',
    en: 'NO₂ is very poisonous: it must not be inhaled even in small amounts. At school it is made only in a fume hood, and the teacher shows the experiment.',
    uz: 'NO₂ juda zaharli: uni hatto oz miqdorda ham nafasga olish mumkin emas. Maktabda u faqat tortuv shkafida olinadi, tajribani oʻqituvchi koʻrsatadi.',
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 4.5,
      show: ['две молекулы NO (N=O, яркая одиночная точка у N)', 'молекула O₂', 'подпись «2NO + O₂»; фон бесцветный'],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Оксид азота(II) NO — бесцветный газ; в его молекуле две общие пары и один неспаренный электрон у азота. Кислород O₂ — из воздуха. Как только NO попадает на воздух, он соединяется с кислородом сам, без нагревания.',
          equation: '2NO + O₂',
          note: 'Символ внутри шара — химический знак элемента. Яркая точка без пары у азота — неспаренный электрон, из-за него NO такой активный.',
          speak: 'Две молекулы оксида азота два и молекула кислорода. Нагревать не нужно.',
        },
        en: {
          title: 'Starting substances',
          body: 'Nitrogen(II) oxide NO is a colourless gas; its molecule has two shared pairs and one unpaired electron at nitrogen. Oxygen O₂ comes from the air. As soon as NO meets air, it combines with oxygen by itself, without heating.',
          equation: '2NO + O₂',
          note: 'The symbol inside a ball is the chemical symbol of the element. The bright unpaired dot at nitrogen is the unpaired electron; it makes NO so reactive.',
          speak: 'Two molecules of nitrogen two oxide and an oxygen molecule. No heating is needed.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Azot(II) oksidi NO — rangsiz gaz; uning molekulasida ikkita umumiy juft va azotda bitta juftlashmagan elektron bor. Kislorod O₂ — havodan. NO havoga tushishi bilan oʻzi, qizdirishsiz kislorod bilan birikadi.',
          equation: '2NO + O₂',
          note: 'Shar ichidagi belgi — elementning kimyoviy belgisi. Azotdagi juftsiz yorqin nuqta — juftlashmagan elektron, NO shuning uchun juda faol.',
          speak: 'Ikkita azot ikki oksidi molekulasi va kislorod molekulasi. Qizdirish shart emas.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5,
      show: ['в NO у азота: 2 пары в связи, 1 неподелённая пара, 1 одиночный электрон', 'облако O: 6 точек', 'схема N (+7): 2, 5; O (+8): 2, 6'],
      sources: [T8_LEVELS],
      text: {
        ru: {
          title: 'Электроны азота в NO',
          body: 'Заряд ядра азота +7, электроны: 2, 5. В молекуле NO пять внешних электронов азота распределены так: два — в общих парах с кислородом, два — неподелённая пара, один не спарен. Заряд ядра кислорода +8, электроны: 2, 6 — у свободного атома кислорода два неспаренных электрона.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6',
          note: 'Строение слоёв — материал 8 класса. Неподелённая пара азота подсвечена: она пойдёт на связь с новым атомом кислорода.',
          speak: 'У азота в оксиде азота два есть свободная пара и один электрон без пары.',
        },
        en: {
          title: 'Nitrogen’s electrons in NO',
          body: 'The nuclear charge of nitrogen is +7, electrons: 2, 5. In the NO molecule nitrogen’s five outer electrons are arranged like this: two in shared pairs with oxygen, two as a lone pair, one unpaired. The nuclear charge of oxygen is +8, electrons: 2, 6 — a free oxygen atom has two unpaired electrons.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6',
          note: 'Electron shells are grade 8 material. Nitrogen’s lone pair is highlighted: it will go into the bond with the new oxygen atom.',
          speak: 'Nitrogen in nitrogen two oxide has a free pair and one electron without a pair.',
        },
        uz: {
          title: 'NO dagi azot elektronlari',
          body: 'Azot yadrosining zaryadi +7, elektronlari: 2, 5. NO molekulasida azotning beshta tashqi elektroni shunday taqsimlangan: ikkitasi kislorod bilan umumiy juftlarda, ikkitasi boʻlinmagan juft, bittasi juftlashmagan. Kislorod yadrosining zaryadi +8, elektronlari: 2, 6 — erkin kislorod atomida ikkita juftlashmagan elektron bor.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6',
          note: 'Pogʻonalar tuzilishi — 8-sinf materiali. Azotning boʻlinmagan jufti ajratib koʻrsatilgan: u yangi kislorod atomi bilan bogʻga ketadi.',
          speak: 'Azot ikki oksididagi azotda boʻsh juft va juftsiz bitta elektron bor.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 4.5,
      show: ['O=O гаснет, два атома O расходятся к двум молекулам NO', 'связи N=O в NO не рвутся'],
      text: {
        ru: {
          title: 'Молекула кислорода делится',
          body: 'Две общие пары в молекуле O₂ расходятся: каждой из двух молекул NO достаётся по одному атому кислорода. Связи в молекулах NO сохраняются.',
          equation: 'O=O → O + O',
          note: 'Схема: на деле две молекулы NO и молекула O₂ сталкиваются почти одновременно, и отдельные атомы кислорода не образуются. Сцена показывает, куда уходят атомы.',
          speak: 'Молекула кислорода делится между двумя молекулами оксида азота.',
        },
        en: {
          title: 'The oxygen molecule is shared out',
          body: 'The two shared pairs of the O₂ molecule split: each of the two NO molecules gets one oxygen atom. The bonds in the NO molecules are kept.',
          equation: 'O=O → O + O',
          note: 'A scheme: in reality two NO molecules and an O₂ molecule collide almost at once, and separate oxygen atoms do not form. The scene shows where the atoms go.',
          speak: 'The oxygen molecule is shared between two nitrogen oxide molecules.',
        },
        uz: {
          title: 'Kislorod molekulasi boʻlinadi',
          body: 'O₂ molekulasidagi ikkita umumiy juft ajraladi: ikkita NO molekulasining har biriga bittadan kislorod atomi tegadi. NO molekulalaridagi bogʻlar saqlanadi.',
          equation: 'O=O → O + O',
          note: 'Sxema: aslida ikkita NO molekulasi va O₂ molekulasi deyarli bir vaqtda toʻqnashadi va alohida kislorod atomlari hosil boʻlmaydi. Sahna atomlar qayerga ketishini koʻrsatadi.',
          speak: 'Kislorod molekulasi ikkita azot oksidi molekulasi orasida boʻlinadi.',
        },
      },
    },
    {
      id: 'bonding',
      level: 8,
      seconds: 6,
      show: ['неподелённая пара N перетекает к новому атому O — стрелка N→O (донорно-акцепторная)', 'одиночный электрон N остаётся; счётчик «17 электронов»'],
      sources: [T8_DATIVE],
      text: {
        ru: {
          title: 'Новая связь и неспаренный электрон',
          body: 'Атом кислорода присоединяется к азоту: неподелённая пара азота становится общей с кислородом — это донорно-акцепторная связь, азот — донор. Неспаренный электрон азота так и остаётся без пары: в молекуле NO₂ 17 внешних электронов — число нечётное.',
          equation: 'NO + O → NO₂',
          note: 'Стрелка N→O показывает, что обе точки пары пришли от азота. После образования связи двойная и новая связи становятся одинаковыми — см. следующий шаг.',
          speak: 'Свободная пара азота связала его с новым кислородом. Один электрон по-прежнему без пары.',
        },
        en: {
          title: 'A new bond and an unpaired electron',
          body: 'An oxygen atom joins nitrogen: nitrogen’s lone pair becomes shared with oxygen — this is a donor-acceptor bond, with nitrogen as the donor. Nitrogen’s unpaired electron still has no pair: the NO₂ molecule has 17 outer electrons — an odd number.',
          equation: 'NO + O → NO₂',
          note: 'The arrow N→O shows that both dots of the pair came from nitrogen. Once the bond forms, the double bond and the new bond become identical — see the next step.',
          speak: 'Nitrogen’s free pair has bound it to the new oxygen. One electron is still without a pair.',
        },
        uz: {
          title: 'Yangi bogʻ va juftlashmagan elektron',
          body: 'Kislorod atomi azotga birikadi: azotning boʻlinmagan jufti kislorod bilan umumiy boʻladi — bu donor-akseptor bogʻ, azot — donor. Azotning juftlashmagan elektroni juftsiz qoladi: NO₂ molekulasida 17 ta tashqi elektron — toq son.',
          equation: 'NO + O → NO₂',
          note: 'N→O strelka juftning ikkala nuqtasi azotdan kelganini koʻrsatadi. Bogʻ hosil boʻlgach, qoʻsh bogʻ va yangi bogʻ bir xil boʻlib qoladi — keyingi qadamga qarang.',
          speak: 'Azotning boʻsh jufti uni yangi kislorod bilan bogʻladi. Bitta elektron hamon juftsiz.',
        },
      },
    },
    {
      id: 'product',
      level: 7,
      seconds: 5.5,
      show: ['изогнутая молекула NO₂, дуга 134,1°', 'две одинаковые «полуторные» связи (черта + пунктир)', 'одиночный электрон у N; молекула бурого цвета'],
      text: {
        ru: {
          title: 'Молекула оксида азота(IV)',
          body: 'Молекула NO₂ изогнута: угол O–N–O равен 134,1°. Обе связи N–O одинаковые — по длине (119,3 пм) они между одинарной и двойной, «полуторные». Неспаренный электрон делает NO₂ бурым и активным: две молекулы NO₂ могут соединиться этими электронами в бесцветную N₂O₄.',
          equation: 'NO₂   ∠ 134,1°',
          note: 'Двойная связь не стоит на месте — она «перескакивает» между кислородами, поэтому связи рисуются одинаковыми. Неспаренный электрон находится в основном на азоте, частично — на кислородах.',
          speak: 'Бурый газ NO₂ — изогнутая молекула с двумя одинаковыми связями и одним электроном без пары.',
        },
        en: {
          title: 'The nitrogen(IV) oxide molecule',
          body: 'The NO₂ molecule is bent: the O–N–O angle is 134.1°. Both N–O bonds are identical — by length (119.3 pm) they lie between single and double, «one and a half». The unpaired electron makes NO₂ brown and reactive: two NO₂ molecules can join through these electrons into colourless N₂O₄.',
          equation: 'NO₂   ∠ 134.1°',
          note: 'The double bond does not stay in place — it «jumps» between the oxygens, so the bonds are drawn identical. The unpaired electron is mostly on nitrogen, partly on the oxygens.',
          speak: 'The brown gas NO₂ is a bent molecule with two identical bonds and one electron without a pair.',
        },
        uz: {
          title: 'Azot(IV) oksidi molekulasi',
          body: 'NO₂ molekulasi egilgan: O–N–O burchagi 134,1°. Ikkala N–O bogʻi bir xil — uzunligi boʻyicha (119,3 pm) ular oddiy va qoʻsh bogʻ oraligʻida, «bir yarimli». Juftlashmagan elektron NO₂ ni qoʻngʻir va faol qiladi: ikkita NO₂ molekulasi shu elektronlar orqali rangsiz N₂O₄ ga birika oladi.',
          equation: 'NO₂   ∠ 134,1°',
          note: 'Qoʻsh bogʻ bir joyda turmaydi — u kislorodlar orasida «sakraydi», shuning uchun bogʻlar bir xil chiziladi. Juftlashmagan elektron asosan azotda, qisman kislorodlarda.',
          speak: 'Qoʻngʻir gaz NO₂ — ikkita bir xil bogʻli va juftsiz bitta elektronli egilgan molekula.',
        },
      },
    },
    {
      id: 'summary',
      level: 7,
      seconds: 4.5,
      show: ['две бурые молекулы NO₂', 'уравнение 2NO + O₂ → 2NO₂, подсчёт атомов; бесцветный фон становится бурым'],
      sources: [T7_ACID_RAIN],
      text: {
        ru: {
          title: 'Итог: оксид азота(IV)',
          body: 'Две молекулы NO и молекула кислорода дали две молекулы NO₂. Это бурый ядовитый газ с резким запахом. С водой и кислородом он даёт азотную кислоту — так возникают кислотные дожди.',
          equation: '2NO + O₂ → 2NO₂',
          note: 'Баланс: слева 2 атома N и 4 атома O, справа столько же. В учебнике (с. 71) эта реакция идёт после грозы вслед за N₂ + O₂ → 2NO; про кислотные дожди — с. 126–127.',
          speak: 'Бесцветный газ стал бурым: получился оксид азота четыре.',
        },
        en: {
          title: 'Result: nitrogen(IV) oxide',
          body: 'Two NO molecules and an oxygen molecule have given two NO₂ molecules. It is a brown poisonous gas with a sharp smell. With water and oxygen it gives nitric acid — this is how acid rain forms.',
          equation: '2NO + O₂ → 2NO₂',
          note: 'Balance: on the left 2 N atoms and 4 O atoms, on the right the same. In the textbook (p. 71) this reaction follows N₂ + O₂ → 2NO after a thunderstorm; acid rain is on pp. 126–127.',
          speak: 'The colourless gas has turned brown: nitrogen four oxide has formed.',
        },
        uz: {
          title: 'Xulosa: azot(IV) oksidi',
          body: 'Ikkita NO molekulasi va kislorod molekulasi ikkita NO₂ molekulasini berdi. Bu oʻtkir hidli qoʻngʻir zaharli gaz. Suv va kislorod bilan u nitrat kislota beradi — kislotali yomgʻirlar shunday paydo boʻladi.',
          equation: '2NO + O₂ → 2NO₂',
          note: 'Balans: chapda 2 ta N va 4 ta O atomi, oʻngda ham shuncha. Darslikda (71-bet) bu reaksiya momaqaldiroqdan keyin N₂ + O₂ → 2NO dan soʻng boradi; kislotali yomgʻirlar haqida — 126–127-betlar.',
          speak: 'Rangsiz gaz qoʻngʻir boʻldi: azot toʻrt oksidi hosil boʻldi.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'no2-valence-iv',
      kind: 'textbook-simplification',
      source: T7_NITROGEN_IV,
      text: {
        ru: '«Азот (IV)» в NO₂ — степень окисления +4. Четырёх общих пар у азота здесь нет: три пары и неспаренный электрон. Формула O=N=O с неспаренным электроном у азота невозможна — вокруг азота было бы девять электронов, а больше восьми у него не бывает.',
        en: '«Nitrogen (IV)» in NO₂ is the oxidation state +4. Nitrogen does not have four shared pairs here: three pairs and an unpaired electron. The formula O=N=O with an unpaired electron on nitrogen is impossible — nitrogen would have nine electrons around it, and it never has more than eight.',
        uz: 'NO₂ dagi «azot (IV)» — +4 oksidlanish darajasi. Bu yerda azotda toʻrtta umumiy juft yoʻq: uchta juft va juftlashmagan elektron. Azotda juftlashmagan elektronli O=N=O formulasi mumkin emas — azot atrofida toʻqqizta elektron boʻlardi, unda esa sakkiztadan koʻp boʻlmaydi.',
      },
    },
    {
      id: 'no2-bp-sign',
      kind: 'textbook-error',
      source: T8_NITROGEN_OXIDES,
      evidence: ref('CRC Handbook of Chemistry and Physics, 97th ed.: N₂O₄ (⇄ 2NO₂) — t пл. −9,3 °C, t кип. 21,15 °C; Greenwood & Earnshaw (1997), гл. 11: t пл. −11,2 °C'),
      text: {
        ru: 'В 8 кл. (с. 163) у NO₂ указана температура кипения «−21,3 °С». Правильно — около +21 °C (смесь NO₂ и N₂O₄ кипит при 21 °C), поэтому в холодный день NO₂ может сжижаться. Бесцветные кристаллы N₂O₄ образуются около −9,3 °C (по разным справочникам до −11,2 °C) — это в учебнике верно.',
        en: 'Grade 8 (p. 163) gives the boiling point of NO₂ as «−21.3 °C». Correct is about +21 °C (the NO₂/N₂O₄ mixture boils at 21 °C), so on a cold day NO₂ can liquefy. Colourless N₂O₄ crystals form at about −9.3 °C (down to −11.2 °C in some handbooks) — this the textbook has right.',
        uz: '8-sinfda (163-bet) NO₂ ning qaynash harorati «−21,3 °C» deb berilgan. Toʻgʻrisi — taxminan +21 °C (NO₂ va N₂O₄ aralashmasi 21 °C da qaynaydi), shuning uchun sovuq kunda NO₂ suyuqlanishi mumkin. Rangsiz N₂O₄ kristallari taxminan −9,3 °C da hosil boʻladi (baʼzi maʼlumotnomalarda −11,2 °C gacha) — bu darslikda toʻgʻri.',
      },
    },
    {
      id: 'no2-n2o4-name',
      kind: 'textbook-error',
      source: T8_NITROGEN_OXIDES,
      text: {
        ru: 'В 8 кл. (с. 163) N₂O₄ назван «диоксидом азота». Диоксид азота — это NO₂; N₂O₄ — его димер (тетраоксид диазота), две молекулы NO₂, соединённые связью N–N.',
        en: 'Grade 8 (p. 163) calls N₂O₄ «nitrogen dioxide». Nitrogen dioxide is NO₂; N₂O₄ is its dimer (dinitrogen tetroxide), two NO₂ molecules joined by an N–N bond.',
        uz: '8-sinfda (163-bet) N₂O₄ «azot dioksidi» deb atalgan. Azot dioksidi — bu NO₂; N₂O₄ — uning dimeri (diazot tetraoksidi), N–N bogʻi bilan birikkan ikkita NO₂ molekulasi.',
      },
    },
    {
      id: 'no2-not-combustion',
      kind: 'textbook-simplification',
      source: T7_OXIDE_OBTAINING,
      text: {
        ru: 'В 7 кл. (с. 107) 2NO + O₂ → 2NO₂ стоит в списке «горение сложных веществ». Это не горение: пламени нет, реакция идёт сама при обычной температуре — это реакция соединения.',
        en: 'Grade 7 (p. 107) lists 2NO + O₂ → 2NO₂ under «burning of complex substances». It is not burning: there is no flame, the reaction goes by itself at ordinary temperature — it is a combination reaction.',
        uz: '7-sinfda (107-bet) 2NO + O₂ → 2NO₂ «murakkab moddalarning yonishi» roʻyxatida turibdi. Bu yonish emas: alanga yoʻq, reaksiya oddiy haroratda oʻzi boradi — bu birikish reaksiyasi.',
      },
    },
    {
      id: 'no2-mechanism',
      kind: 'scene-simplification',
      source: ref('Greenwood & Earnshaw (1997), § 11.3.6: 2NO + O₂ — реакция третьего порядка, её скорость падает с ростом температуры'),
      text: {
        ru: 'Сцена делит молекулу O₂ на атомы. На деле две молекулы NO ненадолго слипаются в пару и забирают молекулу O₂ целиком — поэтому реакция идёт без нагревания и даже медленнее при сильном нагреве.',
        en: 'The scene splits the O₂ molecule into atoms. In reality two NO molecules briefly stick together as a pair and take the O₂ molecule whole — that is why the reaction goes without heating and even slower when strongly heated.',
        uz: 'Sahna O₂ molekulasini atomlarga ajratadi. Aslida ikkita NO molekulasi qisqa vaqt juft boʻlib yopishadi va O₂ molekulasini butunligicha oladi — shuning uchun reaksiya qizdirishsiz boradi, kuchli qizdirilganda esa hatto sekinlashadi.',
      },
    },
  ],
}
