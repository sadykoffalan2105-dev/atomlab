/**
 * NO — N₂ + O₂ → 2NO (Kimyo 7, § 4.5, с. 95: «выше 1200 °C или при электрическом разряде, – Q»;
 * § 2.13, с. 71 — грозовой разряд; Kimyo 8, § 38, с. 163 — 2000 °C).
 * Разрыв тройной связи N≡N; в NO 11 внешних электронов — один неспаренный; порядок связи 2½ (показываем N=O).
 */
import { ref } from './core'
import { ATOM_N, ATOM_O, P_N2, P_NO, P_O2, T7_OXIDES, T7_OXYGEN_PROPS, T8_COVALENT, T8_LEVELS, T8_NITROGEN_OXIDES, LEGEND } from './shared'
import type { SchoolScienceSpec, TextbookRef } from './types'

const T7_LIGHTNING: TextbookRef = {
  grade: 7,
  pages: [71],
  section: '§ 2.13',
  title: 'Выполнение упражнений по составлению уравнений химических реакций',
  what: 'задание 5: «при грозовых токах в атмосфере»: N₂ + O₂ → 2NO; 2NO + O₂ → 2NO₂',
}

const T7_NITROGEN_II: TextbookRef = {
  grade: 7,
  pages: [108],
  section: '§ 4.10',
  title: 'Оксиды',
  what: 'задание: «азот N(II) + кислород → ?»',
}

export const NO_SPEC: SchoolScienceSpec = {
  id: 'no',
  substance: 'NO',
  focus: 'NO',
  name: { ru: 'Оксид азота(II)', en: 'Nitrogen(II) oxide', uz: 'Azot(II) oksidi' },
  bondType: 'covalent-polar',
  reaction: {
    equation: 'N₂ + O₂ → 2NO',
    reactants: [
      { formula: 'N₂', coef: 1, phase: 'г', particle: 'N2' },
      { formula: 'O₂', coef: 1, phase: 'г', particle: 'O2' },
    ],
    products: [{ formula: 'NO', coef: 2, phase: 'г', particle: 'NO' }],
    reversible: false,
    kind: 'combination',
    bankId: 'n2-o2-no',
    sources: [T7_OXYGEN_PROPS, T7_LIGHTNING, T8_NITROGEN_OXIDES],
    conditions: {
      heating: true,
      temperatureC: 2000,
      temperatureSource: T8_NITROGEN_OXIDES,
      electricDischarge: true,
      text: {
        ru: 'электрический разряд (молния) или очень высокая температура — около 2000 °C',
        en: 'an electric discharge (lightning) or a very high temperature — about 2000 °C',
        uz: 'elektr razryadi (chaqmoq) yoki juda yuqori harorat — taxminan 2000 °C',
      },
    },
    heat: 'endo',
    heatSource: T7_OXYGEN_PROPS,
  },
  atoms: [ATOM_N, ATOM_O],
  particles: [P_N2, P_O2, P_NO],
  mechanism: {
    breaks: [
      {
        particle: 'N2',
        a: 'Na1',
        b: 'Na2',
        why: { ru: 'три общие пары N≡N — одна из самых прочных связей', en: 'the three N≡N shared pairs — one of the strongest bonds', uz: 'uchta N≡N umumiy jufti — eng mustahkam bogʻlardan biri' },
      },
      {
        particle: 'O2',
        a: 'Oa',
        b: 'Ob',
        why: { ru: 'две общие пары O=O', en: 'the two O=O shared pairs', uz: 'ikkita O=O umumiy jufti' },
      },
    ],
    forms: [
      {
        particle: 'NO',
        a: 'N',
        b: 'O',
        how: 'shared-pair',
        why: {
          ru: 'два неспаренных электрона N + два неспаренных электрона O; третий электрон N остаётся без пары',
          en: 'two unpaired N electrons + two unpaired O electrons; the third N electron stays unpaired',
          uz: 'N ning ikki juftlashmagan elektroni + O ning ikki juftlashmagan elektroni; N ning uchinchi elektroni juftsiz qoladi',
        },
      },
    ],
  },
  valence: {
    particle: 'NO',
    school: { N: 2, O: 2 },
    schoolSource: T7_NITROGEN_II,
    oxidation: { N: 2, O: -2 },
    verdict: { N: 'match', O: 'match' },
    explain: {
      ru: 'Учебник называет азот в NO двухвалентным. В формуле N=O у азота две общие пары — совпадает. Но у азота остаётся ещё один неспаренный электрон, и на деле он частично связывает атомы: порядок связи два с половиной.',
      en: 'The textbook calls nitrogen in NO divalent. In the formula N=O nitrogen has two shared pairs — this matches. But nitrogen still has one unpaired electron, and in reality it partly bonds the atoms: the bond order is two and a half.',
      uz: 'Darslik NO dagi azotni ikki valentli deydi. N=O formulasida azotda ikkita umumiy juft — mos keladi. Lekin azotda yana bitta juftlashmagan elektron qoladi va aslida u atomlarni qisman bogʻlaydi: bogʻ tartibi ikki yarim.',
    },
  },
  observations: [
    {
      text: {
        ru: 'Оксид азота(II) — бесцветный газ без запаха, мало растворим в воде. На воздухе сразу буреет: соединяется с кислородом в NO₂.',
        en: 'Nitrogen(II) oxide is a colourless odourless gas, poorly soluble in water. In air it turns brown at once: it combines with oxygen to give NO₂.',
        uz: 'Azot(II) oksidi — rangsiz, hidsiz gaz, suvda kam eriydi. Havoda darhol qoʻngʻir tus oladi: kislorod bilan birikib NO₂ hosil qiladi.',
      },
      source: T8_NITROGEN_OXIDES,
    },
    {
      text: {
        ru: 'В природе NO образуется при грозе; поэтому в дождевой воде бывают соединения азота.',
        en: 'In nature NO forms during thunderstorms; that is why rainwater contains nitrogen compounds.',
        uz: 'Tabiatda NO momaqaldiroqda hosil boʻladi; shuning uchun yomgʻir suvida azot birikmalari boʻladi.',
      },
      source: T8_NITROGEN_OXIDES,
    },
    {
      text: {
        ru: 'NO — несолеобразующий оксид.',
        en: 'NO is a non-salt-forming oxide.',
        uz: 'NO — tuz hosil qilmaydigan oksid.',
      },
      source: T7_OXIDES,
    },
  ],
  uses: [
    {
      text: {
        ru: 'В промышленности NO получают окислением аммиака на катализаторе — это первый шаг производства азотной кислоты.',
        en: 'In industry NO is made by oxidizing ammonia on a catalyst — the first step in producing nitric acid.',
        uz: 'Sanoatda NO ammiakni katalizatorda oksidlab olinadi — bu nitrat kislota ishlab chiqarishning birinchi qadami.',
      },
      source: T8_NITROGEN_OXIDES,
    },
  ],
  intro: {
    title: { ru: 'Азот и кислород в молнии', en: 'Nitrogen and oxygen in lightning', uz: 'Chaqmoqda azot va kislorod' },
    speak: {
      ru: 'Азот и кислород в воздухе рядом, но не реагируют. Посмотрим, что меняет молния.',
      en: 'Nitrogen and oxygen sit side by side in air but do not react. Let us see what lightning changes.',
      uz: 'Havoda azot va kislorod yonma-yon, lekin reaksiyaga kirishmaydi. Chaqmoq nimani oʻzgartirishini koʻramiz.',
    },
  },
  safety: {
    ru: 'Оксиды азота ядовиты. Реакцию азота с кислородом в школе не проводят — она идёт только в молнии, электрической дуге или двигателе.',
    en: 'Nitrogen oxides are poisonous. The reaction of nitrogen with oxygen is not done at school — it only happens in lightning, an electric arc or an engine.',
    uz: 'Azot oksidlari zaharli. Azotning kislorod bilan reaksiyasi maktabda oʻtkazilmaydi — u faqat chaqmoqda, elektr yoyida yoki dvigatelda boradi.',
  },
  legend: LEGEND,
  captions: {
    reactants: { ru: 'азот и кислород воздуха', en: 'nitrogen and oxygen of air', uz: 'havo azoti va kislorodi' },
    result: { ru: 'N=O и неспаренный электрон', en: 'N=O and an unpaired electron', uz: 'N=O va juftlashmagan elektron' },
    condition: { ru: 'молния или 2000 °C', en: 'lightning or 2000 °C', uz: 'chaqmoq yoki 2000 °C' },
  },
  steps: [
    {
      id: 'reactants',
      level: 7,
      seconds: 4.5,
      show: ['молекула N₂ (три черты N≡N) и молекула O₂ (O=O)', 'фон: грозовое облако, подпись «N₂ + O₂»'],
      text: {
        ru: {
          title: 'Исходные вещества',
          body: 'Азот N₂ и кислород O₂ — главные газы воздуха, бесцветные и без запаха. В молекуле азота три общие пары электронов — тройная связь N≡N, одна из самых прочных. Поэтому при обычных условиях азот с кислородом не реагирует.',
          equation: 'N₂ + O₂',
          note: 'Символ внутри шара — химический знак элемента. Три черты между атомами азота — три общие пары.',
          speak: 'Азот и кислород всегда рядом в воздухе, но тройная связь азота мешает им реагировать.',
        },
        en: {
          title: 'Starting substances',
          body: 'Nitrogen N₂ and oxygen O₂ are the main gases of air, colourless and odourless. The nitrogen molecule has three shared electron pairs — the N≡N triple bond, one of the strongest. That is why under ordinary conditions nitrogen does not react with oxygen.',
          equation: 'N₂ + O₂',
          note: 'The symbol inside a ball is the chemical symbol of the element. Three dashes between the nitrogen atoms are three shared pairs.',
          speak: 'Nitrogen and oxygen are always together in air, but nitrogen’s triple bond stops them reacting.',
        },
        uz: {
          title: 'Dastlabki moddalar',
          body: 'Azot N₂ va kislorod O₂ — havoning asosiy gazlari, rangsiz va hidsiz. Azot molekulasida uchta umumiy elektron jufti — N≡N uchlamchi bogʻ, eng mustahkam bogʻlardan biri. Shuning uchun oddiy sharoitda azot kislorod bilan reaksiyaga kirishmaydi.',
          equation: 'N₂ + O₂',
          note: 'Shar ichidagi belgi — elementning kimyoviy belgisi. Azot atomlari orasidagi uchta chiziqcha — uchta umumiy juft.',
          speak: 'Azot va kislorod havoda doim birga, lekin azotning uchlamchi bogʻi ularga reaksiyaga kirishishga xalal beradi.',
        },
      },
    },
    {
      id: 'atoms',
      level: 8,
      seconds: 5,
      show: ['облако N: 5 точек (1 пара + 3 одиночных)', 'облако O: 6 точек (2 пары + 2 одиночных)', 'схема N (+7): 2, 5; O (+8): 2, 6'],
      sources: [T8_LEVELS, T8_COVALENT],
      text: {
        ru: {
          title: 'Строение атомов азота и кислорода',
          body: 'Заряд ядра азота +7, электроны: 2, 5. Из пяти внешних электронов азота два образуют пару, а три не спарены — поэтому в молекуле N₂ три общие пары. Заряд ядра кислорода +8, электроны: 2, 6 — два неспаренных электрона.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6',
          note: 'Строение слоёв — материал 8 класса (там же: у атома азота три неспаренных электрона, у кислорода два). Крупные точки облака — внешние электроны.',
          speak: 'У азота три неспаренных электрона, у кислорода два.',
        },
        en: {
          title: 'Structure of nitrogen and oxygen atoms',
          body: 'The nuclear charge of nitrogen is +7, electrons: 2, 5. Of nitrogen’s five outer electrons two form a pair and three are unpaired — that is why the N₂ molecule has three shared pairs. The nuclear charge of oxygen is +8, electrons: 2, 6 — two unpaired electrons.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6',
          note: 'Electron shells are grade 8 material (it also says: a nitrogen atom has three unpaired electrons, oxygen two). The large dots of a cloud are the outer electrons.',
          speak: 'Nitrogen has three unpaired electrons, oxygen has two.',
        },
        uz: {
          title: 'Azot va kislorod atomlarining tuzilishi',
          body: 'Azot yadrosining zaryadi +7, elektronlari: 2, 5. Azotning beshta tashqi elektronidan ikkitasi juft hosil qiladi, uchtasi juftlashmagan — shuning uchun N₂ molekulasida uchta umumiy juft bor. Kislorod yadrosining zaryadi +8, elektronlari: 2, 6 — ikkita juftlashmagan elektron.',
          equation: 'N (+7): 2, 5      O (+8): 2, 6',
          note: 'Pogʻonalar tuzilishi — 8-sinf materiali (u yerda: azot atomida uchta juftlashmagan elektron, kislorodda ikkita). Bulutning katta nuqtalari — tashqi elektronlar.',
          speak: 'Azotda uchta juftlashmagan elektron, kislorodda ikkita.',
        },
      },
    },
    {
      id: 'breaking',
      level: 7,
      seconds: 5,
      show: ['вспышка молнии', 'три черты N≡N гаснут одна за другой; O=O гаснет; атомы расходятся'],
      sources: [T8_NITROGEN_OXIDES],
      text: {
        ru: {
          title: 'Молния рвёт тройную связь',
          body: 'Только в разряде молнии или при температуре около 2000 °C молекулы азота и кислорода распадаются на атомы. Тройную связь N≡N разорвать очень трудно, поэтому реакция идёт с поглощением теплоты — это исключение среди реакций с кислородом.',
          equation: 'N≡N → N + N      O=O → O + O',
          note: 'Схема: на деле молекулы распадаются не все сразу — атом кислорода «отнимает» атом азота у молекулы N₂ цепочкой шагов. Сцена показывает, какие связи рвутся.',
          speak: 'Энергия молнии разрывает даже тройную связь азота.',
        },
        en: {
          title: 'Lightning breaks the triple bond',
          body: 'Only in a lightning discharge or at a temperature of about 2000 °C do nitrogen and oxygen molecules split into atoms. The N≡N triple bond is very hard to break, so the reaction absorbs heat — an exception among reactions with oxygen.',
          equation: 'N≡N → N + N      O=O → O + O',
          note: 'A scheme: in reality the molecules do not all split at once — an oxygen atom «takes» a nitrogen atom from an N₂ molecule through a chain of steps. The scene shows which bonds break.',
          speak: 'The energy of lightning breaks even the triple bond of nitrogen.',
        },
        uz: {
          title: 'Chaqmoq uchlamchi bogʻni uzadi',
          body: 'Faqat chaqmoq razryadida yoki taxminan 2000 °C haroratda azot va kislorod molekulalari atomlarga ajraladi. N≡N uchlamchi bogʻini uzish juda qiyin, shuning uchun reaksiya issiqlik yutilishi bilan boradi — bu kislorod bilan reaksiyalar orasida istisno.',
          equation: 'N≡N → N + N      O=O → O + O',
          note: 'Sxema: aslida molekulalar bir vaqtda parchalanmaydi — kislorod atomi N₂ molekulasidan azot atomini bosqichma-bosqich «tortib oladi». Sahna qaysi bogʻlar uzilishini koʻrsatadi.',
          speak: 'Chaqmoq energiyasi hatto azotning uchlamchi bogʻini ham uzadi.',
        },
      },
    },
    {
      id: 'pairs',
      level: 8,
      seconds: 6,
      show: ['у каждого атома N два одиночных электрона встают в две пары с электронами O', 'третий одиночный электрон N остаётся — яркая точка без пары'],
      sources: [T8_COVALENT],
      text: {
        ru: {
          title: 'Две общие пары и лишний электрон',
          body: 'Атом азота соединяется с атомом кислорода двумя общими парами: два неспаренных электрона азота и два неспаренных электрона кислорода. Третий неспаренный электрон азота остаётся без пары — его не с чем спарить.',
          equation: 'N + O → N=O',
          note: 'Одиночная яркая точка у азота — неспаренный электрон. В молекуле NO 11 внешних электронов — нечётное число, поэтому один обязательно остаётся без пары.',
          speak: 'Две пары связали азот с кислородом, а один электрон азота остался без пары.',
        },
        en: {
          title: 'Two shared pairs and a spare electron',
          body: 'A nitrogen atom joins an oxygen atom with two shared pairs: two unpaired electrons of nitrogen and two unpaired electrons of oxygen. The third unpaired electron of nitrogen stays alone — there is nothing to pair it with.',
          equation: 'N + O → N=O',
          note: 'The single bright dot at nitrogen is the unpaired electron. The NO molecule has 11 outer electrons — an odd number, so one must stay unpaired.',
          speak: 'Two pairs have joined nitrogen and oxygen, and one nitrogen electron is left without a pair.',
        },
        uz: {
          title: 'Ikki umumiy juft va ortiqcha elektron',
          body: 'Azot atomi kislorod atomi bilan ikkita umumiy juft orqali birikadi: azotning ikki juftlashmagan elektroni va kislorodning ikki juftlashmagan elektroni. Azotning uchinchi juftlashmagan elektroni juftsiz qoladi — uni juftlashtiradigan elektron yoʻq.',
          equation: 'N + O → N=O',
          note: 'Azot yonidagi yakka yorqin nuqta — juftlashmagan elektron. NO molekulasida 11 ta tashqi elektron — toq son, shuning uchun bittasi albatta juftsiz qoladi.',
          speak: 'Ikki juft azot va kislorodni bogʻladi, azotning bitta elektroni esa juftsiz qoldi.',
        },
      },
    },
    {
      id: 'molecule',
      level: 7,
      seconds: 5.5,
      show: ['молекула N=O: две пары между ядрами, у N — пара и одиночный электрон, у O — две пары', 'одиночный электрон слегка «размазан» по обоим атомам'],
      text: {
        ru: {
          title: 'Молекула оксида азота(II)',
          body: 'Молекула NO — два атома, соединённые двумя общими парами; у азота есть неподелённая пара и неспаренный электрон, у кислорода — две неподелённые пары. Частица с неспаренным электроном очень активна: на воздухе NO сразу соединяется с кислородом. Длина связи — 115,1 пм.',
          equation: 'N=O',
          note: 'Неспаренный электрон не сидит только на азоте: он «размазан» по обоим атомам и немного их связывает, поэтому связь прочнее двойной — её порядок два с половиной.',
          speak: 'В оксиде азота два один электрон без пары — поэтому молекула такая активная.',
        },
        en: {
          title: 'The nitrogen(II) oxide molecule',
          body: 'The NO molecule is two atoms joined by two shared pairs; nitrogen has a lone pair and an unpaired electron, oxygen has two lone pairs. A particle with an unpaired electron is very reactive: in air NO combines with oxygen at once. The bond length is 115.1 pm.',
          equation: 'N=O',
          note: 'The unpaired electron does not sit on nitrogen alone: it is spread over both atoms and bonds them a little, so the bond is stronger than a double one — its order is two and a half.',
          speak: 'In nitrogen two oxide one electron has no pair — that is why the molecule is so reactive.',
        },
        uz: {
          title: 'Azot(II) oksidi molekulasi',
          body: 'NO molekulasi — ikkita umumiy juft bilan bogʻlangan ikki atom; azotda boʻlinmagan juft va juftlashmagan elektron, kislorodda ikkita boʻlinmagan juft bor. Juftlashmagan elektronli zarracha juda faol: havoda NO darhol kislorod bilan birikadi. Bogʻ uzunligi — 115,1 pm.',
          equation: 'N=O',
          note: 'Juftlashmagan elektron faqat azotda turmaydi: u ikkala atom boʻylab «yoyilgan» va ularni biroz bogʻlaydi, shuning uchun bogʻ qoʻsh bogʻdan mustahkamroq — tartibi ikki yarim.',
          speak: 'Azot ikki oksidida bitta elektron juftsiz — shuning uchun molekula juda faol.',
        },
      },
    },
    {
      id: 'result',
      level: 7,
      seconds: 4.5,
      show: ['две молекулы NO', 'уравнение N₂ + O₂ → 2NO, подсчёт атомов; значок «поглощается теплота»'],
      sources: [T7_LIGHTNING],
      text: {
        ru: {
          title: 'Итог: оксид азота(II)',
          body: 'Молекула азота и молекула кислорода дали две молекулы NO. Реакция идёт с поглощением теплоты и только при очень сильном нагревании или в молнии. Так в грозу в воздухе появляются оксиды азота.',
          equation: 'N₂ + O₂ → 2NO',
          note: 'Баланс: слева 2 атома N и 2 атома O, справа столько же. В учебнике (с. 71) эту реакцию связывают с грозой; дальше NO соединяется с кислородом в NO₂ — следующая сцена.',
          speak: 'Из азота и кислорода получился оксид азота два. Для этого нужна молния.',
        },
        en: {
          title: 'Result: nitrogen(II) oxide',
          body: 'A nitrogen molecule and an oxygen molecule have given two NO molecules. The reaction absorbs heat and happens only with very strong heating or in lightning. This is how nitrogen oxides appear in the air during a thunderstorm.',
          equation: 'N₂ + O₂ → 2NO',
          note: 'Balance: on the left 2 N atoms and 2 O atoms, on the right the same. The textbook (p. 71) links this reaction with thunderstorms; then NO combines with oxygen to give NO₂ — the next scene.',
          speak: 'Nitrogen and oxygen have given nitrogen two oxide. That takes lightning.',
        },
        uz: {
          title: 'Xulosa: azot(II) oksidi',
          body: 'Azot molekulasi va kislorod molekulasi ikkita NO molekulasini berdi. Reaksiya issiqlik yutilishi bilan va faqat juda kuchli qizdirishda yoki chaqmoqda boradi. Momaqaldiroqda havoda azot oksidlari shunday paydo boʻladi.',
          equation: 'N₂ + O₂ → 2NO',
          note: 'Balans: chapda 2 ta N va 2 ta O atomi, oʻngda ham shuncha. Darslikda (71-bet) bu reaksiya momaqaldiroq bilan bogʻlanadi; keyin NO kislorod bilan birikib NO₂ hosil qiladi — keyingi sahna.',
          speak: 'Azot va kisloroddan azot ikki oksidi hosil boʻldi. Buning uchun chaqmoq kerak.',
        },
      },
    },
  ],
  caveats: [
    {
      id: 'no-1200-typo',
      kind: 'textbook-error',
      source: T7_OXYGEN_PROPS,
      evidence: T8_NITROGEN_OXIDES,
      text: {
        ru: 'В 7 кл. (с. 95) напечатано «при температуре выше -1200 °С» — знак минус лишний (опечатка). В 8 кл. (с. 163) — 2000 °C; заметно реакция идёт только при таких температурах или в электрическом разряде.',
        en: 'Grade 7 (p. 95) prints «at a temperature above -1200 °C» — the minus sign is a misprint. Grade 8 (p. 163) gives 2000 °C; the reaction goes noticeably only at such temperatures or in an electric discharge.',
        uz: '7-sinfda (95-bet) «-1200 °C dan yuqori haroratda» deb bosilgan — minus belgisi ortiqcha (xato). 8-sinfda (163-bet) — 2000 °C; reaksiya sezilarli darajada faqat shunday haroratda yoki elektr razryadida boradi.',
      },
    },
    {
      id: 'no-bp',
      kind: 'textbook-error',
      source: T8_NITROGEN_OXIDES,
      evidence: ref('CRC Handbook of Chemistry and Physics, 97th ed., «Physical constants of inorganic compounds»: NO — t кип. −151,8 °C'),
      text: {
        ru: 'В 8 кл. (с. 163) температура кипения NO указана −154,8 °C; по справочнику CRC — −151,8 °C. На сцену это не влияет.',
        en: 'Grade 8 (p. 163) gives the boiling point of NO as −154.8 °C; the CRC Handbook gives −151.8 °C. This does not affect the scene.',
        uz: '8-sinfda (163-bet) NO ning qaynash harorati −154,8 °C deb berilgan; CRC maʼlumotnomasi boʻyicha — −151,8 °C. Bu sahnaga taʼsir qilmaydi.',
      },
    },
    {
      id: 'no-bond-order',
      kind: 'model-limit',
      source: ref('BOND_DATA «N=O» (ядро): 115,1 пм; МО-теория: σ²π⁴π*¹, порядок 2½'),
      text: {
        ru: 'Формула N=O показывает две общие пары, но настоящий порядок связи в NO — два с половиной: неспаренный электрон принадлежит обоим атомам. Поэтому связь в NO короче и прочнее обычной двойной связи N=O.',
        en: 'The formula N=O shows two shared pairs, but the real bond order in NO is two and a half: the unpaired electron belongs to both atoms. That is why the bond in NO is shorter and stronger than an ordinary N=O double bond.',
        uz: 'N=O formulasi ikkita umumiy juftni koʻrsatadi, lekin NO dagi haqiqiy bogʻ tartibi ikki yarim: juftlashmagan elektron ikkala atomga tegishli. Shuning uchun NO dagi bogʻ oddiy N=O qoʻsh bogʻidan qisqaroq va mustahkamroq.',
      },
    },
    {
      id: 'no-mechanism',
      kind: 'scene-simplification',
      source: ref('Зельдович (1946): O + N₂ → NO + N; N + O₂ → NO + O'),
      text: {
        ru: 'В пламени и в молнии NO образуется цепочкой: атом O отнимает атом N у молекулы N₂, а освободившийся атом N отнимает атом O у O₂. Сцена показывает итог — какие связи рвутся и образуются.',
        en: 'In flames and lightning NO forms through a chain: an O atom takes an N atom from an N₂ molecule, and the freed N atom takes an O atom from O₂. The scene shows the outcome — which bonds break and form.',
        uz: 'Alanga va chaqmoqda NO zanjir orqali hosil boʻladi: O atomi N₂ molekulasidan N atomini tortib oladi, boʻshagan N atomi esa O₂ dan O atomini oladi. Sahna natijani — qaysi bogʻlar uzilishi va hosil boʻlishini koʻrsatadi.',
      },
    },
  ],
}
