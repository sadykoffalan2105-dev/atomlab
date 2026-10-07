/**
 * Kimyo 7, с. 118, задание 2: максимальный объём водорода (н.у.) из 0,39 кг цинка в аппарате Киппа.
 * Опыт в 1000 раз меньше: 0,39 г цинка + ≈ 10 мл 10 %-й HCl (избыток) в пробирке с газоотводной трубкой — маленький
 * «аппарат Киппа». Водород собирают над водой в перевёрнутый цилиндр 250 мл, стоящий в высокой банке (в ней можно
 * выровнять уровни воды), читают объём и температуру, приводят к н.у. и пересчитывают на 0,39 кг.
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { P0_KPA, gasMlAt, gasNormalMl, toNormalMl, waterVaporKPa } from '../../../components/lab3d/measure/quantities'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

type V3 = readonly [number, number, number]

/** Раскладка установки (локальные координаты рабочего места, м; верх стола y = 0) — общая для данных и 3D. */
export const KP = {
  ppe: [0.53, 0, 0.12] as V3,
  scales: [-0.46, 0, 0.1] as V3,
  jar: [-0.58, 0, -0.08] as V3,
  spatula: [-0.43, 0, 0.255] as V3,
  /** Низ пробирки, зажатой в лапке штатива (над плитой штатива). */
  tube: [-0.2, 0.03, -0.04] as V3,
  bottle: [-0.05, 0, 0.17] as V3,
  stopper: [-0.09, 0, -0.2] as V3,
  /** Высокая банка с водой (центр дна) и перевёрнутым цилиндром 250 мл. */
  bath: [0.17, 0, -0.06] as V3,
  thermometer: [0.25, 0, 0.24] as V3,
  /** Термометр в банке: низ шарика относительно центра дна банки; наклон к краю (рад). */
  thermoIn: [0.03, 0.006, 0.03] as V3,
  thermoLean: 0.038,
}
/** Центр чаши весов (весы: чаша — y 0,047, на 12 мм ближе к стене). */
export const KP_PAN: V3 = [KP.scales[0], 0.047, KP.scales[2] - 0.012]
/** Верх пробирки (Ø 18 × 150 мм). */
export const KP_TUBE_TOP = KP.tube[1] + 0.15
/** Устье перевёрнутого цилиндра в начале опыта и верх цилиндра (над дном банки). */
export const KP_CYL_TOP = 0.145 + 0.255

const SCALE = 1000
const f = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
/** Ответ из своих измерений: объём при н.у. на 390 г цинка (во сколько раз больше взятой навески). */
const answerL = (v: LabTaskValues) => (v.V0! * 390) / v.mZn! / 1000

export const TASK_G7_KIPP_H2: LabTask = {
  id: 'task-g7-kipp-h2',
  grade: 7,
  page: 118,
  source: L('Kimyo 7 · с. 118, задание 2', 'Kimyo 7 · p. 118, exercise 2', 'Kimyo 7 · 118-bet, 2-topshiriq'),
  bookKind: 'task',
  title: L('Водород в аппарате Киппа: сколько литров даст цинк', 'Hydrogen in a Kipp apparatus: how many litres the zinc gives', 'Kipp apparatida vodorod: rux necha litr beradi'),
  statement: L(
    'Определить максимальный объем (н.у.) водорода, образовавшегося в аппарате Киппа при загрузке цинка массой 0,39 кг.',
    'Determine the maximum volume (STP) of hydrogen formed in a Kipp apparatus loaded with 0.39 kg of zinc.',
    'Kipp apparatiga 0,39 kg massali rux solinganda hosil bo‘ladigan vodorodning eng ko‘p hajmini (n.sh.) aniqlang.',
  ),
  equation: 'Zn + 2HCl → ZnCl₂ + H₂↑',
  kind: 'substitution',
  type: 'stoich-gas',
  difficulty: 2,
  answers: [
    {
      key: 'VH2',
      label: 'V(H₂)',
      what: L('объём водорода (н.у.) из 0,39 кг цинка', 'volume of hydrogen (STP) from 0.39 kg of zinc', '0,39 kg ruxdan vodorod hajmi (n.sh.)'),
      unit: L('л', 'l', 'l'),
      book: 134.4,
      decimals: 1,
      fromRun: answerL,
      // «опыт в 1000 раз меньше — ×1000»: V₀ в мл · 1000 / 1000 = V₀ в литрах
      altFromRun: (v) => v.V0!,
    },
  ],
  labScale: {
    factor: SCALE,
    note: L(
      'В аппарате Киппа 0,39 кг цинка — это 134 л водорода, больше пяти вёдер. Берём цинка в 1000 раз меньше: 0,39 г дадут около 0,14 л газа, а ответ умножаем на 1000 (точнее — во столько раз, во сколько 390 г больше вашей навески).',
      'A Kipp apparatus with 0.39 kg of zinc gives 134 l of hydrogen — more than five buckets. We take 1000 times less zinc: 0.39 g gives about 0.14 l of gas, and the answer is multiplied by 1000 (more exactly, by how many times 390 g exceeds your sample).',
      'Kipp apparatida 0,39 kg rux — bu 134 l vodorod, beshta chelakdan ko‘p. Ruxni 1000 marta kam olamiz: 0,39 g taxminan 0,14 l gaz beradi, javobni 1000 ga ko‘paytiramiz (aniqrog‘i — 390 g sizning tortmangizdan necha marta ko‘p bo‘lsa, shuncha marta).',
    ),
  },
  instruments: ['scales', 'gas250', 'thermometer'],
  equipment: [
    L('Электронные весы (0,01 г), лодочка, шпатель, гранулированный цинк', 'Electronic balance (0.01 g), weighing boat, spatula, granulated zinc', 'Elektron tarozi (0,01 g), qayiqcha, shpatel, donador rux'),
    L('Пробирка в лапке штатива, пробка с газоотводной трубкой, резиновый шланг', 'Test tube in a stand clamp, stopper with a delivery tube, rubber hose', 'Shtativ qisqichidagi probirka, gaz o‘tkazgich nayli tiqin, rezina shlang'),
    L('Соляная кислота 10 %', '10 % hydrochloric acid', '10 % li xlorid kislota'),
    L('Высокая банка с водой, перевёрнутый мерный цилиндр 250 мл в лапке, термометр', 'Tall jar of water, inverted 250 ml measuring cylinder in a clamp, thermometer', 'Suvli baland banka, qisqichdagi to‘ntarilgan 250 ml o‘lchov silindri, termometr'),
  ],
  safety: [
    L('Очки и перчатки: соляная кислота разъедает кожу и глаза.', 'Goggles and gloves: hydrochloric acid harms skin and eyes.', 'Ko‘zoynak va qo‘lqop: xlorid kislota teri va ko‘zni yemiradi.'),
    L('Водород с воздухом образует гремучую смесь: рядом не должно быть огня; после опыта газ выпускают в вытяжку.', 'Hydrogen and air form an explosive mixture: no flames nearby; release the gas into the fume hood afterwards.', 'Vodorod havo bilan qaldiroq aralashma hosil qiladi: yaqinda olov bo‘lmasin; tajribadan so‘ng gazni mo‘rili shkafga chiqaring.'),
    L('Кислоту наливают по стенке пробирки, не наклоняясь над ней.', 'Pour the acid down the wall of the tube without leaning over it.', 'Kislotani probirka devori bo‘ylab, ustiga engashmasdan quying.'),
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
      observation: L('Глаза и руки защищены — работаем с соляной кислотой.', 'Eyes and hands are protected — we are working with hydrochloric acid.', 'Ko‘z va qo‘llar himoyalangan — xlorid kislota bilan ishlaymiz.'),
      how: L('Нажмите на поднос со средствами защиты.', 'Tap the tray with the protective gear.', 'Himoya vositalari turgan patnisni bosing.'),
      teacher: L(
        'Пузырьки газа лопаются и разбрызгивают мельчайшие капли кислоты — поэтому очки надевают до того, как открыть склянку.',
        'Gas bubbles burst and spray tiny droplets of acid — that is why goggles go on before the bottle is opened.',
        'Gaz pufakchalari yorilib, kislotaning mayda tomchilarini sachratadi — shuning uchun ko‘zoynak shisha ochilishidan oldin taqiladi.',
      ),
    },
    {
      id: 'weigh',
      target: 'spatula',
      gesture: { kind: 'drag', from: [KP.spatula[0] + 0.04, 0.01, KP.spatula[2]], to: [KP_PAN[0], 0.07, KP_PAN[2]], lead: 0.25 },
      seconds: 5.5,
      instruction: L('Обнулите весы с лодочкой (T) и наберите шпателем 0,39 г цинка.', 'Tare the balance with the boat (T) and add 0.39 g of zinc with the spatula.', 'Qayiqchali tarozini nolga keltiring (T) va shpatel bilan 0,39 g rux oling.'),
      observation: L('Несколько мелких гранул — и на дисплее около 0,39 г; загорелся значок стабильности ○.', 'A few small granules — and the display shows about 0.39 g; the ○ stability mark is lit.', 'Bir nechta mayda donacha — displeyda taxminan 0,39 g; ○ barqarorlik belgisi yondi.'),
      how: L('Перетащите шпатель от банки с цинком к лодочке на весах.', 'Drag the spatula from the zinc jar to the boat on the balance.', 'Shpatelni rux bankasidan tarozidagi qayiqchaga torting.'),
      teacher: L(
        'Кнопка T вычитает массу лодочки, на дисплее — только цинк. Каждая гранула — это примерно 10²¹ атомов Zn, и каждый атом даст одну молекулу H₂.',
        'The T key subtracts the boat, so the display shows only the zinc. Each granule is about 10²¹ Zn atoms, and every atom will give one H₂ molecule.',
        'T tugmasi qayiqcha massasini ayiradi, displeyda faqat rux. Har bir donacha taxminan 10²¹ ta Zn atomi, har bir atom bitta H₂ molekulasini beradi.',
      ),
      mistake: L('Записывают число, пока цифры ещё «бегут». Ждите значок ○.', 'Writing the number down while the digits are still changing. Wait for the ○ mark.', 'Raqamlar hali «yugurib» turganda yozib olish. ○ belgisini kuting.'),
    },
    {
      id: 'zinc',
      target: 'boat',
      gesture: { kind: 'drag', from: [KP_PAN[0], 0.055, KP_PAN[2]], to: [KP.tube[0] + 0.03, 0.2, KP.tube[2]], lead: 0.38 },
      seconds: 3.4,
      instruction: L('Пересыпьте цинк в пробирку и верните пустую лодочку на весы.', 'Tip the zinc into the test tube and put the empty boat back on the balance.', 'Ruxni probirkaga to‘king va bo‘sh qayiqchani taroziga qaytaring.'),
      observation: L('Гранулы скатились на дно пробирки; пустая лодочка на весах — 0,00 г: весь цинк в пробирке.', 'The granules rolled to the bottom of the tube; the empty boat reads 0.00 g — all the zinc is in the tube.', 'Donachalar probirka tubiga dumaladi; bo‘sh qayiqcha tarozida 0,00 g — barcha rux probirkada.'),
      how: L('Перетащите лодочку к горлу пробирки.', 'Drag the boat to the mouth of the tube.', 'Qayiqchani probirka og‘ziga torting.'),
      teacher: L(
        'Лодочку сжимают желобком — гранулы скатываются в узкое горло, а не мимо. Пустая лодочка снова даёт 0,00 г: ничего не прилипло.',
        'The boat is pinched into a chute so the granules roll into the narrow mouth, not past it. The empty boat reads 0.00 g again: nothing stuck to it.',
        'Qayiqcha nov shaklida qisiladi — donachalar tor og‘izga dumalaydi, yonidan emas. Bo‘sh qayiqcha yana 0,00 g: hech narsa yopishmadi.',
      ),
      mistake: L('Сыплют мимо горла — часть цинка теряется, газа будет меньше.', 'Pouring past the mouth — some zinc is lost and less gas forms.', 'Og‘izdan tashqariga to‘kish — ruxning bir qismi yo‘qoladi, gaz kamroq chiqadi.'),
    },
    {
      id: 'acid',
      target: 'bottle-hcl',
      gesture: { kind: 'drag', from: [KP.bottle[0], 0.08, KP.bottle[2]], to: [KP.tube[0] + 0.04, 0.22, KP.tube[2]], lead: 0.34 },
      seconds: 3.8,
      instruction: L('Налейте в пробирку около 10 мл 10 %-й соляной кислоты (треть пробирки).', 'Pour about 10 ml of 10 % hydrochloric acid into the tube (a third of the tube).', 'Probirkaga taxminan 10 ml 10 % li xlorid kislota quying (probirkaning uchdan biri).'),
      observation: L('Кислота накрыла гранулы — цинк сразу покрылся пузырьками и «закипел».', 'The acid covered the granules — the zinc at once got covered with bubbles and started to “boil”.', 'Kislota donachalarni qopladi — rux darhol pufakchalar bilan qoplanib «qaynay» boshladi.'),
      how: L('Перетащите склянку HCl к горлу пробирки.', 'Drag the HCl bottle to the mouth of the tube.', 'HCl shishasini probirka og‘ziga torting.'),
      teacher: L(
        'Для 0,39 г цинка хватило бы около 4 мл такой кислоты. Берём 10 мл: кислота в избытке, значит прореагирует весь цинк — объём будет «максимальным», как в условии.',
        'About 4 ml of this acid would be enough for 0.39 g of zinc. We take 10 ml: the acid is in excess, so all the zinc reacts and the volume is the “maximum”, as in the problem.',
        '0,39 g rux uchun bunday kislotadan taxminan 4 ml yetardi. 10 ml olamiz: kislota mo‘l, demak barcha rux reaksiyaga kirishadi — hajm shartdagidek «eng ko‘p» bo‘ladi.',
      ),
      mistake: L('Медлят с пробкой: пока пробирка открыта, водород уходит в воздух.', 'Being slow with the stopper: while the tube is open, hydrogen escapes into the air.', 'Tiqinni kechiktirish: probirka ochiq turganda vodorod havoga chiqib ketadi.'),
    },
    {
      id: 'stopper',
      target: 'stopper',
      gesture: { kind: 'drag', from: [KP.stopper[0], 0.02, KP.stopper[2]], to: [KP.tube[0], 0.2, KP.tube[2]], lead: 0.56 },
      seconds: 2.6,
      instruction: L('Сразу закройте пробирку пробкой с газоотводной трубкой.', 'Close the tube at once with the stopper and delivery tube.', 'Probirkani darhol gaz o‘tkazgich nayli tiqin bilan yoping.'),
      observation: L('Газ пошёл по шлангу в банку: из трубки под цилиндром выходят пузырьки, вода в цилиндре опускается.', 'The gas runs through the hose into the jar: bubbles leave the tube under the cylinder and the water in the cylinder goes down.', 'Gaz shlang orqali bankaga bordi: silindr ostidagi naydan pufakchalar chiqmoqda, silindrdagi suv pasaymoqda.'),
      how: L('Перетащите пробку к горлу пробирки.', 'Drag the stopper to the mouth of the tube.', 'Tiqinni probirka og‘ziga torting.'),
      teacher: L(
        'Первым в цилиндр приходит воздух из пробирки, а его место занимает водород. Сколько газа выделилось — столько воды и вытеснено.',
        'Air from the tube reaches the cylinder first, and hydrogen takes its place. As much water is pushed out as the gas that was released.',
        'Silindrga avval probirkadagi havo keladi, uning o‘rnini vodorod egallaydi. Qancha gaz ajralsa — shuncha suv siqib chiqariladi.',
      ),
      mistake: L('Конец трубки не под цилиндром — пузырьки уходят мимо.', 'The tube end is not under the cylinder — the bubbles escape past it.', 'Nay uchi silindr ostida emas — pufakchalar yonidan chiqib ketadi.'),
    },
    {
      id: 'collect',
      target: 'tube',
      gesture: { kind: 'tap' },
      seconds: 9,
      instruction: L('Дождитесь, пока цинк растворится и газ перестанет выделяться.', 'Wait until the zinc dissolves and the gas stops coming.', 'Rux erib, gaz ajralishi to‘xtaguncha kuting.'),
      observation: L('Гранулы тают, пузырьков всё меньше, вода в цилиндре перестала опускаться. В жизни — около 5 минут.', 'The granules melt away, fewer and fewer bubbles, the water in the cylinder stops falling. In real life — about 5 minutes.', 'Donachalar erib boradi, pufakchalar kamayadi, silindrdagi suv pasayishdan to‘xtadi. Hayotda — taxminan 5 daqiqa.'),
      how: L('Нажмите на пробирку — время ускорено.', 'Tap the test tube — time is sped up.', 'Probirkani bosing — vaqt tezlashtirilgan.'),
      teacher: L(
        'Так же работает аппарат Киппа: кислота омывает цинк, пока кран открыт. Закрыли кран — водород выдавливает кислоту вниз, она уходит от цинка, и реакция сама останавливается.',
        'A Kipp apparatus works the same way: the acid washes over the zinc while the tap is open. Close the tap — the hydrogen pushes the acid down, away from the zinc, and the reaction stops by itself.',
        'Kipp apparati ham shunday ishlaydi: jo‘mrak ochiq turganda kislota ruxni yuvadi. Jo‘mrak yopildi — vodorod kislotani pastga siqadi, u ruxdan uzoqlashadi va reaksiya o‘zi to‘xtaydi.',
      ),
      mistake: L('Измеряют объём слишком рано — часть водорода ещё не выделилась.', 'Measuring too early — part of the hydrogen has not formed yet.', 'Hajmni juda erta o‘lchash — vodorodning bir qismi hali ajralmagan.'),
    },
    {
      id: 'level',
      target: 'gas-cylinder',
      gesture: { kind: 'swipe', from: [KP.bath[0], KP_CYL_TOP, KP.bath[2]], to: [KP.bath[0], KP_CYL_TOP - 0.1, KP.bath[2]], lead: 0.8 },
      seconds: 3.6,
      instruction: L('Отведите конец трубки, опустите цилиндр до равенства уровней воды и снимите объём газа.', 'Swing the tube end aside, lower the cylinder until the water levels are equal and read the gas volume.', 'Nay uchini chetga oling, suv sathlari tenglashguncha silindrni tushiring va gaz hajmini o‘qing.'),
      observation: L('Вода в цилиндре сравнялась с водой в банке; показание чуть уменьшилось — газ больше не разрежен.', 'The water in the cylinder is level with the water in the jar; the reading dropped slightly — the gas is no longer rarefied.', 'Silindrdagi suv bankadagi suv bilan tenglashdi; ko‘rsatkich biroz kamaydi — gaz endi siyraklashmagan.'),
      how: L('Проведите по цилиндру вниз — опустите его в банку.', 'Swipe down the cylinder — lower it into the jar.', 'Silindr bo‘ylab pastga suring — uni bankaga tushiring.'),
      teacher: L(
        'Пока вода в цилиндре выше, чем в банке, столб воды «тянет» газ вниз и его давление меньше атмосферного. Уровни равны — давление газа равно атмосферному, такой объём и приводят к н.у.',
        'While the water in the cylinder is higher than in the jar, the water column “pulls” on the gas and its pressure is below atmospheric. Levels equal — the gas pressure equals atmospheric, and this volume is converted to STP.',
        'Silindrdagi suv bankadagidan baland ekan, suv ustuni gazni «tortadi» va uning bosimi atmosfera bosimidan kam. Sathlar teng — gaz bosimi atmosfera bosimiga teng, shu hajm n.sh.ga keltiriladi.',
      ),
      mistake: L('Читают объём по верхнему краю мениска или до выравнивания уровней — объём завышен.', 'Reading at the top of the meniscus or before the levels are equal — the volume is too high.', 'Hajmni meniskning yuqori cheti bo‘yicha yoki sathlar tenglashmasdan o‘qish — hajm oshib ketadi.'),
    },
    {
      id: 'temp',
      target: 'thermometer',
      gesture: { kind: 'drag', from: [KP.thermometer[0] + 0.1, 0.01, KP.thermometer[2]], to: [KP.bath[0] + KP.thermoIn[0], 0.12, KP.bath[2] + KP.thermoIn[2]], lead: 0.55 },
      seconds: 3.2,
      instruction: L('Опустите термометр в воду банки и запишите температуру.', 'Put the thermometer into the jar water and record the temperature.', 'Termometrni banka suviga tushiring va haroratni yozing.'),
      observation: L('Столбик остановился: газ над водой имеет температуру воды.', 'The column has stopped: the gas over the water has the temperature of the water.', 'Ustuncha to‘xtadi: suv ustidagi gaz suv haroratiga ega.'),
      how: L('Перетащите термометр к банке.', 'Drag the thermometer to the jar.', 'Termometrni bankaga torting.'),
      teacher: L(
        'Молекулы тёплого газа движутся быстрее и занимают больше места: при 20–24 °C объём на 7–9 % больше, чем при 0 °C. Приводим к н.у.: V₀ = V · 273 / (273 + t).',
        'Molecules of a warm gas move faster and take up more room: at 20–24 °C the volume is 7–9 % larger than at 0 °C. Convert to STP: V₀ = V · 273 / (273 + t).',
        'Iliq gaz molekulalari tezroq harakatlanib, ko‘proq joy egallaydi: 20–24 °C da hajm 0 °C dagidan 7–9 % ko‘p. N.sh.ga keltiramiz: V₀ = V · 273 / (273 + t).',
      ),
      mistake: L('Берут температуру «на глаз»: ошибка в 5 °C даёт почти 2 % в объёме.', 'Guessing the temperature: a 5 °C error gives almost 2 % in volume.', 'Haroratni «chamalab» olish: 5 °C xato hajmda deyarli 2 % beradi.'),
    },
  ],
  focus: [
    { from: 1.45, to: 1.97, point: [KP.scales[0], 0.035, KP.scales[2] + 0.07], dist: 0.3 },
    { from: 3.5, to: 3.97, point: [KP.tube[0], 0.1, KP.tube[2]], dist: 0.3 },
    { from: 4.62, to: 4.97, point: [KP.bath[0] - 0.12, 0.17, KP.bath[2]], dist: 0.6 },
    { from: 5.1, to: 5.9, point: [KP.bath[0] - 0.06, 0.2, KP.bath[2]], dist: 0.55 },
    { from: 6.86, to: 6.98, point: [KP.bath[0], 0.17, KP.bath[2]], dist: 0.24 },
    { from: 7.62, to: 7.98, point: [KP.bath[0] + KP.thermoIn[0], 0.1, KP.bath[2] + KP.thermoIn[2] + 0.02], dist: 0.24 },
  ],
  labels: [
    { at: 2.9, pos: [KP.scales[0], 0.14, KP.scales[2]], text: L('пустая лодочка — 0,00 г', 'empty boat — 0.00 g', 'bo‘sh qayiqcha — 0,00 g') },
    { at: 3.7, pos: [KP.tube[0] + 0.07, 0.12, KP.tube[2]], text: L('H₂↑ — цинк «кипит»', 'H₂↑ — the zinc “boils”', 'H₂↑ — rux «qaynaydi»') },
    { at: 4.75, pos: [KP.bath[0], 0.44, KP.bath[2]], text: L('газ вытесняет воду', 'the gas pushes the water out', 'gaz suvni siqib chiqaradi') },
    { at: 5.1, pos: [KP.tube[0], 0.3, KP.tube[2]], text: L('ускорено: в жизни ~5 мин', 'sped up: ~5 min in real life', 'tezlashtirilgan: hayotda ~5 daq') },
    { at: 6.86, pos: [KP.bath[0] - 0.09, 0.2, KP.bath[2] + 0.05], text: L('уровни равны: p = p атм', 'levels equal: p = p atm', 'sathlar teng: p = p atm') },
  ],
  measurements: [
    { key: 'mZn', label: 'm(Zn)', what: L('масса цинка', 'mass of zinc', 'rux massasi'), instrument: 'scales', afterStep: 1 },
    { key: 'V', label: 'V(газа)', what: L('объём газа при температуре класса', 'gas volume at room temperature', 'sinf haroratidagi gaz hajmi'), instrument: 'gas250', afterStep: 6 },
    { key: 't', label: 't', what: L('температура воды и газа', 'temperature of the water and gas', 'suv va gaz harorati'), instrument: 'thermometer', afterStep: 7 },
    { key: 'V0', label: 'V₀(H₂)', what: L('объём водорода при н.у. (расчёт)', 'hydrogen volume at STP (calculated)', 'n.sh.dagi vodorod hajmi (hisob)'), instrument: 'gas250', afterStep: 7, derived: true },
  ],
  simulate: (rng) => {
    const mZn = rng.weigh(0.39, 0.02)
    const t = Math.round(rng.between(20, 24))
    const n = mZn / 65
    // газ над водой влажный: к водороду добавляется водяной пар (2,3–3,0 кПа); пока пробирка была открыта,
    // часть H₂ ушла в воздух, немного растворилось в воде
    const pw = waterVaporKPa(t)
    const loss = rng.between(0.015, 0.03)
    const V = rng.read('gas250', gasMlAt(n, t) * (1 + pw / (P0_KPA - pw)) * (1 - loss))
    const V0 = Math.round(toNormalMl(V, t) * 10) / 10
    return { mZn, V, t, V0 }
  },
  given: (v, lang) => {
    const acidMl = ((2 * v.mZn!) / 65) * 36.5 / 0.1 / 1.047
    return [
      tr(lang, 'Задача: m(Zn) = 0,39 кг = 390 г, HCl — в избытке; V(H₂, н.у.) — ?', 'Problem: m(Zn) = 0.39 kg = 390 g, HCl in excess; V(H₂, STP) — ?', 'Masala: m(Zn) = 0,39 kg = 390 g, HCl — mo‘l; V(H₂, n.sh.) — ?'),
      tr(
        lang,
        `Опыт (≈ в 1000 раз меньше): m(Zn) = ${f(v.mZn!, 2, lang)} г; HCl 10 % ≈ 10 мл — избыток (нужно ≈ ${f(acidMl, 1, lang)} мл)`,
        `Experiment (≈ 1000 times smaller): m(Zn) = ${f(v.mZn!, 2, lang)} g; HCl 10 % ≈ 10 ml — excess (≈ ${f(acidMl, 1, lang)} ml needed)`,
        `Tajriba (≈ 1000 marta kichik): m(Zn) = ${f(v.mZn!, 2, lang)} g; HCl 10 % ≈ 10 ml — mo‘l (≈ ${f(acidMl, 1, lang)} ml kerak)`,
      ),
      tr(
        lang,
        `Газ над водой: V = ${f(v.V!, 0, lang)} мл при t = ${f(v.t!, 1, lang)} °C, p ≈ 101,3 кПа`,
        `Gas over water: V = ${f(v.V!, 0, lang)} ml at t = ${f(v.t!, 1, lang)} °C, p ≈ 101.3 kPa`,
        `Suv ustidagi gaz: V = ${f(v.V!, 0, lang)} ml, t = ${f(v.t!, 1, lang)} °C, p ≈ 101,3 kPa`,
      ),
      tr(lang, 'M(Zn) = 65 г/моль, Vm = 22,4 л/моль', 'M(Zn) = 65 g/mol, Vm = 22.4 l/mol', 'M(Zn) = 65 g/mol, Vm = 22,4 l/mol'),
    ]
  },
  solution: (v, lang) => {
    const n = v.V0! / 22400
    const k = 390 / v.mZn!
    const ans = answerL(v)
    return [
      tr(lang, 'Zn + 2HCl → ZnCl₂ + H₂↑: из 1 моль Zn — 1 моль H₂', 'Zn + 2HCl → ZnCl₂ + H₂↑: 1 mol of Zn gives 1 mol of H₂', 'Zn + 2HCl → ZnCl₂ + H₂↑: 1 mol Zn dan 1 mol H₂'),
      tr(
        lang,
        `V₀ = V · 273 / (273 + t) = ${f(v.V!, 0, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(v.V0!, 1, lang)} мл (н.у.)`,
        `V₀ = V · 273 / (273 + t) = ${f(v.V!, 0, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(v.V0!, 1, lang)} ml (STP)`,
        `V₀ = V · 273 / (273 + t) = ${f(v.V!, 0, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(v.V0!, 1, lang)} ml (n.sh.)`,
      ),
      tr(
        lang,
        `n(H₂) = V₀ / Vm = ${f(v.V0!, 1, lang)} / 22 400 = ${f(n, 5, lang)} моль (по цинку: ${f(v.mZn!, 2, lang)} / 65 = ${f(v.mZn! / 65, 5, lang)} моль)`,
        `n(H₂) = V₀ / Vm = ${f(v.V0!, 1, lang)} / 22 400 = ${f(n, 5, lang)} mol (from the zinc: ${f(v.mZn!, 2, lang)} / 65 = ${f(v.mZn! / 65, 5, lang)} mol)`,
        `n(H₂) = V₀ / Vm = ${f(v.V0!, 1, lang)} / 22 400 = ${f(n, 5, lang)} mol (rux bo‘yicha: ${f(v.mZn!, 2, lang)} / 65 = ${f(v.mZn! / 65, 5, lang)} mol)`,
      ),
      tr(
        lang,
        `Пересчёт на аппарат Киппа: 390 г / ${f(v.mZn!, 2, lang)} г = в ${f(k, 0, lang)} раз больше → V(H₂) = ${f(v.V0!, 1, lang)} мл · ${f(k, 0, lang)} = ${f(ans, 1, lang)} л`,
        `Scaling to the Kipp apparatus: 390 g / ${f(v.mZn!, 2, lang)} g = ${f(k, 0, lang)} times more → V(H₂) = ${f(v.V0!, 1, lang)} ml · ${f(k, 0, lang)} = ${f(ans, 1, lang)} l`,
        `Kipp apparatiga hisoblash: 390 g / ${f(v.mZn!, 2, lang)} g = ${f(k, 0, lang)} marta ko‘p → V(H₂) = ${f(v.V0!, 1, lang)} ml · ${f(k, 0, lang)} = ${f(ans, 1, lang)} l`,
      ),
      tr(lang, `Ответ: V(H₂) ≈ ${f(ans, 1, lang)} л`, `Answer: V(H₂) ≈ ${f(ans, 1, lang)} l`, `Javob: V(H₂) ≈ ${f(ans, 1, lang)} l`),
    ]
  },
  compare: [
    {
      label: L('V₀(H₂) при н.у.', 'V₀(H₂) at STP', 'V₀(H₂) n.sh.da'),
      unit: 'ml',
      decimals: 1,
      measured: (v) => v.V0!,
      predicted: (v) => gasNormalMl(v.mZn! / 65),
      book: 134.4,
      tolerancePct: 3,
    },
  ],
  reconcile: L(
    'Объём чуть отличается от расчёта по цинку — это честная физика. Газ над водой влажный: водяной пар (2,3–3,0 кПа) добавляет к объёму 2–3 %. Пока пробирка была открыта, часть водорода ушла в воздух, немного растворилось в воде (−1,5…3 %). Весы ±0,01 г на 0,39 г — это уже ±2,6 % (поэтому на 0,39 кг пересчитывают по своей навеске, а не ровно ×1000), отсчёт по цилиндру ±1 мл — ±0,7 %, термометр ±0,5 °C — ±0,2 %. Если бы уровни не выровняли, газ был бы разрежен столбом воды высотой около 10 см, и объём оказался бы завышен ещё на 1 %.',
    'The volume differs slightly from the calculation from the zinc — that is honest physics. Gas over water is moist: water vapour (2.3–3.0 kPa) adds 2–3 % to the volume. While the tube was open, some hydrogen escaped and a little dissolved in water (−1.5…3 %). The balance (±0.01 g on 0.39 g) is already ±2.6 % — that is why the scaling to 0.39 kg uses your own sample, not exactly ×1000; the cylinder reading (±1 ml) gives ±0.7 %, the thermometer (±0.5 °C) ±0.2 %. Had the levels not been equalised, a water column about 10 cm high would have rarefied the gas, and the volume would have come out 1 % too high.',
    'Hajm rux bo‘yicha hisobdan biroz farq qiladi — bu halol fizika. Suv ustidagi gaz nam: suv bug‘i (2,3–3,0 kPa) hajmga 2–3 % qo‘shadi. Probirka ochiq turganda vodorodning bir qismi havoga chiqib ketdi, ozgina suvda eridi (−1,5…3 %). Tarozi (0,39 g da ±0,01 g) — bu allaqachon ±2,6 % (shuning uchun 0,39 kg ga aynan ×1000 emas, o‘z tortmangiz bo‘yicha hisoblanadi), silindr bo‘yicha o‘qish (±1 ml) ±0,7 %, termometr (±0,5 °C) ±0,2 % beradi. Sathlar tenglashtirilmaganda gaz taxminan 10 sm suv ustuni bilan siyraklashgan bo‘lardi va hajm yana 1 % ortiq chiqardi.',
  ),
  conclusion: L(
    'Из 0,39 г цинка получилось около 0,135 л водорода (н.у.) — 0,006 моль. В аппарате Киппа цинка в 1000 раз больше: n(H₂) = n(Zn) = 390 / 65 = 6 моль, V(H₂) = 6 · 22,4 = 134,4 л. Объём «максимальный» — если растворится весь загруженный цинк и газ не потеряется.',
    'From 0.39 g of zinc we got about 0.135 l of hydrogen (STP) — 0.006 mol. A Kipp apparatus holds 1000 times more zinc: n(H₂) = n(Zn) = 390 / 65 = 6 mol, V(H₂) = 6 · 22.4 = 134.4 l. The volume is the “maximum” one — if all the loaded zinc dissolves and no gas is lost.',
    '0,39 g ruxdan taxminan 0,135 l vodorod (n.sh.) — 0,006 mol olindi. Kipp apparatida rux 1000 marta ko‘p: n(H₂) = n(Zn) = 390 / 65 = 6 mol, V(H₂) = 6 · 22,4 = 134,4 l. Hajm «eng ko‘p» — agar solingan barcha rux erisa va gaz yo‘qolmasa.',
  ),
  story: {
    equation: 'Zn + 2H⁺ → Zn²⁺ + H₂↑',
    text: L(
      'Атомы цинка на поверхности гранулы отдают по два электрона ионам H⁺ кислоты. Атомы водорода попарно соединяются в молекулы H₂ — это пузырьки. Ионы Zn²⁺ уходят в раствор: остаётся раствор хлорида цинка. На каждый атом цинка — одна молекула водорода, поэтому 6 моль цинка дают 6 моль H₂. Аппарат Киппа — три сообщающихся шара: в среднем лежит цинк, кислота поднимается к нему снизу; закрыли кран — газ выталкивает кислоту обратно, и реакция останавливается до следующего открытия крана.',
      'Zinc atoms on the surface of a granule give two electrons each to the H⁺ ions of the acid. Hydrogen atoms join in pairs into H₂ molecules — the bubbles. Zn²⁺ ions go into the solution, leaving a zinc chloride solution. One hydrogen molecule for every zinc atom, so 6 mol of zinc give 6 mol of H₂. A Kipp apparatus is three connected bulbs: the zinc lies in the middle one and the acid rises to it from below; when the tap is closed, the gas pushes the acid back and the reaction stops until the tap is opened again.',
      'Donacha sirtidagi rux atomlari kislotaning H⁺ ionlariga ikkitadan elektron beradi. Vodorod atomlari juft-juft birikib H₂ molekulalarini hosil qiladi — bu pufakchalar. Zn²⁺ ionlari eritmaga o‘tadi: rux xlorid eritmasi qoladi. Har bir rux atomiga — bitta vodorod molekulasi, shuning uchun 6 mol rux 6 mol H₂ beradi. Kipp apparati — uchta tutash shar: o‘rtadagisida rux yotadi, kislota unga pastdan ko‘tariladi; jo‘mrak yopilsa, gaz kislotani orqaga itaradi va reaksiya jo‘mrak qayta ochilguncha to‘xtaydi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('По чему было видно, что водород собирается в цилиндре?', 'How could you see that hydrogen was collecting in the cylinder?', 'Silindrda vodorod yig‘ilayotgani nimadan ko‘rindi?'),
      options: [
        L('Вода в цилиндре опускалась, вверху появлялся газ', 'The water in the cylinder went down and gas appeared at the top', 'Silindrdagi suv pasayib, yuqorida gaz paydo bo‘ldi'),
        L('Вода в банке помутнела', 'The water in the jar turned cloudy', 'Bankadagi suv loyqalandi'),
        L('Цилиндр запотел снаружи', 'The cylinder misted up on the outside', 'Silindr tashqaridan terladi'),
      ],
      correct: 0,
      why: L('Водород бесцветен: его видно только по воде, которую он вытесняет, и по пузырькам.', 'Hydrogen is colourless: it shows only by the water it pushes out and by the bubbles.', 'Vodorod rangsiz: u faqat siqib chiqargan suvi va pufakchalari orqali ko‘rinadi.'),
    },
    {
      id: 'type',
      q: L('Почему перед отсчётом выравнивают уровни воды в цилиндре и в банке?', 'Why are the water levels in the cylinder and the jar equalised before reading?', 'Nega o‘qishdan oldin silindr va bankadagi suv sathlari tenglashtiriladi?'),
      options: [
        L('Чтобы давление газа было равно атмосферному', 'So that the gas pressure equals atmospheric pressure', 'Gaz bosimi atmosfera bosimiga teng bo‘lishi uchun'),
        L('Чтобы газ быстрее остыл', 'So that the gas cools faster', 'Gaz tezroq sovishi uchun'),
        L('Чтобы водород не растворился в воде', 'So that the hydrogen does not dissolve in the water', 'Vodorod suvda erib ketmasligi uchun'),
      ],
      correct: 0,
      why: L('При равных уровнях давление газа равно атмосферному (≈ 101,3 кПа) — только такой объём можно приводить к нормальным условиям.', 'With equal levels the gas pressure equals atmospheric (≈ 101.3 kPa) — only such a volume can be converted to standard conditions.', 'Sathlar teng bo‘lganda gaz bosimi atmosfera bosimiga (≈ 101,3 kPa) teng — faqat shunday hajmni normal sharoitga keltirish mumkin.'),
    },
    {
      id: 'product',
      q: L('Что осталось в пробирке, когда цинк растворился?', 'What was left in the tube when the zinc had dissolved?', 'Rux erib bo‘lgach, probirkada nima qoldi?'),
      options: [
        L('Раствор ZnCl₂ с остатком соляной кислоты', 'A ZnCl₂ solution with leftover hydrochloric acid', 'Xlorid kislota qoldig‘i bilan ZnCl₂ eritmasi'),
        L('Чистая вода', 'Pure water', 'Toza suv'),
        L('Белый осадок оксида цинка', 'A white precipitate of zinc oxide', 'Rux oksidining oq cho‘kmasi'),
      ],
      correct: 0,
      why: L('Цинк перешёл в раствор ионами Zn²⁺, а кислоту брали в избытке — её часть осталась.', 'The zinc went into the solution as Zn²⁺ ions, and the acid was in excess — some of it is left.', 'Rux Zn²⁺ ionlari holida eritmaga o‘tdi, kislota esa mo‘l olingan — uning bir qismi qoldi.'),
    },
  ],
}
