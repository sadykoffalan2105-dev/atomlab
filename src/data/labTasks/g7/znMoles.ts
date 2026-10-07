/**
 * Kimyo 7, с. 62, задание 6: кусок цинка 26 г → количество вещества и число атомов.
 * Опыт в масштабе задачи: весы включают, лодочку тарируют, гранулы цинка набирают шпателем до 26 г (гранулы разные —
 * ровно 26,00 г не набрать), показание снимают после значка стабильности, цинк пересыпают в стакан «Zn для опытов».
 */
import { quantize } from '../../../components/lab3d/measure/quantities'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { L, tr, type LabTask } from '../labTaskTypes'

const M_ZN = 65
const NA = 6.02

export const ZN_MOLES: LabTask = {
  id: 'task-g7-zn-moles',
  grade: 7,
  page: 62,
  source: L('Kimyo 7 · с. 62, задание 6', 'Kimyo 7 · p. 62, exercise 6', 'Kimyo 7 · 62-bet, 6-topshiriq'),
  bookKind: 'task',
  title: L('Сколько молей и атомов в куске цинка', 'How many moles and atoms are in a piece of zinc', 'Rux bo‘lagida necha mol va nechta atom bor'),
  statement: L(
    'Когда кусок цинка взвесили на весах, определили, что он имеет массу 26 г. Определите: а) количество цинка в этом кусочке; б) количество атомов цинка.',
    'A piece of zinc was weighed on a balance and found to have a mass of 26 g. Determine: a) the amount of zinc in this piece; b) the number of zinc atoms.',
    'Rux bo‘lagi tarozida tortilganda uning massasi 26 g ekani aniqlandi. Aniqlang: a) shu bo‘lakdagi rux miqdorini; b) rux atomlari sonini.',
  ),
  equation: 'n = m / M;  N = n · Nₐ',
  kind: 'physical',
  type: 'moles',
  difficulty: 1,
  answers: [
    {
      key: 'n',
      label: 'n(Zn)',
      what: L('количество вещества цинка', 'amount of zinc', 'rux modda miqdori'),
      unit: L('моль', 'mol', 'mol'),
      book: 0.4,
      decimals: 2,
      fromRun: (v) => v.mZn! / M_ZN,
    },
    {
      key: 'N',
      label: 'N(Zn)',
      what: L('число атомов цинка', 'number of zinc atoms', 'rux atomlari soni'),
      unit: L('атомов', 'atoms', 'ta atom'),
      book: 2.408,
      decimals: 2,
      exponent: 23,
      fromRun: (v) => (v.mZn! / M_ZN) * NA,
    },
  ],
  labScale: {
    factor: 1,
    note: L('Опыт в масштабе задачи: 26 г цинка взвешивают целиком.', 'Same scale as the problem: all 26 g of zinc are weighed.', 'Tajriba masala masshtabida: 26 g rux to‘liq tortiladi.'),
  },
  instruments: ['scales'],
  equipment: [
    L('Электронные весы (0,01 г, предел 500 г)', 'Electronic balance (0.01 g, max 500 g)', 'Elektron tarozi (0,01 g, chegarasi 500 g)'),
    L('Лодочка для взвешивания', 'Weighing boat', 'Tortish qayiqchasi'),
    L('Банка с гранулами цинка, шпатель', 'Jar of zinc granules, spatula', 'Rux granulalari solingan banka, shpatel'),
    L('Стакан «Zn для опытов»', 'Beaker “Zn for experiments”', '«Tajribalar uchun Zn» stakani'),
  ],
  safety: [
    L('Реактивы руками не брать — только шпателем.', 'Never touch reagents with your hands — use the spatula.', 'Reaktivlarni qo‘l bilan olmang — faqat shpatel bilan.'),
    L('Вещество — только в лодочку, не прямо на чашу весов; весы не перегружать.', 'Put the substance into the boat, never straight onto the pan; do not overload the balance.', 'Moddani faqat qayiqchaga soling, to‘g‘ridan-to‘g‘ri pallaga emas; tarozini ortiqcha yuklamang.'),
    L('Излишек реактива в банку не возвращают.', 'Excess reagent is never put back into the jar.', 'Ortiqcha reaktiv bankaga qaytarilmaydi.'),
  ],
  steps: [
    {
      id: 'power',
      target: 'scales-power',
      gesture: { kind: 'tap' },
      seconds: 1.8,
      instruction: L('Включите весы кнопкой «ON».', 'Switch the balance on with “ON”.', 'Tarozini «ON» tugmasi bilan yoqing.'),
      observation: L('Весы проверили дисплей и показывают 0.00 g — пустая чаша.', 'The balance runs its display test and shows 0.00 g: the pan is empty.', 'Tarozi displeyni tekshirib, 0.00 g ko‘rsatadi — palla bo‘sh.'),
      how: L('Нажмите круглую кнопку слева под дисплеем.', 'Press the round button to the left below the display.', 'Displey ostidagi chapdagi yumaloq tugmani bosing.'),
      teacher: L('Весы стоят на ровном столе вдали от сквозняка: даже движение воздуха над чашей меняет последнюю цифру.', 'The balance stands on a level bench away from draughts: even moving air over the pan changes the last digit.', 'Tarozi tekis stolda, shamoldan uzoqda turadi: palla ustidagi havo harakati ham oxirgi raqamni o‘zgartiradi.'),
    },
    {
      id: 'boat',
      target: 'boat',
      gesture: { kind: 'drag', from: [-0.2, 0.02, 0.1], to: [0, 0.09, -0.052], lead: 0.55 },
      seconds: 2.4,
      instruction: L('Поставьте пустую лодочку на чашу весов.', 'Put the empty weighing boat on the pan.', 'Bo‘sh qayiqchani tarozi pallasiga qo‘ying.'),
      observation: L('Весы показывают массу пустой лодочки — около 1,8 г.', 'The display shows the mass of the empty boat, about 1.8 g.', 'Tarozi bo‘sh qayiqcha massasini ko‘rsatadi — taxminan 1,8 g.'),
      how: L('Перетащите лодочку со стола на чашу.', 'Drag the boat from the bench onto the pan.', 'Qayiqchani stoldan pallaga torting.'),
      teacher: L('Лодочка нужна, чтобы вещество не касалось чаши: чаша остаётся чистой, а цинк потом легко пересыпать.', 'The boat keeps the substance off the pan: the pan stays clean and the zinc is easy to tip out later.', 'Qayiqcha modda pallaga tegmasligi uchun kerak: palla toza qoladi, ruxni keyin oson to‘kish mumkin.'),
      mistake: L('Сыпать вещество прямо на чашу весов.', 'Pouring the substance straight onto the pan.', 'Moddani to‘g‘ridan-to‘g‘ri pallaga sepish.'),
    },
    {
      id: 'tare',
      target: 'scales-tare',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Обнулите весы кнопкой «T» (тара).', 'Zero the balance with “T” (tare).', 'Tarozini «T» (tara) tugmasi bilan nolga keltiring.'),
      observation: L('На дисплее 0.00 и значок →0←: массу лодочки весы теперь вычитают сами.', 'The display shows 0.00 and →0←: the balance now subtracts the boat by itself.', 'Displeyda 0.00 va →0← belgisi: qayiqcha massasini tarozi endi o‘zi ayiradi.'),
      how: L('Нажмите серебристую кнопку «T» справа под дисплеем.', 'Press the silver “T” button to the right below the display.', 'Displey ostidagi o‘ngdagi kumushrang «T» tugmasini bosing.'),
      teacher: L('Тарирование — это «вычесть посуду»: дальше весы показывают только массу самого вещества.', 'Taring means “subtract the container”: from now on the balance shows only the substance.', 'Tara — «idishni ayirish»: endi tarozi faqat moddaning massasini ko‘rsatadi.'),
      mistake: L('Забыть тару — тогда к массе цинка прибавится масса лодочки (~1,8 г).', 'Forgetting to tare: the boat (~1.8 g) is added to the zinc.', 'Tarani unutish — rux massasiga qayiqcha massasi (~1,8 g) qo‘shiladi.'),
    },
    {
      id: 'zinc',
      target: 'zn-jar',
      gesture: { kind: 'drag', from: [0.2, 0.06, -0.06], to: [0, 0.1, -0.052], lead: 0.2 },
      seconds: 10,
      instruction: L('Наберите шпателем гранулы цинка до 26 г.', 'Spoon zinc granules into the boat up to 26 g.', 'Shpatel bilan rux granulalarini 26 g gacha soling.'),
      observation: L('Показание растёт ступеньками: последние гранулы добавляют по 0,2–0,5 г. Ровно 26,00 г не получается.', 'The reading rises in steps; the last granules add 0.2–0.5 g each. Exactly 26.00 g is impossible.', 'Ko‘rsatkich zinapoya bo‘lib o‘sadi: oxirgi granulalar 0,2–0,5 g dan qo‘shadi. Aynan 26,00 g bo‘lmaydi.'),
      how: L('Откройте банку, перетащите шпатель от банки к лодочке; у 26 г добавляйте по одной грануле.', 'Open the jar and drag the spatula from the jar to the boat; near 26 g add one granule at a time.', 'Bankani oching, shpatelni bankadan qayiqchaga torting; 26 g ga yaqin bittadan granula qo‘shing.'),
      teacher: L('Масса куска складывается из масс атомов: в каждой грануле их ~10²¹, поэтому шаг весов — целая гранула.', 'The mass of the piece is the sum of its atoms: each granule holds ~10²¹ of them, so the step on the display is a whole granule.', 'Bo‘lak massasi atomlar massalari yig‘indisi: har bir granulada ~10²¹ atom, shuning uchun tarozi qadami — butun granula.'),
      mistake: L('Возвращать лишнюю гранулу в банку — так загрязняют реактив.', 'Putting an extra granule back into the jar contaminates the reagent.', 'Ortiqcha granulani bankaga qaytarish — reaktivni ifloslantiradi.'),
    },
    {
      id: 'read',
      target: 'scales-display',
      gesture: { kind: 'tap' },
      seconds: 2.2,
      instruction: L('Дождитесь значка стабильности «○» и снимите показание.', 'Wait for the stability mark “○” and take the reading.', 'Barqarorlik belgisi «○» ni kuting va ko‘rsatkichni yozib oling.'),
      observation: L('Цифры перестали меняться, горит «○». Масса цинка записана в журнал.', 'The digits have stopped changing and “○” is lit. The zinc mass goes into the log.', 'Raqamlar o‘zgarmay qoldi, «○» yonadi. Rux massasi jurnalga yozildi.'),
      how: L('Нажмите на дисплей весов — показание попадёт в журнал измерений.', 'Tap the display — the reading goes into the measurement log.', 'Tarozi displeyini bosing — ko‘rsatkich o‘lchov jurnaliga tushadi.'),
      teacher: L('Пока чаша качается после последней гранулы, последняя цифра «бегает»; верное число — после «○».', 'While the pan settles after the last granule the last digit wanders; the true value comes after “○”.', 'Oxirgi granuladan keyin palla tebranar ekan, oxirgi raqam «yuguradi»; to‘g‘ri son — «○» dan keyin.'),
      mistake: L('Записать число, пока весы не успокоились.', 'Writing the number down before the balance has settled.', 'Tarozi tinchlanmasdan sonni yozib olish.'),
    },
    {
      id: 'transfer',
      target: 'boat',
      gesture: { kind: 'drag', from: [0, 0.06, -0.052], to: [-0.24, 0.13, -0.1], lead: 0.4 },
      seconds: 3.6,
      instruction: L('Пересыпьте цинк в стакан «Zn для опытов».', 'Tip the zinc into the beaker “Zn for experiments”.', 'Ruxni «Tajribalar uchun Zn» stakaniga to‘king.'),
      observation: L('Гранулы в стакане. Весы показывают минус массу лодочки: тара помнит лодочку.', 'The granules are in the beaker. The balance shows minus the boat: the tare still remembers it.', 'Granulalar stakanda. Tarozi qayiqcha massasini minus bilan ko‘rsatadi: tara qayiqchani eslab qolgan.'),
      how: L('Перетащите лодочку к стакану — она наклонится, гранулы ссыплются.', 'Drag the boat to the beaker — it tilts and the granules slide in.', 'Qayiqchani stakanga torting — u qiyshayadi, granulalar to‘kiladi.'),
      teacher: L('Минус на дисплее — не ошибка: весы вычитают тару, а лодочку сняли. Перед новым взвешиванием снова «T».', 'The minus is not an error: the balance subtracts the tare and the boat is gone. Press “T” again before the next weighing.', 'Displeydagi minus xato emas: tarozi tarani ayiradi, qayiqcha esa olingan. Keyingi tortishdan oldin yana «T».'),
    },
  ],
  focus: [
    { from: 0.08, to: 0.96, point: [0, 0.025, 0.06], dist: 0.24 },
    { from: 1.62, to: 1.97, point: [0, 0.04, 0.02], dist: 0.3 },
    { from: 2.15, to: 2.96, point: [0, 0.025, 0.06], dist: 0.22 },
    { from: 3.6, to: 3.92, point: [0, 0.045, 0.01], dist: 0.32 },
    { from: 4.06, to: 4.96, point: [0, 0.025, 0.06], dist: 0.2 },
    { from: 5.7, to: 5.98, point: [-0.08, 0.04, 0.02], dist: 0.42 },
  ],
  labels: [
    { at: 0.62, pos: [0.06, 0.09, 0.06], text: L('0.00 — весы готовы', '0.00: the balance is ready', '0.00 — tarozi tayyor') },
    { at: 1.86, pos: [0.06, 0.1, 0.02], text: L('масса пустой лодочки', 'mass of the empty boat', 'bo‘sh qayiqcha massasi') },
    { at: 2.5, pos: [0.06, 0.09, 0.06], text: L('→0← тара: лодочку не считаем', '→0← tare: the boat is not counted', '→0← tara: qayiqcha hisobga olinmaydi') },
    { at: 3.72, pos: [-0.03, 0.12, -0.05], text: L('гранулы разные: шаг 0,2–0,5 г', 'granules differ: steps of 0.2–0.5 g', 'granulalar har xil: qadam 0,2–0,5 g') },
    { at: 4.5, pos: [0.06, 0.09, 0.06], text: L('«○» — показание стабильно', '“○”: the reading is stable', '«○» — ko‘rsatkich barqaror') },
    { at: 5.55, pos: [-0.24, 0.12, -0.1], text: L('цинк — в стакан для опытов', 'zinc into the beaker for experiments', 'rux — tajribalar stakaniga') },
    { at: 5.85, pos: [0.07, 0.1, 0.06], text: L('минус: тара помнит лодочку', 'minus: the tare remembers the boat', 'minus: tara qayiqchani eslaydi') },
  ],
  measurements: [
    { key: 'boat', label: 'm₀', what: L('масса пустой лодочки (до тары)', 'mass of the empty boat (before taring)', 'bo‘sh qayiqcha massasi (taragacha)'), instrument: 'scales', afterStep: 1 },
    { key: 'mZn', label: 'm(Zn)', what: L('масса цинка (после тары)', 'mass of zinc (after taring)', 'rux massasi (taradan keyin)'), instrument: 'scales', afterStep: 4 },
  ],
  simulate: (rng) => {
    const boat = rng.read('scales', rng.between(1.81, 1.87))
    // гранулы разные: останавливаются у 26 г — чаще чуть больше, иногда на одну гранулу меньше
    const mZn = quantize(26 + rng.between(-0.12, 0.36), 0.01)
    return { boat, mZn }
  },
  given: (v, lang) => [
    `m(Zn) = ${fmtNum(v.mZn!, 2, lang)} ${tr(lang, 'г', 'g', 'g')}`,
    `M(Zn) = 65 ${tr(lang, 'г/моль', 'g/mol', 'g/mol')}`,
    `Nₐ = ${fmtNum(NA, 2, lang)}·10²³ ${tr(lang, 'моль⁻¹', 'mol⁻¹', 'mol⁻¹')}`,
    tr(lang, 'Найти: n(Zn), N(Zn)', 'Find: n(Zn), N(Zn)', 'Topish kerak: n(Zn), N(Zn)'),
  ],
  solution: (v, lang) => {
    const n = v.mZn! / M_ZN
    const N = n * NA
    return [
      `n(Zn) = m / M = ${fmtNum(v.mZn!, 2, lang)} / 65 = ${fmtNum(n, 3, lang)} ${tr(lang, 'моль', 'mol', 'mol')}`,
      `N(Zn) = n · Nₐ = ${fmtNum(n, 3, lang)} · ${fmtNum(NA, 2, lang)}·10²³ = ${fmtNum(N, 2, lang)}·10²³`,
      tr(
        lang,
        `Учебник (26 г): n = 0,4 моль; N = 2,408·10²³ атомов`,
        `Textbook (26 g): n = 0.4 mol; N = 2.408·10²³ atoms`,
        `Darslik (26 g): n = 0,4 mol; N = 2,408·10²³ atom`,
      ),
      tr(
        lang,
        `Ответ: n(Zn) ≈ ${fmtNum(n, 2, lang)} моль; N ≈ ${fmtNum(N, 2, lang)}·10²³ атомов`,
        `Answer: n(Zn) ≈ ${fmtNum(n, 2, lang)} mol; N ≈ ${fmtNum(N, 2, lang)}·10²³ atoms`,
        `Javob: n(Zn) ≈ ${fmtNum(n, 2, lang)} mol; N ≈ ${fmtNum(N, 2, lang)}·10²³ atom`,
      ),
    ]
  },
  compare: [
    {
      label: L('Масса цинка m(Zn)', 'Mass of zinc m(Zn)', 'Rux massasi m(Zn)'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mZn!,
      predicted: () => 26,
      book: 26,
      tolerancePct: 2,
    },
  ],
  reconcile: L(
    'Гранулы цинка неодинаковые (0,2–0,5 г), поэтому ровно 26,00 г шпателем не набрать: останавливаются у ближайшего значения — чуть больше или на одну гранулу меньше. Количество вещества и число атомов пропорциональны массе: лишние 0,13 г — это ещё 0,002 моль. Погрешность самих весов (±0,01 г) на ответ почти не влияет.',
    'Zinc granules differ (0.2–0.5 g each), so you cannot spoon out exactly 26.00 g: you stop at the nearest value, a little above or one granule below. Amount and number of atoms are proportional to mass: an extra 0.13 g is another 0.002 mol. The balance error itself (±0.01 g) hardly affects the answer.',
    'Rux granulalari har xil (0,2–0,5 g), shuning uchun shpatel bilan aynan 26,00 g olib bo‘lmaydi: eng yaqin qiymatda to‘xtashadi — biroz ko‘p yoki bitta granula kam. Modda miqdori va atomlar soni massaga proporsional: ortiqcha 0,13 g — yana 0,002 mol. Tarozining o‘z xatoligi (±0,01 g) javobga deyarli ta’sir qilmaydi.',
  ),
  conclusion: L(
    '26 г цинка — это 0,4 моль, в них 2,408·10²³ атомов: масса, количество вещества и число частиц связаны через M и Nₐ.',
    '26 g of zinc is 0.4 mol, containing 2.408·10²³ atoms: mass, amount and number of particles are linked by M and Nₐ.',
    '26 g rux — bu 0,4 mol, unda 2,408·10²³ atom bor: massa, modda miqdori va zarrachalar soni M va Nₐ orqali bog‘langan.',
  ),
  story: {
    equation: 'm = 26 г → n = 0,4 моль → N = 2,408·10²³',
    text: L(
      'Каждая гранула — это огромное число одинаковых атомов цинка массой 65 а. е. м. Моль — порция из 6,02·10²³ атомов, она весит 65 г; в 26 г таких порций 0,4.',
      'Each granule is a huge number of identical zinc atoms of 65 u. A mole is a portion of 6.02·10²³ atoms weighing 65 g; 26 g holds 0.4 of these portions.',
      'Har bir granula — massasi 65 m.a.b. bo‘lgan juda ko‘p bir xil rux atomlari. Mol — 6,02·10²³ atomdan iborat 65 g lik ulush; 26 g da bunday ulushdan 0,4 ta.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показали весы после нажатия «T» с лодочкой на чаше?', 'What did the balance show after pressing “T” with the boat on the pan?', 'Pallada qayiqcha turganda «T» bosilgach tarozi nimani ko‘rsatdi?'),
      options: [
        L('0.00 и значок →0←', '0.00 and the →0← mark', '0.00 va →0← belgisi'),
        L('массу лодочки', 'the mass of the boat', 'qayiqcha massasini'),
        L('надпись Err', 'the message Err', 'Err yozuvini'),
      ],
      correct: 0,
      why: L('Тара вычитает массу посуды: дальше на дисплее только вещество.', 'Taring subtracts the container: afterwards the display shows only the substance.', 'Tara idish massasini ayiradi: keyin displeyda faqat modda.'),
    },
    {
      id: 'type',
      q: L('Какой приём сделал взвешивание точным?', 'Which technique made the weighing accurate?', 'Qaysi usul tortishni aniq qildi?'),
      options: [
        L('тарирование и отсчёт после значка «○»', 'taring and reading after the “○” mark', 'tara va «○» belgisidan keyin o‘qish'),
        L('цинк прямо на чашу, без лодочки', 'zinc straight onto the pan, no boat', 'ruxni qayiqchasiz to‘g‘ridan-to‘g‘ri pallaga'),
        L('округление до целых граммов', 'rounding to whole grams', 'butun grammgacha yaxlitlash'),
      ],
      correct: 0,
      why: L('Тара убирает массу лодочки, а «○» — колебания чаши; это физическое явление, вещество не меняется.', 'The tare removes the boat and “○” waits out the pan’s swaying; it is a physical process, the substance does not change.', 'Tara qayiqchani, «○» esa palla tebranishini chiqarib tashlaydi; bu fizik hodisa, modda o‘zgarmaydi.'),
    },
    {
      id: 'product',
      q: L('Что вы узнали из своего взвешивания?', 'What did your weighing tell you?', 'Tortishingizdan nimani bildingiz?'),
      options: [
        L('≈ 26 г цинка — это ≈ 0,4 моль, ≈ 2,4·10²³ атомов', '≈ 26 g of zinc is ≈ 0.4 mol, ≈ 2.4·10²³ atoms', '≈ 26 g rux — bu ≈ 0,4 mol, ≈ 2,4·10²³ atom'),
        L('26 г цинка — это 26 моль', '26 g of zinc is 26 mol', '26 g rux — bu 26 mol'),
        L('в 26 г цинка 6,02·10²³ атомов', '26 g of zinc holds 6.02·10²³ atoms', '26 g ruxda 6,02·10²³ atom bor'),
      ],
      correct: 0,
      why: L('n = m / M = 26 / 65 = 0,4 моль; N = 0,4 · 6,02·10²³ = 2,408·10²³.', 'n = m / M = 26 / 65 = 0.4 mol; N = 0.4 · 6.02·10²³ = 2.408·10²³.', 'n = m / M = 26 / 65 = 0,4 mol; N = 0,4 · 6,02·10²³ = 2,408·10²³.'),
    },
  ],
}
