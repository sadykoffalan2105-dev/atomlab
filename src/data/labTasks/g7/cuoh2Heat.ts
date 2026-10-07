/**
 * Kimyo 7, с. 148, задача 2: разложение 49 г Cu(OH)₂ → масса CuO. На столе — в 10 раз меньше: 4,90 г.
 * Опыт: фарфоровая чашка на весах (тара) → 4,90 г голубого Cu(OH)₂ → чашка на сетку кольца штатива над спиртовкой →
 * нагрев: голубой → чёрный, пар → холодное часовое стекло над чашкой: капли воды → помешивать палочкой → погасить
 * колпачком → остывшую чашку щипцами на весы: m(CuO).
 * Убыль массы — вода. Честная систематика: в порошке остаётся немного воды (недосушили) — CuO выходит на 0–1 % больше.
 */
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { L, tr, type LabTask } from '../labTaskTypes'

const g = (lang: 'ru' | 'en' | 'uz') => tr(lang, 'г', 'g', 'g')

export const CUOH2_HEAT: LabTask = {
  id: 'task-g7-cuoh2-heat',
  grade: 7,
  page: 148,
  source: L('Kimyo 7 · с. 148, задача 2', 'Kimyo 7 · p. 148, problem 2', 'Kimyo 7 · 148-bet, 2-masala'),
  bookKind: 'task',
  title: L('Разложение гидроксида меди(II)', 'Decomposing copper(II) hydroxide', 'Mis(II) gidroksidining parchalanishi'),
  statement: L(
    'Какая масса оксида меди (II) образуется при разложении 49 г гидроксида меди (II)?',
    'What mass of copper(II) oxide forms when 49 g of copper(II) hydroxide decomposes?',
    '49 g mis(II) gidroksidi parchalanganda qancha massa mis(II) oksidi hosil bo‘ladi?',
  ),
  equation: 'Cu(OH)₂ → CuO + H₂O',
  kind: 'decomposition',
  type: 'stoich-mass',
  difficulty: 2,
  answers: [
    {
      key: 'mCuO',
      label: 'm(CuO)',
      what: L('масса оксида меди(II)', 'mass of copper(II) oxide', 'mis(II) oksidi massasi'),
      unit: L('г', 'g', 'g'),
      book: 40,
      decimals: 0,
      fromRun: (v) => (v.mcuo! * 49) / v.mcu!,
    },
  ],
  labScale: {
    factor: 10,
    note: L(
      'На столе в 10 раз меньше: 4,90 г Cu(OH)₂ вместо 49 г. Полученную массу CuO умножают на 10 (точнее — на 49 / взятую массу).',
      'On the bench it is 10 times smaller: 4.90 g of Cu(OH)₂ instead of 49 g. Multiply the CuO you get by 10 (more exactly, by 49 / the mass taken).',
      'Stolda 10 marta kam: 49 g o‘rniga 4,90 g Cu(OH)₂. Olingan CuO massasi 10 ga (aniqrog‘i, 49 / olingan massaga) ko‘paytiriladi.',
    ),
  },
  instruments: ['scales'],
  equipment: [
    L('Электронные весы (0,01 г)', 'Electronic balance (0.01 g)', 'Elektron tarozi (0,01 g)'),
    L('Фарфоровая чашка, стеклянная палочка, тигельные щипцы', 'Porcelain dish, glass rod, crucible tongs', 'Chinni kosacha, shisha tayoqcha, tigel qisqichi'),
    L('Штатив с кольцом и керамической сеткой, спиртовка, спички', 'Ring stand with ceramic gauze, spirit lamp, matches', 'Halqali shtativ va keramik to‘r, spirt lampa, gugurt'),
    L('Гидроксид меди(II) Cu(OH)₂ (голубой порошок), шпатель', 'Copper(II) hydroxide Cu(OH)₂ (blue powder), spatula', 'Mis(II) gidroksidi Cu(OH)₂ (ko‘k kukun), shpatel'),
  ],
  safety: [
    L('Очки обязательны: при нагреве порошок может «стрелять».', 'Goggles are a must: the powder may spit when heated.', 'Ko‘zoynak shart: qizdirilganda kukun «otilishi» mumkin.'),
    L('Горячую чашку — только щипцами; спиртовку гасить колпачком.', 'Hot dish — tongs only; put the lamp out with its cap.', 'Issiq kosacha — faqat qisqich bilan; spirt lampani qalpoqcha bilan o‘chiring.'),
    L('Соединения меди ядовиты: не пробовать, руки вымыть.', 'Copper compounds are poisonous: never taste, wash your hands.', 'Mis birikmalari zaharli: tatib ko‘rmang, qo‘lingizni yuving.'),
  ],
  gear: ['goggles'],
  steps: [
    {
      id: 'gear',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте защитные очки.', 'Put on safety goggles.', 'Himoya ko‘zoynagini taqing.'),
      observation: L('Очки надеты.', 'Goggles on.', 'Ko‘zoynak taqildi.'),
      how: L('Нажмите на поднос с очками.', 'Tap the tray with the goggles.', 'Ko‘zoynakli patnisni bosing.'),
      teacher: L('При нагреве пар внутри порошка вырывается толчками и может выбросить крупинки — глаза защищаем.', 'When heated, steam inside the powder escapes in bursts and can throw out grains, so the eyes are protected.', 'Qizdirilganda kukun ichidagi bug‘ turtki bilan chiqib, donachalarni otishi mumkin — ko‘zni himoyalaymiz.'),
    },
    {
      id: 'dish',
      target: 'dish',
      gesture: { kind: 'drag', from: [-0.1, 0.02, 0.13], to: [-0.3, 0.09, -0.052], lead: 0.5 },
      seconds: 2.6,
      instruction: L('Поставьте чистую сухую фарфоровую чашку на весы.', 'Put a clean dry porcelain dish on the balance.', 'Toza quruq chinni kosachani taroziga qo‘ying.'),
      observation: L('Весы показывают массу чашки.', 'The balance shows the mass of the dish.', 'Tarozi kosacha massasini ko‘rsatadi.'),
      how: L('Перетащите чашку со стола на чашу весов.', 'Drag the dish from the bench onto the pan.', 'Kosachani stoldan tarozi pallasiga torting.'),
      teacher: L('Чашка должна быть сухой: капля воды на ней — лишние 0,05 г, которые потом «испарятся» как будто из вещества.', 'The dish must be dry: a drop of water on it is an extra 0.05 g that later “evaporates” as if from the substance.', 'Kosacha quruq bo‘lishi kerak: undagi bir tomchi suv — ortiqcha 0,05 g, keyin go‘yo moddadan «bug‘lanadi».'),
    },
    {
      id: 'tare',
      target: 'scales-tare',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Обнулите весы кнопкой «T».', 'Zero the balance with “T”.', 'Tarozini «T» bilan nolga keltiring.'),
      observation: L('0.00 и →0← — масса чашки вычтена.', '0.00 and →0← — the dish is subtracted.', '0.00 va →0← — kosacha massasi ayirildi.'),
      how: L('Нажмите кнопку «T».', 'Press the “T” button.', '«T» tugmasini bosing.'),
      teacher: L('Тару больше не трогаем: и Cu(OH)₂, и CuO будем взвешивать в той же чашке.', 'Leave the tare alone: both Cu(OH)₂ and CuO are weighed in the same dish.', 'Taraga boshqa tegmaymiz: Cu(OH)₂ ham, CuO ham o‘sha kosachada tortiladi.'),
    },
    {
      id: 'powder',
      target: 'cuoh2-jar',
      gesture: { kind: 'drag', from: [-0.5, 0.06, -0.06], to: [-0.3, 0.1, -0.052], lead: 0.25 },
      seconds: 7,
      instruction: L('Насыпьте шпателем 4,90 г гидроксида меди(II).', 'Spoon 4.90 g of copper(II) hydroxide into the dish.', 'Shpatel bilan 4,90 g mis(II) gidroksidi soling.'),
      observation: L('Голубой порошок в чашке; весы показывают около 4,90 г.', 'Blue powder in the dish; the balance shows about 4.90 g.', 'Kosachada ko‘k kukun; tarozi taxminan 4,90 g ko‘rsatadi.'),
      how: L('Перетащите шпатель от банки к чашке; у 4,90 г подсыпайте лёгким постукиванием.', 'Drag the spatula from the jar to the dish; near 4.90 g tap it gently.', 'Shpatelni bankadan kosachaga torting; 4,90 g ga yaqin sekin chertib soling.'),
      teacher: L('Масштаб 1 : 10: 4,90 г — десятая часть от 49 г из задачи, приборы на столе так точнее.', 'Scale 1 : 10: 4.90 g is a tenth of the 49 g in the problem; bench instruments work better at this size.', 'Masshtab 1 : 10: 4,90 g — masaladagi 49 g ning o‘ndan biri, stoldagi asboblar bunda aniqroq.'),
      mistake: L('Сыпать мимо чашки на чашу весов — показание станет больше, а в чашке вещества меньше.', 'Spilling onto the pan — the reading grows but less substance is in the dish.', 'Kosachadan tashqariga — pallaga to‘kish: ko‘rsatkich oshadi, kosachada esa modda kam bo‘ladi.'),
    },
    {
      id: 'stand',
      target: 'dish',
      gesture: { kind: 'drag', from: [-0.3, 0.07, -0.052], to: [0.15, 0.2, -0.06], lead: 0.5 },
      seconds: 3,
      instruction: L('Перенесите чашку на керамическую сетку над спиртовкой.', 'Move the dish onto the ceramic gauze above the spirit lamp.', 'Kosachani spirt lampa ustidagi keramik to‘rga o‘tkazing.'),
      observation: L('Чашка стоит на сетке кольца штатива. Весы без чашки показывают минус.', 'The dish stands on the gauze of the ring. The empty balance shows a minus.', 'Kosacha shtativ halqasidagi to‘rda turibdi. Kosachasiz tarozi minus ko‘rsatadi.'),
      how: L('Перетащите чашку с весов на сетку.', 'Drag the dish from the balance onto the gauze.', 'Kosachani tarozidan to‘rga torting.'),
      teacher: L('Сетка распределяет жар пламени по дну: фарфор нагревается равномерно и не трескается.', 'The gauze spreads the flame’s heat over the bottom: the porcelain heats evenly and does not crack.', 'To‘r alanga issiqligini tub bo‘ylab taqsimlaydi: chinni bir tekis qiziydi va yorilmaydi.'),
    },
    {
      id: 'heat',
      target: 'spirit-lamp',
      gesture: { kind: 'swipe', from: [0.18, 0.07, -0.06], to: [0.27, 0.07, -0.05], lead: 0.3 },
      seconds: 6,
      instruction: L('Снимите колпачок и зажгите спиртовку.', 'Take off the cap and light the spirit lamp.', 'Qalpoqchani oling va spirt lampani yoqing.'),
      observation: L('Порошок темнеет с краёв: голубой → чёрный. Над чашкой поднимается пар.', 'The powder darkens from the edges: blue → black. Steam rises above the dish.', 'Kukun chetidan qorayadi: ko‘k → qora. Kosacha ustida bug‘ ko‘tariladi.'),
      how: L('Проведите по колпачку вправо — спичка зажжёт фитиль.', 'Swipe the cap to the right — a match lights the wick.', 'Qalpoqchani o‘ngga suring — gugurt pilikni yoqadi.'),
      teacher: L('При нагревании ионы OH⁻ попарно отдают воду: из Cu(OH)₂ остаётся CuO, а H₂O уходит паром.', 'On heating, OH⁻ ions give off water in pairs: CuO remains from Cu(OH)₂ and H₂O leaves as steam.', 'Qizdirilganda OH⁻ ionlari juft-juft suv beradi: Cu(OH)₂ dan CuO qoladi, H₂O esa bug‘ bo‘lib chiqadi.'),
      mistake: L('Ставить чашку прямо в пламя без сетки — фарфор нагреется неравномерно и может треснуть.', 'Putting the dish straight into the flame without the gauze — the porcelain heats unevenly and may crack.', 'Kosachani to‘rsiz to‘g‘ridan-to‘g‘ri alangaga qo‘yish — chinni notekis qiziydi va yorilishi mumkin.'),
    },
    {
      id: 'glass',
      target: 'watch-glass',
      gesture: { kind: 'drag', from: [0.34, 0.01, 0.18], to: [0.15, 0.2, -0.06], lead: 0.4 },
      seconds: 4,
      instruction: L('Подержите над чашкой холодное часовое стекло.', 'Hold a cold watch glass above the dish.', 'Kosacha ustida sovuq soat oynasini ushlab turing.'),
      observation: L('Снизу на стекле появились мелкие капли воды — пар над чашкой это водяной пар.', 'Small drops of water appear on the underside of the glass: the vapour above the dish is water.', 'Oynaning ostida mayda suv tomchilari paydo bo‘ldi — kosacha ustidagi bug‘ suv bug‘idir.'),
      how: L('Перетащите часовое стекло со стола и задержите его над чашкой.', 'Drag the watch glass from the bench and hold it above the dish.', 'Soat oynasini stoldan torting va kosacha ustida ushlab turing.'),
      teacher: L('Молекулы H₂O, вышедшие из кристалла, на холодном стекле теряют скорость и снова собираются в жидкую воду — так доказывают второй продукт.', 'H₂O molecules that left the crystal slow down on the cold glass and gather into liquid water again — this proves the second product.', 'Kristalldan chiqqan H₂O molekulalari sovuq oynada sekinlashib, yana suyuq suvga yig‘iladi — ikkinchi mahsulot shunday isbotlanadi.'),
      mistake: L('Держать стекло низко над пламенем — оно нагреется, и капли не появятся.', 'Holding the glass low over the flame — it heats up and no drops form.', 'Oynani alangaga yaqin ushlash — u qiziydi va tomchilar paydo bo‘lmaydi.'),
    },
    {
      id: 'stir',
      target: 'stir-rod',
      gesture: { kind: 'swipe', from: [0.0, 0.01, 0.14], to: [0.12, 0.01, 0.14], lead: 0.3 },
      seconds: 5,
      instruction: L('Помешивайте порошок палочкой, пока он весь не станет чёрным.', 'Stir the powder with the rod until it is all black.', 'Kukunni hammasi qora bo‘lguncha tayoqcha bilan aralashtiring.'),
      observation: L('Весь порошок чёрный, пар больше не идёт — вода удалена.', 'All the powder is black and no more steam rises: the water is gone.', 'Kukunning hammasi qora, bug‘ chiqmayapti — suv chiqib ketdi.'),
      how: L('Проведите по палочке — она перемешает порошок в чашке.', 'Swipe along the rod — it stirs the powder in the dish.', 'Tayoqcha bo‘ylab suring — u kosachadagi kukunni aralashtiradi.'),
      teacher: L('Пока порошок не перемешан, в середине остаются голубые комочки — не разложившийся Cu(OH)₂ и вода в нём.', 'Unless stirred, blue lumps remain in the middle — undecomposed Cu(OH)₂ with water inside.', 'Aralashtirilmasa, o‘rtada ko‘k bo‘lakchalar qoladi — parchalanmagan Cu(OH)₂ va undagi suv.'),
      mistake: L('Прекратить нагрев, пока виден голубой цвет, — масса CuO выйдет завышенной.', 'Stopping while blue is still visible — the CuO mass comes out too high.', 'Ko‘k rang ko‘rinib turganda qizdirishni to‘xtatish — CuO massasi ortiq chiqadi.'),
    },
    {
      id: 'off',
      target: 'lamp-cap',
      gesture: { kind: 'drag', from: [0.225, 0.02, -0.048], to: [0.15, 0.1, -0.06], lead: 0.6 },
      seconds: 3.2,
      instruction: L('Погасите спиртовку колпачком, дайте чашке остыть.', 'Put the lamp out with its cap and let the dish cool.', 'Spirt lampani qalpoqcha bilan o‘chiring, kosachani sovishiga qo‘ying.'),
      observation: L('Пламя погасло. Чашка остывает (в жизни ~10 минут).', 'The flame is out. The dish cools down (~10 minutes in real life).', 'Alanga o‘chdi. Kosacha soviydi (hayotda ~10 daqiqa).'),
      how: L('Перетащите колпачок со стола на фитиль.', 'Drag the cap from the bench onto the wick.', 'Qalpoqchani stoldan pilikka torting.'),
      teacher: L('Колпачок перекрывает доступ воздуха — без кислорода спирт не горит. Задувать спиртовку нельзя.', 'The cap cuts off the air — without oxygen the spirit cannot burn. Never blow a spirit lamp out.', 'Qalpoqcha havoni to‘sadi — kislorodsiz spirt yonmaydi. Spirt lampani puflab o‘chirish mumkin emas.'),
    },
    {
      id: 'weigh',
      target: 'dish',
      gesture: { kind: 'drag', from: [0.15, 0.15, -0.06], to: [-0.3, 0.1, -0.052], lead: 0.5 },
      seconds: 3,
      instruction: L('Щипцами поставьте остывшую чашку на весы и снимите показание.', 'With the tongs, put the cooled dish on the balance and take the reading.', 'Qisqich bilan sovigan kosachani taroziga qo‘ying va ko‘rsatkichni yozing.'),
      observation: L('Весы показывают массу чёрного CuO — около 4,0 г: меньше, чем было Cu(OH)₂.', 'The balance shows the black CuO, about 4.0 g: less than the Cu(OH)₂ was.', 'Tarozi qora CuO massasini ko‘rsatadi — taxminan 4,0 g: Cu(OH)₂ dan kam.'),
      how: L('Перетащите чашку с сетки на весы.', 'Drag the dish from the gauze to the balance.', 'Kosachani to‘rdan taroziga torting.'),
      teacher: L('Масса уменьшилась на массу ушедшей воды: m(H₂O) = m(Cu(OH)₂) − m(CuO). Вещество не исчезло — вода ушла в воздух.', 'The mass dropped by the water that left: m(H₂O) = m(Cu(OH)₂) − m(CuO). Nothing vanished — the water went into the air.', 'Massa chiqib ketgan suv massasiga kamaydi: m(H₂O) = m(Cu(OH)₂) − m(CuO). Modda yo‘qolmadi — suv havoga chiqdi.'),
      mistake: L('Взвешивать горячую чашку — показание «плывёт» и занижено.', 'Weighing the dish hot — the reading drifts and is low.', 'Issiq kosachani tortish — ko‘rsatkich «suzadi» va kam chiqadi.'),
    },
  ],
  focus: [
    { from: 1.6, to: 1.97, point: [-0.3, 0.04, 0.0], dist: 0.36 },
    { from: 2.15, to: 2.95, point: [-0.3, 0.025, 0.06], dist: 0.22 },
    { from: 3.55, to: 3.97, point: [-0.3, 0.04, 0.0], dist: 0.32 },
    { from: 5.6, to: 5.97, point: [0.15, 0.14, -0.06], dist: 0.34 },
    { from: 6.3, to: 6.72, point: [0.15, 0.17, -0.06], dist: 0.26 },
    { from: 7.3, to: 7.85, point: [0.15, 0.14, -0.06], dist: 0.28 },
    { from: 9.72, to: 9.98, point: [-0.3, 0.03, 0.03], dist: 0.28 },
  ],
  labels: [
    { at: 1.7, pos: [-0.22, 0.12, -0.05], text: L('фарфоровая чашка', 'porcelain dish', 'chinni kosacha') },
    { at: 3.6, pos: [-0.22, 0.12, -0.05], text: L('Cu(OH)₂ — голубой', 'Cu(OH)₂: blue', 'Cu(OH)₂ — ko‘k') },
    { at: 4.85, pos: [0.06, 0.16, -0.06], text: L('сетка: жар — равномерно', 'gauze: even heat', 'to‘r: issiqlik bir tekis') },
    { at: 5.75, pos: [0.22, 0.24, -0.06], text: L('пар — уходит вода H₂O', 'steam: water H₂O leaves', 'bug‘ — suv H₂O chiqadi') },
    { at: 6.5, pos: [0.22, 0.23, -0.06], text: L('капли воды на стекле', 'water drops on the glass', 'oynada suv tomchilari') },
    { at: 7.6, pos: [0.22, 0.2, -0.06], text: L('CuO — чёрный', 'CuO: black', 'CuO — qora') },
    { at: 8.6, pos: [0.22, 0.2, -0.06], text: L('остывание (в жизни ~10 мин)', 'cooling (~10 min in real life)', 'sovish (hayotda ~10 daq)') },
    { at: 9.85, pos: [-0.22, 0.12, -0.05], text: L('масса уменьшилась — ушла вода', 'the mass fell: water has left', 'massa kamaydi — suv chiqdi') },
  ],
  measurements: [
    { key: 'dish', label: 'm₀', what: L('масса пустой чашки (до тары)', 'mass of the empty dish (before taring)', 'bo‘sh kosacha massasi (taragacha)'), instrument: 'scales', afterStep: 1 },
    { key: 'mcu', label: 'm(Cu(OH)₂)', what: L('масса гидроксида меди(II)', 'mass of copper(II) hydroxide', 'mis(II) gidroksidi massasi'), instrument: 'scales', afterStep: 3 },
    { key: 'mcuo', label: 'm(CuO)', what: L('масса оксида меди(II) после нагрева', 'mass of copper(II) oxide after heating', 'qizdirishdan keyingi mis(II) oksidi massasi'), instrument: 'scales', afterStep: 9 },
    { key: 'mH2O', label: 'm(H₂O)', what: L('масса ушедшей воды (убыль массы)', 'mass of water given off (mass loss)', 'chiqib ketgan suv massasi (massa kamayishi)'), instrument: 'scales', afterStep: 9, derived: true },
  ],
  simulate: (rng) => {
    const dish = rng.read('scales', rng.between(58, 67))
    const mcu = rng.weigh(4.9, 0.03)
    // в чёрном порошке может остаться немного воды (недосушили): CuO на 0–1 % «тяжелее»
    const mcuo = rng.read('scales', ((mcu * 80) / 98) * rng.between(0.995, 1.012))
    return { dish, mcu, mcuo, mH2O: Math.round((mcu - mcuo) * 100) / 100 }
  },
  given: (v, lang) => [
    `m(Cu(OH)₂) = ${fmtNum(v.mcu!, 2, lang)} ${g(lang)}  (${tr(lang, 'в задаче 49 г', 'problem: 49 g', 'masalada 49 g')})`,
    `M(Cu(OH)₂) = 98 ${tr(lang, 'г/моль', 'g/mol', 'g/mol')};  M(CuO) = 80 ${tr(lang, 'г/моль', 'g/mol', 'g/mol')}`,
    `${tr(lang, 'Измерено', 'Measured', 'O‘lchandi')}: m(CuO) = ${fmtNum(v.mcuo!, 2, lang)} ${g(lang)}`,
    tr(lang, 'Найти: m(CuO) из 49 г Cu(OH)₂', 'Find: m(CuO) from 49 g of Cu(OH)₂', 'Topish kerak: 49 g Cu(OH)₂ dan m(CuO)'),
  ],
  solution: (v, lang) => {
    const n = v.mcu! / 98
    const run = (v.mcuo! * 49) / v.mcu!
    return [
      'Cu(OH)₂ → CuO + H₂O;  n(CuO) = n(Cu(OH)₂)',
      `n = ${fmtNum(v.mcu!, 2, lang)} / 98 = ${fmtNum(n, 4, lang)} ${tr(lang, 'моль', 'mol', 'mol')} → m(CuO) = ${fmtNum(n, 4, lang)} · 80 = ${fmtNum(n * 80, 2, lang)} ${g(lang)} (${tr(lang, 'расчёт', 'calculated', 'hisob')})`,
      `m(H₂O) = ${fmtNum(v.mcu!, 2, lang)} − ${fmtNum(v.mcuo!, 2, lang)} = ${fmtNum(v.mcu! - v.mcuo!, 2, lang)} ${g(lang)}`,
      `${tr(lang, 'На 49 г по опыту', 'Per 49 g from the run', 'Tajriba bo‘yicha 49 g ga')}: ${fmtNum(v.mcuo!, 2, lang)} · 49 / ${fmtNum(v.mcu!, 2, lang)} = ${fmtNum(run, 1, lang)} ${g(lang)}`,
      tr(
        lang,
        `Ответ: m(CuO) = 49 / 98 · 80 = 40 г (по опыту ${fmtNum(run, 1, lang)} г)`,
        `Answer: m(CuO) = 49 / 98 · 80 = 40 g (run: ${fmtNum(run, 1, lang)} g)`,
        `Javob: m(CuO) = 49 / 98 · 80 = 40 g (tajriba: ${fmtNum(run, 1, lang)} g)`,
      ),
    ]
  },
  compare: [
    {
      label: L('Масса оксида m(CuO)', 'Oxide mass m(CuO)', 'Oksid massasi m(CuO)'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mcuo!,
      predicted: (v) => (v.mcu! * 80) / 98,
      book: 4,
      tolerancePct: 2,
    },
  ],
  reconcile: L(
    'CuO обычно выходит на 0–1 % тяжелее расчёта: в чёрном порошке остаётся немного воды, если нагрев остановили рано или плохо перемешали. Если же порошок «стрелял» и крупинки вылетели — масса меньше. Весы ошибаются на ±0,01 г, а в масштабе задачи (×10) это ±0,1 г.',
    'CuO usually comes out 0–1 % heavier than calculated: a little water stays in the black powder if heating stopped early or stirring was poor. If the powder spat and grains flew out, the mass is lower. The balance errs by ±0.01 g, which is ±0.1 g at the problem’s scale (×10).',
    'CuO odatda hisobdan 0–1 % og‘ir chiqadi: qizdirish erta to‘xtatilsa yoki yaxshi aralashtirilmasa, qora kukunda biroz suv qoladi. Agar kukun «otilib», donachalar uchib ketsa — massa kam. Tarozi ±0,01 g xato qiladi, masala masshtabida (×10) bu ±0,1 g.',
  ),
  conclusion: L(
    'При разложении 49 г Cu(OH)₂ образуется 40 г CuO и 9 г воды: масса продуктов равна массе исходного вещества.',
    'Decomposing 49 g of Cu(OH)₂ gives 40 g of CuO and 9 g of water: the products weigh as much as the starting substance.',
    '49 g Cu(OH)₂ parchalanganda 40 g CuO va 9 g suv hosil bo‘ladi: mahsulotlar massasi boshlang‘ich modda massasiga teng.',
  ),
  story: {
    equation: 'Cu(OH)₂ → CuO + H₂O↑',
    text: L(
      'В кристалле Cu(OH)₂ при нагреве две группы OH⁻ отдают молекулу воды: H⁺ одной переходит к другой, остаётся ион O²⁻ рядом с Cu²⁺ — чёрный CuO. Молекулы H₂O улетают паром.',
      'On heating, two OH⁻ groups in the Cu(OH)₂ crystal give up a water molecule: an H⁺ moves from one to the other, leaving an O²⁻ ion next to Cu²⁺, which is black CuO. The H₂O molecules fly off as steam.',
      'Qizdirilganda Cu(OH)₂ kristalidagi ikki OH⁻ guruhi bitta suv molekulasini beradi: biridagi H⁺ ikkinchisiga o‘tadi, Cu²⁺ yonida O²⁻ ioni qoladi — qora CuO. H₂O molekulalari bug‘ bo‘lib uchib ketadi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Какие признаки реакции вы видели при нагреве?', 'Which signs of reaction did you see on heating?', 'Qizdirishda qanday reaksiya belgilarini ko‘rdingiz?'),
      options: [
        L('голубой порошок почернел, шёл пар', 'the blue powder turned black, steam rose', 'ko‘k kukun qoraydi, bug‘ chiqdi'),
        L('выпал белый осадок', 'a white precipitate formed', 'oq cho‘kma tushdi'),
        L('порошок вспыхнул ярким пламенем', 'the powder flared with a bright flame', 'kukun yorqin alanga bilan yondi'),
      ],
      correct: 0,
      why: L('Смена цвета и выделение пара (воды) — признаки разложения Cu(OH)₂.', 'The colour change and steam (water) are signs that Cu(OH)₂ decomposes.', 'Rang o‘zgarishi va bug‘ (suv) ajralishi — Cu(OH)₂ parchalanishi belgilari.'),
    },
    {
      id: 'type',
      q: L('К какому типу относится реакция?', 'What type of reaction is it?', 'Reaksiya qaysi turga kiradi?'),
      options: [
        L('разложение', 'decomposition', 'parchalanish'),
        L('соединение', 'combination', 'birikish'),
        L('обмен', 'exchange', 'almashinish'),
      ],
      correct: 0,
      why: L('Из одного сложного вещества получились два: CuO и H₂O.', 'One compound gave two: CuO and H₂O.', 'Bitta murakkab moddadan ikkita hosil bo‘ldi: CuO va H₂O.'),
    },
    {
      id: 'product',
      q: L('Что осталось в чашке и почему масса стала меньше?', 'What was left in the dish and why is it lighter?', 'Kosachada nima qoldi va massa nega kamaydi?'),
      options: [
        L('чёрный CuO; вода ушла паром', 'black CuO; the water left as steam', 'qora CuO; suv bug‘ bo‘lib chiqdi'),
        L('медь; кислород ушёл в воздух', 'copper; the oxygen went into the air', 'mis; kislorod havoga chiqdi'),
        L('голубой Cu(OH)₂; часть сгорела', 'blue Cu(OH)₂; part of it burnt', 'ko‘k Cu(OH)₂; bir qismi yondi'),
      ],
      correct: 0,
      why: L('m(Cu(OH)₂) = m(CuO) + m(H₂O): убыль массы — это вода.', 'm(Cu(OH)₂) = m(CuO) + m(H₂O): the mass loss is the water.', 'm(Cu(OH)₂) = m(CuO) + m(H₂O): massa kamayishi — bu suv.'),
    },
  ],
}
