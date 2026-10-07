/**
 * Kimyo 7, с. 96, задание 2: 1,2 г магния сгорают в кислороде — масса и количество оксида.
 * Опыт: тигель с крышкой на весах (тара) → 1,20 г магниевой ленты → тигель на фарфоровом треугольнике над спиртовкой
 * → магний вспыхивает (крышку приоткрывают щипцами — нужен воздух) → остывание → тигель на весы: m(MgO).
 * Честная потеря: часть MgO уходит белым дымом, немного Mg связывает азот (Mg₃N₂), сердцевина ленты догорает не вся.
 */
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { L, tr, type LabTask } from '../labTaskTypes'

const g = (lang: 'ru' | 'en' | 'uz') => tr(lang, 'г', 'g', 'g')
const mol = (lang: 'ru' | 'en' | 'uz') => tr(lang, 'моль', 'mol', 'mol')

export const MG_BURN: LabTask = {
  id: 'task-g7-mg-burn',
  grade: 7,
  page: 96,
  source: L('Kimyo 7 · с. 96, задание 2', 'Kimyo 7 · p. 96, exercise 2', 'Kimyo 7 · 96-bet, 2-topshiriq'),
  bookKind: 'task',
  title: L('Горение магния: сколько оксида образуется', 'Burning magnesium: how much oxide forms', 'Magniyning yonishi: qancha oksid hosil bo‘ladi'),
  statement: L(
    'Сколько г и сколько молей оксида образуется при реакции 1,2 г магния с кислородом?',
    'How many grams and how many moles of oxide form when 1.2 g of magnesium reacts with oxygen?',
    '1,2 g magniy kislorod bilan reaksiyaga kirishganda necha gramm va necha mol oksid hosil bo‘ladi?',
  ),
  equation: '2Mg + O₂ → 2MgO',
  kind: 'combination',
  type: 'stoich-mass',
  difficulty: 2,
  answers: [
    {
      key: 'mMgO',
      label: 'm(MgO)',
      what: L('масса оксида магния', 'mass of magnesium oxide', 'magniy oksidi massasi'),
      unit: L('г', 'g', 'g'),
      book: 2,
      decimals: 2,
      fromRun: (v) => (v.mgo! * 1.2) / v.mg!,
    },
    {
      key: 'nMgO',
      label: 'n(MgO)',
      what: L('количество вещества оксида магния', 'amount of magnesium oxide', 'magniy oksidi modda miqdori'),
      unit: L('моль', 'mol', 'mol'),
      book: 0.05,
      decimals: 3,
      fromRun: (v) => (v.mgo! * 1.2) / v.mg! / 40,
    },
  ],
  labScale: {
    factor: 1,
    note: L('Опыт в масштабе задачи: сжигают 1,2 г магниевой ленты.', 'Same scale as the problem: 1.2 g of magnesium ribbon is burnt.', 'Tajriba masala masshtabida: 1,2 g magniy lentasi yondiriladi.'),
  },
  instruments: ['scales'],
  equipment: [
    L('Электронные весы (0,01 г)', 'Electronic balance (0.01 g)', 'Elektron tarozi (0,01 g)'),
    L('Фарфоровый тигель с крышкой, тигельные щипцы', 'Porcelain crucible with lid, crucible tongs', 'Qopqoqli chinni tigel, tigel qisqichi'),
    L('Треножник, фарфоровый треугольник, спиртовка, спички', 'Tripod, pipe-clay triangle, spirit lamp, matches', 'Uchoyoq, chinni uchburchak, spirt lampa, gugurt'),
    L('Магниевая лента (зачищенная), часовое стекло', 'Magnesium ribbon (cleaned), watch glass', 'Magniy lentasi (tozalangan), soat oynasi'),
  ],
  safety: [
    L('Защитные очки обязательны: горящий магний разбрасывает искры.', 'Goggles are a must: burning magnesium throws sparks.', 'Himoya ko‘zoynagi shart: yonayotgan magniy uchqun sochadi.'),
    L('Не смотреть на пламя магния в упор — яркий свет слепит.', 'Do not stare at the magnesium flame — its light is blinding.', 'Magniy alangasiga tik qaramang — yorug‘ligi ko‘zni qamashtiradi.'),
    L('Горячий тигель — только щипцами; спиртовку гасить колпачком, не дуть.', 'Handle the hot crucible only with tongs; put the lamp out with its cap, never blow.', 'Issiq tigelni faqat qisqich bilan oling; spirt lampani qalpoqcha bilan o‘chiring, puflamang.'),
  ],
  gear: ['goggles'],
  steps: [
    {
      id: 'gear',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте защитные очки.', 'Put on safety goggles.', 'Himoya ko‘zoynagini taqing.'),
      observation: L('Очки надеты — можно работать с огнём.', 'Goggles on: you may work with the flame.', 'Ko‘zoynak taqildi — olov bilan ishlash mumkin.'),
      how: L('Нажмите на поднос с очками.', 'Tap the tray with the goggles.', 'Ko‘zoynakli patnisni bosing.'),
      teacher: L('Горящий магний разбрызгивает раскалённые частицы, а его свет очень яркий — глаза защищают заранее.', 'Burning magnesium spits red-hot particles and its light is very bright, so the eyes are protected in advance.', 'Yonayotgan magniy cho‘g‘ zarralarni sochadi, yorug‘ligi juda kuchli — ko‘z oldindan himoyalanadi.'),
    },
    {
      id: 'crucible',
      target: 'crucible',
      gesture: { kind: 'drag', from: [-0.12, 0.02, 0.12], to: [-0.3, 0.09, -0.052], lead: 0.5 },
      seconds: 3,
      instruction: L('Щипцами поставьте тигель с крышкой на весы.', 'Use the tongs to put the crucible with its lid on the balance.', 'Qisqich bilan qopqoqli tigelni taroziga qo‘ying.'),
      observation: L('Весы показывают массу тигля с крышкой — около 20 г.', 'The balance shows the crucible with its lid, about 20 g.', 'Tarozi qopqoqli tigel massasini ko‘rsatadi — taxminan 20 g.'),
      how: L('Перетащите тигель со стола на чашу весов.', 'Drag the crucible from the bench onto the pan.', 'Tigelni stoldan tarozi pallasiga torting.'),
      teacher: L('Тигель берут щипцами даже холодным: жир с пальцев прибавит к массе сотые доли грамма.', 'The crucible is handled with tongs even when cold: grease from fingers adds hundredths of a gram.', 'Tigel sovuq bo‘lsa ham qisqich bilan olinadi: barmoqdagi yog‘ massaga grammning yuzdan bir ulushlarini qo‘shadi.'),
    },
    {
      id: 'tare',
      target: 'scales-tare',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Обнулите весы кнопкой «T».', 'Zero the balance with “T”.', 'Tarozini «T» bilan nolga keltiring.'),
      observation: L('0.00 и →0←: дальше весы показывают только содержимое тигля.', '0.00 and →0←: from now on only the crucible’s contents are shown.', '0.00 va →0←: endi faqat tigel ichidagi modda ko‘rsatiladi.'),
      how: L('Нажмите кнопку «T» справа под дисплеем.', 'Press the “T” button to the right below the display.', 'Displey ostidagi o‘ngdagi «T» tugmasini bosing.'),
      teacher: L('После тары и до конца опыта кнопку «T» больше не нажимают: продукт взвешивают в том же тигле.', 'After taring, “T” is not pressed again: the product is weighed in the same crucible.', 'Taradan keyin «T» boshqa bosilmaydi: mahsulot o‘sha tigelda tortiladi.'),
      mistake: L('Нажать «T» ещё раз перед взвешиванием оксида — тогда весы покажут только прибавку.', 'Pressing “T” again before weighing the oxide — then only the gain is shown.', 'Oksidni tortishdan oldin yana «T» ni bosish — unda faqat ortgan massa ko‘rinadi.'),
    },
    {
      id: 'ribbon',
      target: 'mg-ribbon',
      gesture: { kind: 'drag', from: [-0.47, 0.01, 0.12], to: [-0.3, 0.1, -0.052], lead: 0.4 },
      seconds: 3.4,
      instruction: L('Положите в тигель свёрнутую магниевую ленту (1,20 г) и закройте крышкой.', 'Put the coiled magnesium ribbon (1.20 g) into the crucible and close the lid.', 'Tigelga o‘ralgan magniy lentasini (1,20 g) soling va qopqoq bilan yoping.'),
      observation: L('Весы показывают массу магния — около 1,20 г. Лента блестящая, серебристая.', 'The balance shows the magnesium, about 1.20 g. The ribbon is shiny and silvery.', 'Tarozi magniy massasini ko‘rsatadi — taxminan 1,20 g. Lenta yaltiroq, kumushrang.'),
      how: L('Перетащите спираль ленты с часового стекла в тигель.', 'Drag the ribbon coil from the watch glass into the crucible.', 'Lenta spiralini soat oynasidan tigelga torting.'),
      teacher: L('Ленту зачищают наждачной бумагой: тусклая плёнка оксида на ней — уже не магний, она исказит массу.', 'The ribbon is cleaned with emery paper: the dull oxide film is no longer magnesium and would spoil the mass.', 'Lenta jilvir qog‘oz bilan tozalanadi: undagi xira oksid pardasi endi magniy emas, massani buzadi.'),
    },
    {
      id: 'triangle',
      target: 'crucible',
      gesture: { kind: 'drag', from: [-0.3, 0.07, -0.052], to: [0.12, 0.2, -0.06], lead: 0.5 },
      seconds: 3,
      instruction: L('Щипцами перенесите тигель в фарфоровый треугольник на треножнике.', 'With the tongs, move the crucible into the pipe-clay triangle on the tripod.', 'Qisqich bilan tigelni uchoyoqdagi chinni uchburchakka o‘tkazing.'),
      observation: L('Тигель стоит в треугольнике, дно — над спиртовкой. Весы без тигля показывают минус.', 'The crucible sits in the triangle, its bottom above the lamp. The empty balance shows a minus.', 'Tigel uchburchakda, tubi spirt lampa ustida. Tigelsiz tarozi minus ko‘rsatadi.'),
      how: L('Перетащите тигель с весов на треножник.', 'Drag the crucible from the balance onto the tripod.', 'Tigelni tarozidan uchoyoqqa torting.'),
      teacher: L('Минус на весах — это вычтенная тара: тигель сняли. Тару не трогаем — она понадобится в конце.', 'The minus is the subtracted tare: the crucible is off. Leave the tare alone — it is needed at the end.', 'Tarozidagi minus — ayirilgan tara: tigel olindi. Taraga tegmaymiz — oxirida kerak bo‘ladi.'),
    },
    {
      id: 'heat',
      target: 'spirit-lamp',
      gesture: { kind: 'swipe', from: [0.15, 0.07, -0.06], to: [0.24, 0.07, -0.05], lead: 0.3 },
      seconds: 7,
      instruction: L('Снимите колпачок и зажгите спиртовку под тиглем.', 'Take off the cap and light the spirit lamp under the crucible.', 'Qalpoqchani oling va tigel ostidagi spirt lampani yoqing.'),
      observation: L('Дно тигля раскаляется; через минуту под крышкой вспыхивает ослепительно-белый свет — магний загорелся.', 'The crucible bottom gets red-hot; after a minute a dazzling white light flares under the lid: the magnesium has caught fire.', 'Tigel tubi qiziydi; bir daqiqadan so‘ng qopqoq ostida ko‘zni qamashtiruvchi oq yorug‘lik chaqnaydi — magniy yondi.'),
      how: L('Проведите по колпачку вправо — спичка зажжёт фитиль.', 'Swipe the cap to the right — a match lights the wick.', 'Qalpoqchani o‘ngga suring — gugurt pilikni yoqadi.'),
      teacher: L('Магний загорается около 650 °C: атомы Mg отдают по 2 электрона атомам кислорода, выделяется много света и тепла.', 'Magnesium ignites at about 650 °C: Mg atoms hand 2 electrons each to oxygen atoms, releasing a lot of light and heat.', 'Magniy taxminan 650 °C da alangalanadi: Mg atomlari kislorod atomlariga 2 tadan elektron beradi, ko‘p yorug‘lik va issiqlik ajraladi.'),
      mistake: L('Зажигать спиртовку от другой спиртовки — спирт разольётся и вспыхнет.', 'Lighting one spirit lamp from another — the spirit spills and catches fire.', 'Spirt lampani boshqa spirt lampadan yoqish — spirt to‘kilib alangalanadi.'),
    },
    {
      id: 'lid',
      target: 'crucible-lid',
      gesture: { kind: 'swipe', from: [0.12, 0.165, -0.06], to: [0.12, 0.225, -0.06], lead: 0.3 },
      seconds: 6,
      instruction: L('Щипцами чуть приоткрывайте крышку, пока магний не догорит.', 'With the tongs, lift the lid slightly now and then until the magnesium has burnt out.', 'Magniy yonib bo‘lguncha qisqich bilan qopqoqni biroz ochib turing.'),
      observation: L('В щель вырывается белое пламя и белый дым MgO. Лента превратилась в белый рыхлый порошок.', 'A white flame and white MgO smoke escape through the gap. The ribbon has turned into a white crumbly powder.', 'Tirqishdan oq alanga va oq MgO tutuni chiqadi. Lenta oq g‘ovak kukunga aylandi.'),
      how: L('Проведите вверх по крышке — щипцы приподнимут её на секунду.', 'Swipe up on the lid — the tongs lift it for a moment.', 'Qopqoq bo‘ylab yuqoriga suring — qisqich uni bir lahzaga ko‘taradi.'),
      teacher: L('Крышку приоткрывают, чтобы впустить кислород воздуха, но ненадолго: иначе белый дым MgO унесёт часть продукта.', 'The lid is opened to let in oxygen from the air, but only briefly: otherwise the white MgO smoke carries product away.', 'Qopqoq havodagi kislorod kirishi uchun ochiladi, lekin qisqa vaqtga: aks holda oq MgO tutuni mahsulotning bir qismini olib ketadi.'),
      mistake: L('Снять крышку совсем — часть оксида улетит дымом, масса выйдет меньше.', 'Taking the lid off completely — some oxide flies off as smoke and the mass comes out low.', 'Qopqoqni butunlay olish — oksidning bir qismi tutun bo‘lib uchadi, massa kam chiqadi.'),
    },
    {
      id: 'off',
      target: 'lamp-cap',
      gesture: { kind: 'drag', from: [0.195, 0.02, -0.048], to: [0.12, 0.1, -0.06], lead: 0.6 },
      seconds: 3.4,
      instruction: L('Погасите спиртовку колпачком и дайте тиглю остыть.', 'Put the lamp out with its cap and let the crucible cool.', 'Spirt lampani qalpoqcha bilan o‘chiring va tigelni sovishiga qo‘ying.'),
      observation: L('Пламя погасло. Тигель остывает (в жизни — около 10 минут).', 'The flame is out. The crucible cools down (about 10 minutes in real life).', 'Alanga o‘chdi. Tigel soviydi (hayotda — taxminan 10 daqiqa).'),
      how: L('Перетащите колпачок со стола на фитиль.', 'Drag the cap from the bench onto the wick.', 'Qalpoqchani stoldan pilikka torting.'),
      teacher: L('Горячий тигель на весах «легче»: от него поднимается тёплый воздух и подталкивает чашу. Поэтому взвешивают холодным.', 'A hot crucible reads light: warm air rising from it pushes on the pan. So it is weighed cold.', 'Issiq tigel tarozida «yengil» chiqadi: undan ko‘tarilgan iliq havo pallani itaradi. Shuning uchun sovuq holda tortiladi.'),
    },
    {
      id: 'weigh',
      target: 'crucible',
      gesture: { kind: 'drag', from: [0.12, 0.14, -0.06], to: [-0.3, 0.1, -0.052], lead: 0.5 },
      seconds: 3,
      instruction: L('Щипцами поставьте остывший тигель на весы и снимите показание.', 'With the tongs, put the cooled crucible on the balance and take the reading.', 'Qisqich bilan sovigan tigelni taroziga qo‘ying va ko‘rsatkichni yozing.'),
      observation: L('Весы показывают массу оксида магния — около 2 г: больше, чем было магния.', 'The balance shows the magnesium oxide, about 2 g: more than the magnesium was.', 'Tarozi magniy oksidi massasini ko‘rsatadi — taxminan 2 g: magniydan ko‘p.'),
      how: L('Перетащите тигель с треножника на весы.', 'Drag the crucible from the tripod to the balance.', 'Tigelni uchoyoqdan taroziga torting.'),
      teacher: L('Масса выросла на массу кислорода, который присоединился к магнию: m(O₂) = m(MgO) − m(Mg).', 'The mass grew by the oxygen that joined the magnesium: m(O₂) = m(MgO) − m(Mg).', 'Massa magniyga qo‘shilgan kislorod massasiga ortdi: m(O₂) = m(MgO) − m(Mg).'),
      mistake: L('Взвешивать горячий тигель — показание будет занижено и будет «плыть».', 'Weighing the crucible hot — the reading is low and drifts.', 'Issiq tigelni tortish — ko‘rsatkich kam chiqadi va «suzadi».'),
    },
  ],
  focus: [
    { from: 1.6, to: 1.97, point: [-0.3, 0.04, 0.0], dist: 0.34 },
    { from: 2.15, to: 2.95, point: [-0.3, 0.025, 0.06], dist: 0.22 },
    { from: 3.55, to: 3.97, point: [-0.3, 0.04, 0.0], dist: 0.32 },
    { from: 5.5, to: 5.97, point: [0.12, 0.14, -0.06], dist: 0.34 },
    { from: 6.15, to: 6.85, point: [0.12, 0.16, -0.06], dist: 0.46 },
    { from: 8.72, to: 8.98, point: [-0.3, 0.03, 0.03], dist: 0.26 },
  ],
  labels: [
    { at: 1.85, pos: [-0.24, 0.13, -0.05], text: L('тигель с крышкой', 'crucible with lid', 'qopqoqli tigel') },
    { at: 2.5, pos: [-0.24, 0.09, 0.06], text: L('→0← тара: тигель не считаем', '→0← tare: the crucible is not counted', '→0← tara: tigel hisobga olinmaydi') },
    { at: 3.65, pos: [-0.24, 0.12, -0.05], text: L('магниевая лента', 'magnesium ribbon', 'magniy lentasi') },
    { at: 5.9, pos: [0.19, 0.2, -0.06], text: L('магний загорелся', 'the magnesium is burning', 'magniy yondi') },
    { at: 6.25, pos: [0.2, 0.25, -0.06], text: L('не смотрите на пламя в упор!', 'do not stare into the flame!', 'alangaga tik qaramang!') },
    { at: 6.62, pos: [0.04, 0.27, -0.06], text: L('белый дым MgO', 'white MgO smoke', 'oq MgO tutuni') },
    { at: 7.6, pos: [0.19, 0.2, -0.06], text: L('остывание (в жизни ~10 мин)', 'cooling (~10 min in real life)', 'sovish (hayotda ~10 daq)') },
    { at: 8.85, pos: [-0.24, 0.13, -0.05], text: L('белый порошок MgO', 'white MgO powder', 'oq MgO kukuni') },
  ],
  measurements: [
    { key: 'crucible', label: 'm₀', what: L('масса тигля с крышкой (до тары)', 'mass of crucible with lid (before taring)', 'qopqoqli tigel massasi (taragacha)'), instrument: 'scales', afterStep: 1 },
    { key: 'mg', label: 'm(Mg)', what: L('масса магниевой ленты', 'mass of the magnesium ribbon', 'magniy lentasi massasi'), instrument: 'scales', afterStep: 3 },
    { key: 'mgo', label: 'm(MgO)', what: L('масса оксида магния после прокаливания', 'mass of magnesium oxide after heating', 'qizdirishdan keyingi magniy oksidi massasi'), instrument: 'scales', afterStep: 8 },
    { key: 'mO2', label: 'm(O₂)', what: L('масса присоединившегося кислорода (разность)', 'mass of oxygen taken up (difference)', 'qo‘shilgan kislorod massasi (farq)'), instrument: 'scales', afterStep: 8, derived: true },
  ],
  simulate: (rng) => {
    const crucible = rng.read('scales', rng.between(19.3, 21.6))
    const mg = rng.weigh(1.2, 0.03)
    // часть MgO уходит дымом, немного Mg связывает азот воздуха (Mg₃N₂), сердцевина ленты догорает не вся
    const mgo = rng.read('scales', ((mg * 40) / 24) * rng.between(0.965, 0.995))
    return { crucible, mg, mgo, mO2: Math.round((mgo - mg) * 100) / 100 }
  },
  given: (v, lang) => [
    `m(Mg) = ${fmtNum(v.mg!, 2, lang)} ${g(lang)}`,
    `M(Mg) = 24 ${tr(lang, 'г/моль', 'g/mol', 'g/mol')};  M(MgO) = 40 ${tr(lang, 'г/моль', 'g/mol', 'g/mol')}`,
    `${tr(lang, 'Измерено', 'Measured', 'O‘lchandi')}: m(MgO) = ${fmtNum(v.mgo!, 2, lang)} ${g(lang)}`,
    tr(lang, 'Найти: m(MgO), n(MgO) для 1,2 г Mg', 'Find: m(MgO), n(MgO) for 1.2 g of Mg', 'Topish kerak: 1,2 g Mg uchun m(MgO), n(MgO)'),
  ],
  solution: (v, lang) => {
    const n = v.mg! / 24
    const run = (v.mgo! * 1.2) / v.mg!
    return [
      '2Mg + O₂ → 2MgO;  n(MgO) = n(Mg)',
      `n(Mg) = ${fmtNum(v.mg!, 2, lang)} / 24 = ${fmtNum(n, 4, lang)} ${mol(lang)} → m(MgO) = ${fmtNum(n, 4, lang)} · 40 = ${fmtNum(n * 40, 2, lang)} ${g(lang)} (${tr(lang, 'расчёт', 'calculated', 'hisob')})`,
      `m(O₂) = ${fmtNum(v.mgo!, 2, lang)} − ${fmtNum(v.mg!, 2, lang)} = ${fmtNum(v.mgo! - v.mg!, 2, lang)} ${g(lang)}`,
      `${tr(lang, 'На 1,2 г Mg по опыту', 'Per 1.2 g Mg from the run', 'Tajriba bo‘yicha 1,2 g Mg ga')}: ${fmtNum(v.mgo!, 2, lang)} · 1,2 / ${fmtNum(v.mg!, 2, lang)} = ${fmtNum(run, 2, lang)} ${g(lang)}`,
      tr(
        lang,
        `Ответ: m(MgO) = 1,2 / 24 · 40 = 2,0 г; n(MgO) = 0,05 моль (по опыту ${fmtNum(run, 2, lang)} г; ${fmtNum(run / 40, 3, lang)} моль)`,
        `Answer: m(MgO) = 1.2 / 24 · 40 = 2.0 g; n(MgO) = 0.05 mol (run: ${fmtNum(run, 2, lang)} g; ${fmtNum(run / 40, 3, lang)} mol)`,
        `Javob: m(MgO) = 1,2 / 24 · 40 = 2,0 g; n(MgO) = 0,05 mol (tajriba: ${fmtNum(run, 2, lang)} g; ${fmtNum(run / 40, 3, lang)} mol)`,
      ),
    ]
  },
  compare: [
    {
      label: L('Масса оксида m(MgO)', 'Oxide mass m(MgO)', 'Oksid massasi m(MgO)'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mgo!,
      predicted: (v) => (v.mg! * 40) / 24,
      book: 2,
      tolerancePct: 5,
    },
  ],
  reconcile: L(
    'Оксида получилось на 0,5–3,5 % меньше расчёта — и это честно: часть MgO улетает белым дымом, когда приоткрывают крышку; немного магния соединяется с азотом воздуха (Mg₃N₂ легче, чем MgO того же магния); сердцевина толстой ленты может не догореть. Весы ошибаются лишь на ±0,01 г.',
    'The oxide comes out 0.5–3.5 % below the calculation, honestly so: some MgO escapes as white smoke when the lid is lifted; a little magnesium combines with nitrogen from the air (Mg₃N₂ is lighter than MgO from the same magnesium); the core of a thick ribbon may not burn through. The balance errs by only ±0.01 g.',
    'Oksid hisobdan 0,5–3,5 % kam chiqdi — bu tabiiy: qopqoq ochilganda MgO ning bir qismi oq tutun bo‘lib uchadi; biroz magniy havodagi azot bilan birikadi (Mg₃N₂ o‘sha magniydan olingan MgO dan yengil); qalin lentaning o‘zagi yonib bitmasligi mumkin. Tarozi faqat ±0,01 g xato qiladi.',
  ),
  conclusion: L(
    'Из 1,2 г магния образуется 2,0 г (0,05 моль) MgO: масса выросла ровно на присоединившийся кислород — 0,8 г.',
    '1.2 g of magnesium gives 2.0 g (0.05 mol) of MgO: the mass grows by exactly the oxygen taken up, 0.8 g.',
    '1,2 g magniydan 2,0 g (0,05 mol) MgO hosil bo‘ladi: massa aynan qo‘shilgan kislorodga — 0,8 g ga ortadi.',
  ),
  story: {
    equation: '2Mg + O₂ → 2MgO',
    text: L(
      'Каждый атом магния отдаёт 2 электрона атому кислорода: получаются ионы Mg²⁺ и O²⁻, которые складываются в белые кристаллики MgO. Атомы кислорода приходят из воздуха — поэтому тигель стал тяжелее.',
      'Each magnesium atom gives 2 electrons to an oxygen atom: Mg²⁺ and O²⁻ ions form and pack into tiny white MgO crystals. The oxygen atoms come from the air, which is why the crucible got heavier.',
      'Har bir magniy atomi kislorod atomiga 2 ta elektron beradi: Mg²⁺ va O²⁻ ionlari hosil bo‘lib, oq MgO kristallchalariga joylashadi. Kislorod atomlari havodan keladi — shuning uchun tigel og‘irlashdi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что вы увидели, когда приоткрыли крышку тигля?', 'What did you see when you lifted the crucible lid?', 'Tigel qopqog‘ini ochganda nimani ko‘rdingiz?'),
      options: [
        L('ослепительно-белое пламя и белый дым', 'a dazzling white flame and white smoke', 'ko‘zni qamashtiruvchi oq alanga va oq tutun'),
        L('голубое пламя и резкий запах', 'a blue flame and a sharp smell', 'ko‘k alanga va o‘tkir hid'),
        L('ничего не изменилось', 'nothing changed', 'hech narsa o‘zgarmadi'),
      ],
      correct: 0,
      why: L('Яркий свет и тепло — признаки горения; белый дым — мельчайшие частицы MgO.', 'Bright light and heat are signs of burning; the white smoke is tiny MgO particles.', 'Yorqin yorug‘lik va issiqlik — yonish belgilari; oq tutun — MgO ning mayda zarralari.'),
    },
    {
      id: 'type',
      q: L('К какому типу относится реакция?', 'What type of reaction is it?', 'Reaksiya qaysi turga kiradi?'),
      options: [
        L('соединение (горение металла)', 'combination (a metal burning)', 'birikish (metallning yonishi)'),
        L('разложение', 'decomposition', 'parchalanish'),
        L('замещение', 'substitution', 'o‘rin olish'),
      ],
      correct: 0,
      why: L('Из двух простых веществ — магния и кислорода — образовалось одно сложное, MgO.', 'Two simple substances, magnesium and oxygen, make one compound, MgO.', 'Ikki oddiy modda — magniy va kisloroddan bitta murakkab modda, MgO hosil bo‘ldi.'),
    },
    {
      id: 'product',
      q: L('Что осталось в тигле после опыта?', 'What was left in the crucible?', 'Tajribadan keyin tigelda nima qoldi?'),
      options: [
        L('белый порошок MgO — тяжелее взятого магния', 'white MgO powder, heavier than the magnesium taken', 'oq MgO kukuni — olingan magniydan og‘ir'),
        L('чёрный уголь — легче магния', 'black carbon, lighter than the magnesium', 'qora ko‘mir — magniydan yengil'),
        L('блестящий магний той же массы', 'shiny magnesium of the same mass', 'o‘sha massadagi yaltiroq magniy'),
      ],
      correct: 0,
      why: L('m(MgO) = m(Mg) + m(O₂): к магнию присоединился кислород воздуха.', 'm(MgO) = m(Mg) + m(O₂): oxygen from the air joined the magnesium.', 'm(MgO) = m(Mg) + m(O₂): magniyga havodagi kislorod qo‘shildi.'),
    },
  ],
}
