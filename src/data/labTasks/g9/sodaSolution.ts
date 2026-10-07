/**
 * Kimyo 9, с. 68, задача 2 (решена в учебнике): раствор карбоната натрия из кристаллической соды.
 * Опыт 1:1 — 54,00 г Na₂CO₃·10H₂O на весах, 146 мл воды мерным цилиндром, растворение палочкой с термометром
 * (декагидрат растворяется с поглощением тепла: раствор остывает на 8–11 °C), контрольное взвешивание раствора.
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

const M_HYD = 286
const M_NA2CO3 = 106
const RHO_W = 0.998

const n = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
const na2co3 = (v: LabTaskValues) => (v.mSoda! * M_NA2CO3) / M_HYD

export const SODA_SOLUTION: LabTask = {
  id: 'task-g9-soda-solution',
  grade: 9,
  page: 68,
  source: L('Kimyo 9 · с. 68, задача 2', 'Kimyo 9 · p. 68, problem 2', 'Kimyo 9 · 68-bet, 2-masala'),
  bookKind: 'task',
  title: L('Раствор соды из кристаллогидрата', 'Soda solution from the crystal hydrate', 'Kristallogidratdan soda eritmasi'),
  statement: L(
    'Сколько граммов воды потребуется для приготовления 10 %-ного раствора карбоната натрия из 54 г кристаллической соды Na₂CO₃·10H₂O?',
    'How many grams of water are needed to prepare a 10 % sodium carbonate solution from 54 g of crystalline soda Na₂CO₃·10H₂O?',
    '54 g kristall soda Na₂CO₃·10H₂O dan 10 % li natriy karbonat eritmasi tayyorlash uchun necha gramm suv kerak?',
  ),
  equation: 'w = m(Na₂CO₃) / m(р-ра) · 100 %',
  kind: 'physical',
  type: 'crystal-hydrate',
  difficulty: 2,
  answers: [
    {
      key: 'water',
      label: 'm(H₂O)',
      what: L('масса воды для 10 %-ного раствора', 'mass of water for a 10 % solution', '10 % li eritma uchun suv massasi'),
      unit: L('г', 'g', 'g'),
      book: 146,
      decimals: 0,
      fromRun: (v) => na2co3(v) / 0.1 - v.mSoda!,
    },
  ],
  labScale: {
    factor: 1,
    note: L(
      'Опыт — в масштабе задачи: 54 г соды и 146 мл воды помещаются в стакан на 250 мл.',
      'Same scale as the problem: 54 g of soda and 146 ml of water fit into a 250 ml beaker.',
      'Tajriba masala miqyosida: 54 g soda va 146 ml suv 250 ml li stakanga sig‘adi.',
    ),
  },
  instruments: ['scales', 'cyl250', 'thermometer'],
  equipment: [
    L('Электронные весы (0,01 г)', 'Electronic balance (0.01 g)', 'Elektron tarozi (0,01 g)'),
    L('Химический стакан 250 мл, стеклянная палочка', '250 ml beaker, glass rod', '250 ml li kimyoviy stakan, shisha tayoqcha'),
    L('Мерный цилиндр 250 мл (дел. 2 мл)', '250 ml measuring cylinder (2 ml div.)', '250 ml li o‘lchov silindri (bo‘linma 2 ml)'),
    L('Термометр −10…+110 °C в лапке штатива', 'Thermometer −10…+110 °C in a stand clamp', 'Shtativ qisqichidagi −10…+110 °C termometr'),
    L('Кристаллическая сода Na₂CO₃·10H₂O, шпатель, дистиллированная вода', 'Crystalline soda Na₂CO₃·10H₂O, spatula, distilled water', 'Kristall soda Na₂CO₃·10H₂O, shpatel, distillangan suv'),
  ],
  safety: [
    L('Работайте в очках: раствор соды щелочной, раздражает глаза.', 'Wear goggles: soda solution is alkaline and irritates the eyes.', 'Ko‘zoynakda ishlang: soda eritmasi ishqoriy, ko‘zni achishtiradi.'),
    L('Соду берите шпателем, не руками; просыпанное — сразу убрать.', 'Take soda with a spatula, not your fingers; clean up spills at once.', 'Sodani qo‘l bilan emas, shpatel bilan oling; to‘kilganini darhol yig‘ing.'),
    L('Термометр закреплён в лапке — им не перемешивают, для этого есть палочка.', 'The thermometer sits in a clamp — never stir with it, use the rod.', 'Termometr qisqichda — u bilan aralashtirilmaydi, buning uchun tayoqcha bor.'),
  ],
  gear: ['goggles'],
  place: 'bench',
  steps: [
    {
      id: 'gear',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте защитные очки.', 'Put on safety goggles.', 'Himoya ko‘zoynagini taqing.'),
      observation: L('Очки надеты — можно работать с раствором соды.', 'Goggles on — you can work with the soda solution.', 'Ko‘zoynak taqildi — soda eritmasi bilan ishlash mumkin.'),
      how: L('Нажмите на поднос с очками.', 'Tap the tray with the goggles.', 'Ko‘zoynakli patnisni bosing.'),
      teacher: L('Раствор соды — щелочной (pH ≈ 11): брызги в глаз опасны, поэтому очки — до первого действия.', 'Soda solution is alkaline (pH ≈ 11): a splash in the eye is dangerous, so goggles go on first.', 'Soda eritmasi ishqoriy (pH ≈ 11): ko‘zga sachrasa xavfli, shuning uchun ko‘zoynak birinchi taqiladi.'),
    },
    {
      id: 'beaker',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.36, 0.05, -0.02], to: [-0.12, 0.1, 0.04], lead: 0.5 },
      seconds: 2.6,
      instruction: L('Поставьте сухой стакан на 250 мл на весы.', 'Place a dry 250 ml beaker on the balance.', 'Quruq 250 ml li stakanni taroziga qo‘ying.'),
      observation: L('Весы показывают массу пустого стакана — около 100 г.', 'The balance shows the empty beaker — about 100 g.', 'Tarozi bo‘sh stakan massasini ko‘rsatadi — taxminan 100 g.'),
      how: L('Перетащите стакан из-под термометра на чашу весов.', 'Drag the beaker from under the thermometer onto the pan.', 'Stakanni termometr ostidan tarozi pallasiga torting.'),
      teacher: L('Стакан должен быть сухим: капля воды на дне — это лишние 0,05 г, а мы взвешиваем до сотых.', 'The beaker must be dry: a drop of water is an extra 0.05 g, and we weigh to hundredths.', 'Stakan quruq bo‘lsin: tubidagi bir tomchi suv — ortiqcha 0,05 g, biz esa yuzdan birgacha tortamiz.'),
    },
    {
      id: 'tare',
      target: 'tare',
      gesture: { kind: 'tap' },
      seconds: 1.4,
      instruction: L('Нажмите «T» — обнулите весы.', 'Press “T” to zero the balance.', '«T» ni bosib, tarozini nolga keltiring.'),
      observation: L('На дисплее 0.00 g и значок «→0←»: масса стакана вычтена.', 'The display reads 0.00 g with “→0←”: the beaker is subtracted.', 'Displeyda 0.00 g va «→0←» belgisi: stakan massasi ayirildi.'),
      how: L('Нажмите кнопку «T» на передней панели весов.', 'Tap the “T” button on the front of the balance.', 'Tarozi old panelidagi «T» tugmasini bosing.'),
      teacher: L('Тара — это вычитание массы посуды: дальше весы покажут только то, что мы насыплем и нальём.', 'Tare subtracts the vessel: from now on the balance shows only what we add.', 'Tara — idish massasini ayirish: endi tarozi faqat biz solgan narsani ko‘rsatadi.'),
      mistake: L('Забыли тару — к массе соды прибавится масса стакана (~100 г).', 'Forgot to tare — the beaker (~100 g) adds to the soda mass.', 'Tarani unutish — soda massasiga stakan massasi (~100 g) qo‘shiladi.'),
    },
    {
      id: 'soda',
      target: 'spatula',
      gesture: { kind: 'swipe', from: [-0.25, 0.03, 0.19], to: [-0.12, 0.18, 0.04], lead: 0.3 },
      seconds: 6.5,
      instruction: L('Насыпьте шпателем 54,00 г кристаллической соды.', 'Add 54.00 g of crystalline soda with the spatula.', 'Shpatel bilan 54,00 g kristall soda soling.'),
      observation: L('Бесцветные прозрачные кристаллы на дне стакана; дисплей растёт и останавливается около 54,00 г.', 'Colourless transparent crystals in the beaker; the display climbs and stops near 54.00 g.', 'Stakan tubida rangsiz shaffof kristallar; displey o‘sib, 54,00 g atrofida to‘xtaydi.'),
      how: L('Проведите шпателем от банки к стакану; последние граммы — по чуть-чуть.', 'Swipe the spatula from the jar to the beaker; add the last grams little by little.', 'Shpatelni bankadan stakanga suring; oxirgi grammlarni oz-ozdan soling.'),
      teacher: L('Na₂CO₃·10H₂O — это ионы Na⁺ и CO₃²⁻ в кристалле вместе с молекулами воды: 180 из 286 г его массы — кристаллизационная вода.', 'Na₂CO₃·10H₂O is Na⁺ and CO₃²⁻ ions packed together with water molecules: 180 of its 286 g are water of crystallisation.', 'Na₂CO₃·10H₂O — kristallda suv molekulalari bilan birga Na⁺ va CO₃²⁻ ionlari: 286 g ning 180 grammi kristallizatsiya suvi.'),
      mistake: L('Снимать показание, пока цифры «бегут»: ждите значок стабильности «○».', 'Reading while digits still change: wait for the stability mark “○”.', 'Raqamlar «yugurayotganda» o‘qish: barqarorlik belgisi «○» ni kuting.'),
    },
    {
      id: 'water',
      target: 'bottle-water',
      gesture: { kind: 'drag', from: [0.32, 0.1, 0.1], to: [0.15, 0.3, -0.06], lead: 0.42 },
      seconds: 4.4,
      instruction: L('Налейте в мерный цилиндр 146 мл дистиллированной воды.', 'Pour 146 ml of distilled water into the measuring cylinder.', 'O‘lchov silindriga 146 ml distillangan suv quying.'),
      observation: L('Вода в цилиндре — у риски 146 мл; поверхность вогнута (мениск).', 'Water stands at the 146 ml mark; the surface is concave (meniscus).', 'Silindrdagi suv 146 ml chizig‘ida; sirti botiq (menisk).'),
      how: L('Перетащите склянку с водой к цилиндру и наклоните.', 'Drag the water bottle to the cylinder and tilt it.', 'Suvli shishani silindrga torting va engashtiring.'),
      teacher: L('Вода смачивает стекло и поднимается по стенкам — мениск вогнутый; объём читают по его нижнему краю, глаз — на уровне жидкости.', 'Water wets glass and creeps up the walls — the meniscus is concave; read its bottom with your eye level with it.', 'Suv shishani ho‘llab devor bo‘ylab ko‘tariladi — menisk botiq; hajm uning pastki cheti bo‘yicha, ko‘z suyuqlik sathida o‘qiladi.'),
      mistake: L('Читать по верхнему краю мениска или сверху вниз — ошибка в 1–2 мл.', 'Reading the top of the meniscus or from above — a 1–2 ml error.', 'Meniskning yuqori cheti bo‘yicha yoki yuqoridan o‘qish — 1–2 ml xato.'),
    },
    {
      id: 'pour',
      target: 'cylinder',
      gesture: { kind: 'drag', from: [0.14, 0.12, -0.06], to: [-0.08, 0.24, 0.04], lead: 0.45 },
      seconds: 4.4,
      instruction: L('Вылейте воду из цилиндра в стакан с содой.', 'Pour the water from the cylinder onto the soda.', 'Silindrdagi suvni sodali stakanga quying.'),
      observation: L('Кристаллы под водой начинают растворяться; дисплей весов — около 200 г.', 'The crystals start dissolving under water; the balance reads about 200 g.', 'Kristallar suv ostida eriy boshlaydi; tarozi displeyi — taxminan 200 g.'),
      how: L('Перетащите цилиндр к стакану на весах и наклоните.', 'Drag the cylinder to the beaker on the balance and tilt it.', 'Silindrni tarozidagi stakanga torting va engashtiring.'),
      teacher: L('Цилиндр градуирован «на налив»: на его стенках остаётся плёнка воды (0,2–0,6 г) — это честная потеря опыта.', 'The cylinder is calibrated “to contain”: a film of water (0.2–0.6 g) stays on its walls — an honest loss.', 'Silindr «quyish uchun» darajalangan: devorlarida suv pardasi (0,2–0,6 g) qoladi — bu tajribaning halol yo‘qotishi.'),
    },
    {
      id: 'thermo',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.12, 0.1, 0.04], to: [-0.36, 0.1, -0.02], lead: 0.5 },
      seconds: 4.6,
      instruction: L('Перенесите стакан под термометр — шарик опустится в раствор.', 'Move the beaker under the thermometer — its bulb goes into the liquid.', 'Stakanni termometr ostiga o‘tkazing — sharchasi eritmaga tushadi.'),
      observation: L('Термометр показывает температуру смеси — около 20 °C; весы без стакана показывают «минус массу стакана».', 'The thermometer reads about 20 °C; without the beaker the balance shows “minus the beaker”.', 'Termometr aralashma haroratini — taxminan 20 °C ni ko‘rsatadi; stakansiz tarozi «minus stakan massasi»ni ko‘rsatadi.'),
      how: L('Перетащите стакан с весов на подставку под термометр.', 'Drag the beaker from the balance to the spot under the thermometer.', 'Stakanni tarozidan termometr ostidagi joyga torting.'),
      teacher: L('Тара запомнила стакан, поэтому без него весы показывают отрицательное число — это нормально, кнопку «T» больше не трогаем.', 'The tare remembers the beaker, so without it the balance reads negative — that is fine, do not press “T” again.', 'Tara stakanni eslab qolgan, shuning uchun usiz tarozi manfiy son ko‘rsatadi — bu normal, «T» ni boshqa bosmaymiz.'),
    },
    {
      id: 'stir',
      target: 'stir-rod',
      gesture: { kind: 'swipe', from: [-0.2, 0.01, -0.17], to: [-0.34, 0.16, -0.02], lead: 0.3 },
      seconds: 6.5,
      instruction: L('Перемешивайте палочкой, пока кристаллы не растворятся; следите за термометром.', 'Stir with the rod until the crystals dissolve; watch the thermometer.', 'Kristallar eriguncha tayoqcha bilan aralashtiring; termometrni kuzating.'),
      observation: L('Кристаллы исчезают, раствор прозрачный; столбик термометра опускается на 8–11 °C — стакан холодный на ощупь.', 'The crystals vanish, the solution is clear; the thermometer drops by 8–11 °C — the beaker feels cold.', 'Kristallar yo‘qoladi, eritma tiniq; termometr ustunchasi 8–11 °C ga tushadi — stakan qo‘lga sovuq.'),
      how: L('Проведите палочкой от стола к стакану — она перемешает раствор.', 'Swipe the rod from the bench to the beaker — it stirs the solution.', 'Tayoqchani stoldan stakanga suring — u eritmani aralashtiradi.'),
      teacher: L('Чтобы разрушить кристалл, нужна энергия, а гидратация ионов возвращает меньше — тепло забирается у воды, раствор остывает.', 'Breaking the crystal costs energy and hydrating the ions gives back less — heat is taken from the water, so it cools.', 'Kristallni buzish uchun energiya kerak, ionlarning gidratlanishi esa kamroq qaytaradi — issiqlik suvdan olinadi, eritma soviydi.'),
      mistake: L('Мешать термометром — тонкий шарик легко разбить.', 'Stirring with the thermometer — the thin bulb breaks easily.', 'Termometr bilan aralashtirish — yupqa sharcha oson sinadi.'),
    },
    {
      id: 'weigh',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.36, 0.1, -0.02], to: [-0.12, 0.12, 0.04], lead: 0.5 },
      seconds: 3.4,
      instruction: L('Поднимите термометр и поставьте стакан с раствором обратно на весы.', 'Raise the thermometer and put the beaker back on the balance.', 'Termometrni ko‘taring va eritmali stakanni yana taroziga qo‘ying.'),
      observation: L('Весы показывают массу раствора — около 200 г: растворение массу не меняет.', 'The balance shows the solution mass — about 200 g: dissolving does not change mass.', 'Tarozi eritma massasini — taxminan 200 g ni ko‘rsatadi: erish massani o‘zgartirmaydi.'),
      how: L('Перетащите стакан с раствором на чашу весов.', 'Drag the beaker with the solution onto the pan.', 'Eritmali stakanni tarozi pallasiga torting.'),
      teacher: L('Масса раствора = масса соды + масса воды: 54 + 146 = 200 г; вода из кристаллов просто стала частью растворителя.', 'Solution mass = soda + water: 54 + 146 = 200 g; the crystal water simply joined the solvent.', 'Eritma massasi = soda + suv: 54 + 146 = 200 g; kristall suvi shunchaki erituvchiga qo‘shildi.'),
    },
  ],
  focus: [
    { from: 3.62, to: 3.98, point: [-0.12, 0.03, 0.15], dist: 0.26 },
    { from: 4.6, to: 4.98, point: [0.14, 0.134, -0.06], dist: 0.24 },
    { from: 7.42, to: 7.98, point: [-0.372, 0.09, -0.02], dist: 0.26 },
    { from: 8.74, to: 8.99, point: [-0.12, 0.03, 0.15], dist: 0.26 },
  ],
  labels: [
    { at: 3.5, pos: [-0.12, 0.22, 0.04], text: L('кристаллы Na₂CO₃·10H₂O', 'Na₂CO₃·10H₂O crystals', 'Na₂CO₃·10H₂O kristallari') },
    { at: 4.78, pos: [0.2, 0.2, -0.06], text: L('по нижнему краю мениска', 'read the bottom of the meniscus', 'meniskning pastki cheti bo‘yicha') },
    { at: 7.5, pos: [-0.3, 0.2, -0.02], text: L('раствор остывает — тепло поглощается', 'the solution cools — heat is absorbed', 'eritma soviydi — issiqlik yutiladi') },
  ],
  measurements: [
    { key: 'mSoda', label: 'm(Na₂CO₃·10H₂O)', what: L('масса кристаллической соды', 'mass of crystalline soda', 'kristall soda massasi'), instrument: 'scales', afterStep: 3 },
    { key: 'V', label: 'V(H₂O)', what: L('объём воды в цилиндре', 'volume of water in the cylinder', 'silindrdagi suv hajmi'), instrument: 'cyl250', afterStep: 4 },
    { key: 't1', label: 't₁', what: L('температура в начале растворения', 'temperature at the start of dissolving', 'erish boshidagi harorat'), instrument: 'thermometer', afterStep: 6 },
    { key: 't2', label: 't₂', what: L('самая низкая температура при растворении', 'lowest temperature while dissolving', 'erish paytidagi eng past harorat'), instrument: 'thermometer', afterStep: 7 },
    { key: 'dT', label: 'Δt', what: L('изменение температуры t₂ − t₁', 'temperature change t₂ − t₁', 'harorat o‘zgarishi t₂ − t₁'), instrument: 'thermometer', afterStep: 7, derived: true },
    { key: 'mSol', label: 'm(Na₂CO₃ + H₂O)', what: L('масса полученного раствора', 'mass of the solution made', 'hosil bo‘lgan eritma massasi'), instrument: 'scales', afterStep: 8 },
  ],
  simulate: (rng) => {
    const mSoda = rng.weigh(54, 0.05)
    const vTrue = 146 + rng.between(-1, 1)
    const V = rng.read('cyl250', vTrue)
    // плёнка воды на стенках цилиндра «на налив»
    const film = rng.between(0.2, 0.6)
    const mSol = rng.read('scales', mSoda + (vTrue - film) * RHO_W)
    const t1 = rng.read('thermometer', rng.between(19.5, 21))
    const t2 = rng.read('thermometer', t1 - rng.between(8.5, 11))
    return { mSoda, V, t1, t2, dT: Math.round((t2 - t1) * 10) / 10, mSol }
  },
  given: (v, lang) => [
    `m(Na₂CO₃·10H₂O) = ${n(v.mSoda!, 2, lang)} ${tr(lang, 'г', 'g', 'g')}`,
    `V(H₂O) = ${n(v.V!, 0, lang)} ${tr(lang, 'мл', 'ml', 'ml')} → m(H₂O) = ${n(v.V!, 0, lang)} · 0${lang === 'en' ? '.' : ','}998 ≈ ${n(v.V! * RHO_W, 1, lang)} ${tr(lang, 'г', 'g', 'g')}`,
    `m(${tr(lang, 'р-ра', 'solution', 'eritma')}) = ${n(v.mSol!, 2, lang)} ${tr(lang, 'г', 'g', 'g')}; t: ${n(v.t1!, 1, lang)} → ${n(v.t2!, 1, lang)} °C`,
    tr(lang, 'Нужно: w(Na₂CO₃) = 10 %; m(H₂O) — ?', 'Wanted: w(Na₂CO₃) = 10 %; m(H₂O) = ?', 'Kerak: w(Na₂CO₃) = 10 %; m(H₂O) — ?'),
    'M(Na₂CO₃·10H₂O) = 286, M(Na₂CO₃) = 106 ' + tr(lang, 'г/моль', 'g/mol', 'g/mol'),
  ],
  solution: (v, lang) => {
    const s = na2co3(v)
    const sol = s / 0.1
    const water = sol - v.mSoda!
    const g = tr(lang, 'г', 'g', 'g')
    return [
      tr(lang, `1) В 286 г соды — 106 г Na₂CO₃: m(Na₂CO₃) = ${n(v.mSoda!, 2, lang)} · 106 / 286 = ${n(s, 2, lang)} г`, `1) 286 g of soda contain 106 g Na₂CO₃: m(Na₂CO₃) = ${n(v.mSoda!, 2, lang)} · 106 / 286 = ${n(s, 2, lang)} g`, `1) 286 g sodada 106 g Na₂CO₃: m(Na₂CO₃) = ${n(v.mSoda!, 2, lang)} · 106 / 286 = ${n(s, 2, lang)} g`),
      tr(lang, `2) 10 %-ный раствор: m(р-ра) = ${n(s, 2, lang)} / 0,10 = ${n(sol, 1, lang)} г`, `2) 10 % solution: m(solution) = ${n(s, 2, lang)} / 0.10 = ${n(sol, 1, lang)} g`, `2) 10 % li eritma: m(eritma) = ${n(s, 2, lang)} / 0,10 = ${n(sol, 1, lang)} g`),
      tr(lang, `3) m(H₂O) = ${n(sol, 1, lang)} − ${n(v.mSoda!, 2, lang)} = ${n(water, 1, lang)} г (кристаллизационная вода уже в соде)`, `3) m(H₂O) = ${n(sol, 1, lang)} − ${n(v.mSoda!, 2, lang)} = ${n(water, 1, lang)} g (the crystal water is already in the soda)`, `3) m(H₂O) = ${n(sol, 1, lang)} − ${n(v.mSoda!, 2, lang)} = ${n(water, 1, lang)} g (kristallizatsiya suvi sodaning ichida)`),
      tr(lang, `4) Проверка опытом: w = ${n(s, 2, lang)} / ${n(v.mSol!, 2, lang)} · 100 % = ${n((s / v.mSol!) * 100, 2, lang)} %`, `4) Check by experiment: w = ${n(s, 2, lang)} / ${n(v.mSol!, 2, lang)} · 100 % = ${n((s / v.mSol!) * 100, 2, lang)} %`, `4) Tajriba bilan tekshiruv: w = ${n(s, 2, lang)} / ${n(v.mSol!, 2, lang)} · 100 % = ${n((s / v.mSol!) * 100, 2, lang)} %`),
      tr(lang, `Ответ: m(H₂O) ≈ ${n(water, 0, lang)} ${g}`, `Answer: m(H₂O) ≈ ${n(water, 0, lang)} ${g}`, `Javob: m(H₂O) ≈ ${n(water, 0, lang)} ${g}`),
    ]
  },
  compare: [
    {
      label: L('w(Na₂CO₃) в растворе', 'w(Na₂CO₃) in the solution', 'eritmadagi w(Na₂CO₃)'),
      unit: '%',
      decimals: 2,
      measured: (v) => (na2co3(v) / v.mSol!) * 100,
      predicted: (v) => (na2co3(v) / (v.mSoda! + v.V! * RHO_W)) * 100,
      book: 10,
      tolerancePct: 2,
    },
    {
      label: L('масса раствора', 'mass of the solution', 'eritma massasi'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mSol!,
      predicted: (v) => v.mSoda! + v.V! * RHO_W,
      book: 200,
      tolerancePct: 1,
    },
  ],
  reconcile: L(
    'Весы дают навеску до 0,01 г, а цилиндр на 250 мл — только ±1 мл (цена деления 2 мл), поэтому вода — главный источник разброса. 1 мл воды при 20 °C весит 0,998 г, а не 1 г: 146 мл — это 145,7 г. Цилиндр градуирован «на налив» — на его стенках остаётся плёнка 0,2–0,6 г, и масса раствора выходит чуть меньше расчётной. На массовую долю это почти не влияет: ±1 г на 200 г — ±0,05 %.',
    'The balance weighs to 0.01 g, but the 250 ml cylinder only to ±1 ml (2 ml divisions), so the water is the main source of spread. 1 ml of water at 20 °C weighs 0.998 g, not 1 g: 146 ml is 145.7 g. The cylinder is calibrated “to contain” — a 0.2–0.6 g film stays on its walls, so the solution comes out slightly lighter than calculated. The mass fraction barely changes: ±1 g in 200 g is ±0.05 %.',
    'Tarozi 0,01 g gacha tortadi, 250 ml li silindr esa faqat ±1 ml (bo‘linma 2 ml), shuning uchun suv — asosiy tarqoqlik manbai. 20 °C da 1 ml suv 1 g emas, 0,998 g: 146 ml — bu 145,7 g. Silindr «quyish uchun» darajalangan — devorlarida 0,2–0,6 g parda qoladi, eritma hisobdagidan biroz yengil chiqadi. Massa ulushiga deyarli ta’sir qilmaydi: 200 g da ±1 g — ±0,05 %.',
  ),
  conclusion: L(
    'Из 54 г кристаллической соды (в ней 20 г Na₂CO₃ и 34 г воды) 10 %-ный раствор получается с 146 г воды — всего 200 г раствора. Растворение декагидрата поглощает тепло: раствор заметно остывает.',
    '54 g of crystalline soda (20 g Na₂CO₃ plus 34 g of water) make a 10 % solution with 146 g of water — 200 g of solution in all. Dissolving the decahydrate absorbs heat: the solution cools noticeably.',
    '54 g kristall sodadan (unda 20 g Na₂CO₃ va 34 g suv) 146 g suv bilan 10 % li eritma olinadi — jami 200 g eritma. Dekagidratning erishi issiqlik yutadi: eritma sezilarli soviydi.',
  ),
  story: {
    equation: 'Na₂CO₃·10H₂O → 2Na⁺ + CO₃²⁻ + 10H₂O',
    text: L(
      'Молекулы воды отрывают ионы Na⁺ и CO₃²⁻ от кристалла и окружают их гидратной оболочкой; десять молекул кристаллизационной воды уходят в раствор и становятся частью растворителя. На разрушение решётки уходит больше энергии, чем выделяется при гидратации, — поэтому раствор холодеет.',
      'Water molecules pull Na⁺ and CO₃²⁻ ions out of the crystal and wrap them in hydration shells; the ten molecules of crystal water join the solvent. Breaking the lattice costs more energy than hydration releases — so the solution gets colder.',
      'Suv molekulalari Na⁺ va CO₃²⁻ ionlarini kristalldan ajratib, gidrat qobiq bilan o‘raydi; o‘nta kristallizatsiya suvi molekulasi eritmaga o‘tib, erituvchining bir qismiga aylanadi. Panjarani buzishga gidratlanishda ajralganidan ko‘proq energiya ketadi — shuning uchun eritma soviydi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показал термометр, когда кристаллы растворялись?', 'What did the thermometer show as the crystals dissolved?', 'Kristallar eriganda termometr nimani ko‘rsatdi?'),
      options: [
        L('Температура понизилась на 8–11 °C', 'The temperature fell by 8–11 °C', 'Harorat 8–11 °C ga pasaydi'),
        L('Температура выросла на 10 °C', 'The temperature rose by 10 °C', 'Harorat 10 °C ga ko‘tarildi'),
        L('Температура не изменилась', 'The temperature did not change', 'Harorat o‘zgarmadi'),
      ],
      correct: 0,
      why: L('Растворение Na₂CO₃·10H₂O эндотермично: энергия на разрушение кристалла берётся из теплоты воды.', 'Dissolving Na₂CO₃·10H₂O is endothermic: the energy to break the crystal comes from the water’s heat.', 'Na₂CO₃·10H₂O ning erishi endotermik: kristallni buzish energiyasi suvning issiqligidan olinadi.'),
    },
    {
      id: 'type',
      q: L('Какое это явление?', 'What kind of process is this?', 'Bu qanday hodisa?'),
      options: [
        L('Физическое явление — растворение', 'A physical process — dissolving', 'Fizik hodisa — erish'),
        L('Реакция обмена', 'An exchange reaction', 'Almashinish reaksiyasi'),
        L('Реакция разложения', 'A decomposition reaction', 'Parchalanish reaksiyasi'),
      ],
      correct: 0,
      why: L('Новых веществ не образуется: в растворе те же ионы Na⁺ и CO₃²⁻, а масса не изменилась (весы показали те же ~200 г).', 'No new substances form: the same Na⁺ and CO₃²⁻ ions are in solution, and the mass did not change (the balance showed the same ~200 g).', 'Yangi modda hosil bo‘lmaydi: eritmada o‘sha Na⁺ va CO₃²⁻ ionlari, massa o‘zgarmadi (tarozi o‘sha ~200 g ni ko‘rsatdi).'),
    },
    {
      id: 'product',
      q: L('Что получилось в стакане?', 'What is in the beaker now?', 'Stakanda nima hosil bo‘ldi?'),
      options: [
        L('≈200 г 10 %-ного раствора Na₂CO₃', '≈200 g of 10 % Na₂CO₃ solution', '≈200 g 10 % li Na₂CO₃ eritmasi'),
        L('≈146 г 37 %-ного раствора соды', '≈146 g of 37 % soda solution', '≈146 g 37 % li soda eritmasi'),
        L('Осадок карбоната натрия под водой', 'Sodium carbonate sediment under water', 'Suv ostida natriy karbonat cho‘kmasi'),
      ],
      correct: 0,
      why: L('20 г Na₂CO₃ в 200 г раствора — это 10 %; вода кристаллогидрата (34 г) тоже входит в 200 г.', '20 g of Na₂CO₃ in 200 g of solution is 10 %; the hydrate water (34 g) is part of the 200 g too.', '200 g eritmada 20 g Na₂CO₃ — bu 10 %; kristallogidrat suvi (34 g) ham 200 g ga kiradi.'),
    },
  ],
}
