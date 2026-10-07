/**
 * Kimyo 7, с. 148, задача 1: 28 г оксида кальция прореагировали с водой — масса образовавшегося вещества.
 * Опыт в 10 раз меньше: фарфоровая чашка на весах (тара) → 2,80 г CaO → чашка на плитку, термометр в порошок →
 * 5 мл воды из мерного цилиндра 10 мл (шипение, пар, разогрев до 55–70 °C, порошок рассыпается) → сушильный шкаф
 * 120 °C (лишняя вода уходит, Ca(OH)₂ не разлагается) → чашка на весы: m(Ca(OH)₂) → щепотка продукта в воду
 * с фенолфталеином — малиновая (щёлочь).
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { C_WATER, deltaT } from '../../../components/lab3d/measure/quantities'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

type V3 = readonly [number, number, number]

/** Раскладка установки (локальные координаты рабочего места, м; верх стола y = 0) — общая для данных и 3D. */
export const CW = {
  ppe: [0.56, 0, 0.22] as V3,
  scales: [-0.44, 0, 0.06] as V3,
  /** Чашка до опыта (на столе). */
  dish: [-0.22, 0, 0.2] as V3,
  jar: [-0.6, 0, -0.12] as V3,
  spatula: [-0.42, 0, 0.255] as V3,
  /** Керамическая плитка: на ней идёт реакция; над ней — термометр в лапке (стержень на 0,12 м левее). */
  tile: [-0.06, 0, -0.04] as V3,
  bottle: [0.2, 0, 0.08] as V3,
  cylinder: [0.1, 0, 0.06] as V3,
  oven: [0.44, 0, -0.12] as V3,
  watch: [0.2, 0, 0.21] as V3,
  dropper: [0.29, 0, 0.25] as V3,
}
/** Центр чаши весов. */
export const CW_PAN: V3 = [CW.scales[0], 0.047, CW.scales[2] - 0.012]
/** Полка сушильного шкафа (координаты стола). */
export const CW_SHELF: V3 = [CW.oven[0], 0.07, CW.oven[2]]
/** Масса фарфоровой чашки (г) — её убирает тара. */
export const CW_DISH_G = 34.18

const SCALE = 10
const M_CAO = 56
const M_CAOH2 = 74
const f = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
const answerG = (v: LabTaskValues) => (v.mProd! * 28) / v.mCaO!

export const TASK_G7_CAO_WATER: LabTask = {
  id: 'task-g7-cao-water',
  grade: 7,
  page: 148,
  source: L('Kimyo 7 · с. 148, задача 1', 'Kimyo 7 · p. 148, problem 1', 'Kimyo 7 · 148-bet, 1-masala'),
  bookKind: 'task',
  title: L('Гашение извести: сколько Ca(OH)₂ даёт оксид кальция', 'Slaking lime: how much Ca(OH)₂ calcium oxide gives', 'Ohakni so‘ndirish: kalsiy oksidi qancha Ca(OH)₂ beradi'),
  statement: L(
    'С водой прореагировало 28 г оксида кальция. Рассчитайте массу образовавшегося вещества.',
    '28 g of calcium oxide reacted with water. Calculate the mass of the substance formed.',
    'Suv bilan 28 g kalsiy oksidi reaksiyaga kirishdi. Hosil bo‘lgan modda massasini hisoblang.',
  ),
  equation: 'CaO + H₂O → Ca(OH)₂',
  kind: 'combination',
  type: 'stoich-mass',
  difficulty: 2,
  answers: [
    {
      key: 'mCaOH2',
      label: 'm(Ca(OH)₂)',
      what: L('масса гидроксида кальция', 'mass of calcium hydroxide', 'kalsiy gidroksid massasi'),
      unit: L('г', 'g', 'g'),
      book: 37,
      decimals: 0,
      fromRun: answerG,
      altFromRun: (v) => v.mProd! * 10,
    },
  ],
  labScale: {
    factor: SCALE,
    note: L(
      '28 г негашёной извести с водой разогреваются почти до кипения и разбрызгиваются. Берём в 10 раз меньше — 2,80 г: реакция та же, а массу продукта умножаем на 10 (точнее — на 28 / вашу навеску).',
      '28 g of quicklime with water heats up almost to boiling and spatters. We take 10 times less — 2.80 g: the reaction is the same, and the product mass is multiplied by 10 (more exactly, by 28 / your sample).',
      '28 g so‘ndirilmagan ohak suv bilan deyarli qaynaguncha qiziydi va sachraydi. 10 marta kam olamiz — 2,80 g: reaksiya o‘sha, mahsulot massasini 10 ga ko‘paytiramiz (aniqrog‘i — 28 / sizning tortmangizga).',
    ),
  },
  instruments: ['scales', 'thermometer', 'cyl10'],
  equipment: [
    L('Электронные весы (0,01 г), фарфоровая чашка, шпатель', 'Electronic balance (0.01 g), porcelain dish, spatula', 'Elektron tarozi (0,01 g), chinni kosacha, shpatel'),
    L('Оксид кальция (негашёная известь) в банке, вода, мерный цилиндр 10 мл', 'Calcium oxide (quicklime) in a jar, water, 10 ml measuring cylinder', 'Bankadagi kalsiy oksidi (so‘ndirilmagan ohak), suv, 10 ml o‘lchov silindri'),
    L('Керамическая плитка, термометр в лапке штатива', 'Ceramic tile, thermometer in a stand clamp', 'Keramik plitka, shtativ qisqichidagi termometr'),
    L('Сушильный шкаф (120 °C), часовое стекло, фенолфталеин', 'Drying oven (120 °C), watch glass, phenolphthalein', 'Quritish shkafi (120 °C), soat oynasi, fenolftalein'),
  ],
  safety: [
    L('Очки и перчатки: известь едкая, а при гашении брызгает горячей кашицей.', 'Goggles and gloves: lime is caustic and spits hot paste while slaking.', 'Ko‘zoynak va qo‘lqop: ohak o‘yuvchi, so‘ndirilganda issiq bo‘tqa sachratadi.'),
    L('Воду в известь льют понемногу и не наклоняются над чашкой — идёт пар.', 'Pour the water onto the lime little by little and do not lean over the dish — steam comes off.', 'Suvni ohakka oz-ozdan quying va kosacha ustiga engashmang — bug‘ chiqadi.'),
    L('Чашку из сушильного шкафа берут, когда она остыла.', 'Take the dish out of the oven only when it has cooled down.', 'Kosachani quritish shkafidan sovigandan keyin oling.'),
  ],
  gear: ['goggles', 'gloves'],
  place: 'bench',
  steps: [
    {
      id: 'ppe',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте очки и перчатки.', 'Put on goggles and gloves.', 'Ko‘zoynak va qo‘lqop taqing.'),
      observation: L('Глаза и руки защищены — работаем с едкой известью.', 'Eyes and hands are protected — we are working with caustic lime.', 'Ko‘z va qo‘llar himoyalangan — o‘yuvchi ohak bilan ishlaymiz.'),
      how: L('Нажмите на поднос со средствами защиты.', 'Tap the tray with the protective gear.', 'Himoya vositalari turgan patnisni bosing.'),
      teacher: L(
        'Пыль CaO на влажной коже и в глазу сама «гасится» и даёт щёлочь с разогревом — поэтому защиту надевают до того, как открыть банку.',
        'CaO dust on moist skin or in the eye slakes by itself, giving an alkali and heat — that is why the protection goes on before the jar is opened.',
        'CaO changi nam terida va ko‘zda o‘zi «so‘nadi» va qizish bilan ishqor beradi — shuning uchun himoya banka ochilishidan oldin taqiladi.',
      ),
    },
    {
      id: 'dish',
      target: 'dish',
      gesture: { kind: 'drag', from: [CW.dish[0], 0.02, CW.dish[2]], to: [CW_PAN[0], 0.08, CW_PAN[2]], lead: 0.5 },
      seconds: 3,
      instruction: L('Поставьте фарфоровую чашку на весы.', 'Put the porcelain dish on the balance.', 'Chinni kosachani taroziga qo‘ying.'),
      observation: L('Весы показывают массу пустой чашки — около 34 г.', 'The balance shows the mass of the empty dish — about 34 g.', 'Tarozi bo‘sh kosacha massasini ko‘rsatadi — taxminan 34 g.'),
      how: L('Перетащите чашку на чашу весов.', 'Drag the dish onto the balance pan.', 'Kosachani tarozi pallasiga torting.'),
      teacher: L(
        'Продукт останется в этой же чашке, поэтому взвешиваем в ней с самого начала — ничего не придётся пересыпать.',
        'The product will stay in this very dish, so we weigh in it from the start — nothing will have to be tipped over.',
        'Mahsulot shu kosachada qoladi, shuning uchun boshidanoq unda tortamiz — hech narsani to‘kish kerak bo‘lmaydi.',
      ),
    },
    {
      id: 'tare',
      target: 'scales-tare',
      gesture: { kind: 'tap' },
      seconds: 1.2,
      instruction: L('Нажмите «T» — обнулите весы с чашкой.', 'Press “T” — tare the balance with the dish.', '«T» ni bosing — kosachali tarozini nolga keltiring.'),
      observation: L('На дисплее 0,00 г и значок «→0←»: масса чашки запомнена.', 'The display shows 0.00 g and the “→0←” mark: the dish mass is stored.', 'Displeyda 0,00 g va «→0←» belgisi: kosacha massasi eslab qolindi.'),
      how: L('Нажмите кнопку T на весах.', 'Press the T key on the balance.', 'Tarozidagi T tugmasini bosing.'),
      teacher: L(
        'Тара вычитает массу чашки из всех следующих показаний: дальше весы покажут только то, что в ней.',
        'The tare subtracts the dish from every later reading: from now on the balance shows only what is inside it.',
        'Tara keyingi barcha ko‘rsatkichlardan kosacha massasini ayiradi: endi tarozi faqat ichidagini ko‘rsatadi.',
      ),
      mistake: L('Забывают тару — потом из показания приходится вычитать массу чашки.', 'Forgetting the tare — later the dish mass has to be subtracted from the reading.', 'Tarani unutish — keyin ko‘rsatkichdan kosacha massasini ayirishga to‘g‘ri keladi.'),
    },
    {
      id: 'cao',
      target: 'spatula',
      gesture: { kind: 'drag', from: [CW.spatula[0] + 0.04, 0.01, CW.spatula[2]], to: [CW_PAN[0], 0.08, CW_PAN[2]], lead: 0.25 },
      seconds: 5.5,
      instruction: L('Насыпьте шпателем 2,80 г оксида кальция.', 'Add 2.80 g of calcium oxide with the spatula.', 'Shpatel bilan 2,80 g kalsiy oksidi soling.'),
      observation: L('Белые комочки и порошок; дисплей остановился около 2,80 г, горит ○.', 'White lumps and powder; the display stopped near 2.80 g, ○ is lit.', 'Oq bo‘lakchalar va kukun; displey 2,80 g atrofida to‘xtadi, ○ yonmoqda.'),
      how: L('Перетащите шпатель от банки с CaO к чашке на весах.', 'Drag the spatula from the CaO jar to the dish on the balance.', 'Shpatelni CaO bankasidan tarozidagi kosachaga torting.'),
      teacher: L(
        'Банку сразу закрывают: CaO жадно тянет из воздуха воду и CO₂ и постепенно портится — становится Ca(OH)₂ и CaCO₃.',
        'The jar is closed at once: CaO greedily takes water and CO₂ from the air and slowly spoils, turning into Ca(OH)₂ and CaCO₃.',
        'Banka darhol yopiladi: CaO havodan suv va CO₂ ni ochko‘zlik bilan tortadi va asta buziladi — Ca(OH)₂ va CaCO₃ ga aylanadi.',
      ),
      mistake: L('Оставляют банку открытой — известь «выдыхается», и опыт даёт меньше продукта.', 'Leaving the jar open — the lime “goes stale” and the experiment gives less product.', 'Bankani ochiq qoldirish — ohak «aynib qoladi», tajriba kamroq mahsulot beradi.'),
    },
    {
      id: 'tile',
      target: 'dish',
      gesture: { kind: 'drag', from: [CW_PAN[0], 0.06, CW_PAN[2]], to: [CW.tile[0], 0.04, CW.tile[2]], lead: 0.5 },
      seconds: 3,
      instruction: L('Перенесите чашку с весов на керамическую плитку под термометр.', 'Move the dish from the balance onto the ceramic tile under the thermometer.', 'Kosachani tarozidan termometr ostidagi keramik plitkaga o‘tkazing.'),
      observation: L('Чашка на плитке; весы показывают минус массу чашки — тара сохранена.', 'The dish is on the tile; the balance shows minus the dish mass — the tare is kept.', 'Kosacha plitkada; tarozi kosacha massasini minus bilan ko‘rsatadi — tara saqlangan.'),
      how: L('Перетащите чашку на плитку.', 'Drag the dish onto the tile.', 'Kosachani plitkaga torting.'),
      teacher: L(
        'Гашение идёт с сильным разогревом и паром — на весах его не проводят: горячий пар портит весы и «сбивает» показание.',
        'Slaking gives strong heat and steam, so it is never done on the balance: hot steam damages the balance and upsets the reading.',
        'So‘ndirish kuchli qizish va bug‘ bilan boradi — uni tarozida o‘tkazilmaydi: issiq bug‘ tarozini buzadi va ko‘rsatkichni «adashtiradi».',
      ),
    },
    {
      id: 'thermo',
      target: 'thermometer',
      gesture: { kind: 'swipe', from: [CW.tile[0], 0.29, CW.tile[2]], to: [CW.tile[0], 0.21, CW.tile[2]], lead: 0.8 },
      seconds: 2.6,
      instruction: L('Опустите лапку с термометром: шарик — в порошок, не касаясь дна.', 'Lower the clamp with the thermometer: bulb into the powder, not touching the bottom.', 'Termometrli qisqichni tushiring: sharcha — kukunga, tubiga tegmasin.'),
      observation: L('Термометр показывает температуру класса.', 'The thermometer shows the room temperature.', 'Termometr sinf haroratini ko‘rsatmoqda.'),
      how: L('Проведите по термометру вниз.', 'Swipe down the thermometer.', 'Termometr bo‘ylab pastga suring.'),
      teacher: L(
        'Начальную температуру записывают обязательно: разогрев — это разность «после − до», а не одно число.',
        'The starting temperature must be written down: the heating is the difference “after − before”, not a single number.',
        'Boshlang‘ich harorat albatta yoziladi: qizish — bu «keyin − oldin» farqi, bitta son emas.',
      ),
    },
    {
      id: 'water',
      target: 'bottle-water',
      gesture: { kind: 'drag', from: [CW.bottle[0], 0.08, CW.bottle[2]], to: [CW.cylinder[0] + 0.04, 0.15, CW.cylinder[2]], lead: 0.34 },
      seconds: 3.6,
      instruction: L('Отмерьте цилиндром 5,0 мл воды.', 'Measure 5.0 ml of water with the cylinder.', 'Silindr bilan 5,0 ml suv o‘lchang.'),
      observation: L('Вода у метки 5 мл — отсчёт по нижнему краю мениска.', 'The water is at the 5 ml mark — read at the bottom of the meniscus.', 'Suv 5 ml belgisida — hisob meniskning pastki cheti bo‘yicha.'),
      how: L('Перетащите склянку с водой к мерному цилиндру.', 'Drag the water bottle to the measuring cylinder.', 'Suvli shishani o‘lchov silindriga torting.'),
      teacher: L(
        'Для 2,80 г CaO по уравнению нужно всего 0,9 г воды. Берём 5 мл: избыток гасит всю известь и забирает часть тепла — меньше брызг.',
        'By the equation 2.80 g of CaO needs only 0.9 g of water. We take 5 ml: the excess slakes all the lime and takes up part of the heat — less spattering.',
        'Tenglama bo‘yicha 2,80 g CaO ga atigi 0,9 g suv kerak. 5 ml olamiz: ortiqchasi barcha ohakni so‘ndiradi va issiqlikning bir qismini oladi — kamroq sachraydi.',
      ),
      mistake: L('Глаз выше уровня жидкости — отсчёт по мениску сверху завышает объём.', 'The eye above the liquid level — reading the meniscus from above overstates the volume.', 'Ko‘z suyuqlik sathidan yuqorida — meniskni yuqoridan o‘qish hajmni oshiradi.'),
    },
    {
      id: 'slake',
      target: 'cylinder',
      gesture: { kind: 'drag', from: [CW.cylinder[0], 0.06, CW.cylinder[2]], to: [CW.tile[0] + 0.05, 0.1, CW.tile[2]], lead: 0.34 },
      seconds: 9,
      instruction: L('Влейте воду в чашку с известью и следите за термометром.', 'Pour the water into the dish of lime and watch the thermometer.', 'Suvni ohakli kosachaga quying va termometrni kuzating.'),
      observation: L('Шипение, клубы пара, комочки трескаются и рассыпаются в рыхлую белую кашицу; столбик термометра быстро ползёт вверх.', 'Hissing, puffs of steam, the lumps crack and crumble into a loose white paste; the thermometer column climbs fast.', 'Vishillash, bug‘ bulutlari, bo‘lakchalar yorilib, g‘ovak oq bo‘tqaga sochiladi; termometr ustunchasi tez ko‘tariladi.'),
      how: L('Перетащите цилиндр к чашке.', 'Drag the cylinder to the dish.', 'Silindrni kosachaga torting.'),
      teacher: L(
        'Ионы O²⁻ в кристалле CaO забирают у молекул воды H⁺ и превращаются в ионы OH⁻. Решётка разрыхляется, а выделившаяся энергия греет воду до пара.',
        'The O²⁻ ions in the CaO crystal take H⁺ from water molecules and become OH⁻ ions. The lattice loosens, and the energy released heats the water into steam.',
        'CaO kristalidagi O²⁻ ionlari suv molekulalaridan H⁺ ni olib, OH⁻ ionlariga aylanadi. Panjara bo‘shashadi, ajralgan energiya esa suvni bug‘gacha qizdiradi.',
      ),
      mistake: L('Льют всю воду сразу и наклоняются над чашкой — горячие брызги и пар летят в лицо.', 'Pouring all the water at once and leaning over the dish — hot spatter and steam fly into the face.', 'Barcha suvni birdan quyish va kosacha ustiga engashish — issiq sachratqi va bug‘ yuzga uradi.'),
    },
    {
      id: 'dry',
      target: 'dish',
      gesture: { kind: 'drag', from: [CW.tile[0], 0.03, CW.tile[2]], to: [CW.oven[0], 0.12, CW.oven[2] + 0.14], lead: 0.4 },
      seconds: 9,
      instruction: L('Поднимите термометр и поставьте чашку в сушильный шкаф на 120 °C.', 'Raise the thermometer and put the dish into the drying oven at 120 °C.', 'Termometrni ko‘taring va kosachani 120 °C li quritish shkafiga qo‘ying.'),
      observation: L('Лишняя вода испарилась, в чашке — сухой белый рыхлый порошок. Шкаф выключили, чашка остыла внутри. В жизни — 30 минут сушки и ещё остывание.', 'The excess water has evaporated; the dish holds a dry, loose white powder. The oven is switched off and the dish has cooled inside. In real life — 30 minutes of drying plus cooling.', 'Ortiqcha suv bug‘lanib ketdi, kosachada quruq oq g‘ovak kukun. Shkaf o‘chirildi, kosacha ichida soviydi. Hayotda — 30 daqiqa quritish va sovish.'),
      how: L('Перетащите чашку в сушильный шкаф.', 'Drag the dish into the drying oven.', 'Kosachani quritish shkafiga torting.'),
      teacher: L(
        'При 120 °C уходит только лишняя вода; вода, ставшая ионами OH⁻ в Ca(OH)₂, остаётся — гидроксид кальция разлагается лишь выше 500 °C.',
        'At 120 °C only the excess water leaves; the water that became OH⁻ ions in Ca(OH)₂ stays — calcium hydroxide breaks down only above 500 °C.',
        '120 °C da faqat ortiqcha suv chiqadi; Ca(OH)₂ dagi OH⁻ ionlariga aylangan suv qoladi — kalsiy gidroksid faqat 500 °C dan yuqorida parchalanadi.',
      ),
      mistake: L('Взвешивают горячую чашку: тёплый воздух поднимается от неё и «облегчает» показание.', 'Weighing the dish while hot: warm air rising from it makes the reading too light.', 'Kosachani issiqligida tortish: undan ko‘tarilayotgan iliq havo ko‘rsatkichni «yengillashtiradi».'),
    },
    {
      id: 'weigh',
      target: 'dish',
      gesture: { kind: 'drag', from: [CW.oven[0], 0.1, CW.oven[2] + 0.11], to: [CW_PAN[0], 0.08, CW_PAN[2]], lead: 0.4 },
      seconds: 4,
      instruction: L('Откройте шкаф и поставьте остывшую чашку на весы.', 'Open the oven and put the cooled dish on the balance.', 'Shkafni oching va sovigan kosachani taroziga qo‘ying.'),
      observation: L('Тара сохранилась — весы показывают массу продукта в чашке: она больше, чем у взятого CaO.', 'The tare is kept — the balance shows the mass of the product in the dish: it is more than the CaO taken.', 'Tara saqlangan — tarozi kosachadagi mahsulot massasini ko‘rsatadi: u olingan CaO dan ko‘p.'),
      how: L('Перетащите чашку из шкафа на весы.', 'Drag the dish from the oven to the balance.', 'Kosachani shkafdan taroziga torting.'),
      teacher: L(
        'Масса выросла ровно на воду, которая вошла в состав гидроксида: на каждую формульную единицу CaO — одна молекула H₂O.',
        'The mass has grown exactly by the water that became part of the hydroxide: one H₂O molecule for every CaO formula unit.',
        'Massa aynan gidroksid tarkibiga kirgan suv qadar oshdi: har bir CaO formula birligiga — bitta H₂O molekulasi.',
      ),
      mistake: L('Нажимают «T» ещё раз перед взвешиванием — тара сбрасывается, и показание теряет смысл.', 'Pressing “T” again before weighing — the tare is reset and the reading means nothing.', 'Tortishdan oldin yana «T» ni bosish — tara bekor bo‘ladi va ko‘rsatkich ma’nosini yo‘qotadi.'),
    },
    {
      id: 'phenol',
      target: 'spatula',
      gesture: { kind: 'drag', from: [CW.spatula[0] + 0.04, 0.01, CW.spatula[2]], to: [CW.watch[0], 0.05, CW.watch[2]], lead: 0.4 },
      seconds: 4,
      instruction: L('Внесите щепотку продукта в воду с каплей фенолфталеина на часовом стекле.', 'Put a pinch of the product into the water with a drop of phenolphthalein on the watch glass.', 'Mahsulotdan bir chimdimni soat oynasidagi fenolftaleinli suvga soling.'),
      observation: L('Вокруг крупинок вода стала малиновой: продукт — щёлочь.', 'The water around the grains turned crimson: the product is an alkali.', 'Donachalar atrofida suv to‘q pushti rangga kirdi: mahsulot — ishqor.'),
      how: L('Перетащите шпатель от чашки к часовому стеклу.', 'Drag the spatula from the dish to the watch glass.', 'Shpatelni kosachadan soat oynasiga torting.'),
      teacher: L(
        'Ca(OH)₂ немного растворяется, и ионы OH⁻ переходят в воду — фенолфталеин в щелочной среде малиновый.',
        'Ca(OH)₂ dissolves slightly and OH⁻ ions pass into the water — phenolphthalein is crimson in an alkaline medium.',
        'Ca(OH)₂ ozgina eriydi va OH⁻ ionlari suvga o‘tadi — fenolftalein ishqoriy muhitda to‘q pushti.',
      ),
    },
  ],
  focus: [
    { from: 1.6, to: 1.97, point: [CW.scales[0], 0.035, CW.scales[2] + 0.07], dist: 0.3 },
    { from: 3.45, to: 3.97, point: [CW.scales[0], 0.035, CW.scales[2] + 0.07], dist: 0.3 },
    { from: 5.6, to: 5.97, point: [CW.tile[0], 0.08, CW.tile[2]], dist: 0.22 },
    { from: 6.55, to: 6.97, point: [CW.cylinder[0], 0.05, CW.cylinder[2]], dist: 0.2 },
    { from: 7.48, to: 7.97, point: [CW.tile[0], 0.12, CW.tile[2]], dist: 0.32 },
    { from: 8.62, to: 8.97, point: [CW.oven[0] - 0.04, 0.05, CW.oven[2] + 0.11], dist: 0.34 },
    { from: 9.75, to: 9.98, point: [CW.scales[0], 0.035, CW.scales[2] + 0.07], dist: 0.3 },
    { from: 10.55, to: 10.98, point: [CW.watch[0], 0.01, CW.watch[2]], dist: 0.24 },
  ],
  labels: [
    { at: 2.5, pos: [CW.scales[0], 0.15, CW.scales[2]], text: L('тара: 0,00 г', 'tare: 0.00 g', 'tara: 0,00 g') },
    { at: 4.8, pos: [CW.scales[0], 0.15, CW.scales[2]], text: L('без чашки — «минус чашка»', 'no dish — “minus the dish”', 'kosachasiz — «minus kosacha»') },
    { at: 7.58, pos: [CW.tile[0] + 0.09, 0.12, CW.tile[2] + 0.04], text: L('шипит и парит: CaO «гасится»', 'hissing and steaming: CaO is slaking', 'vishillaydi, bug‘lanadi: CaO «so‘nmoqda»') },
    { at: 8.72, pos: [CW.oven[0], 0.3, CW.oven[2]], text: L('120 °C · ускорено: в жизни 30 мин', '120 °C · sped up: 30 min in real life', '120 °C · tezlashtirilgan: hayotda 30 daq') },
    { at: 10.3, pos: [CW.scales[0], 0.15, CW.scales[2]], text: L('масса уже записана — теперь проба', 'mass already recorded — now the test', 'massa yozib olindi — endi sinov') },
    { at: 10.62, pos: [CW.watch[0], 0.09, CW.watch[2]], text: L('малиновый: щёлочь', 'crimson: an alkali', 'to‘q pushti: ishqor') },
  ],
  measurements: [
    { key: 'mCaO', label: 'm(CaO)', what: L('масса оксида кальция', 'mass of calcium oxide', 'kalsiy oksidi massasi'), instrument: 'scales', afterStep: 3 },
    { key: 't0', label: 't₀', what: L('температура до реакции', 'temperature before the reaction', 'reaksiyadan oldingi harorat'), instrument: 'thermometer', afterStep: 5 },
    { key: 'vW', label: 'V(H₂O)', what: L('объём воды', 'volume of water', 'suv hajmi'), instrument: 'cyl10', afterStep: 6 },
    { key: 'tMax', label: 'tₘₐₓ', what: L('наибольшая температура при гашении', 'highest temperature during slaking', 'so‘ndirishdagi eng yuqori harorat'), instrument: 'thermometer', afterStep: 7 },
    { key: 'mProd', label: 'm(Ca(OH)₂)', what: L('масса сухого продукта', 'mass of the dry product', 'quruq mahsulot massasi'), instrument: 'scales', afterStep: 9 },
    { key: 'dm', label: 'Δm', what: L('прибавка массы — связанная вода', 'mass gain — the water taken up', 'massa ortishi — birikkan suv'), instrument: 'scales', afterStep: 9, derived: true },
  ],
  simulate: (rng) => {
    const mCaO = rng.weigh(2.8, 0.03)
    const t0 = rng.read('thermometer', rng.between(20, 24))
    const vW = rng.read('cyl10', 5)
    // тепло гашения 65 кДж/моль; греются вода, известь и фарфор чашки (34 г), 30–45 % тепла уходит в воздух и с паром
    const q = (mCaO / M_CAO) * 65200
    const dT = deltaT(q, [[vW, C_WATER], [(mCaO * M_CAOH2) / M_CAO, 0.8], [34, 0.84]], rng.between(0.3, 0.45))
    const tMax = rng.read('thermometer', t0 + dT)
    // часть извести в банке уже «выдохлась» (влага и CO₂ воздуха), немного пыли уносит пар; недосушка — до 0,01 г
    const mProd = rng.read('scales', ((mCaO * M_CAOH2) / M_CAO) * rng.between(0.985, 0.998) + rng.between(0, 0.01))
    return { mCaO, t0, vW, tMax, mProd, dm: Math.round((mProd - mCaO) * 100) / 100 }
  },
  given: (v, lang) => [
    tr(lang, 'Задача: m(CaO) = 28 г, вода — в избытке; m(продукта) — ?', 'Problem: m(CaO) = 28 g, water in excess; m(product) — ?', 'Masala: m(CaO) = 28 g, suv — mo‘l; m(mahsulot) — ?'),
    tr(
      lang,
      `Опыт (в 10 раз меньше): m(CaO) = ${f(v.mCaO!, 2, lang)} г; V(H₂O) = ${f(v.vW!, 1, lang)} мл — избыток (нужно ${f((v.mCaO! / M_CAO) * 18, 2, lang)} г)`,
      `Experiment (10 times smaller): m(CaO) = ${f(v.mCaO!, 2, lang)} g; V(H₂O) = ${f(v.vW!, 1, lang)} ml — excess (${f((v.mCaO! / M_CAO) * 18, 2, lang)} g needed)`,
      `Tajriba (10 marta kichik): m(CaO) = ${f(v.mCaO!, 2, lang)} g; V(H₂O) = ${f(v.vW!, 1, lang)} ml — mo‘l (${f((v.mCaO! / M_CAO) * 18, 2, lang)} g kerak)`,
    ),
    tr(
      lang,
      `Разогрев: ${f(v.t0!, 1, lang)} → ${f(v.tMax!, 1, lang)} °C; после сушки при 120 °C в чашке ${f(v.mProd!, 2, lang)} г`,
      `Heating: ${f(v.t0!, 1, lang)} → ${f(v.tMax!, 1, lang)} °C; after drying at 120 °C the dish holds ${f(v.mProd!, 2, lang)} g`,
      `Qizish: ${f(v.t0!, 1, lang)} → ${f(v.tMax!, 1, lang)} °C; 120 °C da quritilgach kosachada ${f(v.mProd!, 2, lang)} g`,
    ),
    tr(lang, 'M(CaO) = 56 г/моль, M(Ca(OH)₂) = 74 г/моль, M(H₂O) = 18 г/моль', 'M(CaO) = 56 g/mol, M(Ca(OH)₂) = 74 g/mol, M(H₂O) = 18 g/mol', 'M(CaO) = 56 g/mol, M(Ca(OH)₂) = 74 g/mol, M(H₂O) = 18 g/mol'),
  ],
  solution: (v, lang) => {
    const n = v.mCaO! / M_CAO
    const k = 28 / v.mCaO!
    const ans = answerG(v)
    return [
      tr(lang, 'CaO + H₂O → Ca(OH)₂: из 1 моль CaO — 1 моль Ca(OH)₂', 'CaO + H₂O → Ca(OH)₂: 1 mol of CaO gives 1 mol of Ca(OH)₂', 'CaO + H₂O → Ca(OH)₂: 1 mol CaO dan 1 mol Ca(OH)₂'),
      tr(
        lang,
        `n(CaO) = m / M = ${f(v.mCaO!, 2, lang)} / 56 = ${f(n, 4, lang)} моль → по расчёту m(Ca(OH)₂) = ${f(n, 4, lang)} · 74 = ${f(n * M_CAOH2, 2, lang)} г`,
        `n(CaO) = m / M = ${f(v.mCaO!, 2, lang)} / 56 = ${f(n, 4, lang)} mol → calculated m(Ca(OH)₂) = ${f(n, 4, lang)} · 74 = ${f(n * M_CAOH2, 2, lang)} g`,
        `n(CaO) = m / M = ${f(v.mCaO!, 2, lang)} / 56 = ${f(n, 4, lang)} mol → hisob bo‘yicha m(Ca(OH)₂) = ${f(n, 4, lang)} · 74 = ${f(n * M_CAOH2, 2, lang)} g`,
      ),
      tr(
        lang,
        `На весах ${f(v.mProd!, 2, lang)} г; Δm = ${f(v.mProd!, 2, lang)} − ${f(v.mCaO!, 2, lang)} = ${f(v.dm!, 2, lang)} г — связанная вода (по уравнению n · 18 = ${f(n * 18, 2, lang)} г)`,
        `The balance shows ${f(v.mProd!, 2, lang)} g; Δm = ${f(v.mProd!, 2, lang)} − ${f(v.mCaO!, 2, lang)} = ${f(v.dm!, 2, lang)} g — the water taken up (by the equation n · 18 = ${f(n * 18, 2, lang)} g)`,
        `Tarozida ${f(v.mProd!, 2, lang)} g; Δm = ${f(v.mProd!, 2, lang)} − ${f(v.mCaO!, 2, lang)} = ${f(v.dm!, 2, lang)} g — birikkan suv (tenglama bo‘yicha n · 18 = ${f(n * 18, 2, lang)} g)`,
      ),
      tr(
        lang,
        `Масштаб: 28 г / ${f(v.mCaO!, 2, lang)} г = в ${f(k, 2, lang)} раза больше → m(Ca(OH)₂) = ${f(v.mProd!, 2, lang)} · ${f(k, 2, lang)} = ${f(ans, 1, lang)} г`,
        `Scale: 28 g / ${f(v.mCaO!, 2, lang)} g = ${f(k, 2, lang)} times more → m(Ca(OH)₂) = ${f(v.mProd!, 2, lang)} · ${f(k, 2, lang)} = ${f(ans, 1, lang)} g`,
        `Masshtab: 28 g / ${f(v.mCaO!, 2, lang)} g = ${f(k, 2, lang)} marta ko‘p → m(Ca(OH)₂) = ${f(v.mProd!, 2, lang)} · ${f(k, 2, lang)} = ${f(ans, 1, lang)} g`,
      ),
      tr(lang, `Ответ: m(Ca(OH)₂) ≈ ${f(ans, 0, lang)} г`, `Answer: m(Ca(OH)₂) ≈ ${f(ans, 0, lang)} g`, `Javob: m(Ca(OH)₂) ≈ ${f(ans, 0, lang)} g`),
    ]
  },
  compare: [
    {
      label: L('m(Ca(OH)₂) в чашке', 'm(Ca(OH)₂) in the dish', 'kosachadagi m(Ca(OH)₂)'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mProd!,
      predicted: (v) => (v.mCaO! * M_CAOH2) / M_CAO,
      book: 3.7,
      tolerancePct: 3,
    },
  ],
  reconcile: L(
    'Продукта обычно чуть меньше расчёта (на 0,2–1,5 %), и это честно. Оксид кальция в банке уже немного «выдохся»: из воздуха он взял влагу и CO₂, часть его — уже Ca(OH)₂ и CaCO₃, и такая часть воду не присоединяет. При бурном гашении пар уносит немного известковой пыли. Если не досушить, масса окажется больше (лишняя вода), а если долго держать продукт на воздухе — тоже больше: Ca(OH)₂ поглощает CO₂ и превращается в CaCO₃. Весы ±0,01 г на 3,7 г — это всего ±0,3 %.',
    'There is usually slightly less product than calculated (by 0.2–1.5 %), and that is honest. The calcium oxide in the jar has already “gone a little stale”: it took moisture and CO₂ from the air, part of it is already Ca(OH)₂ and CaCO₃, and that part takes up no water. During violent slaking the steam carries away a little lime dust. If it is not dried enough, the mass comes out higher (extra water); if the product is left in the air for a long time, also higher: Ca(OH)₂ absorbs CO₂ and turns into CaCO₃. The balance (±0.01 g on 3.7 g) is only ±0.3 %.',
    'Mahsulot odatda hisobdan biroz kam (0,2–1,5 % ga) — bu halol natija. Bankadagi kalsiy oksidi biroz «aynigan»: havodan namlik va CO₂ olgan, uning bir qismi allaqachon Ca(OH)₂ va CaCO₃, bu qism suv biriktirmaydi. Shiddatli so‘ndirishda bug‘ ozgina ohak changini olib ketadi. Yetarli quritilmasa, massa ko‘p chiqadi (ortiqcha suv); mahsulot havoda uzoq qolsa, yana ko‘p: Ca(OH)₂ CO₂ ni yutib CaCO₃ ga aylanadi. Tarozi (3,7 g da ±0,01 g) — atigi ±0,3 %.',
  ),
  conclusion: L(
    '2,80 г CaO присоединили около 0,9 г воды и дали ≈ 3,7 г гидроксида кальция. В задаче всё в 10 раз больше: 28 г CaO = 0,5 моль, m(Ca(OH)₂) = 0,5 · 74 = 37 г. Продукт — гашёная известь («пушонка»), щёлочь: фенолфталеин малиновый.',
    '2.80 g of CaO took up about 0.9 g of water and gave ≈ 3.7 g of calcium hydroxide. The problem is 10 times larger: 28 g of CaO = 0.5 mol, m(Ca(OH)₂) = 0.5 · 74 = 37 g. The product is slaked lime, an alkali: phenolphthalein turns crimson.',
    '2,80 g CaO taxminan 0,9 g suv biriktirib, ≈ 3,7 g kalsiy gidroksid berdi. Masalada hammasi 10 marta ko‘p: 28 g CaO = 0,5 mol, m(Ca(OH)₂) = 0,5 · 74 = 37 g. Mahsulot — so‘ndirilgan ohak (pushonka), ishqor: fenolftalein to‘q pushti.',
  ),
  story: {
    equation: 'O²⁻ + H₂O → 2OH⁻',
    text: L(
      'Оксид кальция — ионный кристалл из ионов Ca²⁺ и O²⁻. Каждый ион O²⁻ отнимает у молекулы воды ион H⁺: из одного O²⁻ и одной H₂O получаются два иона OH⁻. Кристалл разрыхляется и рассыпается в лёгкий порошок Ca(OH)₂ («пушонку»), а энергия, выделившаяся при образовании новых связей, нагревает смесь — вода шипит и парит. На каждую формульную единицу CaO уходит одна молекула воды, поэтому масса растёт в 74 / 56 раза.',
      'Calcium oxide is an ionic crystal of Ca²⁺ and O²⁻ ions. Each O²⁻ ion takes an H⁺ ion from a water molecule: one O²⁻ and one H₂O give two OH⁻ ions. The crystal loosens and crumbles into a light Ca(OH)₂ powder, and the energy released as the new bonds form heats the mixture — the water hisses and steams. One water molecule goes to every CaO formula unit, so the mass grows by a factor of 74 / 56.',
      'Kalsiy oksidi — Ca²⁺ va O²⁻ ionlaridan iborat ionli kristall. Har bir O²⁻ ioni suv molekulasidan H⁺ ionini tortib oladi: bitta O²⁻ va bitta H₂O dan ikkita OH⁻ ioni hosil bo‘ladi. Kristall bo‘shashib, yengil Ca(OH)₂ kukuniga (pushonkaga) sochiladi, yangi bog‘lar hosil bo‘lganda ajralgan energiya aralashmani qizdiradi — suv vishillab bug‘lanadi. Har bir CaO formula birligiga bitta suv molekulasi ketadi, shuning uchun massa 74 / 56 marta oshadi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показало, что идёт химическая реакция, а не простое смачивание порошка?', 'What showed that a chemical reaction was going on, not just wetting of the powder?', 'Kukun shunchaki ho‘llanmay, kimyoviy reaksiya borayotganini nima ko‘rsatdi?'),
      options: [
        L('Сильный разогрев, шипение и пар', 'Strong heating, hissing and steam', 'Kuchli qizish, vishillash va bug‘'),
        L('Порошок посинел', 'The powder turned blue', 'Kukun ko‘kardi'),
        L('Выделился газ с резким запахом', 'A gas with a sharp smell was released', 'O‘tkir hidli gaz ajraldi'),
      ],
      correct: 0,
      why: L('Выделение тепла (термометр поднялся на десятки градусов) — признак реакции: образуются новые связи и новое вещество.', 'Heat release (the thermometer rose by tens of degrees) is a sign of a reaction: new bonds and a new substance form.', 'Issiqlik ajralishi (termometr o‘nlab darajaga ko‘tarildi) — reaksiya belgisi: yangi bog‘lar va yangi modda hosil bo‘ladi.'),
    },
    {
      id: 'type',
      q: L('К какому типу относится реакция CaO + H₂O → Ca(OH)₂?', 'What type of reaction is CaO + H₂O → Ca(OH)₂?', 'CaO + H₂O → Ca(OH)₂ reaksiyasi qaysi turga kiradi?'),
      options: [
        L('Соединения', 'Combination', 'Birikish'),
        L('Разложения', 'Decomposition', 'Parchalanish'),
        L('Замещения', 'Substitution', 'O‘rin olish'),
      ],
      correct: 0,
      why: L('Из двух веществ получилось одно — это реакция соединения, к тому же экзотермическая.', 'Two substances gave one — a combination reaction, and an exothermic one.', 'Ikki moddadan bitta modda hosil bo‘ldi — bu birikish reaksiyasi, ustiga ekzotermik.'),
    },
    {
      id: 'product',
      q: L('Что осталось в чашке после сушки?', 'What was left in the dish after drying?', 'Quritilgandan keyin kosachada nima qoldi?'),
      options: [
        L('Гидроксид кальция Ca(OH)₂ — гашёная известь', 'Calcium hydroxide Ca(OH)₂ — slaked lime', 'Kalsiy gidroksid Ca(OH)₂ — so‘ndirilgan ohak'),
        L('Снова оксид кальция — вода просто испарилась', 'Calcium oxide again — the water just evaporated', 'Yana kalsiy oksidi — suv shunchaki bug‘landi'),
        L('Карбонат кальция CaCO₃', 'Calcium carbonate CaCO₃', 'Kalsiy karbonat CaCO₃'),
      ],
      correct: 0,
      why: L('Масса выросла на связанную воду и не вернулась к массе CaO после сушки при 120 °C, а фенолфталеин стал малиновым — это щёлочь Ca(OH)₂.', 'The mass grew by the bound water and did not return to the CaO mass after drying at 120 °C, and phenolphthalein turned crimson — it is the alkali Ca(OH)₂.', 'Massa birikkan suv hisobiga oshdi va 120 °C da quritilgach CaO massasiga qaytmadi, fenolftalein esa to‘q pushti bo‘ldi — bu Ca(OH)₂ ishqori.'),
    },
  ],
}
