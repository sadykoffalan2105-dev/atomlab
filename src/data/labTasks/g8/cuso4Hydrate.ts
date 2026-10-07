/**
 * Kimyo 8, с. 154, задача 4: массовая доля кристаллизационной воды в медном купоросе CuSO₄·5H₂O.
 * Опыт 1 : 1 — 2,50 г синих кристаллов в фарфоровой чашке на кольце над спиртовкой: синий → голубовато-белый,
 * пар; остывание, 1-е взвешивание (вода ушла не вся), повторный нагрев, 2-е взвешивание (масса почти постоянна);
 * капля воды на белый порошок — снова синеет и теплеет. w(H₂O) = (m₀ − m₂) / m₀ · 100 %.
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'
import { CU } from './layoutG8'

const PAN: readonly [number, number, number] = [CU.scales[0], 0.047, CU.scales[2] - 0.012]
const RING = CU.ringDish
/** Доля CuSO₄ и воды в CuSO₄·5H₂O по школьным M: 160 / 250 и 90 / 250. */
const ANH = 160 / 250
const WATER = 90 / 250
const f = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
const wRun = (v: LabTaskValues) => ((v.m0! - v.m2!) / v.m0!) * 100

export const TASK_G8_CUSO4_HYDRATE: LabTask = {
  id: 'task-g8-cuso4-hydrate',
  grade: 8,
  page: 154,
  source: L('Kimyo 8 · с. 154, задача 4', 'Kimyo 8 · p. 154, problem 4', 'Kimyo 8 · 154-bet, 4-masala'),
  bookKind: 'task',
  title: L('Сколько воды в медном купоросе', 'How much water is in blue vitriol', 'Mis kuporosida qancha suv bor'),
  statement: L(
    'Вычислите массовую долю (%) кристаллизационной воды в медном купоросе.',
    'Calculate the mass fraction (%) of water of crystallization in blue vitriol (copper sulfate pentahydrate).',
    'Mis kuporosidagi kristallizatsiya suvining massa ulushini (%) hisoblang.',
  ),
  equation: 'CuSO₄·5H₂O → CuSO₄ + 5H₂O',
  kind: 'decomposition',
  type: 'crystal-hydrate',
  difficulty: 2,
  answers: [
    {
      key: 'w',
      label: 'w(H₂O)',
      what: L('массовая доля кристаллизационной воды', 'mass fraction of water of crystallization', 'kristallizatsiya suvining massa ulushi'),
      unit: L('%', '%', '%'),
      book: 36,
      decimals: 0,
      fromRun: wRun,
    },
  ],
  labScale: {
    factor: 1,
    note: L(
      'Массовая доля не зависит от того, сколько взять вещества. Берём 2,50 г кристаллов: воды в них около 0,9 г — весы с ценой 0,01 г покажут её с точностью около 1 %.',
      'A mass fraction does not depend on how much substance is taken. We take 2.50 g of crystals: they hold about 0.9 g of water, which a 0.01 g balance shows to about 1 %.',
      'Massa ulushi olingan modda miqdoriga bog‘liq emas. 2,50 g kristall olamiz: ularda taxminan 0,9 g suv bor — 0,01 g li tarozi uni taxminan 1 % aniqlikda ko‘rsatadi.',
    ),
  },
  instruments: ['scales'],
  equipment: [
    L('Электронные весы (0,01 г), фарфоровая чашка, шпатель', 'Electronic balance (0.01 g), porcelain dish, spatula', 'Elektron tarozi (0,01 g), chinni kosacha, shpatel'),
    L('Медный купорос CuSO₄·5H₂O (синие кристаллы)', 'Blue vitriol CuSO₄·5H₂O (blue crystals)', 'Mis kuporosi CuSO₄·5H₂O (ko‘k kristallar)'),
    L('Штатив с кольцом, спиртовка, спички, стеклянная палочка', 'Ring stand, spirit lamp, matches, glass rod', 'Halqali shtativ, spirt lampa, gugurt, shisha tayoqcha'),
    L('Склянка-капельница с дистиллированной водой; эксикатор (для остывания)', 'Dropper bottle with distilled water; desiccator (for cooling)', 'Distillangan suvli tomizgichli shisha; eksikator (sovitish uchun)'),
  ],
  safety: [
    L('Очки: при нагреве кристаллы потрескивают и могут разлетаться.', 'Goggles: when heated, the crystals crackle and may spit.', 'Ko‘zoynak: qizdirilganda kristallar chirsillaydi va sachrashi mumkin.'),
    L('Горячую чашку не трогать руками; спиртовку гасят только колпачком, не задувают.', 'Do not touch the hot dish; put out the spirit lamp only with its cap, never blow it out.', 'Issiq kosachani qo‘l bilan ushlamang; spirt lampa faqat qalpoqcha bilan o‘chiriladi, puflanmaydi.'),
    L('Сульфат меди вреден при проглатывании; после работы вымыть руки.', 'Copper sulfate is harmful if swallowed; wash your hands after work.', 'Mis sulfat yutilganda zararli; ishdan so‘ng qo‘lni yuving.'),
  ],
  gear: ['goggles'],
  steps: [
    {
      id: 'ppe',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте защитные очки.', 'Put on safety goggles.', 'Himoya ko‘zoynagini taqing.'),
      observation: L('Глаза защищены: при нагреве кристаллы потрескивают.', 'Eyes are protected: the crystals crackle when heated.', 'Ko‘zlar himoyalangan: qizdirilganda kristallar chirsillaydi.'),
      how: L('Нажмите на поднос со средствами защиты.', 'Tap the tray with the protective gear.', 'Himoya vositalari turgan patnisni bosing.'),
      teacher: L(
        'Внутри кристаллов вода связана; при нагреве она превращается в пар и разрывает кристаллы — крупинки могут отскочить.',
        'Water is bound inside the crystals; when heated it turns into steam and bursts the crystals — grains may jump out.',
        'Kristallar ichida suv bog‘langan; qizdirilganda u bug‘ga aylanib kristallarni yoradi — donachalar sakrab chiqishi mumkin.',
      ),
    },
    {
      id: 'tare',
      target: 'dish',
      gesture: { kind: 'drag', from: [CU.dish[0], 0.02, CU.dish[2]], to: [PAN[0], 0.06, PAN[2]], lead: 0.42 },
      seconds: 3.6,
      instruction: L('Поставьте фарфоровую чашку на весы и обнулите их (T).', 'Put the porcelain dish on the balance and tare it (T).', 'Chinni kosachani taroziga qo‘ying va nolga keltiring (T).'),
      observation: L('Весы показали массу чашки, после «T» — 0,00 г.', 'The balance showed the mass of the dish; after “T” it reads 0.00 g.', 'Tarozi kosacha massasini ko‘rsatdi, «T» dan so‘ng — 0,00 g.'),
      how: L('Перетащите чашку на чашу весов.', 'Drag the dish onto the balance pan.', 'Kosachani tarozi pallasiga torting.'),
      teacher: L(
        'Чашку заранее прокалили и остудили — на ней нет влаги. Тара позволяет видеть на дисплее только массу вещества в чашке.',
        'The dish was heated and cooled beforehand — there is no moisture on it. Taring lets the display show only the mass of the substance in the dish.',
        'Kosacha oldindan qizdirilib sovitilgan — unda namlik yo‘q. Tara displeyda faqat kosachadagi modda massasini ko‘rishga imkon beradi.',
      ),
    },
    {
      id: 'crystals',
      target: 'spatula',
      gesture: { kind: 'drag', from: [CU.spatula[0] + 0.04, 0.01, CU.spatula[2]], to: [PAN[0], 0.08, PAN[2]], lead: 0.25 },
      seconds: 6,
      instruction: L('Наберите шпателем 2,50 г синих кристаллов медного купороса.', 'Add 2.50 g of blue vitriol crystals with the spatula.', 'Shpatel bilan 2,50 g ko‘k mis kuporosi kristallarini oling.'),
      observation: L('Ярко-синие прозрачные кристаллы; показание остановилось около 2,50 г, горит значок ○.', 'Bright blue transparent crystals; the reading settles near 2.50 g and the ○ mark lights up.', 'Yorqin ko‘k tiniq kristallar; ko‘rsatkich 2,50 g atrofida to‘xtadi, ○ belgisi yondi.'),
      how: L('Перетащите шпатель от банки к чашке на весах.', 'Drag the spatula from the jar to the dish on the balance.', 'Shpatelni bankadan tarozidagi kosachaga torting.'),
      teacher: L(
        'Синий цвет дают ионы меди, окружённые молекулами воды. В каждой частице CuSO₄·5H₂O — пять молекул воды.',
        'The blue colour comes from copper ions surrounded by water molecules. Each CuSO₄·5H₂O unit holds five water molecules.',
        'Ko‘k rangni suv molekulalari bilan o‘ralgan mis ionlari beradi. Har bir CuSO₄·5H₂O zarrachasida beshta suv molekulasi bor.',
      ),
      mistake: L('Записывают число, пока цифры «бегут». Ждите значок стабильности ○.', 'Writing down the number while the digits are still changing. Wait for the ○ stability mark.', 'Raqamlar «yugurib» turganda yozib olish. ○ barqarorlik belgisini kuting.'),
    },
    {
      id: 'ring',
      target: 'dish',
      gesture: { kind: 'drag', from: [PAN[0], 0.06, PAN[2]], to: [RING[0], 0.16, RING[2]], lead: 0.6 },
      seconds: 3.6,
      instruction: L('Поставьте чашку на кольцо штатива над спиртовкой.', 'Put the dish on the ring of the stand above the spirit lamp.', 'Kosachani spirt lampa ustidagi shtativ halqasiga qo‘ying.'),
      observation: L('Чашка стоит на кольце; дно — на высоте верхней части пламени. Весы без чашки показывают минус.', 'The dish sits on the ring; its bottom is at the height of the upper part of the flame. Without the dish the balance shows a minus.', 'Kosacha halqada turibdi; tubi alangganing yuqori qismi balandligida. Kosachasiz tarozi minus ko‘rsatadi.'),
      how: L('Перетащите чашку с весов на кольцо штатива.', 'Drag the dish from the balance to the ring of the stand.', 'Kosachani tarozidan shtativ halqasiga torting.'),
      teacher: L(
        'Самая горячая часть пламени спиртовки — верхняя треть. Если чашка стоит слишком низко, она закоптится и греется хуже.',
        'The hottest part of a spirit lamp flame is its upper third. If the dish sits too low, it gets sooty and heats worse.',
        'Spirt lampa alangasining eng issiq qismi — yuqori uchdan biri. Kosacha juda past tursa, qorayadi va yomonroq isiydi.',
      ),
    },
    {
      id: 'light',
      target: 'spirit-lamp',
      gesture: { kind: 'tap' },
      seconds: 3.4,
      instruction: L('Снимите колпачок и зажгите спиртовку спичкой.', 'Take off the cap and light the spirit lamp with a match.', 'Qalpoqchani oling va spirt lampani gugurt bilan yoqing.'),
      observation: L('Фитиль загорелся ровным голубоватым пламенем.', 'The wick lights with an even bluish flame.', 'Pilik tekis zangori alanga bilan yondi.'),
      how: L('Нажмите на спиртовку.', 'Tap the spirit lamp.', 'Spirt lampani bosing.'),
      teacher: L(
        'Спиртовку зажигают только спичкой, а не от другой спиртовки: из наклонённой спиртовки может пролиться горящий спирт.',
        'A spirit lamp is lit only with a match, never from another lamp: burning alcohol can spill from a tilted lamp.',
        'Spirt lampa faqat gugurt bilan yoqiladi, boshqa lampadan emas: egilgan lampadan yonayotgan spirt to‘kilishi mumkin.',
      ),
    },
    {
      id: 'heat',
      target: 'rod',
      gesture: { kind: 'drag', from: [CU.rod[0] + 0.1, 0.01, CU.rod[2]], to: [RING[0], 0.2, RING[2]], lead: 0.3 },
      seconds: 8,
      instruction: L('Нагревайте кристаллы, помешивая стеклянной палочкой, пока синий цвет не исчезнет.', 'Heat the crystals, stirring with a glass rod, until the blue colour is gone.', 'Kristallarni shisha tayoqcha bilan aralashtirib, ko‘k rang yo‘qolguncha qizdiring.'),
      observation: L('Кристаллы потрескивают, над чашкой пар; синий цвет бледнеет — остаётся голубовато-белый порошок.', 'The crystals crackle, steam rises over the dish; the blue fades — a bluish-white powder is left.', 'Kristallar chirsillaydi, kosacha ustida bug‘; ko‘k rang oqaradi — zangori-oq kukun qoladi.'),
      how: L('Перетащите палочку к чашке на штативе.', 'Drag the glass rod to the dish on the stand.', 'Tayoqchani shtativdagi kosachaga torting.'),
      teacher: L(
        'При нагреве молекулы воды отрываются от ионов меди и улетают паром. Без воды вокруг ионов Cu²⁺ сульфат меди белый.',
        'On heating, the water molecules break away from the copper ions and leave as steam. Without water around the Cu²⁺ ions, copper sulfate is white.',
        'Qizdirilganda suv molekulalari mis ionlaridan ajralib, bug‘ bo‘lib chiqadi. Cu²⁺ ionlari atrofida suv bo‘lmasa, mis sulfat oq rangda.',
      ),
      mistake: L('Греют слишком сильно и долго — белый CuSO₄ начинает чернеть: он разлагается дальше, и масса становится меньше нужной.', 'Heating too strongly and too long — white CuSO₄ starts to blacken: it decomposes further, and the mass becomes too small.', 'Juda kuchli va uzoq qizdirish — oq CuSO₄ qorayib qoladi: u yana parchalanadi va massa keragidan kamayadi.'),
    },
    {
      id: 'cool',
      target: 'lamp-cap',
      gesture: { kind: 'tap' },
      seconds: 4,
      instruction: L('Погасите спиртовку колпачком и дайте чашке остыть.', 'Put out the spirit lamp with the cap and let the dish cool.', 'Spirt lampani qalpoqcha bilan o‘chiring va kosachani sovushga qo‘ying.'),
      observation: L('Пламя погасло; чашка остывает. В лаборатории её ставят остывать в эксикатор — сосуд с осушителем.', 'The flame is out; the dish is cooling. In a laboratory it cools in a desiccator — a vessel with a drying agent.', 'Alanga o‘chdi; kosacha soviyapti. Laboratoriyada u eksikatorda — quritgichli idishda sovitiladi.'),
      how: L('Нажмите на колпачок спиртовки.', 'Tap the spirit lamp cap.', 'Spirt lampa qalpoqchasini bosing.'),
      teacher: L(
        'Безводный CuSO₄ жадно впитывает влагу из воздуха. В эксикаторе воздух сухой — порошок не наберёт воды, пока остывает.',
        'Anhydrous CuSO₄ eagerly absorbs moisture from the air. The air in a desiccator is dry, so the powder takes up no water while cooling.',
        'Suvsiz CuSO₄ havodan namlikni tez yutadi. Eksikatorda havo quruq — kukun sovuyotganda suv olmaydi.',
      ),
      mistake: L('Задувают спиртовку — пламя может проскочить внутрь сосуда со спиртом.', 'Blowing out the lamp — the flame can flash back into the alcohol container.', 'Spirt lampani puflab o‘chirish — alanga spirtli idish ichiga o‘tib ketishi mumkin.'),
    },
    {
      id: 'weigh1',
      target: 'dish',
      gesture: { kind: 'drag', from: [RING[0], 0.16, RING[2]], to: [PAN[0], 0.06, PAN[2]], lead: 0.55 },
      seconds: 4,
      instruction: L('Взвесьте остывшую чашку с порошком (1-е взвешивание).', 'Weigh the cooled dish with the powder (1st weighing).', 'Sovigan kukunli kosachani torting (1-tortish).'),
      observation: L('Масса заметно меньше, чем было кристаллов, — вода ушла. Но местами порошок ещё голубоватый.', 'The mass is noticeably smaller than the crystals were — the water has gone. But in places the powder is still bluish.', 'Massa kristallarnikidan sezilarli kam — suv chiqib ketdi. Lekin ba’zi joylarda kukun hali zangori.'),
      how: L('Перетащите чашку с кольца на весы.', 'Drag the dish from the ring to the balance.', 'Kosachani halqadan taroziga torting.'),
      teacher: L(
        'Весы помнят тару — массу пустой чашки, поэтому на дисплее масса порошка. Голубоватый оттенок значит, что часть воды ещё осталась.',
        'The balance remembers the tare — the empty dish — so the display shows the mass of the powder. A bluish tint means some water is still there.',
        'Tarozi tarani — bo‘sh kosachani eslab qolgan, shuning uchun displeyda kukun massasi. Zangori tus suvning bir qismi hali qolganini bildiradi.',
      ),
      mistake: L('Взвешивают горячую чашку — восходящий тёплый воздух занижает показание.', 'Weighing a hot dish — rising warm air makes the reading too low.', 'Issiq kosachani tortish — ko‘tarilayotgan iliq havo ko‘rsatkichni kamaytiradi.'),
    },
    {
      id: 'reheat',
      target: 'dish',
      gesture: { kind: 'drag', from: [PAN[0], 0.06, PAN[2]], to: [RING[0], 0.16, RING[2]], lead: 0.42 },
      seconds: 9,
      instruction: L('Нагрейте чашку ещё раз, погасите спиртовку и остудите.', 'Heat the dish once more, put out the lamp and let it cool.', 'Kosachani yana bir marta qizdiring, spirt lampani o‘chiring va sovuting.'),
      observation: L('Остатки голубого цвета исчезли — порошок ровно белёсый; пара больше нет.', 'The last traces of blue are gone — the powder is evenly whitish; no more steam.', 'Ko‘k rang qoldiqlari yo‘qoldi — kukun bir tekis oqish; bug‘ endi yo‘q.'),
      how: L('Перетащите чашку с весов обратно на кольцо.', 'Drag the dish from the balance back to the ring.', 'Kosachani tarozidan yana halqaga torting.'),
      teacher: L(
        'Повторный нагрев — проверка: если вода ушла вся, масса больше не меняется. Это называют «прокалить до постоянной массы».',
        'Heating again is a check: if all the water has gone, the mass no longer changes. This is called “heating to constant mass”.',
        'Qayta qizdirish — tekshiruv: agar suv to‘liq chiqib ketgan bo‘lsa, massa boshqa o‘zgarmaydi. Buni «doimiy massagacha qizdirish» deyiladi.',
      ),
    },
    {
      id: 'weigh2',
      target: 'dish',
      gesture: { kind: 'drag', from: [RING[0], 0.16, RING[2]], to: [PAN[0], 0.06, PAN[2]], lead: 0.55 },
      seconds: 4,
      instruction: L('Взвесьте остывшую чашку ещё раз (2-е взвешивание).', 'Weigh the cooled dish again (2nd weighing).', 'Sovigan kosachani yana torting (2-tortish).'),
      observation: L('Масса уменьшилась лишь на несколько сотых грамма — почти постоянна: вода ушла практически вся.', 'The mass dropped only by a few hundredths of a gram — almost constant: practically all the water has gone.', 'Massa faqat bir necha yuzdan bir grammga kamaydi — deyarli doimiy: suv amalda to‘liq chiqib ketdi.'),
      how: L('Перетащите чашку с кольца на весы.', 'Drag the dish from the ring to the balance.', 'Kosachani halqadan taroziga torting.'),
      teacher: L(
        'В расчёт берут последнее взвешивание: масса воды — разность между кристаллами и безводным порошком.',
        'The last weighing goes into the calculation: the mass of water is the difference between the crystals and the anhydrous powder.',
        'Hisobga oxirgi tortish olinadi: suv massasi — kristallar va suvsiz kukun massalari farqi.',
      ),
    },
    {
      id: 'water',
      target: 'dropper',
      gesture: { kind: 'drag', from: [CU.water[0], 0.08, CU.water[2]], to: [CU.dish[0], 0.07, CU.dish[2]], lead: 0.24 },
      seconds: 5,
      instruction: L('Поставьте чашку на стол и капните на белый порошок несколько капель воды.', 'Put the dish on the table and drop a few drops of water onto the white powder.', 'Kosachani stolga qo‘ying va oq kukunga bir necha tomchi suv tomizing.'),
      observation: L('Порошок там, куда попала вода, сразу синеет, чашка заметно теплеет.', 'Where the water lands, the powder turns blue at once, and the dish gets noticeably warm.', 'Suv tushgan joyda kukun darhol ko‘karadi, kosacha sezilarli iliydi.'),
      how: L('Перетащите пипетку с водой к чашке.', 'Drag the dropper with water to the dish.', 'Suvli tomizgichni kosachaga torting.'),
      teacher: L(
        'Ионы меди снова окружают себя молекулами воды — получается синий CuSO₄·5H₂O, и выделяется тепло. Так безводный сульфат меди обнаруживает воду.',
        'The copper ions surround themselves with water molecules again — blue CuSO₄·5H₂O forms and heat is released. This is how anhydrous copper sulfate detects water.',
        'Mis ionlari yana suv molekulalari bilan o‘raladi — ko‘k CuSO₄·5H₂O hosil bo‘ladi va issiqlik ajraladi. Suvsiz mis sulfat suvni shunday aniqlaydi.',
      ),
    },
  ],
  focus: [
    { from: 2.66, to: 2.98, point: [CU.scales[0], 0.035, CU.scales[2] + 0.07], dist: 0.3 },
    { from: 5.12, to: 5.92, point: [RING[0], RING[1] + 0.01, RING[2]], dist: 0.36 },
    { from: 7.6, to: 7.98, point: [CU.scales[0], 0.035, CU.scales[2] + 0.07], dist: 0.3 },
    { from: 9.6, to: 9.98, point: [CU.scales[0], 0.035, CU.scales[2] + 0.07], dist: 0.3 },
    { from: 10.36, to: 10.95, point: [CU.dish[0], 0.02, CU.dish[2]], dist: 0.28 },
  ],
  labels: [
    { at: 2.75, pos: [CU.scales[0], 0.15, CU.scales[2]], text: L('синие кристаллы CuSO₄·5H₂O', 'blue CuSO₄·5H₂O crystals', 'ko‘k CuSO₄·5H₂O kristallari') },
    { at: 5.45, pos: [RING[0], RING[1] + 0.1, RING[2]], text: L('синий → голубовато-белый, пар', 'blue → bluish-white, steam', 'ko‘k → zangori-oq, bug‘') },
    { at: 5.85, pos: [RING[0] + 0.05, RING[1] + 0.14, RING[2]], text: L('ускорено: в жизни 5–10 мин', 'sped up: 5–10 min in real life', 'tezlashtirilgan: hayotda 5–10 daq') },
    { at: 6.45, pos: [RING[0], RING[1] + 0.1, RING[2]], text: L('остывает (в жизни — в эксикаторе)', 'cooling (a desiccator in real life)', 'soviyapti (hayotda — eksikatorda)') },
    { at: 9.7, pos: [CU.scales[0], 0.15, CU.scales[2]], text: L('масса почти не изменилась', 'the mass has hardly changed', 'massa deyarli o‘zgarmadi') },
    { at: 10.6, pos: [CU.dish[0], 0.1, CU.dish[2]], text: L('снова синеет и теплеет', 'turns blue and warm again', 'yana ko‘karadi va iliydi') },
  ],
  measurements: [
    { key: 'm0', label: 'm₀', what: L('масса кристаллов CuSO₄·5H₂O', 'mass of the CuSO₄·5H₂O crystals', 'CuSO₄·5H₂O kristallari massasi'), instrument: 'scales', afterStep: 2 },
    { key: 'm1', label: 'm₁', what: L('масса порошка после 1-го нагрева', 'mass of the powder after the 1st heating', '1-qizdirishdan keyingi kukun massasi'), instrument: 'scales', afterStep: 7 },
    { key: 'm2', label: 'm₂', what: L('масса порошка после 2-го нагрева', 'mass of the powder after the 2nd heating', '2-qizdirishdan keyingi kukun massasi'), instrument: 'scales', afterStep: 9 },
    { key: 'mW', label: 'm(H₂O)', what: L('масса ушедшей воды m₀ − m₂', 'mass of water given off m₀ − m₂', 'chiqib ketgan suv massasi m₀ − m₂'), instrument: 'scales', afterStep: 9, derived: true },
  ],
  simulate: (rng) => {
    const m0 = rng.weigh(2.5, 0.03)
    const anh = m0 * ANH
    // 1-й нагрев: остаётся 3–7 % воды (голубоватые участки); 2-й — почти вся вода ушла (0–1,2 %)
    const m2 = rng.read('scales', anh + m0 * WATER * rng.between(0, 0.012))
    const m1 = Math.max(rng.read('scales', anh + m0 * WATER * rng.between(0.03, 0.07)), m2 + 0.02)
    return { m0, m1: Number(m1.toFixed(2)), m2, mW: Number((m0 - m2).toFixed(2)) }
  },
  given: (v, lang) => [
    tr(lang, 'Задача: медный купорос CuSO₄·5H₂O; w(H₂O) — ?', 'Problem: blue vitriol CuSO₄·5H₂O; w(H₂O) — ?', 'Masala: mis kuporosi CuSO₄·5H₂O; w(H₂O) — ?'),
    tr(
      lang,
      `Опыт: m₀(CuSO₄·5H₂O) = ${f(v.m0!, 2, lang)} г; после 1-го нагрева m₁ = ${f(v.m1!, 2, lang)} г; после 2-го m₂ = ${f(v.m2!, 2, lang)} г`,
      `Experiment: m₀(CuSO₄·5H₂O) = ${f(v.m0!, 2, lang)} g; after the 1st heating m₁ = ${f(v.m1!, 2, lang)} g; after the 2nd m₂ = ${f(v.m2!, 2, lang)} g`,
      `Tajriba: m₀(CuSO₄·5H₂O) = ${f(v.m0!, 2, lang)} g; 1-qizdirishdan keyin m₁ = ${f(v.m1!, 2, lang)} g; 2-dan keyin m₂ = ${f(v.m2!, 2, lang)} g`,
    ),
    tr(lang, 'M(CuSO₄·5H₂O) = 250 г/моль, M(CuSO₄) = 160 г/моль, M(H₂O) = 18 г/моль', 'M(CuSO₄·5H₂O) = 250 g/mol, M(CuSO₄) = 160 g/mol, M(H₂O) = 18 g/mol', 'M(CuSO₄·5H₂O) = 250 g/mol, M(CuSO₄) = 160 g/mol, M(H₂O) = 18 g/mol'),
  ],
  solution: (v, lang) => [
    tr(lang, 'По формуле: в 1 моль CuSO₄·5H₂O (250 г) — 5 моль воды (5 · 18 = 90 г)', 'From the formula: 1 mol of CuSO₄·5H₂O (250 g) holds 5 mol of water (5 · 18 = 90 g)', 'Formula bo‘yicha: 1 mol CuSO₄·5H₂O (250 g) da 5 mol suv (5 · 18 = 90 g)'),
    tr(
      lang,
      `После 1-го нагрева ушло m₀ − m₁ = ${f(v.m0!, 2, lang)} − ${f(v.m1!, 2, lang)} = ${f(v.m0! - v.m1!, 2, lang)} г — вода ушла не вся; после 2-го масса почти постоянна`,
      `After the 1st heating m₀ − m₁ = ${f(v.m0!, 2, lang)} − ${f(v.m1!, 2, lang)} = ${f(v.m0! - v.m1!, 2, lang)} g left — not all the water; after the 2nd the mass is almost constant`,
      `1-qizdirishdan keyin m₀ − m₁ = ${f(v.m0!, 2, lang)} − ${f(v.m1!, 2, lang)} = ${f(v.m0! - v.m1!, 2, lang)} g chiqdi — suv to‘liq chiqmadi; 2-dan keyin massa deyarli doimiy`,
    ),
    tr(
      lang,
      `m(H₂O) = m₀ − m₂ = ${f(v.m0!, 2, lang)} − ${f(v.m2!, 2, lang)} = ${f(v.mW!, 2, lang)} г`,
      `m(H₂O) = m₀ − m₂ = ${f(v.m0!, 2, lang)} − ${f(v.m2!, 2, lang)} = ${f(v.mW!, 2, lang)} g`,
      `m(H₂O) = m₀ − m₂ = ${f(v.m0!, 2, lang)} − ${f(v.m2!, 2, lang)} = ${f(v.mW!, 2, lang)} g`,
    ),
    tr(
      lang,
      `w(H₂O) = m(H₂O) / m₀ · 100 % = ${f(v.mW!, 2, lang)} / ${f(v.m0!, 2, lang)} · 100 % = ${f(wRun(v), 1, lang)} % (по формуле: 90 / 250 · 100 % = 36 %)`,
      `w(H₂O) = m(H₂O) / m₀ · 100 % = ${f(v.mW!, 2, lang)} / ${f(v.m0!, 2, lang)} · 100 % = ${f(wRun(v), 1, lang)} % (from the formula: 90 / 250 · 100 % = 36 %)`,
      `w(H₂O) = m(H₂O) / m₀ · 100 % = ${f(v.mW!, 2, lang)} / ${f(v.m0!, 2, lang)} · 100 % = ${f(wRun(v), 1, lang)} % (formula bo‘yicha: 90 / 250 · 100 % = 36 %)`,
    ),
    tr(lang, `Ответ: w(H₂O) ≈ ${f(wRun(v), 0, lang)} %`, `Answer: w(H₂O) ≈ ${f(wRun(v), 0, lang)} %`, `Javob: w(H₂O) ≈ ${f(wRun(v), 0, lang)} %`),
  ],
  compare: [
    {
      label: L('w(H₂O) в купоросе', 'w(H₂O) in blue vitriol', 'kuporosdagi w(H₂O)'),
      unit: '%',
      decimals: 1,
      measured: wRun,
      predicted: () => WATER * 100,
      book: 36,
      tolerancePct: 3,
    },
  ],
  reconcile: L(
    'Опыт даёт 35,5–36 %, а не ровно 36 %, и это честно. Даже после двух нагреваний в порошке может остаться немного воды (до 1 %): последняя молекула воды держится крепче остальных и уходит только выше 200 °C. Весы ±0,01 г в двух взвешиваниях дают до ±0,02 г, то есть около ±0,8 % от 2,5 г. Если пока чашка остывала на воздухе, безводный CuSO₄ впитал влагу, масса m₂ будет больше и доля воды меньше — поэтому остужают в эксикаторе. Если перегреть, CuSO₄ начнёт разлагаться и доля «воды» получится больше 36 %.',
    'The experiment gives 35.5–36 % rather than exactly 36 %, and that is honest. Even after two heatings the powder may keep a little water (up to 1 %): the last water molecule is held more firmly and leaves only above 200 °C. The balance (±0.01 g) over two weighings gives up to ±0.02 g, i.e. about ±0.8 % of 2.5 g. If the anhydrous CuSO₄ soaked up moisture while the dish cooled in the air, m₂ is larger and the water fraction smaller — that is why it cools in a desiccator. If overheated, CuSO₄ starts to decompose and the “water” fraction comes out above 36 %.',
    'Tajriba aniq 36 % emas, 35,5–36 % beradi — bu halol. Ikki marta qizdirilgandan keyin ham kukunda ozgina suv qolishi mumkin (1 % gacha): oxirgi suv molekulasi boshqalardan mahkamroq ushlanadi va faqat 200 °C dan yuqorida chiqadi. Tarozi (±0,01 g) ikki tortishda ±0,02 g gacha, ya’ni 2,5 g ning taxminan ±0,8 % ini beradi. Kosacha havoda soviyotganda suvsiz CuSO₄ namlik yutsa, m₂ kattaroq, suv ulushi kichikroq chiqadi — shuning uchun eksikatorda sovitiladi. Ortiqcha qizdirilsa, CuSO₄ parchalana boshlaydi va «suv» ulushi 36 % dan oshadi.',
  ),
  conclusion: L(
    'Из 2,50 г медного купороса при нагревании ушло около 0,90 г воды: w(H₂O) ≈ 36 %, как по формуле 90 / 250. Синий цвет купороса связан с водой: безводный CuSO₄ белый и снова синеет от капли воды.',
    'About 0.90 g of water left 2.50 g of blue vitriol on heating: w(H₂O) ≈ 36 %, as the formula 90 / 250 gives. The blue colour of vitriol is due to water: anhydrous CuSO₄ is white and turns blue again from a drop of water.',
    '2,50 g mis kuporosi qizdirilganda taxminan 0,90 g suv chiqdi: w(H₂O) ≈ 36 %, 90 / 250 formulasidagidek. Kuporosning ko‘k rangi suv bilan bog‘liq: suvsiz CuSO₄ oq va bir tomchi suvdan yana ko‘karadi.',
  ),
  story: {
    equation: 'CuSO₄·5H₂O → CuSO₄ + 5H₂O↑',
    text: L(
      'В кристалле медного купороса каждый ион Cu²⁺ окружён молекулами воды — они и дают синий цвет. При нагреве молекулы воды получают энергию, отрываются от ионов и улетают паром; кристаллы рассыпаются в белый порошок безводного CuSO₄. Капля воды возвращает молекулы H₂O к ионам меди — порошок снова синеет, и выделяется тепло.',
      'In a blue vitriol crystal each Cu²⁺ ion is surrounded by water molecules — they give the blue colour. On heating, the water molecules gain energy, break away from the ions and leave as steam; the crystals crumble into the white powder of anhydrous CuSO₄. A drop of water brings H₂O molecules back to the copper ions — the powder turns blue again and heat is released.',
      'Mis kuporosi kristalida har bir Cu²⁺ ioni suv molekulalari bilan o‘ralgan — ko‘k rangni ular beradi. Qizdirilganda suv molekulalari energiya olib, ionlardan ajraladi va bug‘ bo‘lib chiqadi; kristallar suvsiz CuSO₄ ning oq kukuniga aylanadi. Bir tomchi suv H₂O molekulalarini mis ionlariga qaytaradi — kukun yana ko‘karadi va issiqlik ajraladi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показало, что из кристаллов уходит вода?', 'What showed that water was leaving the crystals?', 'Kristallardan suv chiqayotganini nima ko‘rsatdi?'),
      options: [
        L('Пар над чашкой, синий цвет сменился белёсым, масса уменьшилась', 'Steam over the dish, the blue turned whitish, the mass decreased', 'Kosacha ustida bug‘, ko‘k rang oqishga aylandi, massa kamaydi'),
        L('Кристаллы расплавились в синюю жидкость', 'The crystals melted into a blue liquid', 'Kristallar ko‘k suyuqlikka eridi'),
        L('Масса увеличилась', 'The mass increased', 'Massa ortdi'),
      ],
      correct: 0,
      why: L('Вода уходит паром, без неё сульфат меди белый, а весы показывают убыль массы — это масса воды.', 'The water leaves as steam, without it copper sulfate is white, and the balance shows a loss of mass — that is the mass of the water.', 'Suv bug‘ bo‘lib chiqadi, usiz mis sulfat oq, tarozi esa massa kamayishini ko‘rsatadi — bu suv massasi.'),
    },
    {
      id: 'type',
      q: L('Зачем чашку нагревали и взвешивали второй раз?', 'Why was the dish heated and weighed a second time?', 'Nima uchun kosacha ikkinchi marta qizdirilib tortildi?'),
      options: [
        L('Проверить, что масса стала постоянной — вода ушла вся', 'To check that the mass became constant — all the water had gone', 'Massa doimiy bo‘lganini — suv to‘liq chiqqanini tekshirish uchun'),
        L('Чтобы порошок снова посинел', 'To make the powder blue again', 'Kukun yana ko‘karishi uchun'),
        L('Чтобы весы прогрелись', 'To warm up the balance', 'Tarozi qizishi uchun'),
      ],
      correct: 0,
      why: L('Это «прокаливание до постоянной массы»: если после повторного нагрева масса почти не изменилась, воды не осталось.', 'This is “heating to constant mass”: if the mass hardly changes after heating again, no water is left.', 'Bu «doimiy massagacha qizdirish»: qayta qizdirishdan keyin massa deyarli o‘zgarmasa, suv qolmagan.'),
    },
    {
      id: 'product',
      q: L('Какой белый порошок остался в чашке?', 'What white powder was left in the dish?', 'Kosachada qanday oq kukun qoldi?'),
      options: [
        L('Безводный сульфат меди CuSO₄', 'Anhydrous copper sulfate CuSO₄', 'Suvsiz mis sulfat CuSO₄'),
        L('Оксид меди(II) CuO', 'Copper(II) oxide CuO', 'Mis(II) oksidi CuO'),
        L('Металлическая медь', 'Metallic copper', 'Metall mis'),
      ],
      correct: 0,
      why: L('Ушла только кристаллизационная вода; капля воды снова даёт синий CuSO₄·5H₂O. CuO был бы чёрным, медь — красной.', 'Only the water of crystallization left; a drop of water gives blue CuSO₄·5H₂O again. CuO would be black, copper red.', 'Faqat kristallizatsiya suvi chiqdi; bir tomchi suv yana ko‘k CuSO₄·5H₂O beradi. CuO qora, mis esa qizil bo‘lardi.'),
    },
  ],
}
