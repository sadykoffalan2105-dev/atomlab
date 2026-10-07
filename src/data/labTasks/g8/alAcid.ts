/**
 * Kimyo 8, с. 140, задача 4: сколько граммов 20 %-го раствора серной кислоты нужно для растворения 5,4 г алюминия.
 * Опыт в 10 раз меньше (в вытяжном шкафу): 0,54 г алюминиевой стружки в колбе на электроплитке, кислота — из бюретки
 * 25 мл. Без нагрева алюминий почти не реагирует (плёнка Al₂O₃), при ~60 °C — бурно; кислоту добавляют порциями,
 * пока не растворится последний кусочек. m(р-ра) = V · ρ (ρ = 1,14 г/мл — с этикетки).
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

type V3 = readonly [number, number, number]

/** Раскладка установки в вытяжном шкафу (локальные координаты, верх стола y = 0). */
export const AL = {
  ppe: [-0.05, 0, 0.19] as V3,
  scales: [-0.36, 0, 0.07] as V3,
  jar: [-0.42, 0, -0.14] as V3,
  spatula: [-0.3, 0, 0.225] as V3,
  /** Колба сначала стоит на столе у весов. */
  flask0: [-0.14, 0, -0.06] as V3,
  /** Электроплитка (центр основания) и место колбы на конфорке. */
  plate: [0.08, 0, -0.03] as V3,
  seat: [0.08, 0.054, -0.042] as V3,
  /** Стержень штатива бюретки [x, z] — справа от плитки. */
  rod: [0.245, -0.042] as const,
  /** Конец носика бюретки: на 8 мм выше горла колбы на плитке. */
  tipY: 0.054 + 0.105 + 0.008,
  waste: [0.205, 0, 0.13] as V3,
  bottle: [0.32, 0, 0.16] as V3,
  funnelRest: [0.42, 0, 0.07] as V3,
  /** Высота крана над столом (для жеста). */
  cockY: 0.054 + 0.105 + 0.008 + 0.042,
  /** Риска «0» бюретки над столом (носик + 0,075 + 0,2631). */
  zeroY: 0.054 + 0.105 + 0.008 + 0.075 + 25e-6 / (Math.PI * 0.0055 * 0.0055),
}

const RHO = 1.14
const SCALE = 10
const f = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
/** Сколько 20 %-го раствора (г) нужно для m(Al) по уравнению. */
const needSolution = (mAl: number) => ((mAl / 27) * 1.5 * 98) / 0.2
const mSol = (v: LabTaskValues) => v.V! * RHO

export const TASK_G8_AL_ACID: LabTask = {
  id: 'task-g8-al-acid',
  grade: 8,
  page: 140,
  source: L('Kimyo 8 · с. 140, задача 4', 'Kimyo 8 · p. 140, problem 4', 'Kimyo 8 · 140-bet, 4-masala'),
  bookKind: 'task',
  title: L('Сколько кислоты растворит алюминий', 'How much acid dissolves the aluminium', 'Alyuminiyni qancha kislota eritadi'),
  statement: L(
    'Сколько граммов 20 %-ного раствора серной кислоты потребуется для растворения 5,4 г алюминия?',
    'How many grams of a 20 % sulfuric acid solution are needed to dissolve 5.4 g of aluminium?',
    '5,4 g alyuminiyni eritish uchun 20 % li sulfat kislota eritmasidan necha gramm kerak bo‘ladi?',
  ),
  bookNote: L(
    'В учебнике опечатка: «для расплавления 5,4 г алюминия». Алюминий здесь не плавят, а растворяют в кислоте — верно «для растворения».',
    'The textbook has a misprint: “to melt 5.4 g of aluminium”. The aluminium is not melted here but dissolved in acid — it should read “to dissolve”.',
    'Darslikda xato bor: «5,4 g alyuminiyni suyuqlantirish uchun». Bu yerda alyuminiy suyuqlantirilmaydi, kislotada eritiladi — to‘g‘risi «eritish uchun».',
  ),
  equation: '2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂↑',
  kind: 'substitution',
  type: 'solution-w',
  difficulty: 3,
  answers: [
    {
      key: 'mSol',
      label: 'm(H₂SO₄ 20 %)',
      what: L('масса 20 %-го раствора серной кислоты', 'mass of the 20 % sulfuric acid solution', '20 % li sulfat kislota eritmasining massasi'),
      unit: L('г', 'g', 'g'),
      book: 147,
      decimals: 0,
      fromRun: (v) => (mSol(v) * 5.4) / v.mAl!,
      altFromRun: (v) => mSol(v) * 10,
    },
  ],
  labScale: {
    factor: SCALE,
    note: L(
      'В задаче 5,4 г алюминия — на них уйдёт почти 130 мл кислоты и выделится 6,7 л водорода. Берём алюминия в 10 раз меньше (0,54 г): кислоты нужно около 13 мл — ровно для бюретки на 25 мл. Ответ пересчитываем на 5,4 г.',
      'The problem has 5.4 g of aluminium — that needs almost 130 ml of acid and gives 6.7 l of hydrogen. We take 10 times less aluminium (0.54 g): about 13 ml of acid is needed — just right for a 25 ml burette. The answer is scaled back to 5.4 g.',
      'Masalada 5,4 g alyuminiy — unga deyarli 130 ml kislota ketadi va 6,7 l vodorod ajraladi. Alyuminiyni 10 marta kam olamiz (0,54 g): kislota taxminan 13 ml kerak — 25 ml li byuretka uchun ayni muddao. Javobni 5,4 g ga qayta hisoblaymiz.',
    ),
  },
  instruments: ['scales', 'burette25'],
  equipment: [
    L('Электронные весы (0,01 г), лодочка, шпатель', 'Electronic balance (0.01 g), weighing boat, spatula', 'Elektron tarozi (0,01 g), qayiqcha, shpatel'),
    L('Алюминиевая стружка; серная кислота 20 % (ρ = 1,14 г/мл — на этикетке)', 'Aluminium turnings; 20 % sulfuric acid (ρ = 1.14 g/ml — on the label)', 'Alyuminiy qirindisi; 20 % li sulfat kislota (ρ = 1,14 g/ml — yorliqda)'),
    L('Бюретка 25 мл на штативе, маленькая воронка, стакан для слива', '25 ml burette on a stand, small funnel, waste beaker', 'Shtativdagi 25 ml byuretka, kichik voronka, to‘kish uchun stakan'),
    L('Коническая колба 100 мл, лабораторная электроплитка', '100 ml conical flask, laboratory hot plate', '100 ml konussimon kolba, laboratoriya elektr plitkasi'),
  ],
  safety: [
    L('Очки, перчатки и халат: горячая серная кислота разъедает кожу, ткань и глаза.', 'Goggles, gloves and a lab coat: hot sulfuric acid harms skin, cloth and eyes.', 'Ko‘zoynak, qo‘lqop va xalat: issiq sulfat kislota teri, mato va ko‘zni yemiradi.'),
    L('Работаем в вытяжном шкафу: выделяется водород, над горячей колбой — брызги кислоты.', 'Work in the fume hood: hydrogen is released, and acid spray rises from the hot flask.', 'Mo‘rili shkafda ishlaymiz: vodorod ajraladi, issiq kolba ustida kislota sachraydi.'),
    L('Греем электроплиткой, не спиртовкой: водород с воздухом взрывается от огня. Колбу пробкой не закрывать.', 'Heat with a hot plate, not a spirit lamp: hydrogen mixed with air explodes from a flame. Do not stopper the flask.', 'Spirt lampa emas, elektr plitka bilan isitamiz: vodorod havo bilan olovdan portlaydi. Kolbani tiqin bilan yopmang.'),
  ],
  gear: ['goggles', 'gloves', 'coat'],
  place: 'hood',
  steps: [
    {
      id: 'ppe',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте очки, перчатки и халат.', 'Put on goggles, gloves and a lab coat.', 'Ko‘zoynak, qo‘lqop va xalat kiying.'),
      observation: L('Защита надета, тяга вытяжного шкафа работает.', 'Protection is on, the fume hood draught is working.', 'Himoya kiyildi, mo‘rili shkaf tortmasi ishlayapti.'),
      how: L('Нажмите на поднос со средствами защиты.', 'Tap the tray with the protective gear.', 'Himoya vositalari turgan patnisni bosing.'),
      teacher: L(
        'Серная кислота отнимает воду у кожи и ткани, а горячая — ещё и брызгает. Поэтому сегодня и очки, и перчатки, и халат.',
        'Sulfuric acid pulls water out of skin and cloth, and hot acid also spatters. So today we need goggles, gloves and a coat.',
        'Sulfat kislota teri va matodan suvni tortib oladi, issig‘i esa sachraydi ham. Shuning uchun bugun ko‘zoynak, qo‘lqop va xalat shart.',
      ),
    },
    {
      id: 'weigh',
      target: 'spatula',
      gesture: { kind: 'drag', from: [AL.spatula[0] + 0.04, 0.01, AL.spatula[2]], to: [AL.scales[0], 0.07, AL.scales[2] - 0.012], lead: 0.25 },
      seconds: 5.5,
      instruction: L('Обнулите весы с лодочкой (T) и наберите шпателем 0,54 г алюминиевой стружки.', 'Tare the balance with the boat (T) and add 0.54 g of aluminium turnings with the spatula.', 'Qayiqchali tarozini nolga keltiring (T) va shpatel bilan 0,54 g alyuminiy qirindisi oling.'),
      observation: L('Лёгкая блестящая стружка: показание растёт и останавливается около 0,54 г, загорается ○.', 'Light shiny turnings: the reading grows and stops near 0.54 g, the ○ lights up.', 'Yengil yaltiroq qirindi: ko‘rsatkich oshib, 0,54 g atrofida to‘xtaydi, ○ yonadi.'),
      how: L('Перетащите шпатель от банки с алюминием к лодочке на весах.', 'Drag the spatula from the aluminium jar to the boat on the balance.', 'Shpatelni alyuminiy bankasidan tarozidagi qayiqchaga torting.'),
      teacher: L(
        '0,54 г алюминия — это 0,02 моль атомов Al. Каждому атому алюминия предстоит отдать по три электрона.',
        '0.54 g of aluminium is 0.02 mol of Al atoms. Each aluminium atom will have to give away three electrons.',
        '0,54 g alyuminiy — bu 0,02 mol Al atomi. Har bir alyuminiy atomi uchtadan elektron berishi kerak.',
      ),
      mistake: L('Записывают показание, пока цифры «бегут». Ждите значок ○.', 'Writing down the reading while the digits are still changing. Wait for the ○ mark.', 'Raqamlar «yugurib» turganda yozib olish. ○ belgisini kuting.'),
    },
    {
      id: 'metal',
      target: 'boat',
      gesture: { kind: 'drag', from: [AL.scales[0], 0.055, AL.scales[2] - 0.012], to: [AL.flask0[0] + 0.03, 0.15, AL.flask0[2]], lead: 0.38 },
      seconds: 3.4,
      instruction: L('Пересыпьте алюминий в коническую колбу и верните пустую лодочку на весы.', 'Tip the aluminium into the conical flask and put the empty boat back on the balance.', 'Alyuminiyni konussimon kolbaga to‘king va bo‘sh qayiqchani taroziga qaytaring.'),
      observation: L('Стружка на дне колбы; пустая лодочка — 0,00 г: весь металл в колбе.', 'The turnings lie at the bottom of the flask; the empty boat reads 0.00 g — all the metal is in the flask.', 'Qirindi kolba tubida; bo‘sh qayiqcha — 0,00 g: barcha metall kolbada.'),
      how: L('Перетащите лодочку к горлу колбы.', 'Drag the boat to the neck of the flask.', 'Qayiqchani kolba bo‘g‘ziga torting.'),
      teacher: L(
        'Пустая лодочка снова показывает 0,00 г — значит, ничего не прилипло и не просыпалось мимо.',
        'The empty boat shows 0.00 g again — nothing stuck to it or spilled past the neck.',
        'Bo‘sh qayiqcha yana 0,00 g ko‘rsatadi — demak, hech narsa yopishmadi va to‘kilmadi.',
      ),
    },
    {
      id: 'fill',
      target: 'bottle',
      gesture: { kind: 'drag', from: [AL.bottle[0], 0.08, AL.bottle[2]], to: [AL.seat[0], 0.48, AL.seat[2]], lead: 0.34 },
      seconds: 6,
      instruction: L('Через воронку налейте в бюретку 20 %-ю серную кислоту чуть выше нуля и выньте воронку.', 'Through the funnel, fill the burette with 20 % sulfuric acid slightly above zero, then take the funnel out.', 'Voronka orqali byuretkaga 20 % li sulfat kislotani noldan biroz yuqori quying va voronkani oling.'),
      observation: L('Кислота стоит немного выше риски «0»; воронка снята и стоит на столе.', 'The acid stands a little above the “0” mark; the funnel is out and stands on the bench.', 'Kislota «0» belgisidan biroz yuqorida; voronka olingan va stolda turibdi.'),
      how: L('Перетащите склянку с кислотой к воронке на бюретке.', 'Drag the acid bottle to the funnel on the burette.', 'Kislota shishasini byuretkadagi voronkaga torting.'),
      teacher: L(
        'Бюретку заполняют выше нуля, а воронку вынимают до отсчёта: капли с неё стекали бы и меняли уровень.',
        'A burette is filled above zero, and the funnel is removed before reading: drops running off it would change the level.',
        'Byuretka noldan yuqori to‘ldiriladi, voronka esa o‘qishdan oldin olinadi: undan oqqan tomchilar sathni o‘zgartirardi.',
      ),
      mistake: L('Оставляют воронку в бюретке — с неё капает, и начальный отсчёт «уплывает».', 'Leaving the funnel in the burette — it drips and the starting reading drifts.', 'Voronkani byuretkada qoldirish — undan tomadi va boshlang‘ich hisob «suzib ketadi».'),
    },
    {
      id: 'zero',
      target: 'waste',
      gesture: { kind: 'drag', from: [AL.waste[0], 0.04, AL.waste[2]], to: [AL.seat[0], 0.1, AL.seat[2]], lead: 0.3 },
      seconds: 5,
      instruction: L('Подставьте стакан для слива, краном спустите кислоту до риски «0» и уберите стакан.', 'Put the waste beaker under the tip, run the acid down to the “0” mark with the tap and take the beaker away.', 'To‘kish stakanini qo‘ying, jo‘mrak bilan kislotani «0» belgisigacha tushiring va stakanni oling.'),
      observation: L('Нижний край мениска — точно на риске «0», носик заполнен кислотой без пузырька воздуха.', 'The bottom of the meniscus sits exactly on the “0” mark, the tip is filled with acid with no air bubble.', 'Meniskning pastki cheti — aynan «0» belgisida, uchi havo pufakchasisiz kislota bilan to‘ldi.'),
      how: L('Перетащите стакан для слива под носик бюретки.', 'Drag the waste beaker under the burette tip.', 'To‘kish stakanini byuretka uchi ostiga torting.'),
      teacher: L(
        'Глаз — на уровне мениска, отсчёт — по его нижнему краю. Носик заполняют заранее: пузырёк воздуха в носике «съел» бы часть объёма.',
        'Eye level with the meniscus, read at its bottom edge. The tip is filled beforehand: an air bubble in it would “eat” part of the volume.',
        'Ko‘z — menisk sathida, hisob — uning pastki cheti bo‘yicha. Uchi oldindan to‘ldiriladi: undagi havo pufakchasi hajmning bir qismini «yeb» qo‘yardi.',
      ),
      mistake: L('Смотрят на мениск сверху — отсчёт получается меньше настоящего.', 'Looking at the meniscus from above — the reading comes out smaller than it really is.', 'Meniskka yuqoridan qarash — hisob haqiqiysidan kichik chiqadi.'),
    },
    {
      id: 'plate',
      target: 'flask',
      gesture: { kind: 'drag', from: [AL.flask0[0], 0.06, AL.flask0[2]], to: [AL.seat[0], 0.1, AL.seat[2]], lead: 0.7 },
      seconds: 3.4,
      instruction: L('Поставьте колбу с алюминием на плитку под носик бюретки.', 'Put the flask with the aluminium on the hot plate under the burette tip.', 'Alyuminiyli kolbani plitkaga, byuretka uchi ostiga qo‘ying.'),
      observation: L('Колба стоит на холодной конфорке, носик бюретки — над горлом.', 'The flask stands on the cold plate, the burette tip is above the neck.', 'Kolba sovuq konforkada, byuretka uchi bo‘g‘iz ustida.'),
      how: L('Перетащите колбу на плитку.', 'Drag the flask onto the hot plate.', 'Kolbani plitkaga torting.'),
      teacher: L(
        'Носик бюретки — над горлом колбы: так ни одна капля не пройдёт мимо, а пары не попадут в бюретку.',
        'The burette tip is above the neck of the flask: no drop misses, and no vapour gets into the burette.',
        'Byuretka uchi kolba bo‘g‘zi ustida: birorta tomchi ham tashqariga ketmaydi, bug‘ esa byuretkaga kirmaydi.',
      ),
    },
    {
      id: 'cold',
      target: 'stopcock',
      gesture: { kind: 'swipe', from: [AL.seat[0] + 0.03, AL.cockY, AL.seat[2] + 0.02], to: [AL.seat[0] - 0.03, AL.cockY, AL.seat[2] + 0.02], lead: 0.15 },
      seconds: 4.5,
      instruction: L('Откройте кран и впустите около 5 мл кислоты, не нагревая. Закройте кран.', 'Open the tap and let in about 5 ml of acid without heating. Close the tap.', 'Jo‘mrakni oching va isitmasdan taxminan 5 ml kislota quying. Jo‘mrakni yoping.'),
      observation: L('Кислота покрыла стружку, но пузырьков — единицы: металл почти не реагирует.', 'The acid covers the turnings, but there are only a few bubbles: the metal hardly reacts.', 'Kislota qirindini qopladi, ammo pufakchalar juda kam: metall deyarli reaksiyaga kirishmaydi.'),
      how: L('Проведите по ручке крана — поверните её вдоль бюретки.', 'Swipe across the tap handle — turn it along the burette.', 'Jo‘mrak dastasi bo‘ylab suring — uni byuretka bo‘ylab buring.'),
      teacher: L(
        'Алюминий всегда покрыт тонкой прочной плёнкой Al₂O₃. Холодная разбавленная кислота растворяет её очень медленно — металл до кислоты почти не добирается.',
        'Aluminium is always covered with a thin, tough Al₂O₃ film. Cold dilute acid dissolves it very slowly — the acid hardly reaches the metal.',
        'Alyuminiy doimo yupqa mustahkam Al₂O₃ parda bilan qoplangan. Sovuq suyultirilgan kislota uni juda sekin eritadi — kislota metallga deyarli yetmaydi.',
      ),
      mistake: L('Решают, что алюминий «не реагирует с кислотой», и льют её без меры.', 'Deciding that aluminium “does not react with acid” and pouring in acid without measure.', 'Alyuminiy «kislota bilan reaksiyaga kirishmaydi» deb o‘ylab, kislotani o‘lchovsiz quyish.'),
    },
    {
      id: 'heat',
      target: 'knob',
      gesture: { kind: 'tap' },
      seconds: 5,
      instruction: L('Включите плитку на 60 °C.', 'Switch the hot plate on at 60 °C.', 'Plitkani 60 °C ga yoqing.'),
      observation: L('Колба прогрелась — стружка «закипела»: бурно идёт водород, потом пузырьков меньше — кислота кончается.', 'The flask has warmed up — the turnings “boil”: hydrogen comes off vigorously, then fewer bubbles — the acid is running out.', 'Kolba isidi — qirindi «qaynadi»: vodorod shiddat bilan ajraladi, keyin pufakchalar kamayadi — kislota tugayapti.'),
      how: L('Нажмите на ручку плитки.', 'Tap the hot plate knob.', 'Plitka dastasini bosing.'),
      teacher: L(
        'При нагреве плёнка Al₂O₃ быстро растворяется, и атомы алюминия отдают по три электрона ионам H⁺: из каждой пары атомов водорода — молекула H₂.',
        'When heated, the Al₂O₃ film dissolves quickly, and aluminium atoms give three electrons each to H⁺ ions: each pair of hydrogen atoms forms an H₂ molecule.',
        'Isitilganda Al₂O₃ pardasi tez eriydi va alyuminiy atomlari H⁺ ionlariga uchtadan elektron beradi: har bir juft vodorod atomidan H₂ molekulasi hosil bo‘ladi.',
      ),
      mistake: L('Греют сильнее: кислота начинает испаряться и брызгать, часть её теряется.', 'Heating harder: the acid starts to evaporate and spatter, and some of it is lost.', 'Kuchliroq isitish: kislota bug‘lanib sachray boshlaydi, bir qismi yo‘qoladi.'),
    },
    {
      id: 'titrate',
      target: 'stopcock',
      gesture: { kind: 'swipe', from: [AL.seat[0] + 0.03, AL.cockY, AL.seat[2] + 0.02], to: [AL.seat[0] - 0.03, AL.cockY, AL.seat[2] + 0.02], lead: 0.15 },
      seconds: 9,
      instruction: L('Добавляйте кислоту порциями, пока не растворится последний кусочек. Запишите отсчёт бюретки.', 'Add the acid in portions until the last piece dissolves. Record the burette reading.', 'Oxirgi bo‘lakcha eriguncha kislotani ulushlab qo‘shing. Byuretka ko‘rsatkichini yozing.'),
      observation: L('После каждой порции — новая волна пузырьков. Последний кусочек исчез, раствор прозрачный. В жизни — 15–20 минут.', 'Each portion brings a new wave of bubbles. The last piece is gone, the solution is clear. In real life — 15–20 minutes.', 'Har bir ulushdan so‘ng — yangi pufakchalar to‘lqini. Oxirgi bo‘lakcha yo‘qoldi, eritma tiniq. Hayotda — 15–20 daqiqa.'),
      how: L('Проведите по ручке крана — время ускорено.', 'Swipe across the tap handle — time is sped up.', 'Jo‘mrak dastasi bo‘ylab suring — vaqt tezlashtirilgan.'),
      teacher: L(
        'Под конец кислоты в колбе мало, и последний кусочек растворяется медленно — поэтому кислоты уходит чуть больше расчёта. Отсчёт — по нижнему краю мениска, глаз на его уровне.',
        'Near the end there is little acid left in the flask, and the last piece dissolves slowly — so a little more acid is used than calculated. Read at the bottom of the meniscus, eye level with it.',
        'Oxirida kolbada kislota kam qoladi va oxirgi bo‘lakcha sekin eriydi — shuning uchun kislota hisobdan biroz ko‘p ketadi. Hisob — meniskning pastki cheti bo‘yicha, ko‘z uning sathida.',
      ),
      mistake: L('Льют всё сразу «с запасом» — тогда объём уже ничего не говорит о том, сколько кислоты было нужно.', 'Pouring it all in at once “to be safe” — then the volume no longer tells how much acid was needed.', 'Hammasini birdaniga «zaxira bilan» quyish — unda hajm qancha kislota kerakligini ko‘rsatmaydi.'),
    },
    {
      id: 'off',
      target: 'knob',
      gesture: { kind: 'tap' },
      seconds: 3,
      instruction: L('Выключите плитку и дайте колбе остыть в вытяжке.', 'Switch off the hot plate and let the flask cool in the hood.', 'Plitkani o‘chiring va kolbani mo‘rili shkafda sovuting.'),
      observation: L('В колбе — прозрачный бесцветный раствор сульфата алюминия; конфорка остывает.', 'The flask holds a clear colourless solution of aluminium sulfate; the plate is cooling down.', 'Kolbada — tiniq rangsiz alyuminiy sulfat eritmasi; konforka soviyapti.'),
      how: L('Нажмите на ручку плитки.', 'Tap the hot plate knob.', 'Plitka dastasini bosing.'),
      teacher: L(
        'Ионы Al³⁺ и SO₄²⁻ остались в растворе — их не видно, раствор бесцветный. Горячую колбу не трогают голыми руками.',
        'The Al³⁺ and SO₄²⁻ ions stay in the solution — you cannot see them, the solution is colourless. Never touch the hot flask with bare hands.',
        'Al³⁺ va SO₄²⁻ ionlari eritmada qoldi — ular ko‘rinmaydi, eritma rangsiz. Issiq kolbani yalang qo‘l bilan ushlamang.',
      ),
    },
  ],
  focus: [
    { from: 1.45, to: 1.97, point: [AL.scales[0], 0.035, AL.scales[2] + 0.07], dist: 0.3 },
    { from: 3.3, to: 3.85, point: [AL.seat[0], AL.zeroY + 0.03, AL.seat[2]], dist: 0.34 },
    { from: 4.45, to: 4.97, point: [AL.seat[0], AL.zeroY, AL.seat[2]], dist: 0.13 },
    { from: 6.2, to: 6.97, point: [AL.seat[0], 0.09, AL.seat[2]], dist: 0.32 },
    { from: 7.25, to: 7.97, point: [AL.seat[0], 0.07, AL.seat[2] + 0.04], dist: 0.38 },
    { from: 8.76, to: 8.99, point: [AL.seat[0], AL.zeroY - 0.135, AL.seat[2]], dist: 0.13 },
    { from: 9.3, to: 9.97, point: [AL.seat[0], 0.08, AL.seat[2] + 0.03], dist: 0.36 },
  ],
  labels: [
    { at: 2.9, pos: [AL.scales[0], 0.14, AL.scales[2]], text: L('пустая лодочка — 0,00 г', 'empty boat — 0.00 g', 'bo‘sh qayiqcha — 0,00 g') },
    { at: 4.62, pos: [AL.seat[0] + 0.05, AL.zeroY, AL.seat[2]], text: L('отсчёт 0,00 мл', 'reading 0.00 ml', 'hisob 0,00 ml') },
    { at: 6.5, pos: [AL.seat[0] - 0.08, 0.2, AL.seat[2]], text: L('редкие пузырьки: мешает плёнка Al₂O₃', 'few bubbles: the Al₂O₃ film is in the way', 'kam pufakcha: Al₂O₃ pardasi xalaqit beradi') },
    { at: 7.55, pos: [AL.seat[0] - 0.08, 0.2, AL.seat[2]], text: L('60 °C: H₂↑ бурно', '60 °C: H₂↑ vigorously', '60 °C: H₂↑ shiddatli') },
    { at: 8.15, pos: [AL.seat[0] - 0.09, 0.24, AL.seat[2]], text: L('ускорено: в жизни 15–20 мин', 'sped up: 15–20 min in real life', 'tezlashtirilgan: hayotda 15–20 daq') },
    { at: 8.86, pos: [AL.seat[0] - 0.08, 0.2, AL.seat[2]], text: L('растворился последний кусочек', 'the last piece has dissolved', 'oxirgi bo‘lakcha eridi') },
  ],
  measurements: [
    { key: 'mAl', label: 'm(Al)', what: L('масса алюминия', 'mass of aluminium', 'alyuminiy massasi'), instrument: 'scales', afterStep: 1 },
    { key: 'V1', label: 'V₁', what: L('кислота без нагрева (первая порция)', 'acid without heating (first portion)', 'isitmasdan kislota (birinchi ulush)'), instrument: 'burette25', afterStep: 6 },
    { key: 'V', label: 'V(H₂SO₄ 20 %)', what: L('объём кислоты по бюретке (конечный отсчёт)', 'volume of acid from the burette (final reading)', 'byuretka bo‘yicha kislota hajmi (oxirgi hisob)'), instrument: 'burette25', afterStep: 8 },
    { key: 'mSol', label: 'm(H₂SO₄ 20 %)', what: L('масса израсходованного раствора: V · 1,14 г/мл', 'mass of solution used: V · 1.14 g/ml', 'sarflangan eritma massasi: V · 1,14 g/ml'), instrument: 'burette25', afterStep: 8, derived: true },
  ],
  simulate: (rng) => {
    const mAl = rng.weigh(0.54, 0.005)
    const V1 = rng.read('burette25', rng.between(4.7, 5.3))
    // под конец кислоты мало и последний кусочек растворяется медленно — её добавляют с небольшим избытком
    const V = rng.read('burette25', (needSolution(mAl) / RHO) * rng.between(1.005, 1.03))
    return { mAl, V1, V, mSol: V * RHO }
  },
  given: (v, lang) => [
    tr(lang, 'Задача: m(Al) = 5,4 г; w(H₂SO₄) = 20 %; m(р-ра H₂SO₄) — ?', 'Problem: m(Al) = 5.4 g; w(H₂SO₄) = 20 %; m(H₂SO₄ solution) — ?', 'Masala: m(Al) = 5,4 g; w(H₂SO₄) = 20 %; m(H₂SO₄ eritmasi) — ?'),
    tr(
      lang,
      `Опыт (в 10 раз меньше): m(Al) = ${f(v.mAl!, 2, lang)} г; бюретка: в начале 0,00 мл, в конце ${f(v.V!, 2, lang)} мл`,
      `Experiment (10 times smaller): m(Al) = ${f(v.mAl!, 2, lang)} g; burette: 0.00 ml at the start, ${f(v.V!, 2, lang)} ml at the end`,
      `Tajriba (10 marta kichik): m(Al) = ${f(v.mAl!, 2, lang)} g; byuretka: boshida 0,00 ml, oxirida ${f(v.V!, 2, lang)} ml`,
    ),
    tr(lang, 'ρ(H₂SO₄ 20 %) = 1,14 г/мл (этикетка); M(Al) = 27 г/моль, M(H₂SO₄) = 98 г/моль', 'ρ(H₂SO₄ 20 %) = 1.14 g/ml (label); M(Al) = 27 g/mol, M(H₂SO₄) = 98 g/mol', 'ρ(H₂SO₄ 20 %) = 1,14 g/ml (yorliq); M(Al) = 27 g/mol, M(H₂SO₄) = 98 g/mol'),
  ],
  solution: (v, lang) => {
    const m = mSol(v)
    const nAl = v.mAl! / 27
    const ans = (m * 5.4) / v.mAl!
    return [
      tr(lang, '2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂↑: на 2 моль Al — 3 моль H₂SO₄', '2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂↑: 3 mol of H₂SO₄ per 2 mol of Al', '2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂↑: 2 mol Al ga — 3 mol H₂SO₄'),
      tr(
        lang,
        `Опыт: m(р-ра) = V · ρ = ${f(v.V!, 2, lang)} · 1,14 = ${f(m, 2, lang)} г; в нём m(H₂SO₄) = ${f(m, 2, lang)} · 0,20 = ${f(m * 0.2, 2, lang)} г`,
        `Experiment: m(solution) = V · ρ = ${f(v.V!, 2, lang)} · 1.14 = ${f(m, 2, lang)} g; it contains m(H₂SO₄) = ${f(m, 2, lang)} · 0.20 = ${f(m * 0.2, 2, lang)} g`,
        `Tajriba: m(eritma) = V · ρ = ${f(v.V!, 2, lang)} · 1,14 = ${f(m, 2, lang)} g; unda m(H₂SO₄) = ${f(m, 2, lang)} · 0,20 = ${f(m * 0.2, 2, lang)} g`,
      ),
      tr(
        lang,
        `По уравнению: n(Al) = ${f(v.mAl!, 2, lang)} / 27 = ${f(nAl, 4, lang)} моль → n(H₂SO₄) = 1,5 · n(Al) = ${f(nAl * 1.5, 4, lang)} моль → m(р-ра) = ${f(nAl * 1.5, 4, lang)} · 98 / 0,20 = ${f(needSolution(v.mAl!), 2, lang)} г`,
        `From the equation: n(Al) = ${f(v.mAl!, 2, lang)} / 27 = ${f(nAl, 4, lang)} mol → n(H₂SO₄) = 1.5 · n(Al) = ${f(nAl * 1.5, 4, lang)} mol → m(solution) = ${f(nAl * 1.5, 4, lang)} · 98 / 0.20 = ${f(needSolution(v.mAl!), 2, lang)} g`,
        `Tenglama bo‘yicha: n(Al) = ${f(v.mAl!, 2, lang)} / 27 = ${f(nAl, 4, lang)} mol → n(H₂SO₄) = 1,5 · n(Al) = ${f(nAl * 1.5, 4, lang)} mol → m(eritma) = ${f(nAl * 1.5, 4, lang)} · 98 / 0,20 = ${f(needSolution(v.mAl!), 2, lang)} g`,
      ),
      tr(
        lang,
        `Пересчёт на 5,4 г алюминия: m(р-ра) = ${f(m, 2, lang)} · 5,4 / ${f(v.mAl!, 2, lang)} = ${f(ans, 1, lang)} г`,
        `Scaled to 5.4 g of aluminium: m(solution) = ${f(m, 2, lang)} · 5.4 / ${f(v.mAl!, 2, lang)} = ${f(ans, 1, lang)} g`,
        `5,4 g alyuminiyga qayta hisob: m(eritma) = ${f(m, 2, lang)} · 5,4 / ${f(v.mAl!, 2, lang)} = ${f(ans, 1, lang)} g`,
      ),
      tr(lang, `Ответ: m(р-ра H₂SO₄ 20 %) ≈ ${f(ans, 0, lang)} г`, `Answer: m(20 % H₂SO₄ solution) ≈ ${f(ans, 0, lang)} g`, `Javob: m(20 % li H₂SO₄ eritmasi) ≈ ${f(ans, 0, lang)} g`),
    ]
  },
  compare: [
    {
      label: L('m(р-ра H₂SO₄ 20 %)', 'm(20 % H₂SO₄ solution)', 'm(20 % li H₂SO₄ eritmasi)'),
      unit: 'g',
      decimals: 2,
      measured: (v) => mSol(v),
      predicted: (v) => needSolution(v.mAl!),
      book: 14.7,
      tolerancePct: 4,
    },
  ],
  reconcile: L(
    'Кислоты ушло чуть больше расчёта (на 0,5–3 %), и это честная химия. Под конец кислоты в колбе почти нет, последний кусочек растворяется очень медленно — его «дожимают» небольшим избытком. Немного кислоты тратится на плёнку Al₂O₃ на стружке, чуть-чуть испаряется с горячей колбы. Бюретка ±0,05 мл даёт всего ±0,4 %, весы ±0,01 г на 0,54 г — до ±2 % в массе алюминия (поэтому ответ пересчитан именно на взвешенную массу), плотность с этикетки 1,14 г/мл округлена (по таблице 1,139) — 0,1 %.',
    'A little more acid was used than calculated (by 0.5–3 %), and that is honest chemistry. Near the end there is almost no acid left in the flask, and the last piece dissolves very slowly — it is finished off with a small excess. Some acid is spent on the Al₂O₃ film on the turnings, a tiny bit evaporates from the hot flask. The burette (±0.05 ml) gives only ±0.4 %, the balance (±0.01 g on 0.54 g) up to ±2 % in the aluminium mass (that is why the answer is scaled from the weighed mass), the label density of 1.14 g/ml is rounded (1.139 in tables) — 0.1 %.',
    'Kislota hisobdan biroz ko‘p ketdi (0,5–3 % ga) — bu halol kimyo. Oxirida kolbada kislota deyarli qolmaydi, oxirgi bo‘lakcha juda sekin eriydi — uni ozgina mo‘l kislota bilan «tugatishadi». Bir oz kislota qirindidagi Al₂O₃ pardasiga sarflanadi, juda ozi issiq kolbadan bug‘lanadi. Byuretka (±0,05 ml) atigi ±0,4 %, tarozi (0,54 g da ±0,01 g) alyuminiy massasida ±2 % gacha beradi (shuning uchun javob aynan tortilgan massaga qayta hisoblangan), yorliqdagi zichlik 1,14 g/ml yaxlitlangan (jadvalda 1,139) — 0,1 %.',
  ),
  conclusion: L(
    'На 0,54 г алюминия ушло около 12,9 мл (14,7 г) 20 %-й серной кислоты. Для 5,4 г — в 10 раз больше: 147 г раствора, в нём 29,4 г H₂SO₄ (0,3 моль). Водорода при этом выделяется 0,3 моль — 6,72 л (н.у.). Без нагрева алюминий почти не реагировал: его защищает плёнка Al₂O₃.',
    'About 12.9 ml (14.7 g) of 20 % sulfuric acid was used for 0.54 g of aluminium. For 5.4 g — 10 times more: 147 g of solution containing 29.4 g of H₂SO₄ (0.3 mol). The hydrogen released is 0.3 mol — 6.72 l (STP). Without heating the aluminium hardly reacted: the Al₂O₃ film protects it.',
    '0,54 g alyuminiyga taxminan 12,9 ml (14,7 g) 20 % li sulfat kislota ketdi. 5,4 g uchun — 10 marta ko‘p: 147 g eritma, unda 29,4 g H₂SO₄ (0,3 mol). Bunda 0,3 mol vodorod ajraladi — 6,72 l (n.sh.). Isitmasdan alyuminiy deyarli reaksiyaga kirishmadi: uni Al₂O₃ pardasi himoya qiladi.',
  ),
  story: {
    equation: '2Al + 6H⁺ → 2Al³⁺ + 3H₂↑',
    text: L(
      'Пока на алюминии цела плёнка Al₂O₃, ионы H⁺ до металла не добираются. Тёплая кислота растворяет плёнку, и каждый атом алюминия отдаёт по три электрона трём ионам H⁺. Атомы водорода попарно соединяются в молекулы H₂ — пузырьки. Ионы Al³⁺ уходят в раствор к ионам SO₄²⁻: на 2 атома Al уходит 3 «молекулы» H₂SO₄.',
      'While the Al₂O₃ film on the aluminium is intact, H⁺ ions cannot reach the metal. Warm acid dissolves the film, and each aluminium atom gives three electrons to three H⁺ ions. Hydrogen atoms join in pairs into H₂ molecules — the bubbles. Al³⁺ ions go into the solution next to the SO₄²⁻ ions: 2 Al atoms use up 3 “molecules” of H₂SO₄.',
      'Alyuminiydagi Al₂O₃ pardasi butun ekan, H⁺ ionlari metallga yetolmaydi. Iliq kislota pardani eritadi va har bir alyuminiy atomi uchta H⁺ ioniga uchtadan elektron beradi. Vodorod atomlari juft-juft H₂ molekulalariga birikadi — pufakchalar. Al³⁺ ionlari eritmaga, SO₄²⁻ ionlari yoniga o‘tadi: 2 ta Al atomiga 3 ta H₂SO₄ «molekulasi» ketadi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Почему без нагрева пузырьков почти не было?', 'Why were there hardly any bubbles without heating?', 'Nega isitmasdan pufakchalar deyarli bo‘lmadi?'),
      options: [
        L('Алюминий покрыт прочной плёнкой Al₂O₃', 'Aluminium is covered with a tough Al₂O₃ film', 'Alyuminiy mustahkam Al₂O₃ pardasi bilan qoplangan'),
        L('Серная кислота вообще не реагирует с металлами', 'Sulfuric acid does not react with metals at all', 'Sulfat kislota metallar bilan umuman reaksiyaga kirishmaydi'),
        L('Стружка была слишком лёгкой', 'The turnings were too light', 'Qirindi juda yengil edi'),
      ],
      correct: 0,
      why: L('Плёнка оксида защищает металл; тёплая кислота растворяет её быстрее — и реакция разгоняется.', 'The oxide film protects the metal; warm acid dissolves it faster — and the reaction speeds up.', 'Oksid pardasi metallni himoya qiladi; iliq kislota uni tezroq eritadi — reaksiya tezlashadi.'),
    },
    {
      id: 'type',
      q: L('К какому типу относится реакция алюминия с серной кислотой?', 'What type of reaction is aluminium with sulfuric acid?', 'Alyuminiyning sulfat kislota bilan reaksiyasi qaysi turga kiradi?'),
      options: [L('Замещения', 'Substitution', 'O‘rin olish'), L('Обмена', 'Exchange', 'Almashinish'), L('Разложения', 'Decomposition', 'Parchalanish')],
      correct: 0,
      why: L('Простое вещество алюминий замещает водород в кислоте: 2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂↑.', 'The simple substance aluminium replaces hydrogen in the acid: 2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂↑.', 'Oddiy modda alyuminiy kislotadagi vodorod o‘rnini oladi: 2Al + 3H₂SO₄ → Al₂(SO₄)₃ + 3H₂↑.'),
    },
    {
      id: 'product',
      q: L('Что осталось в колбе, когда растворился последний кусочек?', 'What was left in the flask when the last piece had dissolved?', 'Oxirgi bo‘lakcha erigach, kolbada nima qoldi?'),
      options: [
        L('Бесцветный раствор сульфата алюминия', 'A colourless aluminium sulfate solution', 'Rangsiz alyuminiy sulfat eritmasi'),
        L('Голубой раствор', 'A blue solution', 'Ko‘k eritma'),
        L('Белый осадок оксида алюминия', 'A white precipitate of aluminium oxide', 'Alyuminiy oksidining oq cho‘kmasi'),
      ],
      correct: 0,
      why: L('Алюминий перешёл в раствор ионами Al³⁺ — получился раствор Al₂(SO₄)₃, он бесцветный.', 'The aluminium went into the solution as Al³⁺ ions — an Al₂(SO₄)₃ solution formed, and it is colourless.', 'Alyuminiy Al³⁺ ionlari holida eritmaga o‘tdi — Al₂(SO₄)₃ eritmasi hosil bo‘ldi, u rangsiz.'),
    },
  ],
}
