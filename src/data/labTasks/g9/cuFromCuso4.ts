/**
 * Kimyo 9, с. 174, пример 8 (решён в учебнике, ответ — с. 175): медь из раствора сульфата меди(II) и железа.
 * Опыт 1:1 — 40,0 г 20 %-го CuSO₄ отвешивают в стакан на весах, всыпают ~3 г железного порошка (избыток: нужно 2,8 г),
 * перемешивают (ускорено): красно-бурая медь, голубой раствор → бледно-зелёный; избыток железа растворяют
 * соляной кислотой (медь не реагирует), медь — на взвешенный фильтр, промыть, высушить при 80 °C, взвесить.
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

const M_CUSO4 = 160
const M_CU = 64
const M_FE = 56
const W = 0.2

const n = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
const nCuso4 = (v: LabTaskValues) => (v.m1! * W) / M_CUSO4
/** Сколько меди даёт взятый раствор (железо в избытке). */
const cuCalc = (v: LabTaskValues) => nCuso4(v) * M_CU

export const CU_FROM_CUSO4: LabTask = {
  id: 'task-g9-cu-from-cuso4',
  grade: 9,
  page: 174,
  source: L('Kimyo 9 · с. 174, пример 8', 'Kimyo 9 · p. 174, example 8', 'Kimyo 9 · 174-bet, 8-misol'),
  bookKind: 'example',
  title: L('Медь из медного купороса и железа', 'Copper from copper sulfate and iron', 'Mis kuporosi va temirdan mis'),
  statement: L(
    'Сколько граммов меди образуется при полном взаимодействии 40 г 20 %-ного раствора соли сульфата меди(II) с железом?',
    'How many grams of copper form when 40 g of a 20 % solution of copper(II) sulfate reacts completely with iron?',
    '40 g 20 % li mis(II) sulfat tuzi eritmasi temir bilan to‘liq reaksiyaga kirishganda necha gramm mis hosil bo‘ladi?',
  ),
  equation: 'CuSO₄ + Fe → FeSO₄ + Cu',
  kind: 'substitution',
  type: 'stoich-mass',
  difficulty: 2,
  answers: [
    {
      key: 'mCu',
      label: 'm(Cu)',
      what: L('масса выделившейся меди', 'mass of copper formed', 'ajralib chiqqan mis massasi'),
      unit: L('г', 'g', 'g'),
      book: 3.2,
      decimals: 2,
      // медь с весов, пересчитанная на ровно 40 г раствора из условия
      fromRun: (v) => (v.mCu! * 40) / v.m1!,
    },
  ],
  labScale: {
    factor: 1,
    note: L(
      'Опыт — в масштабе задачи: 40 г раствора (около 33 мл) и 3 г железного порошка в стакане на 100 мл.',
      'Same scale as the problem: 40 g of solution (about 33 ml) and 3 g of iron powder in a 100 ml beaker.',
      'Tajriba masala miqyosida: 40 g eritma (taxminan 33 ml) va 3 g temir kukuni 100 ml li stakanda.',
    ),
  },
  instruments: ['scales'],
  equipment: [
    L('Электронные весы (0,01 г)', 'Electronic balance (0.01 g)', 'Elektron tarozi (0,01 g)'),
    L('Химический стакан 100 мл, стеклянная палочка, шпатель', '100 ml beaker, glass rod, spatula', '100 ml li kimyoviy stakan, shisha tayoqcha, shpatel'),
    L('Раствор CuSO₄ (20 %), железный порошок, соляная кислота (10 %)', 'CuSO₄ solution (20 %), iron powder, hydrochloric acid (10 %)', 'CuSO₄ eritmasi (20 %), temir kukuni, xlorid kislota (10 %)'),
    L('Штатив с кольцом, воронка, фильтр, промывалка', 'Ring stand, funnel, filter paper, wash bottle', 'Halqali shtativ, voronka, filtr, yuvgich'),
    L('Сушильный шкаф (80 °C), стаканчик для фильтра', 'Drying oven (80 °C), small beaker for the filter', 'Quritish shkafi (80 °C), filtr uchun kichik stakan'),
  ],
  safety: [
    L('Медный купорос ядовит при проглатывании, соляная кислота едкая: работайте в очках и перчатках.', 'Copper sulfate is poisonous if swallowed and hydrochloric acid is corrosive: wear goggles and gloves.', 'Mis kuporosi yutilsa zaharli, xlorid kislota o‘yuvchi: ko‘zoynak va qo‘lqopda ishlang.'),
    L('Кислоту приливайте понемногу: выделяется водород — рядом не должно быть огня.', 'Add the acid a little at a time: hydrogen is given off — no flames nearby.', 'Kislotani oz-ozdan quying: vodorod ajraladi — yaqinda olov bo‘lmasin.'),
    L('Растворы с медью и железом — в банку для слива, не в раковину.', 'Copper and iron solutions go into the waste jar, not the sink.', 'Mis va temirli eritmalar — chiqindi bankasiga, rakovinaga emas.'),
  ],
  gear: ['goggles', 'gloves'],
  place: 'bench',
  steps: [
    {
      id: 'gear',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте очки и перчатки.', 'Put on goggles and gloves.', 'Ko‘zoynak va qo‘lqop kiying.'),
      observation: L('Очки и перчатки надеты — можно работать с купоросом и кислотой.', 'Goggles and gloves on — you can work with the copper sulfate and acid.', 'Ko‘zoynak va qo‘lqop kiyildi — kuporos va kislota bilan ishlash mumkin.'),
      how: L('Нажмите на поднос со средствами защиты.', 'Tap the tray with the protective gear.', 'Himoya vositalari turgan patnisni bosing.'),
      teacher: L('Ионы Cu²⁺ ядовиты, а соляная кислота разъедает кожу — поэтому перчатки нужны до первой склянки.', 'Cu²⁺ ions are poisonous and hydrochloric acid eats into skin — so gloves go on before the first bottle.', 'Cu²⁺ ionlari zaharli, xlorid kislota esa terini yemiradi — shuning uchun qo‘lqop birinchi shishadan oldin kiyiladi.'),
    },
    {
      id: 'filter',
      target: 'filter',
      gesture: { kind: 'drag', from: [0.12, 0.01, 0.17], to: [-0.22, 0.06, 0.05], lead: 0.6 },
      seconds: 2.6,
      instruction: L('Положите сухой фильтр на весы.', 'Put the dry filter paper on the balance.', 'Quruq filtrni taroziga qo‘ying.'),
      observation: L('Весы показывают массу сухого фильтра — меньше 1 г.', 'The balance shows the dry filter — under 1 g.', 'Tarozi quruq filtr massasini ko‘rsatadi — 1 g dan kam.'),
      how: L('Перетащите фильтр на чашу весов.', 'Drag the filter onto the pan.', 'Filtrni tarozi pallasiga torting.'),
      teacher: L('Медь потом будем взвешивать вместе с фильтром, поэтому массу пустого фильтра узнаём заранее.', 'The copper will be weighed together with the filter, so we find the empty filter’s mass first.', 'Mis keyin filtr bilan birga tortiladi, shuning uchun bo‘sh filtr massasini oldindan bilib olamiz.'),
    },
    {
      id: 'beaker',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.42, 0.04, -0.06], to: [-0.22, 0.1, 0.05], lead: 0.6 },
      seconds: 2.8,
      instruction: L('Уберите фильтр и поставьте на весы сухой стакан на 100 мл.', 'Remove the filter and put a dry 100 ml beaker on the balance.', 'Filtrni oling va taroziga quruq 100 ml li stakanni qo‘ying.'),
      observation: L('Весы показывают массу пустого стакана — около 52 г.', 'The balance shows the empty beaker — about 52 g.', 'Tarozi bo‘sh stakan massasini ko‘rsatadi — taxminan 52 g.'),
      how: L('Перетащите стакан на чашу весов.', 'Drag the beaker onto the pan.', 'Stakanni tarozi pallasiga torting.'),
      teacher: L('В задаче дана масса раствора — её и отвешиваем прямо в стакан, где пойдёт реакция.', 'The problem gives the mass of solution — we weigh it straight into the beaker where the reaction will run.', 'Masalada eritma massasi berilgan — uni reaksiya boradigan stakanga to‘g‘ridan-to‘g‘ri tortamiz.'),
    },
    {
      id: 'tare',
      target: 'tare',
      gesture: { kind: 'tap' },
      seconds: 1.4,
      instruction: L('Нажмите «T» — обнулите весы.', 'Press “T” to zero the balance.', '«T» ni bosib, tarozini nolga keltiring.'),
      observation: L('На дисплее 0.00 g и «→0←»: масса стакана вычтена.', 'The display reads 0.00 g with “→0←”: the beaker is subtracted.', 'Displeyda 0.00 g va «→0←»: stakan massasi ayirildi.'),
      how: L('Нажмите кнопку «T» на передней панели весов.', 'Tap the “T” button on the front of the balance.', 'Tarozi old panelidagi «T» tugmasini bosing.'),
      teacher: L('Тара вычитает стакан: дальше дисплей покажет массу того, что в нём.', 'Tare subtracts the beaker: from now on the display shows what is inside it.', 'Tara stakanni ayiradi: endi displey uning ichidagi narsa massasini ko‘rsatadi.'),
      mistake: L('Без тары к массе раствора прибавится масса стакана (~52 г).', 'Without tare the beaker (~52 g) adds to the solution mass.', 'Tarasiz eritma massasiga stakan massasi (~52 g) qo‘shiladi.'),
    },
    {
      id: 'cuso4',
      target: 'bottle-cuso4',
      gesture: { kind: 'drag', from: [-0.5, 0.06, 0.17], to: [-0.25, 0.18, 0.05], lead: 0.42 },
      seconds: 4.4,
      instruction: L('Налейте в стакан 40,0 г 20 %-ного раствора сульфата меди(II).', 'Pour 40.0 g of 20 % copper(II) sulfate solution into the beaker.', 'Stakanga 40,0 g 20 % li mis(II) sulfat eritmasini quying.'),
      observation: L('Ярко-голубой прозрачный раствор (около 33 мл); дисплей останавливается около 40,0 г.', 'A bright blue clear solution (about 33 ml); the display stops near 40.0 g.', 'Yorqin havorang tiniq eritma (taxminan 33 ml); displey 40,0 g atrofida to‘xtaydi.'),
      how: L('Перетащите склянку CuSO₄ к стакану на весах и наклоните; у отметки — по каплям.', 'Drag the CuSO₄ bottle to the beaker on the balance and tilt it; near the mark — drop by drop.', 'CuSO₄ shishasini tarozidagi stakanga torting va engashtiring; belgiga yaqin — tomchilab.'),
      teacher: L('Голубой цвет дают ионы Cu²⁺, окружённые молекулами воды; в 40 г 20 %-ного раствора их 8 г соли.', 'The blue colour comes from Cu²⁺ ions surrounded by water molecules; 40 g of 20 % solution holds 8 g of the salt.', 'Havorang rangni suv molekulalari bilan o‘ralgan Cu²⁺ ionlari beradi; 40 g 20 % li eritmada 8 g tuz bor.'),
      mistake: L('Лить широкой струёй до самой отметки — легко перелить.', 'Pouring a wide stream right up to the mark — easy to overshoot.', 'Belgigacha keng oqim bilan quyish — oshirib yuborish oson.'),
    },
    {
      id: 'iron',
      target: 'spatula',
      gesture: { kind: 'swipe', from: [-0.56, 0.01, 0.0], to: [-0.23, 0.16, 0.05], lead: 0.3 },
      seconds: 5.5,
      instruction: L('Всыпьте шпателем около 3 г железного порошка — с небольшим избытком.', 'Add about 3 g of iron powder with the spatula — a slight excess.', 'Shpatel bilan taxminan 3 g temir kukunini soling — ozgina ortig‘i bilan.'),
      observation: L('Серый порошок оседает на дно; на крупинках сразу появляется красноватый налёт. Дисплей вырос примерно на 3 г.', 'The grey powder sinks; a reddish coating appears on the grains at once. The display has grown by about 3 g.', 'Kulrang kukun tubiga cho‘kadi; donachalarda darhol qizg‘ish qatlam paydo bo‘ladi. Displey taxminan 3 g ga oshdi.'),
      how: L('Проведите шпателем от банки к стакану.', 'Swipe the spatula from the jar to the beaker.', 'Shpatelni bankadan stakanga suring.'),
      teacher: L(
        'Чтобы вся медь вышла из раствора, железа берут больше, чем нужно по уравнению (2,8 г на 8 г CuSO₄). Сколько точно — не важно: лишнее потом растворим.',
        'To get all the copper out of solution, more iron is taken than the equation needs (2.8 g for 8 g of CuSO₄). The exact amount does not matter: the extra will be dissolved later.',
        'Barcha mis eritmadan chiqishi uchun temir tenglamadagidan ko‘proq olinadi (8 g CuSO₄ ga 2,8 g). Aniq qanchaligi muhim emas: ortig‘ini keyin eritamiz.',
      ),
      mistake: L('Взять железа меньше 2,8 г — часть меди останется в растворе, раствор будет голубоватым.', 'Taking less than 2.8 g of iron — some copper stays in solution and it remains bluish.', '2,8 g dan kam temir olish — misning bir qismi eritmada qoladi, eritma havorangligicha qoladi.'),
    },
    {
      id: 'stir',
      target: 'stir-rod',
      gesture: { kind: 'swipe', from: [-0.25, 0.01, -0.21], to: [-0.22, 0.16, 0.04], lead: 0.3 },
      seconds: 7,
      instruction: L('Перемешивайте палочкой, пока раствор не перестанет быть голубым (время ускорено: ~10 мин).', 'Stir with the rod until the solution is no longer blue (time sped up: ~10 min).', 'Eritma havorang bo‘lmay qolguncha tayoqcha bilan aralashtiring (vaqt tezlashtirilgan: ~10 daqiqa).'),
      observation: L(
        'На дне — рыхлая красно-бурая медь; голубой раствор побледнел до бледно-зелёного (FeSO₄); стакан чуть тёплый. Масса на весах не изменилась.',
        'Loose red-brown copper lies on the bottom; the blue solution has faded to pale green (FeSO₄); the beaker is slightly warm. The mass on the balance has not changed.',
        'Tubida — g‘ovak qizil-qo‘ng‘ir mis; havorang eritma och yashilga (FeSO₄) aylandi; stakan biroz iliq. Tarozidagi massa o‘zgarmadi.',
      ),
      how: L('Проведите палочкой от стола к стакану — она перемешает смесь.', 'Swipe the rod from the bench to the beaker — it stirs the mixture.', 'Tayoqchani stoldan stakanga suring — u aralashmani aralashtiradi.'),
      teacher: L(
        'Каждый атом железа отдаёт два электрона иону Cu²⁺: железо уходит в раствор ионом Fe²⁺, а медь оседает атомами. Голубые ионы Cu²⁺ кончаются — цвет уходит.',
        'Each iron atom gives two electrons to a Cu²⁺ ion: iron goes into solution as Fe²⁺ and copper settles as atoms. The blue Cu²⁺ ions run out — the colour fades.',
        'Har bir temir atomi Cu²⁺ ioniga ikki elektron beradi: temir eritmaga Fe²⁺ ioni bo‘lib o‘tadi, mis esa atomlar bo‘lib cho‘kadi. Havorang Cu²⁺ ionlari tugaydi — rang yo‘qoladi.',
      ),
      mistake: L('Бросить перемешивать раньше — голубой оттенок значит, что медь ещё в растворе.', 'Stopping too early — a blue tint means copper is still in solution.', 'Aralashtirishni erta to‘xtatish — havorang tus mis hali eritmada ekanini bildiradi.'),
    },
    {
      id: 'acid',
      target: 'bottle-hcl',
      gesture: { kind: 'drag', from: [-0.02, 0.06, 0.17], to: [-0.19, 0.18, 0.05], lead: 0.42 },
      seconds: 5,
      instruction: L('Прилейте около 5 мл 10 %-ной соляной кислоты — растворите лишнее железо.', 'Add about 5 ml of 10 % hydrochloric acid to dissolve the extra iron.', 'Taxminan 5 ml 10 % li xlorid kislota qo‘shing — ortiqcha temirni eriting.'),
      observation: L('У дна бегут пузырьки водорода, серые крупинки железа исчезают; красно-бурая медь остаётся.', 'Hydrogen bubbles rise from the bottom and the grey iron grains vanish; the red-brown copper stays.', 'Tubidan vodorod pufakchalari ko‘tariladi, kulrang temir donachalari yo‘qoladi; qizil-qo‘ng‘ir mis qoladi.'),
      how: L('Перетащите склянку HCl к стакану и наклоните.', 'Drag the HCl bottle to the beaker and tilt it.', 'HCl shishasini stakanga torting va engashtiring.'),
      teacher: L(
        'Железо стоит в ряду активности левее водорода и вытесняет его из кислоты, а медь — правее и с соляной кислотой не реагирует. Так на фильтр попадёт только медь.',
        'Iron stands left of hydrogen in the activity series and displaces it from the acid; copper stands to the right and does not react with hydrochloric acid. So only copper reaches the filter.',
        'Temir faollik qatorida vodoroddan chapda turadi va uni kislotadan siqib chiqaradi, mis esa o‘ngda — xlorid kislota bilan reaksiyaga kirmaydi. Shunda filtrga faqat mis tushadi.',
      ),
      mistake: L('Пропустить кислоту — лишнее железо (~0,2 г) взвесится вместе с медью.', 'Skipping the acid — the extra iron (~0.2 g) gets weighed together with the copper.', 'Kislotani tashlab ketish — ortiqcha temir (~0,2 g) mis bilan birga tortiladi.'),
    },
    {
      id: 'filtrate',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.22, 0.09, 0.05], to: [0.13, 0.3, -0.06], lead: 0.4 },
      seconds: 6.5,
      instruction: L('Отфильтруйте медь и промойте её на фильтре дистиллированной водой.', 'Filter off the copper and wash it on the filter with distilled water.', 'Misni filtrlang va filtrda distillangan suv bilan yuving.'),
      observation: L('Бледно-зелёный фильтрат стекает в стакан, красно-бурая медь остаётся на фильтре.', 'The pale green filtrate runs into the beaker; the red-brown copper stays on the filter.', 'Och yashil filtrat stakanga oqib tushadi, qizil-qo‘ng‘ir mis filtrda qoladi.'),
      how: L('Перетащите стакан с весов к воронке и наклоните.', 'Drag the beaker from the balance to the funnel and tilt it.', 'Stakanni tarozidan voronkaga torting va engashtiring.'),
      teacher: L('Промывание уносит с меди раствор FeSO₄ и FeCl₂ — иначе после сушки соли прибавят массу.', 'Washing carries the FeSO₄ and FeCl₂ solution off the copper — otherwise the dried salts would add mass.', 'Yuvish misdan FeSO₄ va FeCl₂ eritmasini olib ketadi — aks holda quritilgandan keyin tuzlar massa qo‘shadi.'),
      mistake: L('Оставить медь на стенках стакана — её смывают на фильтр струёй из промывалки.', 'Leaving copper on the beaker walls — rinse it onto the filter with the wash bottle.', 'Misni stakan devorlarida qoldirish — uni yuvgich oqimi bilan filtrga yuvib tushiriladi.'),
    },
    {
      id: 'dry',
      target: 'oven',
      gesture: { kind: 'tap' },
      seconds: 3.4,
      instruction: L('Высушите фильтр с медью в сушильном шкафу при 80 °C.', 'Dry the filter with the copper in the drying oven at 80 °C.', 'Misli filtrni quritish shkafida 80 °C da quriting.'),
      observation: L('Фильтр сохнет (время ускорено: 60 мин); медь — сухой красно-бурый порошок.', 'The filter dries (time sped up: 60 min); the copper is a dry red-brown powder.', 'Filtr quriydi (vaqt tezlashtirilgan: 60 daqiqa); mis — quruq qizil-qo‘ng‘ir kukun.'),
      how: L('Нажмите на сушильный шкаф.', 'Tap the drying oven.', 'Quritish shkafini bosing.'),
      teacher: L('Сушат при невысокой температуре: горячая влажная медь на воздухе темнеет — покрывается оксидом, и масса растёт.', 'Dry at a moderate temperature: hot, damp copper darkens in air — it gains an oxide film and its mass grows.', 'Past haroratda quritiladi: issiq nam mis havoda qorayadi — oksid bilan qoplanadi va massasi ortadi.'),
      mistake: L('Сушить на плитке докрасна — медь почернеет (CuO), и масса будет больше.', 'Drying on a hot plate until red-hot — the copper turns black (CuO) and weighs more.', 'Plitkada qizdirib quritish — mis qorayadi (CuO), massasi ko‘proq chiqadi.'),
    },
    {
      id: 'weigh',
      target: 'filter',
      gesture: { kind: 'drag', from: [0.45, 0.11, -0.1], to: [-0.2, 0.06, 0.05], lead: 0.6 },
      seconds: 3.2,
      instruction: L('Обнулите пустые весы «T» и положите остывший фильтр с медью на чашу.', 'Zero the empty balance with “T” and put the cooled filter with the copper on the pan.', 'Bo‘sh tarozini «T» bilan nolga keltiring va sovigan misli filtrni pallaga qo‘ying.'),
      observation: L('Весы показывают массу фильтра с медью — около 4 г.', 'The balance shows the filter with the copper — about 4 g.', 'Tarozi misli filtr massasini ko‘rsatadi — taxminan 4 g.'),
      how: L('Перетащите фильтр из шкафа на весы.', 'Drag the filter from the oven to the balance.', 'Filtrni shkafdan taroziga torting.'),
      teacher: L('Масса меди — разность: фильтр с медью минус сухой фильтр.', 'The copper mass is the difference: filter with copper minus dry filter.', 'Mis massasi — farq: misli filtr minus quruq filtr.'),
    },
  ],
  focus: [
    { from: 1.62, to: 1.99, point: [-0.22, 0.03, 0.17], dist: 0.26 },
    { from: 4.62, to: 4.99, point: [-0.22, 0.05, 0.14], dist: 0.3 },
    { from: 5.62, to: 5.99, point: [-0.22, 0.05, 0.12], dist: 0.3 },
    { from: 6.3, to: 6.98, point: [-0.22, 0.07, 0.05], dist: 0.3 },
    { from: 7.46, to: 7.98, point: [-0.22, 0.07, 0.05], dist: 0.3 },
    { from: 8.36, to: 8.68, point: [0.13, 0.2, -0.13], dist: 0.36 },
    { from: 10.62, to: 10.99, point: [-0.22, 0.03, 0.17], dist: 0.26 },
  ],
  labels: [
    { at: 5.7, pos: [-0.22, 0.17, 0.05], text: L('на железе — красный налёт меди', 'a red copper coating on the iron', 'temirda — misning qizil qatlami') },
    { at: 6.9, pos: [-0.22, 0.17, 0.05], text: L('голубой → бледно-зелёный: Cu²⁺ → Fe²⁺', 'blue → pale green: Cu²⁺ → Fe²⁺', 'havorang → och yashil: Cu²⁺ → Fe²⁺') },
    { at: 7.8, pos: [-0.22, 0.17, 0.05], text: L('пузырьки H₂ — растворяется лишнее железо', 'H₂ bubbles — the extra iron dissolves', 'H₂ pufakchalari — ortiqcha temir eriydi') },
    { at: 8.55, pos: [0.22, 0.18, -0.13], text: L('медь на фильтре', 'copper on the filter', 'mis filtrda') },
  ],
  measurements: [
    { key: 'mF', label: 'm₀', what: L('масса сухого фильтра', 'mass of the dry filter', 'quruq filtr massasi'), instrument: 'scales', afterStep: 1 },
    { key: 'm1', label: 'm₁', what: L('масса 20 %-ного раствора CuSO₄', 'mass of the 20 % CuSO₄ solution', '20 % li CuSO₄ eritmasi massasi'), instrument: 'scales', afterStep: 4 },
    { key: 'm2', label: 'm₂', what: L('раствор + железный порошок', 'solution + iron powder', 'eritma + temir kukuni'), instrument: 'scales', afterStep: 5 },
    { key: 'mFe', label: 'm(Fe)', what: L('масса железа m₂ − m₁', 'iron mass m₂ − m₁', 'temir massasi m₂ − m₁'), instrument: 'scales', afterStep: 5, derived: true },
    { key: 'mFP', label: 'm₃', what: L('масса фильтра с сухой медью', 'mass of the filter with the dry copper', 'quruq misli filtr massasi'), instrument: 'scales', afterStep: 10 },
    { key: 'mCu', label: 'm(Cu)', what: L('масса меди m₃ − m₀', 'copper mass m₃ − m₀', 'mis massasi m₃ − m₀'), instrument: 'scales', afterStep: 10, derived: true },
  ],
  simulate: (rng) => {
    const mF = rng.read('scales', rng.between(0.8, 0.9))
    const m1 = rng.weigh(40, 0.06)
    // железо — «около 3 г» шпателем: на 0,1–0,35 г больше нужных 2,8 г
    const m2 = rng.read('scales', m1 + rng.between(2.92, 3.15))
    const mFe = Math.round((m2 - m1) * 100) / 100
    // потери: мелкая медь проходит фильтр и остаётся на стекле; плёнка оксида при сушке чуть прибавляет
    const mTrue = ((m1 * W) / M_CUSO4) * M_CU * rng.between(0.985, 1.005)
    const mFP = rng.read('scales', mF + mTrue)
    return { mF, m1, m2, mFe, mFP, mCu: Math.round((mFP - mF) * 100) / 100 }
  },
  given: (v, lang) => [
    tr(lang, `m₁ = ${n(v.m1!, 2, lang)} г — 20 %-ный раствор CuSO₄`, `m₁ = ${n(v.m1!, 2, lang)} g — 20 % CuSO₄ solution`, `m₁ = ${n(v.m1!, 2, lang)} g — 20 % li CuSO₄ eritmasi`),
    tr(lang, `m(Fe) = ${n(v.m2!, 2, lang)} − ${n(v.m1!, 2, lang)} = ${n(v.mFe!, 2, lang)} г (железный порошок)`, `m(Fe) = ${n(v.m2!, 2, lang)} − ${n(v.m1!, 2, lang)} = ${n(v.mFe!, 2, lang)} g (iron powder)`, `m(Fe) = ${n(v.m2!, 2, lang)} − ${n(v.m1!, 2, lang)} = ${n(v.mFe!, 2, lang)} g (temir kukuni)`),
    tr(
      lang,
      `m₀ = ${n(v.mF!, 2, lang)} г (фильтр), m₃ = ${n(v.mFP!, 2, lang)} г (фильтр + медь) → m(Cu) = ${n(v.mCu!, 2, lang)} г`,
      `m₀ = ${n(v.mF!, 2, lang)} g (filter), m₃ = ${n(v.mFP!, 2, lang)} g (filter + copper) → m(Cu) = ${n(v.mCu!, 2, lang)} g`,
      `m₀ = ${n(v.mF!, 2, lang)} g (filtr), m₃ = ${n(v.mFP!, 2, lang)} g (filtr + mis) → m(Cu) = ${n(v.mCu!, 2, lang)} g`,
    ),
    'M(CuSO₄) = 160, M(Fe) = 56, M(Cu) = 64 ' + tr(lang, 'г/моль', 'g/mol', 'g/mol'),
    tr(lang, 'Найти: m(Cu) — ?', 'Find: m(Cu) = ?', 'Topish kerak: m(Cu) — ?'),
  ],
  solution: (v, lang) => {
    const ms = v.m1! * W
    const nc = nCuso4(v)
    const nf = v.mFe! / M_FE
    const cu = cuCalc(v)
    return [
      tr(lang, `1) m(CuSO₄) = ${n(v.m1!, 2, lang)} · 0,2 = ${n(ms, 3, lang)} г; n(CuSO₄) = ${n(ms, 3, lang)} / 160 = ${n(nc, 4, lang)} моль`, `1) m(CuSO₄) = ${n(v.m1!, 2, lang)} · 0.2 = ${n(ms, 3, lang)} g; n(CuSO₄) = ${n(ms, 3, lang)} / 160 = ${n(nc, 4, lang)} mol`, `1) m(CuSO₄) = ${n(v.m1!, 2, lang)} · 0,2 = ${n(ms, 3, lang)} g; n(CuSO₄) = ${n(ms, 3, lang)} / 160 = ${n(nc, 4, lang)} mol`),
      tr(lang, `2) n(Fe) = ${n(v.mFe!, 2, lang)} / 56 = ${n(nf, 4, lang)} моль > ${n(nc, 4, lang)} — железо в избытке, считаем по CuSO₄`, `2) n(Fe) = ${n(v.mFe!, 2, lang)} / 56 = ${n(nf, 4, lang)} mol > ${n(nc, 4, lang)} — iron is in excess, so use CuSO₄`, `2) n(Fe) = ${n(v.mFe!, 2, lang)} / 56 = ${n(nf, 4, lang)} mol > ${n(nc, 4, lang)} — temir ortiqcha, CuSO₄ bo‘yicha hisoblaymiz`),
      tr(lang, `3) CuSO₄ + Fe → FeSO₄ + Cu: n(Cu) = n(CuSO₄) = ${n(nc, 4, lang)} моль; m(Cu) = ${n(nc, 4, lang)} · 64 = ${n(cu, 2, lang)} г`, `3) CuSO₄ + Fe → FeSO₄ + Cu: n(Cu) = n(CuSO₄) = ${n(nc, 4, lang)} mol; m(Cu) = ${n(nc, 4, lang)} · 64 = ${n(cu, 2, lang)} g`, `3) CuSO₄ + Fe → FeSO₄ + Cu: n(Cu) = n(CuSO₄) = ${n(nc, 4, lang)} mol; m(Cu) = ${n(nc, 4, lang)} · 64 = ${n(cu, 2, lang)} g`),
      tr(lang, `4) Опыт: m(Cu) = ${n(v.mFP!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mCu!, 2, lang)} г — это ${n((v.mCu! / cu) * 100, 1, lang)} % от расчёта`, `4) Experiment: m(Cu) = ${n(v.mFP!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mCu!, 2, lang)} g — ${n((v.mCu! / cu) * 100, 1, lang)} % of the calculation`, `4) Tajriba: m(Cu) = ${n(v.mFP!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mCu!, 2, lang)} g — hisobning ${n((v.mCu! / cu) * 100, 1, lang)} % i`),
      tr(lang, `Ответ: m(Cu) ≈ ${n(cu, 2, lang)} г`, `Answer: m(Cu) ≈ ${n(cu, 2, lang)} g`, `Javob: m(Cu) ≈ ${n(cu, 2, lang)} g`),
    ]
  },
  compare: [
    {
      label: L('масса меди', 'mass of copper', 'mis massasi'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mCu!,
      predicted: (v) => cuCalc(v),
      book: 3.2,
      tolerancePct: 3,
    },
  ],
  reconcile: L(
    'Меди на весах обычно на 0–1,5 % меньше расчёта: мельчайшая медная «губка» проходит сквозь фильтр и остаётся на стенках стакана и палочке. Чуть больше расчёта выходит, если медь при сушке потемнела (плёнка оксида) или плохо промыта. А без соляной кислоты к меди прибавилось бы лишнее железо — около 0,2 г, это уже 6 %. Весы ±0,01 г — на 3,2 г всего ±0,3 %.',
    'The balance usually shows 0–1.5 % less copper than calculated: the finest copper “sponge” passes through the filter and stays on the beaker walls and rod. It comes out slightly more if the copper darkened while drying (oxide film) or was poorly washed. Without the hydrochloric acid the extra iron — about 0.2 g, already 6 % — would be added to the copper. The balance gives ±0.01 g — only ±0.3 % of 3.2 g.',
    'Tarozida mis odatda hisobdan 0–1,5 % kam chiqadi: eng mayda mis «g‘ovagi» filtrdan o‘tib ketadi va stakan devorlari hamda tayoqchada qoladi. Quritishda mis qoraygan (oksid parda) yoki yomon yuvilgan bo‘lsa, biroz ko‘p chiqadi. Xlorid kislotasiz misga ortiqcha temir — taxminan 0,2 g, bu 6 % — qo‘shilardi. Tarozi ±0,01 g — 3,2 g da bor-yo‘g‘i ±0,3 %.',
  ),
  conclusion: L(
    'В 40 г 20 %-ного раствора 8 г CuSO₄ (0,05 моль); железо вытесняет из него 0,05 моль меди — 3,2 г. Голубой раствор становится бледно-зелёным: ионы Cu²⁺ заменились ионами Fe²⁺.',
    '40 g of 20 % solution contain 8 g of CuSO₄ (0.05 mol); iron displaces 0.05 mol of copper from it — 3.2 g. The blue solution turns pale green: Cu²⁺ ions have been replaced by Fe²⁺.',
    '40 g 20 % li eritmada 8 g CuSO₄ (0,05 mol) bor; temir undan 0,05 mol misni siqib chiqaradi — 3,2 g. Havorang eritma och yashilga aylanadi: Cu²⁺ ionlari o‘rnini Fe²⁺ ionlari egalladi.',
  ),
  story: {
    equation: 'Fe + Cu²⁺ → Fe²⁺ + Cu',
    text: L(
      'Атом железа на поверхности крупинки отдаёт два электрона иону Cu²⁺, который подошёл к нему из раствора: железо становится ионом Fe²⁺ и уходит в воду, а медь оседает атомом на месте железа — так крупинки обрастают красной медью. Ионы SO₄²⁻ не участвуют: раствор FeSO₄ бледно-зелёный.',
      'An iron atom on the surface of a grain gives two electrons to a Cu²⁺ ion that has come up from the solution: iron becomes an Fe²⁺ ion and goes into the water, while copper settles as an atom in its place — that is how the grains get coated with red copper. SO₄²⁻ ions take no part: the FeSO₄ solution is pale green.',
      'Donacha sirtidagi temir atomi eritmadan kelgan Cu²⁺ ioniga ikki elektron beradi: temir Fe²⁺ ioniga aylanib suvga o‘tadi, mis esa uning o‘rniga atom bo‘lib o‘tiradi — donachalar shunday qizil mis bilan qoplanadi. SO₄²⁻ ionlari qatnashmaydi: FeSO₄ eritmasi och yashil.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что наблюдали, когда железо перемешивали в растворе CuSO₄?', 'What did you see while stirring the iron in the CuSO₄ solution?', 'Temirni CuSO₄ eritmasida aralashtirganda nimani kuzatdingiz?'),
      options: [
        L('Красно-бурый осадок меди, раствор из голубого стал бледно-зелёным', 'A red-brown copper deposit; the solution went from blue to pale green', 'Qizil-qo‘ng‘ir mis cho‘kmasi, eritma havorangdan och yashilga aylandi'),
        L('Белый осадок и запах газа', 'A white precipitate and a smell of gas', 'Oq cho‘kma va gaz hidi'),
        L('Раствор стал тёмно-синим, железо не изменилось', 'The solution turned dark blue; the iron did not change', 'Eritma to‘q ko‘k bo‘ldi, temir o‘zgarmadi'),
      ],
      correct: 0,
      why: L('Медь выделяется на железе красным налётом, а голубые ионы Cu²⁺ заменяются бледно-зелёными Fe²⁺.', 'Copper deposits on the iron as a red coating, and the blue Cu²⁺ ions are replaced by pale green Fe²⁺.', 'Mis temirda qizil qatlam bo‘lib ajraladi, havorang Cu²⁺ ionlari esa och yashil Fe²⁺ bilan almashadi.'),
    },
    {
      id: 'type',
      q: L('К какому типу относится реакция CuSO₄ + Fe?', 'What type of reaction is CuSO₄ + Fe?', 'CuSO₄ + Fe reaksiyasi qaysi turga kiradi?'),
      options: [
        L('Замещение: более активное железо вытесняет медь из соли', 'Substitution: the more active iron displaces copper from the salt', 'O‘rin olish: faolroq temir misni tuzdan siqib chiqaradi'),
        L('Обмен', 'Exchange', 'Almashinish'),
        L('Разложение', 'Decomposition', 'Parchalanish'),
      ],
      correct: 0,
      why: L('Простое вещество (Fe) занимает место атомов другого элемента (Cu) в сложном веществе; железо в ряду активности левее меди.', 'A simple substance (Fe) takes the place of another element’s atoms (Cu) in a compound; iron stands left of copper in the activity series.', 'Oddiy modda (Fe) murakkab moddadagi boshqa element (Cu) atomlari o‘rnini egallaydi; temir faollik qatorida misdan chapda.'),
    },
    {
      id: 'product',
      q: L('Что осталось на фильтре после обработки соляной кислотой?', 'What stayed on the filter after the hydrochloric acid treatment?', 'Xlorid kislota bilan ishlangandan keyin filtrda nima qoldi?'),
      options: [
        L('Чистая медь: лишнее железо растворилось, медь с HCl не реагирует', 'Pure copper: the extra iron dissolved and copper does not react with HCl', 'Toza mis: ortiqcha temir eridi, mis HCl bilan reaksiyaga kirmaydi'),
        L('Смесь меди и железа', 'A mixture of copper and iron', 'Mis va temir aralashmasi'),
        L('Сульфат железа(II)', 'Iron(II) sulfate', 'Temir(II) sulfat'),
      ],
      correct: 0,
      why: L('Fe + 2HCl → FeCl₂ + H₂↑ — железо ушло в раствор, а медь стоит в ряду активности после водорода и осталась.', 'Fe + 2HCl → FeCl₂ + H₂↑ — the iron went into solution, while copper stands after hydrogen in the activity series and stayed.', 'Fe + 2HCl → FeCl₂ + H₂↑ — temir eritmaga o‘tdi, mis esa faollik qatorida vodoroddan keyin turadi va qoldi.'),
    },
  ],
  sideEquations: ['Fe + 2HCl → FeCl₂ + H₂↑'],
}
