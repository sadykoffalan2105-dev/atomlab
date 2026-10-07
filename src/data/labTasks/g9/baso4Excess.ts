/**
 * Kimyo 9, с. 36, пример 1 (решён в учебнике, ответ — с. 37): избыток и недостаток при осаждении BaSO₄.
 * Опыт 1:1 — растворы отвешивают прямо в стакан на весах (104,0 г 5 %-го BaCl₂ и 71,0 г 10 %-го Na₂SO₄), белый осадок
 * сразу; проба прозрачного раствора над осадком показывает, что в избытке Na₂SO₄; осадок — на плотный взвешенный фильтр,
 * промыть, высушить при 105 °C, взвесить. Потери: мелкие кристаллы проходят через фильтр и остаются на стекле (0,4–1,5 %).
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

const M_BACL2 = 208
const M_NA2SO4 = 142
const M_BASO4 = 233
const W1 = 0.05
const W2 = 0.1

const n = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
const nBa = (v: LabTaskValues) => (v.m1! * W1) / M_BACL2
const nSo4 = (v: LabTaskValues) => (v.m2! * W2) / M_NA2SO4
/** Сколько моль BaSO₄ может выпасть — по веществу в недостатке. */
const nLim = (v: LabTaskValues) => Math.min(nBa(v), nSo4(v))
/** Количество вещества в недостатке по условию задачи: 104 · 0,05 / 208 = 0,025 моль. */
const N_BOOK = (104 * W1) / M_BACL2

export const BASO4_EXCESS: LabTask = {
  id: 'task-g9-baso4-excess',
  grade: 9,
  page: 36,
  source: L('Kimyo 9 · с. 36, пример 1', 'Kimyo 9 · p. 36, example 1', 'Kimyo 9 · 36-bet, 1-misol'),
  bookKind: 'example',
  title: L('Сульфат бария: что в избытке?', 'Barium sulfate: which is in excess?', 'Bariy sulfat: qaysi biri ortiqcha?'),
  statement: L(
    '104 г 5 %-ного раствора хлорида бария смешали с 71 г 10 %-ного раствора сульфата натрия. Сколько граммов сульфата бария выпало в осадок?',
    '104 g of a 5 % barium chloride solution was mixed with 71 g of a 10 % sodium sulfate solution. How many grams of barium sulfate precipitated?',
    '104 g 5 % li bariy xlorid eritmasi 71 g 10 % li natriy sulfat eritmasi bilan aralashtirildi. Necha gramm bariy sulfat cho‘kmaga tushdi?',
  ),
  equation: 'BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl',
  kind: 'exchange',
  type: 'excess',
  difficulty: 3,
  answers: [
    {
      key: 'mBaSO4',
      label: 'm(BaSO₄)',
      what: L('масса осадка сульфата бария', 'mass of the barium sulfate precipitate', 'bariy sulfat cho‘kmasining massasi'),
      unit: L('г', 'g', 'g'),
      book: 5.825,
      decimals: 2,
      // осадок с весов, пересчитанный на количества из условия (у вас BaCl₂ взято чуть больше или меньше 104 г)
      fromRun: (v) => (v.mP! * N_BOOK) / nLim(v),
    },
  ],
  labScale: {
    factor: 1,
    note: L(
      'Опыт — в масштабе задачи: 104 г и 71 г растворов (около 165 мл) помещаются в стакан на 250 мл.',
      'Same scale as the problem: 104 g and 71 g of solutions (about 165 ml) fit into a 250 ml beaker.',
      'Tajriba masala miqyosida: 104 g va 71 g eritmalar (taxminan 165 ml) 250 ml li stakanga sig‘adi.',
    ),
  },
  instruments: ['scales'],
  equipment: [
    L('Электронные весы (0,01 г)', 'Electronic balance (0.01 g)', 'Elektron tarozi (0,01 g)'),
    L('Химический стакан 250 мл; растворы BaCl₂ (5 %) и Na₂SO₄ (10 %) в склянках', '250 ml beaker; BaCl₂ (5 %) and Na₂SO₄ (10 %) solutions in bottles', '250 ml li kimyoviy stakan; shishalarda BaCl₂ (5 %) va Na₂SO₄ (10 %) eritmalari'),
    L('Пипетка, две пробирки в штативе, капельницы с BaCl₂ и Na₂SO₄', 'Dropper, two test tubes in a rack, dropping bottles of BaCl₂ and Na₂SO₄', 'Pipetka, shtativdagi ikkita probirka, BaCl₂ va Na₂SO₄ tomizg‘ichlari'),
    L('Штатив с кольцом, воронка, плотный беззольный фильтр «синяя лента», промывалка', 'Ring stand, funnel, dense ashless “blue ribbon” filter paper, wash bottle', 'Halqali shtativ, voronka, zich kulsiz «ko‘k lenta» filtri, yuvgich'),
    L('Сушильный шкаф (105 °C), часовое стекло', 'Drying oven (105 °C), watch glass', 'Quritish shkafi (105 °C), soat oynasi'),
  ],
  safety: [
    L('Растворимые соли бария ядовиты: работайте в перчатках, после опыта вымойте руки.', 'Soluble barium salts are poisonous: wear gloves and wash your hands afterwards.', 'Eriydigan bariy tuzlari zaharli: qo‘lqopda ishlang, tajribadan keyin qo‘lingizni yuving.'),
    L('Очки обязательны: брызги солевых растворов раздражают глаза.', 'Goggles are a must: splashes of salt solutions irritate the eyes.', 'Ko‘zoynak shart: tuz eritmalarining sachrashi ko‘zni achishtiradi.'),
    L('Горячий фильтр из шкафа — только щипцами или в перчатках; остатки с барием — в банку для слива, не в раковину.', 'Take the hot filter out with tongs or gloves; barium waste goes into the waste jar, not the sink.', 'Shkafdan issiq filtrni faqat qisqich yoki qo‘lqop bilan oling; bariyli qoldiqlar — chiqindi bankasiga, rakovinaga emas.'),
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
      observation: L('Очки и перчатки надеты — можно работать с солями бария.', 'Goggles and gloves on — you can work with barium salts.', 'Ko‘zoynak va qo‘lqop kiyildi — bariy tuzlari bilan ishlash mumkin.'),
      how: L('Нажмите на поднос со средствами защиты.', 'Tap the tray with the protective gear.', 'Himoya vositalari turgan patnisni bosing.'),
      teacher: L(
        'Ион Ba²⁺ из растворимых солей ядовит. А вот нерастворимый BaSO₄ безвреден — его даже пьют перед рентгеном желудка.',
        'The Ba²⁺ ion from soluble salts is poisonous. Insoluble BaSO₄, though, is harmless — patients even drink it before a stomach X-ray.',
        'Eriydigan tuzlardagi Ba²⁺ ioni zaharli. Erimaydigan BaSO₄ esa zararsiz — uni hatto oshqozon rentgenidan oldin ichishadi.',
      ),
    },
    {
      id: 'filter',
      target: 'filter',
      gesture: { kind: 'drag', from: [0.12, 0.01, 0.17], to: [-0.22, 0.06, 0.05], lead: 0.6 },
      seconds: 2.6,
      instruction: L('Положите сухой плотный фильтр («синяя лента») на весы.', 'Put the dry dense filter (“blue ribbon”) on the balance.', 'Quruq zich filtrni («ko‘k lenta») taroziga qo‘ying.'),
      observation: L('Весы показывают массу сухого фильтра — меньше 1 г.', 'The balance shows the dry filter — under 1 g.', 'Tarozi quruq filtr massasini ko‘rsatadi — 1 g dan kam.'),
      how: L('Перетащите фильтр на чашу весов.', 'Drag the filter onto the pan.', 'Filtrni tarozi pallasiga torting.'),
      teacher: L(
        'BaSO₄ выпадает очень мелкими кристалликами — сквозь обычный фильтр они проходят, поэтому берут самый плотный. Массу фильтра потом вычтем из массы фильтра с осадком.',
        'BaSO₄ comes down as very fine crystals that slip through ordinary paper, so the densest filter is used. Its mass will later be subtracted from the filter plus precipitate.',
        'BaSO₄ juda mayda kristallchalar bo‘lib cho‘kadi — oddiy filtrdan o‘tib ketadi, shuning uchun eng zichi olinadi. Filtr massasi keyin cho‘kmali filtr massasidan ayiriladi.',
      ),
      mistake: L('Брать фильтр мокрыми пальцами — влага прибавит сотые доли грамма.', 'Handling the filter with wet fingers — moisture adds hundredths of a gram.', 'Filtrni ho‘l barmoq bilan olish — namlik grammning yuzdan bir ulushlarini qo‘shadi.'),
    },
    {
      id: 'beaker',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.42, 0.05, -0.06], to: [-0.22, 0.1, 0.05], lead: 0.6 },
      seconds: 2.8,
      instruction: L('Уберите фильтр и поставьте на весы сухой стакан на 250 мл.', 'Remove the filter and put a dry 250 ml beaker on the balance.', 'Filtrni oling va taroziga quruq 250 ml li stakanni qo‘ying.'),
      observation: L('Весы показывают массу пустого стакана — около 98 г.', 'The balance shows the empty beaker — about 98 g.', 'Tarozi bo‘sh stakan massasini ko‘rsatadi — taxminan 98 g.'),
      how: L('Перетащите стакан на чашу весов.', 'Drag the beaker onto the pan.', 'Stakanni tarozi pallasiga torting.'),
      teacher: L(
        'В задаче даны массы растворов — их и отвешиваем прямо в стакан: весы точнее мензурки, и не нужно знать плотность.',
        'The problem gives masses of solutions, so we weigh them straight into the beaker: a balance is more precise than a cylinder, and no density is needed.',
        'Masalada eritmalar massasi berilgan — ularni to‘g‘ridan-to‘g‘ri stakanga tortamiz: tarozi menzurkadan aniqroq, zichlikni bilish ham shart emas.',
      ),
    },
    {
      id: 'tare1',
      target: 'tare',
      gesture: { kind: 'tap' },
      seconds: 1.4,
      instruction: L('Нажмите «T» — обнулите весы.', 'Press “T” to zero the balance.', '«T» ni bosib, tarozini nolga keltiring.'),
      observation: L('На дисплее 0.00 g и «→0←»: масса стакана вычтена.', 'The display reads 0.00 g with “→0←”: the beaker is subtracted.', 'Displeyda 0.00 g va «→0←»: stakan massasi ayirildi.'),
      how: L('Нажмите кнопку «T» на передней панели весов.', 'Tap the “T” button on the front of the balance.', 'Tarozi old panelidagi «T» tugmasini bosing.'),
      teacher: L('Тара вычитает посуду: дальше дисплей покажет только массу налитого раствора.', 'Tare subtracts the vessel: from now on the display shows only the solution poured in.', 'Tara idishni ayiradi: endi displey faqat quyilgan eritma massasini ko‘rsatadi.'),
      mistake: L('Без тары к массе раствора прибавится масса стакана (~98 г).', 'Without tare the beaker (~98 g) adds to the solution mass.', 'Tarasiz eritma massasiga stakan massasi (~98 g) qo‘shiladi.'),
    },
    {
      id: 'bacl2',
      target: 'bottle-bacl2',
      gesture: { kind: 'drag', from: [-0.5, 0.06, 0.17], to: [-0.25, 0.2, 0.05], lead: 0.42 },
      seconds: 4.6,
      instruction: L('Налейте в стакан 104,0 г 5 %-ного раствора хлорида бария.', 'Pour 104.0 g of 5 % barium chloride solution into the beaker.', 'Stakanga 104,0 g 5 % li bariy xlorid eritmasini quying.'),
      observation: L('Бесцветный прозрачный раствор (около 100 мл); дисплей останавливается около 104,0 г.', 'A colourless clear solution (about 100 ml); the display stops near 104.0 g.', 'Rangsiz tiniq eritma (taxminan 100 ml); displey 104,0 g atrofida to‘xtaydi.'),
      how: L('Перетащите склянку BaCl₂ к стакану на весах и наклоните; у отметки — по каплям.', 'Drag the BaCl₂ bottle to the beaker on the balance and tilt it; near the mark — drop by drop.', 'BaCl₂ shishasini tarozidagi stakanga torting va engashtiring; belgiga yaqin — tomchilab.'),
      teacher: L(
        'В растворе хлорид бария распался на ионы Ba²⁺ и Cl⁻, окружённые молекулами воды; 5 % — это 5 г соли в каждых 100 г раствора.',
        'In solution barium chloride has split into Ba²⁺ and Cl⁻ ions surrounded by water molecules; 5 % means 5 g of salt in every 100 g of solution.',
        'Eritmada bariy xlorid suv molekulalari bilan o‘ralgan Ba²⁺ va Cl⁻ ionlariga ajralgan; 5 % — har 100 g eritmada 5 g tuz.',
      ),
      mistake: L('Лить широкой струёй до самой отметки — легко перелить; у отметки лейте тонкой струйкой.', 'Pouring a wide stream right up to the mark — easy to overshoot; pour a thin stream near the mark.', 'Belgigacha keng oqim bilan quyish — oshirib yuborish oson; belgiga yaqin ingichka oqim bilan quying.'),
    },
    {
      id: 'tare2',
      target: 'tare',
      gesture: { kind: 'tap' },
      seconds: 1.4,
      instruction: L('Снова нажмите «T» — обнулите весы со стаканом и раствором.', 'Press “T” again to zero the balance with the beaker and solution.', '«T» ni yana bosing — stakan va eritma bilan tarozini nolga keltiring.'),
      observation: L('Дисплей снова 0.00 g: второй раствор весы покажут отдельно.', 'The display is 0.00 g again: the second solution will be shown separately.', 'Displey yana 0.00 g: ikkinchi eritmani tarozi alohida ko‘rsatadi.'),
      how: L('Нажмите кнопку «T».', 'Tap the “T” button.', '«T» tugmasini bosing.'),
      teacher: L('Тару можно брать сколько угодно раз: весы вычитают всё, что уже стоит на чаше.', 'You may tare as often as you like: the balance subtracts everything already on the pan.', 'Tarani istagancha olish mumkin: tarozi pallada turgan hamma narsani ayiradi.'),
    },
    {
      id: 'na2so4',
      target: 'bottle-na2so4',
      gesture: { kind: 'drag', from: [-0.02, 0.06, 0.17], to: [-0.19, 0.2, 0.05], lead: 0.42 },
      seconds: 4.8,
      instruction: L('Прилейте 71,0 г 10 %-ного раствора сульфата натрия.', 'Add 71.0 g of 10 % sodium sulfate solution.', '71,0 g 10 % li natriy sulfat eritmasini qo‘shing.'),
      observation: L(
        'Сразу выпадает густой белый осадок — смесь молочно-белая. Дисплей — около 71,0 г: при реакции масса не изменилась.',
        'A thick white precipitate forms at once — the mixture turns milky white. The display reads about 71.0 g: the reaction did not change the mass.',
        'Darhol quyuq oq cho‘kma tushadi — aralashma sutdek oq. Displey — taxminan 71,0 g: reaksiyada massa o‘zgarmadi.',
      ),
      how: L('Перетащите склянку Na₂SO₄ к стакану на весах и наклоните.', 'Drag the Na₂SO₄ bottle to the beaker on the balance and tilt it.', 'Na₂SO₄ shishasini tarozidagi stakanga torting va engashtiring.'),
      teacher: L(
        'Ионы Ba²⁺ и SO₄²⁻ встречаются и сразу связываются в нерастворимый BaSO₄, а Na⁺ и Cl⁻ так и остаются в растворе.',
        'Ba²⁺ and SO₄²⁻ ions meet and immediately bind into insoluble BaSO₄, while Na⁺ and Cl⁻ simply stay in solution.',
        'Ba²⁺ va SO₄²⁻ ionlari uchrashib, darhol erimaydigan BaSO₄ ga birikadi, Na⁺ va Cl⁻ esa eritmada qolaveradi.',
      ),
      mistake: L('Решить на глаз, что «осадок уже весь»: какое вещество кончилось, покажет только проба.', 'Deciding by eye that “all the precipitate is there”: only a test shows which reagent ran out.', 'Ko‘z bilan «cho‘kma to‘liq tushdi» deb hal qilish: qaysi modda tugaganini faqat sinov ko‘rsatadi.'),
    },
    {
      id: 'excess',
      target: 'pipette',
      gesture: { kind: 'swipe', from: [-0.52, 0.01, 0.05], to: [-0.23, 0.18, 0.05], lead: 0.3 },
      seconds: 9,
      instruction: L(
        'Дайте осадку осесть и проверьте, что в избытке: пипеткой перенесите прозрачный раствор над осадком в две пробирки, в первую капните BaCl₂, во вторую — Na₂SO₄.',
        'Let the precipitate settle and test for the excess: pipette the clear liquid above the precipitate into two test tubes, add a drop of BaCl₂ to the first and Na₂SO₄ to the second.',
        'Cho‘kma tinsin va ortiqchasini tekshiring: cho‘kma ustidagi tiniq eritmani pipetka bilan ikkita probirkaga oling, birinchisiga BaCl₂, ikkinchisiga Na₂SO₄ tomizing.',
      ),
      observation: L(
        'С каплей BaCl₂ — белая муть: в растворе остались ионы SO₄²⁻. С каплей Na₂SO₄ — прозрачно: ионов Ba²⁺ не осталось.',
        'With a drop of BaCl₂ — white cloudiness: SO₄²⁻ ions are still in solution. With a drop of Na₂SO₄ — clear: no Ba²⁺ ions are left.',
        'BaCl₂ tomchisi bilan — oq loyqa: eritmada SO₄²⁻ ionlari qolgan. Na₂SO₄ tomchisi bilan — tiniq: Ba²⁺ ionlari qolmagan.',
      ),
      how: L('Проведите пипеткой от стола к стакану — дальше проба идёт сама.', 'Swipe the dropper from the bench to the beaker — the test then runs by itself.', 'Pipetkani stoldan stakanga suring — sinov keyin o‘zi davom etadi.'),
      teacher: L(
        'Муть с BaCl₂ означает, что сульфат-ионов было больше, чем ионов бария: весь Ba²⁺ уже в осадке. Значит, сколько выпадет BaSO₄, решает вещество в недостатке.',
        'Cloudiness with BaCl₂ means there were more sulfate ions than barium ions: all the Ba²⁺ is already in the precipitate. So the amount of BaSO₄ is set by the reagent in short supply.',
        'BaCl₂ bilan loyqalanish sulfat ionlari bariy ionlaridan ko‘p bo‘lganini bildiradi: barcha Ba²⁺ allaqachon cho‘kmada. Demak, qancha BaSO₄ tushishini kamlikdagi modda belgilaydi.',
      ),
      mistake: L('Набрать жидкость со дна вместе с осадком — муть будет в обеих пробирках, и проба ничего не скажет.', 'Drawing liquid from the bottom with the precipitate — both tubes turn cloudy and the test tells nothing.', 'Suyuqlikni tubidan cho‘kma bilan olish — ikkala probirka ham loyqalanadi, sinov hech narsa ko‘rsatmaydi.'),
    },
    {
      id: 'filtrate',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.22, 0.1, 0.05], to: [0.13, 0.3, -0.06], lead: 0.4 },
      seconds: 6.5,
      instruction: L(
        'Отфильтруйте: вылейте смесь с осадком на фильтр в воронке и промойте осадок дистиллированной водой.',
        'Filter: pour the mixture with the precipitate onto the filter in the funnel and wash the precipitate with distilled water.',
        'Filtrlang: cho‘kmali aralashmani voronkadagi filtrga quying va cho‘kmani distillangan suv bilan yuving.',
      ),
      observation: L('Фильтрат стекает прозрачным, белый осадок остаётся на фильтре.', 'The filtrate runs through clear; the white precipitate stays on the filter.', 'Filtrat tiniq oqib tushadi, oq cho‘kma filtrda qoladi.'),
      how: L('Перетащите стакан с весов к воронке и наклоните.', 'Drag the beaker from the balance to the funnel and tilt it.', 'Stakanni tarozidan voronkaga torting va engashtiring.'),
      teacher: L(
        'Поры плотного фильтра мельче кристалликов BaSO₄, а вода с ионами Na⁺, Cl⁻ и лишними SO₄²⁻ проходит. Промывание уносит этот раствор с осадка — иначе после сушки соли прибавят массу.',
        'The pores of the dense filter are finer than the BaSO₄ crystals, while water with Na⁺, Cl⁻ and the spare SO₄²⁻ passes through. Washing carries that solution off the precipitate — otherwise the dried salts would add mass.',
        'Zich filtr teshikchalari BaSO₄ kristallchalaridan mayda, Na⁺, Cl⁻ va ortiqcha SO₄²⁻ ionli suv esa o‘tib ketadi. Yuvish bu eritmani cho‘kmadan olib ketadi — aks holda quritilgandan keyin tuzlar massa qo‘shadi.',
      ),
      mistake: L('Лить выше края бумаги — часть осадка проскочит между фильтром и стеклом воронки.', 'Pouring above the paper edge — some precipitate slips between the filter and the funnel glass.', 'Qog‘oz chetidan yuqori quyish — cho‘kmaning bir qismi filtr va voronka shishasi orasidan o‘tib ketadi.'),
    },
    {
      id: 'dry',
      target: 'oven',
      gesture: { kind: 'tap' },
      seconds: 3.4,
      instruction: L('Высушите фильтр с осадком в сушильном шкафу при 105 °C.', 'Dry the filter with the precipitate in the drying oven at 105 °C.', 'Cho‘kmali filtrni quritish shkafida 105 °C da quriting.'),
      observation: L('Фильтр сохнет (время ускорено: 60 мин); осадок — белый сухой порошок.', 'The filter dries (time sped up: 60 min); the precipitate is a dry white powder.', 'Filtr quriydi (vaqt tezlashtirilgan: 60 daqiqa); cho‘kma — oq quruq kukun.'),
      how: L('Нажмите на сушильный шкаф.', 'Tap the drying oven.', 'Quritish shkafini bosing.'),
      teacher: L(
        'При 105 °C уходит только вода, BaSO₄ не разлагается. Сушат до постоянной массы и дают остыть: тёплый фильтр на весах «легчает» из-за потока воздуха.',
        'At 105 °C only water leaves; BaSO₄ does not decompose. Dry to constant mass and let it cool: a warm filter reads light because of rising air.',
        '105 °C da faqat suv chiqadi, BaSO₄ parchalanmaydi. O‘zgarmas massagacha quritiladi va sovitiladi: iliq filtr havo oqimi tufayli tarozida «yengil» chiqadi.',
      ),
      mistake: L('Взвесить недосушенный фильтр — оставшаяся вода прибавит массу осадку.', 'Weighing a filter that is not fully dry — the leftover water adds to the precipitate.', 'Yaxshi qurimagan filtrni tortish — qolgan suv cho‘kma massasiga qo‘shiladi.'),
    },
    {
      id: 'weigh',
      target: 'filter',
      gesture: { kind: 'drag', from: [0.48, 0.08, -0.1], to: [-0.2, 0.06, 0.05], lead: 0.6 },
      seconds: 3.2,
      instruction: L('Обнулите пустые весы «T» и положите остывший фильтр с осадком на чашу.', 'Zero the empty balance with “T” and put the cooled filter with the precipitate on the pan.', 'Bo‘sh tarozini «T» bilan nolga keltiring va sovigan cho‘kmali filtrni pallaga qo‘ying.'),
      observation: L('Весы показывают массу фильтра с осадком — около 6,6 г.', 'The balance shows the filter with the precipitate — about 6.6 g.', 'Tarozi cho‘kmali filtr massasini ko‘rsatadi — taxminan 6,6 g.'),
      how: L('Перетащите фильтр из шкафа на весы.', 'Drag the filter from the oven to the balance.', 'Filtrni shkafdan taroziga torting.'),
      teacher: L(
        'Без стакана весы показывали «минус» запомненную тару — поэтому сначала снова ноль. Масса осадка — разность: фильтр с осадком минус сухой фильтр.',
        'Without the beaker the balance showed “minus” the stored tare — so zero it first. The precipitate is the difference: filter with precipitate minus dry filter.',
        'Stakansiz tarozi eslab qolingan tarani «minus» bilan ko‘rsatardi — shuning uchun avval yana nol. Cho‘kma massasi — farq: cho‘kmali filtr minus quruq filtr.',
      ),
    },
  ],
  focus: [
    { from: 1.62, to: 1.99, point: [-0.22, 0.03, 0.17], dist: 0.26 },
    { from: 4.62, to: 4.99, point: [-0.22, 0.05, 0.14], dist: 0.3 },
    { from: 6.5, to: 6.99, point: [-0.22, 0.07, 0.1], dist: 0.32 },
    { from: 7.3, to: 7.99, point: [-0.47, 0.09, -0.19], dist: 0.3 },
    { from: 8.36, to: 8.68, point: [0.13, 0.2, -0.13], dist: 0.36 },
    { from: 10.62, to: 10.99, point: [-0.22, 0.03, 0.17], dist: 0.26 },
  ],
  labels: [
    { at: 6.6, pos: [-0.22, 0.2, 0.05], text: L('белый осадок BaSO₄ — сразу', 'white BaSO₄ precipitate — at once', 'oq BaSO₄ cho‘kmasi — darhol') },
    { at: 7.8, pos: [-0.53, 0.2, -0.19], text: L('+ BaCl₂: муть → SO₄²⁻ в избытке', '+ BaCl₂: cloudy → SO₄²⁻ in excess', '+ BaCl₂: loyqa → SO₄²⁻ ortiqcha') },
    { at: 7.93, pos: [-0.4, 0.23, -0.19], text: L('+ Na₂SO₄: прозрачно → Ba²⁺ нет', '+ Na₂SO₄: clear → no Ba²⁺', '+ Na₂SO₄: tiniq → Ba²⁺ yo‘q') },
    { at: 8.5, pos: [0.22, 0.18, -0.13], text: L('фильтрат прозрачный', 'the filtrate is clear', 'filtrat tiniq') },
  ],
  measurements: [
    { key: 'mF', label: 'm₀', what: L('масса сухого фильтра', 'mass of the dry filter', 'quruq filtr massasi'), instrument: 'scales', afterStep: 1 },
    { key: 'm1', label: 'm₁', what: L('масса 5 %-ного раствора BaCl₂', 'mass of the 5 % BaCl₂ solution', '5 % li BaCl₂ eritmasi massasi'), instrument: 'scales', afterStep: 4 },
    { key: 'm2', label: 'm₂', what: L('масса 10 %-ного раствора Na₂SO₄', 'mass of the 10 % Na₂SO₄ solution', '10 % li Na₂SO₄ eritmasi massasi'), instrument: 'scales', afterStep: 6 },
    { key: 'mFP', label: 'm₃', what: L('масса фильтра с сухим осадком', 'mass of the filter with the dry precipitate', 'quruq cho‘kmali filtr massasi'), instrument: 'scales', afterStep: 10 },
    { key: 'mP', label: 'm(BaSO₄)', what: L('масса осадка m₃ − m₀', 'precipitate mass m₃ − m₀', 'cho‘kma massasi m₃ − m₀'), instrument: 'scales', afterStep: 10, derived: true },
  ],
  simulate: (rng) => {
    // фильтр «синяя лента» Ø 11 см — 0,8–0,9 г
    const mF = rng.read('scales', rng.between(0.8, 0.9))
    // у отметки доливают по каплям: обычно на 0,01–0,06 г больше
    const m1 = rng.weigh(104, 0.06)
    const m2 = rng.weigh(71, 0.06)
    const lim = Math.min((m1 * W1) / M_BACL2, (m2 * W2) / M_NA2SO4)
    // потери: мельчайшие кристаллы проходят сквозь фильтр, немного остаётся на стекле и палочке
    const mTrue = lim * M_BASO4 * rng.between(0.985, 0.996)
    const mFP = rng.read('scales', mF + mTrue)
    return { mF, m1, m2, mFP, mP: Math.round((mFP - mF) * 100) / 100 }
  },
  given: (v, lang) => [
    tr(lang, `m₁ = ${n(v.m1!, 2, lang)} г — 5 %-ный раствор BaCl₂`, `m₁ = ${n(v.m1!, 2, lang)} g — 5 % BaCl₂ solution`, `m₁ = ${n(v.m1!, 2, lang)} g — 5 % li BaCl₂ eritmasi`),
    tr(lang, `m₂ = ${n(v.m2!, 2, lang)} г — 10 %-ный раствор Na₂SO₄`, `m₂ = ${n(v.m2!, 2, lang)} g — 10 % Na₂SO₄ solution`, `m₂ = ${n(v.m2!, 2, lang)} g — 10 % li Na₂SO₄ eritmasi`),
    tr(
      lang,
      `m₀ = ${n(v.mF!, 2, lang)} г (фильтр), m₃ = ${n(v.mFP!, 2, lang)} г (фильтр + осадок) → m(BaSO₄) = ${n(v.mP!, 2, lang)} г`,
      `m₀ = ${n(v.mF!, 2, lang)} g (filter), m₃ = ${n(v.mFP!, 2, lang)} g (filter + precipitate) → m(BaSO₄) = ${n(v.mP!, 2, lang)} g`,
      `m₀ = ${n(v.mF!, 2, lang)} g (filtr), m₃ = ${n(v.mFP!, 2, lang)} g (filtr + cho‘kma) → m(BaSO₄) = ${n(v.mP!, 2, lang)} g`,
    ),
    tr(lang, 'Проба над осадком: + BaCl₂ — муть, + Na₂SO₄ — без мути', 'Test above the precipitate: + BaCl₂ — cloudy, + Na₂SO₄ — clear', 'Cho‘kma ustidagi sinov: + BaCl₂ — loyqa, + Na₂SO₄ — tiniq'),
    'M(BaCl₂) = 208, M(Na₂SO₄) = 142, M(BaSO₄) = 233 ' + tr(lang, 'г/моль', 'g/mol', 'g/mol'),
    tr(lang, 'Найти: m(BaSO₄) — ?', 'Find: m(BaSO₄) = ?', 'Topish kerak: m(BaSO₄) — ?'),
  ],
  solution: (v, lang) => {
    const a = nBa(v)
    const b = nSo4(v)
    const lim = Math.min(a, b)
    const m = lim * M_BASO4
    const baShort = a <= b
    const short = baShort ? 'BaCl₂' : 'Na₂SO₄'
    const extra = baShort ? 'Na₂SO₄' : 'BaCl₂'
    const g = tr(lang, 'г', 'g', 'g')
    const mol = tr(lang, 'моль', 'mol', 'mol')
    return [
      tr(
        lang,
        `1) m(BaCl₂) = ${n(v.m1!, 2, lang)} · 0,05 = ${n(v.m1! * W1, 3, lang)} г; n(BaCl₂) = ${n(v.m1! * W1, 3, lang)} / 208 = ${n(a, 4, lang)} моль`,
        `1) m(BaCl₂) = ${n(v.m1!, 2, lang)} · 0.05 = ${n(v.m1! * W1, 3, lang)} g; n(BaCl₂) = ${n(v.m1! * W1, 3, lang)} / 208 = ${n(a, 4, lang)} mol`,
        `1) m(BaCl₂) = ${n(v.m1!, 2, lang)} · 0,05 = ${n(v.m1! * W1, 3, lang)} g; n(BaCl₂) = ${n(v.m1! * W1, 3, lang)} / 208 = ${n(a, 4, lang)} mol`,
      ),
      tr(
        lang,
        `2) m(Na₂SO₄) = ${n(v.m2!, 2, lang)} · 0,1 = ${n(v.m2! * W2, 3, lang)} г; n(Na₂SO₄) = ${n(v.m2! * W2, 3, lang)} / 142 = ${n(b, 4, lang)} моль`,
        `2) m(Na₂SO₄) = ${n(v.m2!, 2, lang)} · 0.1 = ${n(v.m2! * W2, 3, lang)} g; n(Na₂SO₄) = ${n(v.m2! * W2, 3, lang)} / 142 = ${n(b, 4, lang)} mol`,
        `2) m(Na₂SO₄) = ${n(v.m2!, 2, lang)} · 0,1 = ${n(v.m2! * W2, 3, lang)} g; n(Na₂SO₄) = ${n(v.m2! * W2, 3, lang)} / 142 = ${n(b, 4, lang)} mol`,
      ),
      tr(
        lang,
        `3) BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl — 1 : 1. В недостатке ${short} (${n(lim, 4, lang)} ${mol}), ${extra} в избытке — проба это подтвердила.`,
        `3) BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl — 1 : 1. ${short} is the limiting reagent (${n(lim, 4, lang)} ${mol}), ${extra} is in excess — the test confirmed it.`,
        `3) BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl — 1 : 1. Kamlikda ${short} (${n(lim, 4, lang)} ${mol}), ${extra} ortiqcha — sinov buni tasdiqladi.`,
      ),
      tr(
        lang,
        `4) Считаем по недостатку: n(BaSO₄) = ${n(lim, 4, lang)} моль; m(BaSO₄) = 233 · ${n(lim, 4, lang)} = ${n(m, 2, lang)} г`,
        `4) Calculate from the limiting reagent: n(BaSO₄) = ${n(lim, 4, lang)} mol; m(BaSO₄) = 233 · ${n(lim, 4, lang)} = ${n(m, 2, lang)} g`,
        `4) Kamlikdagi modda bo‘yicha hisoblaymiz: n(BaSO₄) = ${n(lim, 4, lang)} mol; m(BaSO₄) = 233 · ${n(lim, 4, lang)} = ${n(m, 2, lang)} g`,
      ),
      tr(
        lang,
        `5) Опыт: m(BaSO₄) = ${n(v.mFP!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mP!, 2, lang)} г — это ${n((v.mP! / m) * 100, 1, lang)} % от расчёта`,
        `5) Experiment: m(BaSO₄) = ${n(v.mFP!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mP!, 2, lang)} g — ${n((v.mP! / m) * 100, 1, lang)} % of the calculation`,
        `5) Tajriba: m(BaSO₄) = ${n(v.mFP!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mP!, 2, lang)} g — hisobning ${n((v.mP! / m) * 100, 1, lang)} % i`,
      ),
      tr(lang, `Ответ: m(BaSO₄) ≈ ${n(m, 2, lang)} ${g}`, `Answer: m(BaSO₄) ≈ ${n(m, 2, lang)} ${g}`, `Javob: m(BaSO₄) ≈ ${n(m, 2, lang)} ${g}`),
    ]
  },
  compare: [
    {
      label: L('масса осадка BaSO₄', 'mass of the BaSO₄ precipitate', 'BaSO₄ cho‘kmasi massasi'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mP!,
      predicted: (v) => nLim(v) * M_BASO4,
      book: 5.825,
      tolerancePct: 3,
    },
  ],
  reconcile: L(
    'На весах осадка обычно на 0,5–1,5 % меньше расчёта. Мельчайшие кристаллики BaSO₄ проходят даже сквозь «синюю ленту», немного осадка остаётся на стенках стакана; растворимость BaSO₄ ничтожна (≈2 мг на литр), её почти не видно. В другую сторону ошибаются, если плохо промыть осадок (на нём высохнут NaCl и Na₂SO₄) или не досушить фильтр. Сами весы дают ±0,01 г — на 5,8 г это всего ±0,2 %.',
    'The balance usually shows 0.5–1.5 % less precipitate than calculated. The finest BaSO₄ crystals pass even through the “blue ribbon”, and a little stays on the beaker walls; BaSO₄ solubility is tiny (≈2 mg per litre) and barely shows. The error goes the other way if the precipitate is poorly washed (NaCl and Na₂SO₄ dry on it) or the filter is not dried through. The balance itself gives ±0.01 g — only ±0.2 % of 5.8 g.',
    'Tarozida cho‘kma odatda hisobdan 0,5–1,5 % kam chiqadi. Eng mayda BaSO₄ kristallchalari hatto «ko‘k lenta»dan ham o‘tadi, ozgina cho‘kma stakan devorlarida qoladi; BaSO₄ ning eruvchanligi juda kichik (litrda ≈2 mg), deyarli sezilmaydi. Cho‘kma yomon yuvilsa (unda NaCl va Na₂SO₄ quriydi) yoki filtr yaxshi quritilmasa, xato teskari tomonga ketadi. Tarozining o‘zi ±0,01 g beradi — 5,8 g da bor-yo‘g‘i ±0,2 %.',
  ),
  conclusion: L(
    'BaCl₂ (0,025 моль) оказался в недостатке, Na₂SO₄ (0,05 моль) — в избытке: проба над осадком это показала. Осадка выпадает столько, сколько позволяет вещество в недостатке, — 0,025 моль, 5,825 г BaSO₄.',
    'BaCl₂ (0.025 mol) was the limiting reagent and Na₂SO₄ (0.05 mol) was in excess, as the test above the precipitate showed. As much precipitate forms as the limiting reagent allows — 0.025 mol, 5.825 g of BaSO₄.',
    'BaCl₂ (0,025 mol) kamlikda, Na₂SO₄ (0,05 mol) esa ortiqcha bo‘lib chiqdi — cho‘kma ustidagi sinov buni ko‘rsatdi. Cho‘kma kamlikdagi modda imkon bergancha tushadi — 0,025 mol, 5,825 g BaSO₄.',
  ),
  story: {
    equation: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓',
    text: L(
      'Каждый ион Ba²⁺ встречает в растворе ион SO₄²⁻, и они прочно связываются в кристаллик BaSO₄, который уже не растворяется. Сульфат-ионов было вдвое больше, поэтому когда бария не осталось, половина SO₄²⁻ так и плавает в растворе вместе с Na⁺ и Cl⁻ — их и обнаружила капля BaCl₂ в пробе.',
      'Each Ba²⁺ ion meets an SO₄²⁻ ion in solution, and they bind firmly into a BaSO₄ crystal that no longer dissolves. There were twice as many sulfate ions, so once the barium ran out, half of the SO₄²⁻ is still floating in solution with Na⁺ and Cl⁻ — that is what the drop of BaCl₂ found in the test.',
      'Har bir Ba²⁺ ioni eritmada SO₄²⁻ ioni bilan uchrashadi va ular endi erimaydigan BaSO₄ kristallchasiga mustahkam birikadi. Sulfat ionlari ikki baravar ko‘p edi, shuning uchun bariy tugaganda SO₄²⁻ ning yarmi Na⁺ va Cl⁻ bilan eritmada qoladi — sinovdagi BaCl₂ tomchisi aynan ularni topdi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показала проба прозрачного раствора над осадком?', 'What did the test of the clear liquid above the precipitate show?', 'Cho‘kma ustidagi tiniq eritma sinovi nimani ko‘rsatdi?'),
      options: [
        L('С BaCl₂ — муть, с Na₂SO₄ — прозрачно', 'Cloudy with BaCl₂, clear with Na₂SO₄', 'BaCl₂ bilan — loyqa, Na₂SO₄ bilan — tiniq'),
        L('С BaCl₂ — прозрачно, с Na₂SO₄ — муть', 'Clear with BaCl₂, cloudy with Na₂SO₄', 'BaCl₂ bilan — tiniq, Na₂SO₄ bilan — loyqa'),
        L('Обе пробирки помутнели', 'Both tubes turned cloudy', 'Ikkala probirka ham loyqalandi'),
      ],
      correct: 0,
      why: L(
        'Ba²⁺ из капли BaCl₂ нашёл оставшиеся ионы SO₄²⁻ — значит, Na₂SO₄ в избытке; капле Na₂SO₄ «не с кем» реагировать — ионов бария не осталось.',
        'Ba²⁺ from the BaCl₂ drop found leftover SO₄²⁻ ions, so Na₂SO₄ is in excess; the Na₂SO₄ drop had nothing to react with — no barium ions were left.',
        'BaCl₂ tomchisidagi Ba²⁺ qolgan SO₄²⁻ ionlarini topdi — demak, Na₂SO₄ ortiqcha; Na₂SO₄ tomchisi «hech kim bilan» reaksiyaga kirmadi — bariy ionlari qolmagan.',
      ),
    },
    {
      id: 'type',
      q: L('К какому типу относится эта реакция?', 'What type of reaction is this?', 'Bu qanday turdagi reaksiya?'),
      options: [
        L('Обмен, идущий до конца: выпадает осадок', 'Exchange that goes to completion: a precipitate forms', 'Oxirigacha boradigan almashinish: cho‘kma tushadi'),
        L('Замещение', 'Substitution', 'O‘rin olish'),
        L('Соединение', 'Combination', 'Birikish'),
      ],
      correct: 0,
      why: L(
        'Две соли обмениваются ионами: Ba²⁺ уходит к SO₄²⁻, Na⁺ остаётся с Cl⁻. Реакция идёт до конца, потому что BaSO₄ нерастворим.',
        'Two salts swap ions: Ba²⁺ goes to SO₄²⁻ and Na⁺ stays with Cl⁻. It goes to completion because BaSO₄ is insoluble.',
        'Ikki tuz ion almashadi: Ba²⁺ SO₄²⁻ ga o‘tadi, Na⁺ Cl⁻ bilan qoladi. BaSO₄ erimagani uchun reaksiya oxirigacha boradi.',
      ),
    },
    {
      id: 'product',
      q: L('Что осталось на фильтре, а что прошло в фильтрат?', 'What stayed on the filter and what went into the filtrate?', 'Filtrda nima qoldi, filtratga nima o‘tdi?'),
      options: [
        L('На фильтре BaSO₄; в фильтрате NaCl и избыток Na₂SO₄', 'BaSO₄ on the filter; NaCl and the excess Na₂SO₄ in the filtrate', 'Filtrda BaSO₄; filtratda NaCl va ortiqcha Na₂SO₄'),
        L('На фильтре NaCl; в фильтрате BaSO₄', 'NaCl on the filter; BaSO₄ in the filtrate', 'Filtrda NaCl; filtratda BaSO₄'),
        L('На фильтре BaCl₂ и Na₂SO₄; в фильтрате вода', 'BaCl₂ and Na₂SO₄ on the filter; water in the filtrate', 'Filtrda BaCl₂ va Na₂SO₄; filtratda suv'),
      ],
      correct: 0,
      why: L(
        'Нерастворимый BaSO₄ задержан фильтром, растворимые NaCl и непрореагировавший Na₂SO₄ ушли с водой — поэтому осадок и промывают.',
        'Insoluble BaSO₄ is held by the filter; soluble NaCl and unreacted Na₂SO₄ leave with the water — which is why the precipitate is washed.',
        'Erimaydigan BaSO₄ filtrda ushlanib qoldi, eriydigan NaCl va reaksiyaga kirmagan Na₂SO₄ suv bilan o‘tib ketdi — shuning uchun cho‘kma yuviladi.',
      ),
    },
  ],
  sideEquations: ['Ba²⁺ + SO₄²⁻ → BaSO₄↓'],
}
