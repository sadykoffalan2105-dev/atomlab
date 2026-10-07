/**
 * Kimyo 8, с. 14, пример: масса и объём водорода из 26 г цинка и избытка соляной кислоты.
 * Опыт в 20 раз меньше: 1,30 г цинка + 25 мл 10 %-й HCl в колбе, водород собирают над водой в цилиндр 500 мл,
 * выравнивают уровни, читают объём и температуру, приводят к н.у. Массу H₂ (0,04 г) не взвешивают — считают по объёму.
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { P0_KPA, gasMlAt, gasNormalMl, toNormalMl, waterVaporKPa } from '../../../components/lab3d/measure/quantities'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'
import { ZH } from './layoutG8'

const PAN: readonly [number, number, number] = [ZH.scales[0], 0.047, ZH.scales[2] - 0.012]
const SCALE = 20
const f = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
const n0 = (v: LabTaskValues) => v.V0! / 22400

export const TASK_G8_ZN_HCL_GAS: LabTask = {
  id: 'task-g8-zn-hcl-gas',
  grade: 8,
  page: 14,
  source: L('Kimyo 8 · с. 14, пример', 'Kimyo 8 · p. 14, worked example', 'Kimyo 8 · 14-bet, misol'),
  bookKind: 'example',
  title: L('Водород из цинка и соляной кислоты', 'Hydrogen from zinc and hydrochloric acid', 'Rux va xlorid kislotadan vodorod'),
  statement: L(
    'Какую массу (г) и какой объем (л, н.у.) водорода можно получить путем воздействия избыточным количеством соляной кислоты на 26 г цинка?',
    'What mass (g) and what volume (l, STP) of hydrogen can be obtained by treating 26 g of zinc with an excess of hydrochloric acid?',
    '26 g ruxga mo‘l miqdorda xlorid kislota ta’sir ettirib, qancha massa (g) va qancha hajm (l, n.sh.) vodorod olish mumkin?',
  ),
  equation: 'Zn + 2HCl → ZnCl₂ + H₂↑',
  kind: 'substitution',
  type: 'stoich-gas',
  difficulty: 2,
  answers: [
    {
      key: 'mH2',
      label: 'm(H₂)',
      what: L('масса водорода', 'mass of hydrogen', 'vodorod massasi'),
      unit: L('г', 'g', 'g'),
      book: 0.8,
      decimals: 2,
      fromRun: (v) => n0(v) * 2 * SCALE,
    },
    {
      key: 'VH2',
      label: 'V(H₂)',
      what: L('объём водорода (н.у.)', 'volume of hydrogen (STP)', 'vodorod hajmi (n.sh.)'),
      unit: L('л', 'l', 'l'),
      book: 8.96,
      decimals: 2,
      fromRun: (v) => (v.V0! * SCALE) / 1000,
    },
  ],
  labScale: {
    factor: SCALE,
    note: L(
      'В задаче 26 г цинка — это почти 9 л водорода, в 18 раз больше самого большого цилиндра. Берём цинка в 20 раз меньше (1,30 г): газа будет около 0,45 л, а ответ умножаем на 20.',
      'The problem has 26 g of zinc, almost 9 l of hydrogen — 18 times the largest cylinder. We take 20 times less zinc (1.30 g): about 0.45 l of gas, and multiply the answer by 20.',
      'Masalada 26 g rux — bu deyarli 9 l vodorod, eng katta silindrdan 18 marta ko‘p. Ruxni 20 marta kam olamiz (1,30 g): gaz taxminan 0,45 l bo‘ladi, javobni 20 ga ko‘paytiramiz.',
    ),
  },
  instruments: ['scales', 'cyl50', 'gas500', 'thermometer'],
  equipment: [
    L('Электронные весы (0,01 г), лодочка, шпатель', 'Electronic balance (0.01 g), weighing boat, spatula', 'Elektron tarozi (0,01 g), qayiqcha, shpatel'),
    L('Гранулированный цинк, соляная кислота 10 %', 'Granulated zinc, 10 % hydrochloric acid', 'Donador rux, 10 % li xlorid kislota'),
    L('Коническая колба 100 мл в лапке штатива, пробка с газоотводной трубкой', '100 ml conical flask in a stand clamp, stopper with a delivery tube', 'Shtativ qisqichidagi 100 ml konussimon kolba, gaz o‘tkazgich nayli tiqin'),
    L('Мерный цилиндр 50 мл', '50 ml measuring cylinder', '50 ml o‘lchov silindri'),
    L('Пневматическая ванна, цилиндр 500 мл в лапке, термометр', 'Pneumatic trough, 500 ml cylinder in a clamp, thermometer', 'Pnevmatik vanna, qisqichdagi 500 ml silindr, termometr'),
  ],
  safety: [
    L('Очки и перчатки: соляная кислота разъедает кожу и глаза.', 'Goggles and gloves: hydrochloric acid harms skin and eyes.', 'Ko‘zoynak va qo‘lqop: xlorid kislota teri va ko‘zni yemiradi.'),
    L('Водород с воздухом взрывоопасен: рядом не должно быть огня; после опыта газ выпускают в вытяжку.', 'Hydrogen mixed with air is explosive: no flames nearby; release the gas into the fume hood afterwards.', 'Vodorod havo bilan portlovchi: yaqinda olov bo‘lmasin; tajribadan so‘ng gazni mo‘rili shkafga chiqaring.'),
    L('Кислоту наливают через цилиндр, не наклоняясь над колбой.', 'Pour the acid with the cylinder without leaning over the flask.', 'Kislotani silindr orqali, kolba ustiga engashmasdan quying.'),
  ],
  gear: ['goggles', 'gloves'],
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
        'Даже 10 %-я соляная кислота разъедает кожу, а пузырьки газа разбрызгивают мелкие капли — очки обязательны.',
        'Even 10 % hydrochloric acid harms the skin, and the gas bubbles throw fine droplets — goggles are a must.',
        'Hatto 10 % li xlorid kislota terini yemiradi, gaz pufakchalari mayda tomchilarni sachratadi — ko‘zoynak shart.',
      ),
    },
    {
      id: 'weigh',
      target: 'spatula',
      gesture: { kind: 'drag', from: [ZH.spatula[0] + 0.04, 0.01, ZH.spatula[2]], to: [PAN[0], 0.07, PAN[2]], lead: 0.25 },
      seconds: 5.5,
      instruction: L('Обнулите весы с лодочкой (T) и наберите шпателем 1,30 г цинка.', 'Tare the balance with the boat (T) and add 1.30 g of zinc with the spatula.', 'Qayiqchali tarozini nolga keltiring (T) va shpatel bilan 1,30 g rux oling.'),
      observation: L('С каждой гранулой показание растёт и останавливается около 1,30 г; загорается значок ○.', 'The reading grows with each granule and stops near 1.30 g; the ○ mark lights up.', 'Har bir donacha bilan ko‘rsatkich oshib, 1,30 g atrofida to‘xtaydi; ○ belgisi yonadi.'),
      how: L('Перетащите шпатель от банки с цинком к лодочке на весах.', 'Drag the spatula from the zinc jar to the boat on the balance.', 'Shpatelni rux bankasidan tarozidagi qayiqchaga torting.'),
      teacher: L(
        'Кнопка T вычитает массу лодочки — на дисплее только цинк. 1,30 г цинка — это 0,02 моль атомов Zn.',
        'The T key subtracts the boat — the display shows only the zinc. 1.30 g of zinc is 0.02 mol of Zn atoms.',
        'T tugmasi qayiqcha massasini ayiradi — displeyda faqat rux. 1,30 g rux — bu 0,02 mol Zn atomi.',
      ),
      mistake: L('Записывают показание, пока цифры «бегут». Ждите значок стабильности ○.', 'Writing down the reading while the digits are still changing. Wait for the ○ stability mark.', 'Raqamlar «yugurib» turganda yozib olish. ○ barqarorlik belgisini kuting.'),
    },
    {
      id: 'zinc',
      target: 'boat',
      gesture: { kind: 'drag', from: [PAN[0], 0.055, PAN[2]], to: [ZH.flask[0] + 0.03, 0.15, ZH.flask[2]], lead: 0.38 },
      seconds: 3.4,
      instruction: L('Пересыпьте цинк в колбу и верните пустую лодочку на весы.', 'Tip the zinc into the flask and put the empty boat back on the balance.', 'Ruxni kolbaga to‘king va bo‘sh qayiqchani taroziga qaytaring.'),
      observation: L('Гранулы на дне колбы; пустая лодочка на весах — 0,00 г: весь цинк в колбе.', 'The granules lie at the bottom of the flask; the empty boat reads 0.00 g — all the zinc is in the flask.', 'Donachalar kolba tubida; bo‘sh qayiqcha taroziida 0,00 g — barcha rux kolbada.'),
      how: L('Перетащите лодочку к горлу колбы.', 'Drag the boat to the neck of the flask.', 'Qayiqchani kolba bo‘g‘ziga torting.'),
      teacher: L(
        'Пока лодочку держат в руке, весы показывают её массу со знаком минус. Вернули пустую — снова 0,00 г: ничего не прилипло и не просыпалось.',
        'While the boat is in your hand, the balance shows its mass with a minus sign. Put back empty — 0.00 g again: nothing stuck or spilled.',
        'Qayiqcha qo‘lda bo‘lganda tarozi uning massasini minus ishora bilan ko‘rsatadi. Bo‘sh qaytarildi — yana 0,00 g: hech narsa yopishmadi va to‘kilmadi.',
      ),
      mistake: L('Сыплют мимо горла — часть цинка теряется, газа получится меньше.', 'Pouring past the neck — some zinc is lost and less gas forms.', 'Bo‘g‘izdan tashqariga to‘kish — ruxning bir qismi yo‘qoladi, gaz kamroq chiqadi.'),
    },
    {
      id: 'acid',
      target: 'bottle-hcl',
      gesture: { kind: 'drag', from: [ZH.bottle[0], 0.08, ZH.bottle[2]], to: [ZH.cylinder[0], 0.21, ZH.cylinder[2]], lead: 0.34 },
      seconds: 3.8,
      instruction: L('Отмерьте цилиндром 25 мл 10 %-й соляной кислоты.', 'Measure 25 ml of 10 % hydrochloric acid with the cylinder.', 'Silindr bilan 25 ml 10 % li xlorid kislota o‘lchang.'),
      observation: L('Кислота стоит у метки 25 мл — отсчёт по нижнему краю мениска.', 'The acid is at the 25 ml mark — read at the bottom of the meniscus.', 'Kislota 25 ml belgisida — hisob meniskning pastki cheti bo‘yicha.'),
      how: L('Перетащите склянку HCl к мерному цилиндру.', 'Drag the HCl bottle to the measuring cylinder.', 'HCl shishasini o‘lchov silindriga torting.'),
      teacher: L(
        'Для 1,30 г цинка хватило бы около 14 мл такой кислоты. Берём 25 мл: кислота в избытке, и прореагирует весь цинк — как в условии.',
        'About 14 ml of this acid would be enough for 1.30 g of zinc. We take 25 ml: the acid is in excess, so all the zinc reacts, as in the problem.',
        '1,30 g rux uchun bunday kislotadan taxminan 14 ml yetardi. 25 ml olamiz: kislota mo‘l, barcha rux reaksiyaga kirishadi — shartdagidek.',
      ),
      mistake: L('Отсчёт по верхнему краю мениска — объём кажется больше.', 'Reading at the top of the meniscus — the volume looks larger.', 'Meniskning yuqori cheti bo‘yicha o‘qish — hajm kattaroq ko‘rinadi.'),
    },
    {
      id: 'pour',
      target: 'cylinder',
      gesture: { kind: 'drag', from: [ZH.cylinder[0], 0.1, ZH.cylinder[2]], to: [ZH.flask[0], 0.16, ZH.flask[2]], lead: 0.34 },
      seconds: 3.4,
      instruction: L('Влейте кислоту в колбу к цинку.', 'Pour the acid onto the zinc in the flask.', 'Kislotani kolbadagi rux ustiga quying.'),
      observation: L('Цинк покрывается пузырьками и «кипит», колба слегка теплеет.', 'The zinc gets covered with bubbles and “boils”, the flask warms slightly.', 'Rux pufakchalar bilan qoplanib «qaynaydi», kolba biroz isiydi.'),
      how: L('Перетащите цилиндр к горлу колбы.', 'Drag the cylinder to the neck of the flask.', 'Silindrni kolba bo‘g‘ziga torting.'),
      teacher: L(
        'Атомы цинка отдают по два электрона ионам H⁺. Атомы водорода соединяются по два — в молекулы H₂: это и есть пузырьки.',
        'Zinc atoms give two electrons each to H⁺ ions. Hydrogen atoms join in pairs into H₂ molecules — these are the bubbles.',
        'Rux atomlari H⁺ ionlariga ikkitadan elektron beradi. Vodorod atomlari ikkitadan birikib H₂ molekulalarini hosil qiladi — pufakchalar shu.',
      ),
      mistake: L('Медлят с пробкой: пока колба открыта, водород уходит в воздух.', 'Being slow with the stopper: while the flask is open, hydrogen escapes into the air.', 'Tiqinni kechiktirish: kolba ochiq turganda vodorod havoga chiqib ketadi.'),
    },
    {
      id: 'stopper',
      target: 'stopper',
      gesture: { kind: 'drag', from: [ZH.stopper[0], 0.02, ZH.stopper[2]], to: [ZH.flask[0], 0.13, ZH.flask[2]], lead: 0.56 },
      seconds: 2.6,
      instruction: L('Сразу закройте колбу пробкой с газоотводной трубкой.', 'Close the flask at once with the stopper and delivery tube.', 'Kolbani darhol gaz o‘tkazgich nayli tiqin bilan yoping.'),
      observation: L('Газ идёт по трубке под цилиндр — вода в цилиндре опускается.', 'The gas runs through the tube under the cylinder — the water in the cylinder goes down.', 'Gaz nay orqali silindr ostiga boradi — silindrdagi suv pasayadi.'),
      how: L('Перетащите пробку к горлу колбы.', 'Drag the stopper to the neck of the flask.', 'Tiqinni kolba bo‘g‘ziga torting.'),
      teacher: L(
        'Первым в цилиндр приходит воздух из колбы, а его место занимает водород. Поэтому объём газа в цилиндре равен объёму выделившегося водорода.',
        'Air from the flask reaches the cylinder first, and hydrogen takes its place. So the gas volume in the cylinder equals the volume of hydrogen released.',
        'Silindrga avval kolbadagi havo keladi, uning o‘rnini vodorod egallaydi. Shuning uchun silindrdagi gaz hajmi ajralgan vodorod hajmiga teng.',
      ),
      mistake: L('Конец трубки не под цилиндром — пузырьки уходят мимо.', 'The tube end is not under the cylinder — the bubbles escape past it.', 'Nay uchi silindr ostida emas — pufakchalar yonidan chiqib ketadi.'),
    },
    {
      id: 'collect',
      target: 'flask',
      gesture: { kind: 'tap' },
      seconds: 9,
      instruction: L('Дождитесь, пока цинк растворится и газ перестанет выделяться.', 'Wait until the zinc dissolves and the gas stops coming.', 'Rux erib, gaz ajralishi to‘xtaguncha kuting.'),
      observation: L('Гранулы тают, пузырьков всё меньше, вода в цилиндре перестала опускаться. В жизни — 10–15 минут.', 'The granules melt away, fewer and fewer bubbles, the water in the cylinder stops falling. In real life — 10–15 minutes.', 'Donachalar erib boradi, pufakchalar kamayadi, silindrdagi suv pasayishdan to‘xtaydi. Hayotda — 10–15 daqiqa.'),
      how: L('Нажмите на колбу — время ускорено.', 'Tap the flask — time is sped up.', 'Kolbani bosing — vaqt tezlashtirilgan.'),
      teacher: L(
        'Кислота расходуется и разбавляется — реакция замедляется. Газ измеряют, когда он остыл до температуры класса.',
        'The acid is used up and diluted — the reaction slows down. The gas is measured once it has cooled to room temperature.',
        'Kislota sarflanib suyuladi — reaksiya sekinlashadi. Gaz sinf haroratigacha sovigach o‘lchanadi.',
      ),
      mistake: L('Измеряют объём слишком рано — часть водорода ещё не выделилась.', 'Measuring too early — part of the hydrogen has not formed yet.', 'Hajmni juda erta o‘lchash — vodorodning bir qismi hali ajralmagan.'),
    },
    {
      id: 'level',
      target: 'gas-cylinder',
      gesture: { kind: 'swipe', from: [ZH.trough[0], 0.27, ZH.trough[2]], to: [ZH.trough[0], 0.18, ZH.trough[2]], lead: 0.8 },
      seconds: 3.4,
      instruction: L('Отведите трубку, выровняйте уровни воды в цилиндре и в ванне и снимите объём газа.', 'Move the tube away, level the water in the cylinder with the trough and read the gas volume.', 'Nayni chetga oling, silindr va vannadagi suv sathlarini tenglang va gaz hajmini o‘qing.'),
      observation: L('Уровни совпали; по шкале цилиндра — объём газа при температуре класса.', 'The levels match; the cylinder scale shows the gas volume at room temperature.', 'Sathlar tenglashdi; silindr shkalasida — sinf haroratidagi gaz hajmi.'),
      how: L('Проведите по цилиндру вниз — опустите его в ванну.', 'Swipe down the cylinder — lower it into the trough.', 'Silindr bo‘ylab pastga suring — uni vannaga tushiring.'),
      teacher: L(
        'Когда уровни равны, давление газа в цилиндре равно атмосферному. Только такой объём можно приводить к нормальным условиям.',
        'When the levels are equal, the gas pressure in the cylinder equals atmospheric pressure. Only this volume can be converted to STP.',
        'Sathlar teng bo‘lganda silindrdagi gaz bosimi atmosfera bosimiga teng. Faqat shu hajmni normal sharoitga keltirish mumkin.',
      ),
      mistake: L('Читают объём, когда вода в цилиндре выше, чем в ванне: газ разрежен, объём завышен.', 'Reading while the water in the cylinder is higher than in the trough: the gas is rarefied and the volume is too high.', 'Silindrdagi suv vannadagidan baland turganda o‘qish: gaz siyraklashgan, hajm oshib ketadi.'),
    },
    {
      id: 'temp',
      target: 'thermometer',
      gesture: { kind: 'drag', from: [ZH.thermometer[0] + 0.1, 0.01, ZH.thermometer[2]], to: [ZH.trough[0] + ZH.thermoIn[0], 0.12, ZH.trough[2] + ZH.thermoIn[2]], lead: 0.55 },
      seconds: 3.2,
      instruction: L('Опустите термометр в воду ванны и запишите температуру.', 'Put the thermometer into the trough water and record the temperature.', 'Termometrni vanna suviga tushiring va haroratni yozing.'),
      observation: L('Столбик остановился: газ над водой имеет температуру воды.', 'The column has stopped: the gas over water has the temperature of the water.', 'Ustuncha to‘xtadi: suv ustidagi gaz suv haroratiga ega.'),
      how: L('Перетащите термометр к ванне.', 'Drag the thermometer to the trough.', 'Termometrni vannaga torting.'),
      teacher: L(
        'При 20–22 °C газ занимает на 7–8 % больший объём, чем при 0 °C. Приводим к н.у.: V₀ = V · 273 / (273 + t).',
        'At 20–22 °C a gas takes up 7–8 % more volume than at 0 °C. Convert to STP: V₀ = V · 273 / (273 + t).',
        '20–22 °C da gaz 0 °C dagidan 7–8 % ko‘p hajm egallaydi. N.sh.ga keltiramiz: V₀ = V · 273 / (273 + t).',
      ),
      mistake: L('Берут температуру «на глаз»: ошибка в 5 °C даёт почти 2 % в объёме.', 'Guessing the temperature: a 5 °C error gives almost 2 % in volume.', 'Haroratni «chamalab» olish: 5 °C xato hajmda deyarli 2 % beradi.'),
    },
  ],
  focus: [
    { from: 1.45, to: 1.97, point: [ZH.scales[0], 0.035, ZH.scales[2] + 0.07], dist: 0.3 },
    { from: 3.55, to: 3.97, point: [ZH.cylinder[0], 0.12, ZH.cylinder[2]], dist: 0.26 },
    { from: 4.5, to: 4.97, point: [ZH.flask[0], 0.06, ZH.flask[2]], dist: 0.3 },
    { from: 5.58, to: 5.97, point: [ZH.trough[0] - 0.12, 0.12, ZH.trough[2]], dist: 0.55 },
    { from: 6.12, to: 6.9, point: [ZH.trough[0] - 0.05, 0.13, ZH.trough[2]], dist: 0.5 },
    { from: 7.45, to: 7.98, point: [ZH.trough[0], 0.07, ZH.trough[2]], dist: 0.24 },
    { from: 8.6, to: 8.98, point: [ZH.trough[0] + ZH.thermoIn[0] - 0.03, 0.13, ZH.trough[2] + ZH.thermoIn[2]], dist: 0.24 },
  ],
  labels: [
    { at: 2.9, pos: [ZH.scales[0], 0.14, ZH.scales[2]], text: L('пустая лодочка — 0,00 г', 'empty boat — 0.00 g', 'bo‘sh qayiqcha — 0,00 g') },
    { at: 4.62, pos: [ZH.flask[0] + 0.06, 0.12, ZH.flask[2]], text: L('H₂↑ — цинк «кипит»', 'H₂↑ — the zinc “boils”', 'H₂↑ — rux «qaynaydi»') },
    { at: 5.75, pos: [ZH.trough[0], 0.35, ZH.trough[2]], text: L('газ вытесняет воду', 'the gas pushes the water out', 'gaz suvni siqib chiqaradi') },
    { at: 6.1, pos: [ZH.flask[0], 0.22, ZH.flask[2]], text: L('ускорено: в жизни 10–15 мин', 'sped up: 10–15 min in real life', 'tezlashtirilgan: hayotda 10–15 daq') },
    { at: 7.82, pos: [ZH.trough[0] - 0.08, 0.13, ZH.trough[2] + 0.04], text: L('уровни равны: p = p атм', 'levels equal: p = p atm', 'sathlar teng: p = p atm') },
  ],
  measurements: [
    { key: 'mZn', label: 'm(Zn)', what: L('масса цинка', 'mass of zinc', 'rux massasi'), instrument: 'scales', afterStep: 1 },
    { key: 'vAcid', label: 'V(HCl)', what: L('объём 10 %-й соляной кислоты', 'volume of 10 % hydrochloric acid', '10 % li xlorid kislota hajmi'), instrument: 'cyl50', afterStep: 3 },
    { key: 'V', label: 'V(газа)', what: L('объём газа при температуре класса', 'gas volume at room temperature', 'sinf haroratidagi gaz hajmi'), instrument: 'gas500', afterStep: 7 },
    { key: 't', label: 't', what: L('температура воды и газа', 'temperature of the water and gas', 'suv va gaz harorati'), instrument: 'thermometer', afterStep: 8 },
    { key: 'V0', label: 'V₀(H₂)', what: L('объём водорода при н.у. (расчёт)', 'hydrogen volume at STP (calculated)', 'n.sh.dagi vodorod hajmi (hisob)'), instrument: 'gas500', afterStep: 8, derived: true },
  ],
  simulate: (rng) => {
    const mZn = rng.weigh(1.3, 0.015)
    const vAcid = rng.read('cyl50', 25)
    const tTrue = rng.between(19, 22)
    const n = mZn / 65
    // газ над водой влажный: к водороду добавляется водяной пар (2,2–2,6 кПа); часть H₂ ушла, пока колба была открыта
    const wet = P0_KPA / (P0_KPA - waterVaporKPa(tTrue))
    const loss = rng.between(0.012, 0.03)
    const V = rng.read('gas500', gasMlAt(n, tTrue) * wet * (1 - loss))
    const t = rng.read('thermometer', tTrue)
    return { mZn, vAcid, V, t, V0: toNormalMl(V, t) }
  },
  given: (v, lang) => [
    tr(lang, 'Задача: m(Zn) = 26 г, HCl — в избытке; m(H₂) — ?, V(H₂, н.у.) — ?', 'Problem: m(Zn) = 26 g, HCl in excess; m(H₂) — ?, V(H₂, STP) — ?', 'Masala: m(Zn) = 26 g, HCl — mo‘l; m(H₂) — ?, V(H₂, n.sh.) — ?'),
    tr(
      lang,
      `Опыт (в 20 раз меньше): m(Zn) = ${f(v.mZn!, 2, lang)} г; V(HCl 10 %) = ${f(v.vAcid!, 1, lang)} мл — избыток (нужно ≈ 14 мл)`,
      `Experiment (20 times smaller): m(Zn) = ${f(v.mZn!, 2, lang)} g; V(HCl 10 %) = ${f(v.vAcid!, 1, lang)} ml — excess (≈ 14 ml needed)`,
      `Tajriba (20 marta kichik): m(Zn) = ${f(v.mZn!, 2, lang)} g; V(HCl 10 %) = ${f(v.vAcid!, 1, lang)} ml — mo‘l (≈ 14 ml kerak)`,
    ),
    tr(
      lang,
      `Газ над водой: V = ${f(v.V!, 1, lang)} мл при t = ${f(v.t!, 1, lang)} °C, p ≈ 101,3 кПа`,
      `Gas over water: V = ${f(v.V!, 1, lang)} ml at t = ${f(v.t!, 1, lang)} °C, p ≈ 101.3 kPa`,
      `Suv ustidagi gaz: V = ${f(v.V!, 1, lang)} ml, t = ${f(v.t!, 1, lang)} °C, p ≈ 101,3 kPa`,
    ),
    tr(lang, 'M(Zn) = 65 г/моль, M(H₂) = 2 г/моль, Vm = 22,4 л/моль', 'M(Zn) = 65 g/mol, M(H₂) = 2 g/mol, Vm = 22.4 l/mol', 'M(Zn) = 65 g/mol, M(H₂) = 2 g/mol, Vm = 22,4 l/mol'),
  ],
  solution: (v, lang) => {
    const n = n0(v)
    return [
      tr(lang, 'Zn + 2HCl → ZnCl₂ + H₂↑: из 1 моль Zn — 1 моль H₂', 'Zn + 2HCl → ZnCl₂ + H₂↑: 1 mol of Zn gives 1 mol of H₂', 'Zn + 2HCl → ZnCl₂ + H₂↑: 1 mol Zn dan 1 mol H₂'),
      tr(
        lang,
        `V₀ = V · 273 / (273 + t) = ${f(v.V!, 1, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(v.V0!, 1, lang)} мл (н.у.)`,
        `V₀ = V · 273 / (273 + t) = ${f(v.V!, 1, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(v.V0!, 1, lang)} ml (STP)`,
        `V₀ = V · 273 / (273 + t) = ${f(v.V!, 1, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(v.V0!, 1, lang)} ml (n.sh.)`,
      ),
      tr(
        lang,
        `n(H₂) = V₀ / Vm = ${f(v.V0!, 1, lang)} / 22 400 = ${f(n, 4, lang)} моль (по цинку: ${f(v.mZn!, 2, lang)} / 65 = ${f(v.mZn! / 65, 4, lang)} моль)`,
        `n(H₂) = V₀ / Vm = ${f(v.V0!, 1, lang)} / 22 400 = ${f(n, 4, lang)} mol (from the zinc: ${f(v.mZn!, 2, lang)} / 65 = ${f(v.mZn! / 65, 4, lang)} mol)`,
        `n(H₂) = V₀ / Vm = ${f(v.V0!, 1, lang)} / 22 400 = ${f(n, 4, lang)} mol (rux bo‘yicha: ${f(v.mZn!, 2, lang)} / 65 = ${f(v.mZn! / 65, 4, lang)} mol)`,
      ),
      tr(
        lang,
        `m(H₂) в опыте = n · M = ${f(n, 4, lang)} · 2 = ${f(n * 2, 3, lang)} г — весы с ценой 0,01 г такую массу честно не покажут`,
        `m(H₂) in the experiment = n · M = ${f(n, 4, lang)} · 2 = ${f(n * 2, 3, lang)} g — a 0.01 g balance cannot honestly show this mass`,
        `Tajribada m(H₂) = n · M = ${f(n, 4, lang)} · 2 = ${f(n * 2, 3, lang)} g — 0,01 g li tarozi bu massani aniq ko‘rsatmaydi`,
      ),
      tr(
        lang,
        `Масштаб ×20: V(H₂) = ${f(v.V0!, 1, lang)} мл · 20 = ${f((v.V0! * SCALE) / 1000, 2, lang)} л; m(H₂) = ${f(n * 2, 4, lang)} г · 20 = ${f(n * 2 * SCALE, 2, lang)} г`,
        `Scale ×20: V(H₂) = ${f(v.V0!, 1, lang)} ml · 20 = ${f((v.V0! * SCALE) / 1000, 2, lang)} l; m(H₂) = ${f(n * 2, 4, lang)} g · 20 = ${f(n * 2 * SCALE, 2, lang)} g`,
        `Masshtab ×20: V(H₂) = ${f(v.V0!, 1, lang)} ml · 20 = ${f((v.V0! * SCALE) / 1000, 2, lang)} l; m(H₂) = ${f(n * 2, 4, lang)} g · 20 = ${f(n * 2 * SCALE, 2, lang)} g`,
      ),
      tr(
        lang,
        `Ответ: m(H₂) ≈ ${f(n * 2 * SCALE, 2, lang)} г; V(H₂) ≈ ${f((v.V0! * SCALE) / 1000, 2, lang)} л`,
        `Answer: m(H₂) ≈ ${f(n * 2 * SCALE, 2, lang)} g; V(H₂) ≈ ${f((v.V0! * SCALE) / 1000, 2, lang)} l`,
        `Javob: m(H₂) ≈ ${f(n * 2 * SCALE, 2, lang)} g; V(H₂) ≈ ${f((v.V0! * SCALE) / 1000, 2, lang)} l`,
      ),
    ]
  },
  compare: [
    {
      label: L('V₀(H₂) при н.у.', 'V₀(H₂) at STP', 'V₀(H₂) n.sh.da'),
      unit: 'ml',
      decimals: 0,
      measured: (v) => v.V0!,
      predicted: (v) => gasNormalMl(v.mZn! / 65),
      book: 448,
      tolerancePct: 3,
    },
  ],
  reconcile: L(
    'Объём чуть отличается от расчёта по цинку, и это честная физика. Газ над водой влажный: к водороду примешан водяной пар (2,2–2,6 кПа), он добавляет 2–3 % объёма. Пока колба была открыта, часть водорода ушла в воздух, немного растворилось в воде (−1…3 %). Термометр ±0,5 °C даёт ±0,2 %, отсчёт по цилиндру ±2,5 мл — ±0,5 %, весы ±0,01 г — ±0,8 %. Убыль массы колбы (0,04 г) не взвешивают: это на пределе весов, а замена воздуха в колбе лёгким водородом сама меняет показание примерно на 0,1 г. Поэтому массу водорода считают по объёму: m = V₀ / 22,4 · 2.',
    'The volume differs slightly from the calculation from the zinc, and that is honest physics. Gas over water is moist: water vapour (2.2–2.6 kPa) is mixed with the hydrogen and adds 2–3 % to the volume. While the flask was open, some hydrogen escaped and a little dissolved in water (−1…3 %). The thermometer (±0.5 °C) gives ±0.2 %, the cylinder reading (±2.5 ml) ±0.5 %, the balance (±0.01 g) ±0.8 %. The loss of mass of the flask (0.04 g) is not weighed: it is at the limit of the balance, and replacing the air in the flask with light hydrogen itself changes the reading by about 0.1 g. So the mass of hydrogen is calculated from its volume: m = V₀ / 22.4 · 2.',
    'Hajm rux bo‘yicha hisobdan biroz farq qiladi — bu halol fizika. Suv ustidagi gaz nam: vodorodga suv bug‘i (2,2–2,6 kPa) aralashgan, u hajmga 2–3 % qo‘shadi. Kolba ochiq turganda vodorodning bir qismi havoga chiqib ketdi, ozgina suvda eridi (−1…3 %). Termometr (±0,5 °C) ±0,2 %, silindr bo‘yicha o‘qish (±2,5 ml) ±0,5 %, tarozi (±0,01 g) ±0,8 % beradi. Kolba massasining kamayishi (0,04 g) tortilmaydi: bu tarozi chegarasida, kolbadagi havoning yengil vodorod bilan almashishi esa ko‘rsatkichni taxminan 0,1 g ga o‘zgartiradi. Shuning uchun vodorod massasi hajm bo‘yicha hisoblanadi: m = V₀ / 22,4 · 2.',
  ),
  conclusion: L(
    'Из 1,30 г цинка получилось около 0,45 л водорода (н.у.) — 0,02 моль. В задаче цинка в 20 раз больше: m(H₂) = 0,8 г, V(H₂) = 8,96 л. В растворе остаётся хлорид цинка — 0,4 моль · 136 г/моль = 54,4 г ZnCl₂ (как в книге).',
    'From 1.30 g of zinc we got about 0.45 l of hydrogen (STP) — 0.02 mol. The problem has 20 times more zinc: m(H₂) = 0.8 g, V(H₂) = 8.96 l. Zinc chloride stays in the solution — 0.4 mol · 136 g/mol = 54.4 g of ZnCl₂ (as in the book).',
    '1,30 g ruxdan taxminan 0,45 l vodorod (n.sh.) — 0,02 mol olindi. Masalada rux 20 marta ko‘p: m(H₂) = 0,8 g, V(H₂) = 8,96 l. Eritmada rux xlorid qoladi — 0,4 mol · 136 g/mol = 54,4 g ZnCl₂ (kitobdagidek).',
  ),
  story: {
    equation: 'Zn + 2H⁺ → Zn²⁺ + H₂↑',
    text: L(
      'Атомы цинка на поверхности гранулы отдают по два электрона ионам H⁺ кислоты. Атомы водорода попарно соединяются в молекулы H₂ — это пузырьки газа. Ионы Zn²⁺ уходят в раствор к ионам Cl⁻: получается раствор хлорида цинка. На каждый атом цинка — одна молекула водорода.',
      'Zinc atoms on the surface of the granule give two electrons each to the H⁺ ions of the acid. Hydrogen atoms join in pairs into H₂ molecules — the gas bubbles. Zn²⁺ ions go into the solution next to the Cl⁻ ions: a zinc chloride solution forms. One hydrogen molecule for every zinc atom.',
      'Donacha sirtidagi rux atomlari kislotaning H⁺ ionlariga ikkitadan elektron beradi. Vodorod atomlari juft-juft birikib H₂ molekulalarini hosil qiladi — bular gaz pufakchalari. Zn²⁺ ionlari eritmaga, Cl⁻ ionlari yoniga o‘tadi: rux xlorid eritmasi hosil bo‘ladi. Har bir rux atomiga — bitta vodorod molekulasi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показало, что выделяется газ?', 'What showed that a gas was being released?', 'Gaz ajralayotganini nima ko‘rsatdi?'),
      options: [
        L('Пузырьки на цинке и вода, уходящая из цилиндра', 'Bubbles on the zinc and water leaving the cylinder', 'Ruxdagi pufakchalar va silindrdan chiqayotgan suv'),
        L('Раствор посинел', 'The solution turned blue', 'Eritma ko‘kardi'),
        L('Выпал белый осадок', 'A white precipitate formed', 'Oq cho‘kma tushdi'),
      ],
      correct: 0,
      why: L('Водород — бесцветный газ: его видно по пузырькам и по воде, которую он вытесняет из цилиндра.', 'Hydrogen is a colourless gas: it shows itself as bubbles and by the water it pushes out of the cylinder.', 'Vodorod — rangsiz gaz: u pufakchalar va silindrdan siqib chiqargan suv orqali ko‘rinadi.'),
    },
    {
      id: 'type',
      q: L('К какому типу относится реакция цинка с соляной кислотой?', 'What type of reaction is zinc with hydrochloric acid?', 'Ruxning xlorid kislota bilan reaksiyasi qaysi turga kiradi?'),
      options: [
        L('Замещения', 'Substitution', 'O‘rin olish'),
        L('Обмена', 'Exchange', 'Almashinish'),
        L('Соединения', 'Combination', 'Birikish'),
      ],
      correct: 0,
      why: L('Простое вещество цинк замещает водород в кислоте: Zn + 2HCl → ZnCl₂ + H₂↑.', 'The simple substance zinc replaces hydrogen in the acid: Zn + 2HCl → ZnCl₂ + H₂↑.', 'Oddiy modda rux kislotadagi vodorod o‘rnini oladi: Zn + 2HCl → ZnCl₂ + H₂↑.'),
    },
    {
      id: 'product',
      q: L('Что осталось в колбе, когда цинк растворился?', 'What was left in the flask when the zinc had dissolved?', 'Rux erib bo‘lgach, kolbada nima qoldi?'),
      options: [
        L('Раствор ZnCl₂ с остатком соляной кислоты', 'A ZnCl₂ solution with leftover hydrochloric acid', 'Xlorid kislota qoldig‘i bilan ZnCl₂ eritmasi'),
        L('Чистая вода', 'Pure water', 'Toza suv'),
        L('Твёрдый оксид цинка', 'Solid zinc oxide', 'Qattiq rux oksidi'),
      ],
      correct: 0,
      why: L('Цинк перешёл в раствор ионами Zn²⁺, а кислоту брали в избытке — её часть осталась.', 'The zinc went into the solution as Zn²⁺ ions, and the acid was in excess — some of it is left.', 'Rux Zn²⁺ ionlari holida eritmaga o‘tdi, kislota esa mo‘l olingan — uning bir qismi qoldi.'),
    },
  ],
}
