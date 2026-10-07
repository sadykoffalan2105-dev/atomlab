/**
 * Kimyo 8, с. 128, задание 10: масса и количество вещества осадка AgCl из раствора, содержащего 19 г MgCl₂.
 * Опыт в 20 раз меньше: 50,0 г 1,9 %-го раствора MgCl₂ (0,95 г соли) + 40 мл 10 %-го AgNO₃ (нужно ≈ 31 мл) →
 * белый творожистый AgCl↓; проба на полноту осаждения, фильтрование с промыванием, сушка при 105 °C, взвешивание
 * фильтра до и после. m(AgCl) = m(фильтра с осадком) − m(фильтра).
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { quantize } from '../../../components/lab3d/measure/quantities'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'
import { AG } from './layoutG8'

/** Массовая доля MgCl₂ в растворе на склянке. */
const W = 0.019
const M_MGCL2 = 95
const M_AGCL = 143.5
const PAN: readonly [number, number, number] = [AG.scales[0], 0.047, AG.scales[2] - 0.012]
const f = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
/** MgCl₂ в опыте (г) и AgCl по расчёту из него (г). */
const mSalt = (v: LabTaskValues) => v.mSol! * W
const agclCalc = (v: LabTaskValues) => (mSalt(v) / M_MGCL2) * 2 * M_AGCL
/** Пересчёт на задачу: во сколько раз 19 г больше взятой соли. */
const toBook = (v: LabTaskValues) => 19 / mSalt(v)

export const TASK_G8_AGCL: LabTask = {
  id: 'task-g8-agcl',
  grade: 8,
  page: 128,
  source: L('Kimyo 8 · с. 128, задание 10', 'Kimyo 8 · p. 128, exercise 10', 'Kimyo 8 · 128-bet, 10-topshiriq'),
  bookKind: 'task',
  title: L('Осадок хлорида серебра: масса и количество', 'Silver chloride precipitate: mass and amount', 'Kumush xlorid cho‘kmasi: massa va miqdor'),
  statement: L(
    'Определите массу и количество вещества осадка, образующегося при добавлении к раствору, содержащему 19 г хлорида магния, достаточного количества раствора нитрата серебра.',
    'Determine the mass and the amount of substance of the precipitate formed when a sufficient amount of silver nitrate solution is added to a solution containing 19 g of magnesium chloride.',
    '19 g magniy xlorid saqlagan eritmaga yetarli miqdorda kumush nitrat eritmasi qo‘shilganda hosil bo‘ladigan cho‘kmaning massasi va modda miqdorini aniqlang.',
  ),
  equation: 'MgCl₂ + 2AgNO₃ → 2AgCl↓ + Mg(NO₃)₂',
  kind: 'exchange',
  type: 'precipitate',
  difficulty: 2,
  answers: [
    {
      key: 'mAgCl',
      label: 'm(AgCl)',
      what: L('масса осадка хлорида серебра', 'mass of the silver chloride precipitate', 'kumush xlorid cho‘kmasining massasi'),
      unit: L('г', 'g', 'g'),
      book: 57.4,
      decimals: 1,
      fromRun: (v) => v.mAgCl! * toBook(v),
      altFromRun: (v) => v.mAgCl! * 20,
    },
    {
      key: 'nAgCl',
      label: 'n(AgCl)',
      what: L('количество вещества осадка', 'amount of substance of the precipitate', 'cho‘kmaning modda miqdori'),
      unit: L('моль', 'mol', 'mol'),
      book: 0.4,
      decimals: 2,
      fromRun: (v) => (v.mAgCl! * toBook(v)) / M_AGCL,
      altFromRun: (v) => (v.mAgCl! * 20) / M_AGCL,
    },
  ],
  labScale: {
    factor: 20,
    note: L(
      'В задаче 19 г MgCl₂ — осадка получится почти 60 г, это килограмм раствора. Берём в 20 раз меньше: 50,0 г 1,9 %-го раствора — в нём 0,95 г MgCl₂, осадка будет около 2,9 г. Ответ пересчитываем на 19 г.',
      'The problem has 19 g of MgCl₂ — almost 60 g of precipitate and a kilogram of solution. We take 20 times less: 50.0 g of a 1.9 % solution holds 0.95 g of MgCl₂, giving about 2.9 g of precipitate. The answer is scaled back to 19 g.',
      'Masalada 19 g MgCl₂ — deyarli 60 g cho‘kma, bu bir kilogramm eritma. 20 marta kam olamiz: 50,0 g 1,9 % li eritmada 0,95 g MgCl₂ bor, cho‘kma taxminan 2,9 g bo‘ladi. Javobni 19 g ga qayta hisoblaymiz.',
    ),
  },
  instruments: ['scales', 'cyl50'],
  equipment: [
    L('Электронные весы (0,01 г), стакан 250 мл, бумажный фильтр', 'Electronic balance (0.01 g), 250 ml beaker, filter paper', 'Elektron tarozi (0,01 g), 250 ml stakan, filtr qog‘oz'),
    L('Раствор MgCl₂ 1,9 %; раствор AgNO₃ 10 % в тёмной склянке и капельница', '1.9 % MgCl₂ solution; 10 % AgNO₃ solution in a dark bottle and a dropper', '1,9 % li MgCl₂ eritmasi; to‘q shishadagi 10 % li AgNO₃ eritmasi va tomizgich'),
    L('Мерный цилиндр 50 мл, стеклянная палочка', '50 ml measuring cylinder, glass rod', '50 ml o‘lchov silindri, shisha tayoqcha'),
    L('Штатив с кольцом, воронка, стакан для фильтрата, промывалка с дистиллированной водой', 'Ring stand, funnel, beaker for the filtrate, wash bottle with distilled water', 'Halqali shtativ, voronka, filtrat uchun stakan, distillangan suvli yuvgich'),
    L('Сушильный шкаф (105 °C), часовое стекло', 'Drying oven (105 °C), watch glass', 'Quritish shkafi (105 °C), soat oynasi'),
  ],
  safety: [
    L('Очки и перчатки: нитрат серебра оставляет на коже чёрные пятна и разъедает глаза.', 'Goggles and gloves: silver nitrate leaves black stains on the skin and harms the eyes.', 'Ko‘zoynak va qo‘lqop: kumush nitrat terida qora dog‘ qoldiradi va ko‘zni yemiradi.'),
    L('AgNO₃ хранят в тёмной склянке: на свету он разлагается. Склянку сразу закрывают.', 'AgNO₃ is kept in a dark bottle: light decomposes it. Close the bottle right away.', 'AgNO₃ to‘q shishada saqlanadi: yorug‘likda parchalanadi. Shishani darhol yoping.'),
    L('Фильтрат с серебром не выливают в раковину — его сливают в банку для остатков серебра.', 'The filtrate containing silver is not poured into the sink — it goes into the silver residue jar.', 'Kumushli filtrat rakovinaga to‘kilmaydi — kumush qoldiqlari bankasiga quyiladi.'),
  ],
  gear: ['goggles', 'gloves'],
  steps: [
    {
      id: 'ppe',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте очки и перчатки.', 'Put on goggles and gloves.', 'Ko‘zoynak va qo‘lqop taqing.'),
      observation: L('Глаза и руки защищены — работаем с нитратом серебра.', 'Eyes and hands are protected — we are working with silver nitrate.', 'Ko‘z va qo‘llar himoyalangan — kumush nitrat bilan ishlaymiz.'),
      how: L('Нажмите на поднос со средствами защиты.', 'Tap the tray with the protective gear.', 'Himoya vositalari turgan patnisni bosing.'),
      teacher: L(
        'Ионы Ag⁺ восстанавливаются на коже до мельчайших частиц серебра — пятна чернеют и не смываются несколько дней.',
        'Ag⁺ ions are reduced on the skin to tiny particles of silver — the stains turn black and stay for days.',
        'Ag⁺ ionlari terida mayda kumush zarrachalarigacha qaytariladi — dog‘lar qorayadi va bir necha kun yuvilmaydi.',
      ),
    },
    {
      id: 'filter-dry',
      target: 'filter',
      gesture: { kind: 'drag', from: [AG.paper[0], 0.01, AG.paper[2]], to: [PAN[0], 0.07, PAN[2]], lead: 0.5 },
      seconds: 4,
      instruction: L('Взвесьте сухой бумажный фильтр.', 'Weigh the dry filter paper.', 'Quruq filtr qog‘ozni torting.'),
      observation: L('Фильтр лёгкий — меньше грамма; показание остановилось, горит значок ○.', 'The filter is light — less than a gram; the reading has settled and the ○ mark is on.', 'Filtr yengil — bir grammdan kam; ko‘rsatkich to‘xtadi, ○ belgisi yondi.'),
      how: L('Перетащите фильтр со стола на чашу весов.', 'Drag the filter from the table onto the balance pan.', 'Filtrni stoldan tarozi pallasiga torting.'),
      teacher: L(
        'Осадок будем взвешивать вместе с фильтром, поэтому массу самого фильтра нужно знать заранее. Фильтр заранее высушен — в нём нет влаги.',
        'We will weigh the precipitate together with the filter, so we must know the mass of the filter itself beforehand. The filter has been dried in advance — it holds no moisture.',
        'Cho‘kmani filtr bilan birga tortamiz, shuning uchun filtrning o‘z massasini oldindan bilish kerak. Filtr oldindan quritilgan — unda namlik yo‘q.',
      ),
      mistake: L('Берут фильтр мокрыми пальцами — бумага впитывает воду, и масса завышается.', 'Handling the filter with wet fingers — the paper soaks up water and the mass comes out too high.', 'Filtrni ho‘l barmoqlar bilan olish — qog‘oz suvni shimadi va massa oshib ketadi.'),
    },
    {
      id: 'beaker',
      target: 'beaker',
      gesture: { kind: 'drag', from: [AG.beaker[0], 0.05, AG.beaker[2]], to: [PAN[0], 0.1, PAN[2]], lead: 0.45 },
      seconds: 4,
      instruction: L('Уберите фильтр, поставьте на весы сухой стакан и обнулите их (T).', 'Take the filter off, put a dry beaker on the balance and tare it (T).', 'Filtrni oling, taroziga quruq stakan qo‘ying va nolga keltiring (T).'),
      observation: L('Весы показали массу стакана, после «T» — 0,00 г: дальше на дисплее только раствор.', 'The balance showed the mass of the beaker; after “T” it reads 0.00 g — from now on the display shows only the solution.', 'Tarozi stakan massasini ko‘rsatdi, «T» dan so‘ng — 0,00 g: endi displeyda faqat eritma.'),
      how: L('Перетащите стакан на чашу весов.', 'Drag the beaker onto the balance pan.', 'Stakanni tarozi pallasiga torting.'),
      teacher: L(
        'Тара — это вычитание: весы запоминают массу стакана и показывают только то, что в него нальют.',
        'Taring is a subtraction: the balance remembers the beaker’s mass and shows only what is poured into it.',
        'Tara — bu ayirish: tarozi stakan massasini eslab qoladi va faqat unga quyilganini ko‘rsatadi.',
      ),
      mistake: L('Забывают нажать T — тогда в «массу раствора» попадает и стакан.', 'Forgetting to press T — then the beaker ends up in the “mass of the solution”.', 'T ni bosishni unutish — shunda «eritma massasi»ga stakan ham qo‘shiladi.'),
    },
    {
      id: 'mgcl2',
      target: 'bottle-mgcl2',
      gesture: { kind: 'drag', from: [AG.mgBottle[0], 0.08, AG.mgBottle[2]], to: [PAN[0], 0.2, PAN[2]], lead: 0.3 },
      seconds: 5.5,
      instruction: L('Налейте раствор MgCl₂ 1,9 % до 50,00 г.', 'Pour 1.9 % MgCl₂ solution up to 50.00 g.', '1,9 % li MgCl₂ eritmasini 50,00 g gacha quying.'),
      observation: L('Раствор бесцветный и прозрачный; у 50 г льют тонкой струйкой и останавливаются на 50,0x г.', 'The solution is colourless and clear; near 50 g it is poured in a thin trickle and stopped at 50.0x g.', 'Eritma rangsiz va tiniq; 50 g ga yaqin ingichka oqim bilan quyilib, 50,0x g da to‘xtatiladi.'),
      how: L('Перетащите склянку MgCl₂ к стакану на весах.', 'Drag the MgCl₂ bottle to the beaker on the balance.', 'MgCl₂ shishasini tarozidagi stakanga torting.'),
      teacher: L(
        'В 50 г раствора с долей 1,9 % — 0,95 г MgCl₂, то есть 0,01 моль. Каждая частица MgCl₂ даёт в воде один ион Mg²⁺ и два иона Cl⁻.',
        'Fifty grams of a 1.9 % solution hold 0.95 g of MgCl₂, that is 0.01 mol. Each MgCl₂ unit gives one Mg²⁺ ion and two Cl⁻ ions in water.',
        '1,9 % li 50 g eritmada 0,95 g MgCl₂, ya’ni 0,01 mol bor. Har bir MgCl₂ suvda bitta Mg²⁺ va ikkita Cl⁻ ioni beradi.',
      ),
      mistake: L('Перелили — отливают лишнее обратно в склянку. Так нельзя: раствор возвращать в склянку запрещено, его отливают в отдельный стакан.', 'Overshot — pouring the extra back into the bottle. Not allowed: never return solution to the stock bottle, pour it into a separate beaker.', 'Ortiqcha quyildi — ortig‘ini shishaga qaytarish. Mumkin emas: eritmani shishaga qaytarib bo‘lmaydi, alohida stakanga to‘kiladi.'),
    },
    {
      id: 'agno3',
      target: 'bottle-agno3',
      gesture: { kind: 'drag', from: [AG.agBottle[0], 0.08, AG.agBottle[2]], to: [AG.cylinder[0], 0.2, AG.cylinder[2]], lead: 0.34 },
      seconds: 4.5,
      instruction: L('Отмерьте цилиндром 40 мл 10 %-го раствора AgNO₃ из тёмной склянки.', 'Measure 40 ml of 10 % AgNO₃ solution from the dark bottle with the cylinder.', 'To‘q shishadan silindr bilan 40 ml 10 % li AgNO₃ eritmasini o‘lchang.'),
      observation: L('Раствор нитрата серебра бесцветный; уровень у метки 40 мл — по нижнему краю мениска.', 'The silver nitrate solution is colourless; the level is at the 40 ml mark — read at the bottom of the meniscus.', 'Kumush nitrat eritmasi rangsiz; sath 40 ml belgisida — meniskning pastki cheti bo‘yicha.'),
      how: L('Перетащите тёмную склянку AgNO₃ к мерному цилиндру.', 'Drag the dark AgNO₃ bottle to the measuring cylinder.', 'To‘q AgNO₃ shishasini o‘lchov silindriga torting.'),
      teacher: L(
        'На 0,01 моль MgCl₂ нужно 0,02 моль AgNO₃ — около 31 мл такого раствора. Берём 40 мл: «достаточное количество» означает избыток, чтобы ни один ион Cl⁻ не остался в растворе.',
        '0.01 mol of MgCl₂ needs 0.02 mol of AgNO₃ — about 31 ml of this solution. We take 40 ml: “a sufficient amount” means an excess, so that not a single Cl⁻ ion stays in the solution.',
        '0,01 mol MgCl₂ ga 0,02 mol AgNO₃ — bunday eritmadan taxminan 31 ml kerak. 40 ml olamiz: «yetarli miqdor» — bu mo‘l miqdor, birorta ham Cl⁻ ioni eritmada qolmasligi uchun.',
      ),
      mistake: L('Оставляют склянку AgNO₃ открытой на свету — раствор темнеет.', 'Leaving the AgNO₃ bottle open in the light — the solution darkens.', 'AgNO₃ shishasini yorug‘da ochiq qoldirish — eritma qorayadi.'),
    },
    {
      id: 'off-scales',
      target: 'beaker',
      gesture: { kind: 'drag', from: [PAN[0], 0.1, PAN[2]], to: [AG.beaker[0], 0.06, AG.beaker[2]], lead: 0.8 },
      seconds: 3,
      instruction: L('Снимите стакан с раствором с весов и поставьте на стол.', 'Take the beaker with the solution off the balance and put it on the table.', 'Eritmali stakanni tarozidan olib, stolga qo‘ying.'),
      observation: L('Весы показывают массу стакана со знаком минус — так и должно быть после тары.', 'The balance shows the beaker’s mass with a minus sign — that is normal after taring.', 'Tarozi stakan massasini minus ishora bilan ko‘rsatadi — tarodan keyin shunday bo‘lishi kerak.'),
      how: L('Перетащите стакан с весов на стол.', 'Drag the beaker from the balance to the table.', 'Stakanni tarozidan stolga torting.'),
      teacher: L(
        'Реакцию на весах не проводят: брызги разъедают чашу и механизм. Стакан ставят рядом со штативом.',
        'Reactions are not done on the balance: splashes corrode the pan and the mechanism. The beaker goes next to the stand.',
        'Reaksiya tarozida o‘tkazilmaydi: sachrashlar palla va mexanizmni yemiradi. Stakan shtativ yoniga qo‘yiladi.',
      ),
    },
    {
      id: 'mix',
      target: 'cylinder',
      gesture: { kind: 'drag', from: [AG.cylinder[0], 0.1, AG.cylinder[2]], to: [AG.beaker[0], 0.16, AG.beaker[2]], lead: 0.34 },
      seconds: 4.5,
      instruction: L('Влейте нитрат серебра в стакан с раствором MgCl₂.', 'Pour the silver nitrate into the beaker with the MgCl₂ solution.', 'Kumush nitratni MgCl₂ eritmali stakanga quying.'),
      observation: L('Сразу выпадает белый творожистый осадок — раствор становится молочным, хлопья слипаются.', 'A white curdy precipitate forms at once — the solution turns milky, the flakes clump together.', 'Darhol oq ivisimon cho‘kma tushadi — eritma sutdek oqaradi, parchalar bir-biriga yopishadi.'),
      how: L('Перетащите цилиндр к стакану.', 'Drag the cylinder to the beaker.', 'Silindrni stakanga torting.'),
      teacher: L(
        'Ионы Ag⁺ и Cl⁻ встречаются и сразу соединяются в нерастворимый AgCl. Ионы Mg²⁺ и NO₃⁻ остаются в растворе — они «зрители».',
        'Ag⁺ and Cl⁻ ions meet and immediately join into insoluble AgCl. The Mg²⁺ and NO₃⁻ ions stay in the solution — they are “spectators”.',
        'Ag⁺ va Cl⁻ ionlari uchrashib, darhol erimaydigan AgCl ga birikadi. Mg²⁺ va NO₃⁻ ionlari eritmada qoladi — ular «tomoshabin».',
      ),
    },
    {
      id: 'complete',
      target: 'dropper',
      gesture: { kind: 'drag', from: [AG.dropper[0], 0.08, AG.dropper[2]], to: [AG.beaker[0], 0.14, AG.beaker[2]], lead: 0.24 },
      seconds: 5.5,
      instruction: L('Дайте осадку осесть и капните AgNO₃ в прозрачный слой — проверьте, всё ли осаждено.', 'Let the precipitate settle and add a drop of AgNO₃ to the clear layer — check that everything has precipitated.', 'Cho‘kma cho‘kishini kuting va tiniq qatlamga AgNO₃ tomizing — hammasi cho‘kkanini tekshiring.'),
      observation: L('Осадок осел, сверху прозрачный слой; от новых капель AgNO₃ мути нет — ионов Cl⁻ не осталось.', 'The precipitate has settled with a clear layer above; fresh drops of AgNO₃ cause no cloudiness — no Cl⁻ ions are left.', 'Cho‘kma cho‘kdi, ustida tiniq qatlam; yangi AgNO₃ tomchilaridan loyqa yo‘q — Cl⁻ ionlari qolmadi.'),
      how: L('Перетащите пипетку к стакану.', 'Drag the dropper to the beaker.', 'Tomizgichni stakanga torting.'),
      teacher: L(
        'Если бы ионы Cl⁻ ещё оставались, капля Ag⁺ дала бы белое облачко. Его нет — значит, весь хлор уже в осадке.',
        'If Cl⁻ ions were still left, a drop of Ag⁺ would make a white cloud. There is none — so all the chloride is already in the precipitate.',
        'Agar Cl⁻ ionlari qolgan bo‘lsa, Ag⁺ tomchisi oq bulutcha hosil qilardi. U yo‘q — demak, barcha xlor allaqachon cho‘kmada.',
      ),
      mistake: L('Капают в мутную жидкость, не дав осадку осесть, — ничего не видно.', 'Adding the drop into the cloudy liquid before the precipitate settles — nothing can be seen.', 'Cho‘kma cho‘kmasdan loyqa suyuqlikka tomizish — hech narsa ko‘rinmaydi.'),
    },
    {
      id: 'filter',
      target: 'beaker',
      gesture: { kind: 'drag', from: [AG.beaker[0], 0.06, AG.beaker[2]], to: [AG.funnel[0] - 0.06, 0.28, AG.funnel[2]], lead: 0.36 },
      seconds: 8,
      instruction: L('Отфильтруйте осадок по палочке и промойте его дистиллированной водой.', 'Filter off the precipitate along the glass rod and wash it with distilled water.', 'Cho‘kmani tayoqcha bo‘ylab filtrlang va distillangan suv bilan yuving.'),
      observation: L('Фильтрат стекает прозрачным, белый осадок остаётся на фильтре; промывалкой смывают остатки со стенок.', 'The filtrate runs through clear, the white precipitate stays on the filter; the wash bottle rinses the rest off the walls.', 'Filtrat tiniq oqib tushadi, oq cho‘kma filtrda qoladi; yuvgich bilan devorlardagi qoldiq yuviladi.'),
      how: L('Перетащите стакан к воронке.', 'Drag the beaker to the funnel.', 'Stakanni voronkaga torting.'),
      teacher: L(
        'Частицы AgCl крупнее пор бумаги и задерживаются, а вода с ионами Mg²⁺, NO₃⁻ и лишними Ag⁺ проходит. Промывание уносит эти ионы — иначе после сушки они прибавили бы массу.',
        'AgCl particles are larger than the pores of the paper and stay behind, while water with Mg²⁺, NO₃⁻ and spare Ag⁺ ions passes through. Washing carries these ions away — otherwise they would add mass after drying.',
        'AgCl zarrachalari qog‘oz teshiklaridan katta va ushlanib qoladi, Mg²⁺, NO₃⁻ va ortiqcha Ag⁺ ionli suv esa o‘tib ketadi. Yuvish bu ionlarni olib ketadi — aks holda quritishdan keyin ular massani oshirardi.',
      ),
      mistake: L('Льют мимо палочки или выше края фильтра — часть осадка проходит в фильтрат.', 'Pouring past the rod or above the filter edge — some precipitate gets into the filtrate.', 'Tayoqchadan tashqari yoki filtr chetidan yuqori quyish — cho‘kmaning bir qismi filtratga o‘tadi.'),
    },
    {
      id: 'dry',
      target: 'filter',
      gesture: { kind: 'drag', from: [AG.funnel[0], AG.funnel[1] + 0.03, AG.funnel[2]], to: [AG.oven[0], 0.1, AG.oven[2] + 0.17], lead: 0.32 },
      seconds: 7,
      instruction: L('Выньте фильтр с осадком, разверните его на часовом стекле в сушильном шкафу (105 °C).', 'Take out the filter with the precipitate and unfold it on the watch glass in the drying oven (105 °C).', 'Cho‘kmali filtrni chiqarib, quritish shkafidagi soat oynasida yoying (105 °C).'),
      observation: L('Осадок лежит горкой в середине фильтра. Шкаф греет до 105 °C, таймер идёт; вода испаряется, осадок рассыпчатый и чуть сереет сверху.', 'The precipitate lies in a small heap in the middle of the filter. The oven heats to 105 °C, the timer runs; the water evaporates, the precipitate turns crumbly and slightly grey on top.', 'Cho‘kma filtr o‘rtasida uyum bo‘lib yotadi. Shkaf 105 °C gacha qiziydi, taymer yuradi; suv bug‘lanadi, cho‘kma sochiluvchan bo‘lib, usti biroz kulrang tortadi.'),
      how: L('Перетащите фильтр из воронки к сушильному шкафу.', 'Drag the filter from the funnel to the drying oven.', 'Filtrni voronkadan quritish shkafiga torting.'),
      teacher: L(
        'При 105 °C уходит вода, а AgCl не разлагается. На свету хлорид серебра медленно темнеет — выделяется немного серебра; на массу это почти не влияет.',
        'At 105 °C the water leaves, while AgCl does not decompose. In light, silver chloride slowly darkens — a little silver forms; it hardly changes the mass.',
        '105 °C da suv chiqib ketadi, AgCl esa parchalanmaydi. Yorug‘likda kumush xlorid asta-sekin qorayadi — ozgina kumush ajraladi; massaga deyarli ta’sir qilmaydi.',
      ),
      mistake: L('Взвешивают недосушенный фильтр — оставшаяся вода завышает массу осадка.', 'Weighing a filter that is not fully dry — the leftover water makes the precipitate look heavier.', 'Chala quritilgan filtrni tortish — qolgan suv cho‘kma massasini oshiradi.'),
    },
    {
      id: 'weigh',
      target: 'filter',
      gesture: { kind: 'drag', from: [AG.oven[0], 0.08, AG.oven[2] + 0.14], to: [PAN[0], 0.07, PAN[2]], lead: 0.62 },
      seconds: 4.5,
      instruction: L('Обнулите пустые весы и взвесьте остывший фильтр с осадком.', 'Zero the empty balance and weigh the cooled filter with the precipitate.', 'Bo‘sh tarozini nolga keltiring va sovigan cho‘kmali filtrni torting.'),
      observation: L('Весы показывают массу фильтра с осадком; разность с сухим фильтром — масса AgCl.', 'The balance shows the mass of the filter with the precipitate; the difference from the dry filter is the mass of AgCl.', 'Tarozi cho‘kmali filtr massasini ko‘rsatadi; quruq filtr bilan farqi — AgCl massasi.'),
      how: L('Перетащите фильтр из шкафа на весы.', 'Drag the filter from the oven to the balance.', 'Filtrni shkafdan taroziga torting.'),
      teacher: L(
        'Горячий фильтр взвешивать нельзя: тёплый воздух поднимается от чаши и «облегчает» груз. Масса осадка — разность двух взвешиваний на одних и тех же весах.',
        'A hot filter must not be weighed: warm air rises from the pan and makes the load “lighter”. The mass of the precipitate is the difference of two weighings on the same balance.',
        'Issiq filtrni tortib bo‘lmaydi: iliq havo palladan ko‘tarilib, yukni «yengillashtiradi». Cho‘kma massasi — bir xil tarozida ikki tortish farqi.',
      ),
      mistake: L('Не обнулили весы после стакана — к показанию прибавляется «минус стакан».', 'Not zeroing the balance after the beaker — the “minus beaker” is added to the reading.', 'Stakandan keyin tarozi nolga keltirilmagan — ko‘rsatkichga «minus stakan» qo‘shiladi.'),
    },
  ],
  focus: [
    { from: 1.58, to: 1.98, point: [AG.scales[0], 0.035, AG.scales[2] + 0.07], dist: 0.3 },
    { from: 3.62, to: 3.98, point: [AG.scales[0], 0.035, AG.scales[2] + 0.07], dist: 0.3 },
    { from: 4.62, to: 4.98, point: [AG.cylinder[0], 0.11, AG.cylinder[2]], dist: 0.26 },
    { from: 6.5, to: 6.98, point: [AG.beaker[0], 0.05, AG.beaker[2]], dist: 0.3 },
    { from: 7.36, to: 7.95, point: [AG.beaker[0], 0.05, AG.beaker[2]], dist: 0.28 },
    { from: 8.3, to: 8.95, point: [AG.funnel[0] - 0.01, AG.funnel[1] - 0.02, AG.funnel[2]], dist: 0.45 },
    { from: 9.45, to: 9.86, point: [AG.oven[0] - 0.04, 0.05, AG.oven[2] + 0.11], dist: 0.42 },
    { from: 10.62, to: 10.98, point: [AG.scales[0], 0.035, AG.scales[2] + 0.07], dist: 0.32 },
  ],
  labels: [
    { at: 1.7, pos: [AG.scales[0], 0.14, AG.scales[2]], text: L('сухой фильтр', 'dry filter', 'quruq filtr') },
    { at: 6.55, pos: [AG.beaker[0], 0.15, AG.beaker[2]], text: L('AgCl↓ — белый творожистый осадок', 'AgCl↓ — white curdy precipitate', 'AgCl↓ — oq ivisimon cho‘kma') },
    { at: 7.62, pos: [AG.beaker[0], 0.15, AG.beaker[2]], text: L('мути нет — осаждение полное', 'no cloudiness — precipitation complete', 'loyqa yo‘q — cho‘ktirish to‘liq') },
    { at: 8.72, pos: [AG.funnel[0], AG.funnel[1] + 0.12, AG.funnel[2]], text: L('промывание: уходят Mg²⁺, NO₃⁻, Ag⁺', 'washing: Mg²⁺, NO₃⁻, Ag⁺ go away', 'yuvish: Mg²⁺, NO₃⁻, Ag⁺ ketadi') },
    { at: 9.5, pos: [AG.oven[0], 0.29, AG.oven[2]], text: L('ускорено: в жизни ~1 ч при 105 °C', 'sped up: ~1 h at 105 °C in real life', 'tezlashtirilgan: hayotda 105 °C da ~1 soat') },
    { at: 10.7, pos: [AG.scales[0], 0.14, AG.scales[2]], text: L('на свету AgCl слегка сереет', 'AgCl greys slightly in light', 'yorug‘likda AgCl biroz kulrang tortadi') },
  ],
  measurements: [
    { key: 'mF', label: 'm(фильтра)', what: L('масса сухого фильтра', 'mass of the dry filter', 'quruq filtr massasi'), instrument: 'scales', afterStep: 1 },
    { key: 'mSol', label: 'm(р-ра MgCl₂)', what: L('масса раствора MgCl₂ 1,9 %', 'mass of the 1.9 % MgCl₂ solution', '1,9 % li MgCl₂ eritmasi massasi'), instrument: 'scales', afterStep: 3 },
    { key: 'vAg', label: 'V(AgNO₃)', what: L('объём раствора AgNO₃ 10 %', 'volume of the 10 % AgNO₃ solution', '10 % li AgNO₃ eritmasi hajmi'), instrument: 'cyl50', afterStep: 4 },
    { key: 'mFP', label: 'm(фильтра с AgCl)', what: L('масса высушенного фильтра с осадком', 'mass of the dried filter with the precipitate', 'quritilgan cho‘kmali filtr massasi'), instrument: 'scales', afterStep: 10 },
    { key: 'mAgCl', label: 'm(AgCl)', what: L('масса осадка (разность взвешиваний)', 'mass of the precipitate (difference of weighings)', 'cho‘kma massasi (tortishlar farqi)'), instrument: 'scales', afterStep: 10, derived: true },
  ],
  simulate: (rng) => {
    const paper = rng.between(0.74, 0.82)
    const mF = rng.read('scales', paper)
    // раствор льют из склянки до 50,00 г: останавливаются чуть выше отметки
    const mSol = quantize(50 + rng.between(-0.01, 0.14), 0.01)
    const vAg = rng.read('cyl50', 40)
    // потери: мелкие частицы проходят сквозь фильтр, крупинки остаются на стенках стакана и палочке
    const agcl = ((mSol * W) / M_MGCL2) * 2 * M_AGCL * rng.between(0.985, 0.997)
    const mFP = rng.read('scales', paper + agcl)
    return { mF, mSol, vAg, mFP, mAgCl: quantize(mFP - mF, 0.01) }
  },
  given: (v, lang) => [
    tr(lang, 'Задача: m(MgCl₂) = 19 г, AgNO₃ — достаточно; m(осадка) — ?, n(осадка) — ?', 'Problem: m(MgCl₂) = 19 g, AgNO₃ sufficient; m(precipitate) — ?, n(precipitate) — ?', 'Masala: m(MgCl₂) = 19 g, AgNO₃ — yetarli; m(cho‘kma) — ?, n(cho‘kma) — ?'),
    tr(
      lang,
      `Опыт (в 20 раз меньше): m(р-ра MgCl₂) = ${f(v.mSol!, 2, lang)} г, w = 1,9 %; V(AgNO₃ 10 %) = ${f(v.vAg!, 1, lang)} мл — избыток (нужно ≈ 31 мл)`,
      `Experiment (20 times smaller): m(MgCl₂ solution) = ${f(v.mSol!, 2, lang)} g, w = 1.9 %; V(AgNO₃ 10 %) = ${f(v.vAg!, 1, lang)} ml — excess (≈ 31 ml needed)`,
      `Tajriba (20 marta kichik): m(MgCl₂ eritmasi) = ${f(v.mSol!, 2, lang)} g, w = 1,9 %; V(AgNO₃ 10 %) = ${f(v.vAg!, 1, lang)} ml — mo‘l (≈ 31 ml kerak)`,
    ),
    tr(
      lang,
      `Весы: m(фильтра) = ${f(v.mF!, 2, lang)} г; m(фильтра с осадком) = ${f(v.mFP!, 2, lang)} г`,
      `Balance: m(filter) = ${f(v.mF!, 2, lang)} g; m(filter with precipitate) = ${f(v.mFP!, 2, lang)} g`,
      `Tarozi: m(filtr) = ${f(v.mF!, 2, lang)} g; m(cho‘kmali filtr) = ${f(v.mFP!, 2, lang)} g`,
    ),
    tr(lang, 'M(MgCl₂) = 95 г/моль, M(AgCl) = 143,5 г/моль', 'M(MgCl₂) = 95 g/mol, M(AgCl) = 143.5 g/mol', 'M(MgCl₂) = 95 g/mol, M(AgCl) = 143,5 g/mol'),
  ],
  solution: (v, lang) => {
    const ms = mSalt(v)
    const k = toBook(v)
    const m = v.mAgCl! * k
    return [
      tr(lang, 'MgCl₂ + 2AgNO₃ → 2AgCl↓ + Mg(NO₃)₂: из 1 моль MgCl₂ — 2 моль AgCl', 'MgCl₂ + 2AgNO₃ → 2AgCl↓ + Mg(NO₃)₂: 1 mol of MgCl₂ gives 2 mol of AgCl', 'MgCl₂ + 2AgNO₃ → 2AgCl↓ + Mg(NO₃)₂: 1 mol MgCl₂ dan 2 mol AgCl'),
      tr(
        lang,
        `m(MgCl₂) = ${f(v.mSol!, 2, lang)} · 0,019 = ${f(ms, 3, lang)} г; n = ${f(ms, 3, lang)} / 95 = ${f(ms / M_MGCL2, 5, lang)} моль → по расчёту m(AgCl) = ${f(agclCalc(v), 3, lang)} г`,
        `m(MgCl₂) = ${f(v.mSol!, 2, lang)} · 0.019 = ${f(ms, 3, lang)} g; n = ${f(ms, 3, lang)} / 95 = ${f(ms / M_MGCL2, 5, lang)} mol → calculated m(AgCl) = ${f(agclCalc(v), 3, lang)} g`,
        `m(MgCl₂) = ${f(v.mSol!, 2, lang)} · 0,019 = ${f(ms, 3, lang)} g; n = ${f(ms, 3, lang)} / 95 = ${f(ms / M_MGCL2, 5, lang)} mol → hisob bo‘yicha m(AgCl) = ${f(agclCalc(v), 3, lang)} g`,
      ),
      tr(
        lang,
        `Измерено: m(AgCl) = ${f(v.mFP!, 2, lang)} − ${f(v.mF!, 2, lang)} = ${f(v.mAgCl!, 2, lang)} г; n(AgCl) = ${f(v.mAgCl!, 2, lang)} / 143,5 = ${f(v.mAgCl! / M_AGCL, 4, lang)} моль`,
        `Measured: m(AgCl) = ${f(v.mFP!, 2, lang)} − ${f(v.mF!, 2, lang)} = ${f(v.mAgCl!, 2, lang)} g; n(AgCl) = ${f(v.mAgCl!, 2, lang)} / 143.5 = ${f(v.mAgCl! / M_AGCL, 4, lang)} mol`,
        `O‘lchandi: m(AgCl) = ${f(v.mFP!, 2, lang)} − ${f(v.mF!, 2, lang)} = ${f(v.mAgCl!, 2, lang)} g; n(AgCl) = ${f(v.mAgCl!, 2, lang)} / 143,5 = ${f(v.mAgCl! / M_AGCL, 4, lang)} mol`,
      ),
      tr(
        lang,
        `Пересчёт на 19 г MgCl₂ (в ${f(k, 2, lang)} раза больше): m(AgCl) = ${f(v.mAgCl!, 2, lang)} · ${f(k, 2, lang)} = ${f(m, 1, lang)} г; n = ${f(m, 1, lang)} / 143,5 = ${f(m / M_AGCL, 3, lang)} моль`,
        `Scaling to 19 g of MgCl₂ (${f(k, 2, lang)} times more): m(AgCl) = ${f(v.mAgCl!, 2, lang)} · ${f(k, 2, lang)} = ${f(m, 1, lang)} g; n = ${f(m, 1, lang)} / 143.5 = ${f(m / M_AGCL, 3, lang)} mol`,
        `19 g MgCl₂ ga qayta hisob (${f(k, 2, lang)} marta ko‘p): m(AgCl) = ${f(v.mAgCl!, 2, lang)} · ${f(k, 2, lang)} = ${f(m, 1, lang)} g; n = ${f(m, 1, lang)} / 143,5 = ${f(m / M_AGCL, 3, lang)} mol`,
      ),
      tr(
        lang,
        `Ответ: m(AgCl) ≈ ${f(m, 1, lang)} г; n(AgCl) ≈ ${f(m / M_AGCL, 2, lang)} моль`,
        `Answer: m(AgCl) ≈ ${f(m, 1, lang)} g; n(AgCl) ≈ ${f(m / M_AGCL, 2, lang)} mol`,
        `Javob: m(AgCl) ≈ ${f(m, 1, lang)} g; n(AgCl) ≈ ${f(m / M_AGCL, 2, lang)} mol`,
      ),
    ]
  },
  compare: [
    {
      label: L('m(AgCl) в опыте', 'm(AgCl) in the experiment', 'tajribadagi m(AgCl)'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mAgCl!,
      predicted: agclCalc,
      book: 2.87,
      tolerancePct: 3,
    },
  ],
  reconcile: L(
    'Осадок обычно на 0,5–1,5 % легче расчёта, и это честная работа с осадком. Мельчайшие частицы AgCl проходят сквозь поры фильтра, крупинки остаются на стенках стакана и на палочке. Весы ±0,01 г при двух взвешиваниях дают до ±0,02 г, то есть ±0,7 % от 2,9 г. Раствор налит до 50,0x г, а не ровно до 50 г, — поэтому расчёт ведём от взятой массы. Если осадок не промыть, на нём высохнут Mg(NO₃)₂ и AgNO₃ — масса будет больше расчёта; если не досушить — тоже больше. Потемнение AgCl на свету массу почти не меняет.',
    'The precipitate is usually 0.5–1.5 % lighter than calculated, and that is honest work with a precipitate. The finest AgCl particles pass through the filter pores, and grains stay on the beaker walls and the rod. The balance (±0.01 g) over two weighings gives up to ±0.02 g, i.e. ±0.7 % of 2.9 g. The solution was poured to 50.0x g rather than exactly 50 g, so the calculation starts from the mass actually taken. If the precipitate is not washed, Mg(NO₃)₂ and AgNO₃ dry on it and the mass exceeds the calculation; if it is not dried completely, the mass is too high as well. Darkening of AgCl in light hardly changes its mass.',
    'Cho‘kma odatda hisobdan 0,5–1,5 % yengil — bu cho‘kma bilan halol ish. Eng mayda AgCl zarrachalari filtr teshiklaridan o‘tadi, donachalar stakan devorlarida va tayoqchada qoladi. Tarozi (±0,01 g) ikki tortishda ±0,02 g gacha, ya’ni 2,9 g ning ±0,7 % ini beradi. Eritma aniq 50 g emas, 50,0x g gacha quyilgan — shuning uchun hisob olingan massadan yuritiladi. Cho‘kma yuvilmasa, unda Mg(NO₃)₂ va AgNO₃ qurib qoladi — massa hisobdan ko‘p bo‘ladi; chala quritilsa ham ko‘p chiqadi. AgCl ning yorug‘likda qorayishi massani deyarli o‘zgartirmaydi.',
  ),
  conclusion: L(
    'Из 0,95 г MgCl₂ (0,01 моль) выпало около 2,85 г AgCl — 0,02 моль: на каждую частицу MgCl₂ — две частицы AgCl. В задаче соли в 20 раз больше: m(AgCl) = 57,4 г, n(AgCl) = 0,4 моль.',
    'From 0.95 g of MgCl₂ (0.01 mol) about 2.85 g of AgCl precipitated — 0.02 mol: two AgCl units for every MgCl₂ unit. The problem has 20 times more salt: m(AgCl) = 57.4 g, n(AgCl) = 0.4 mol.',
    '0,95 g MgCl₂ dan (0,01 mol) taxminan 2,85 g AgCl — 0,02 mol cho‘kdi: har bir MgCl₂ zarrachasiga ikkita AgCl. Masalada tuz 20 marta ko‘p: m(AgCl) = 57,4 g, n(AgCl) = 0,4 mol.',
  ),
  story: {
    equation: 'Ag⁺ + Cl⁻ → AgCl↓',
    text: L(
      'В растворе MgCl₂ плавают ионы Mg²⁺ и Cl⁻, в растворе AgNO₃ — Ag⁺ и NO₃⁻. Когда растворы смешали, ионы Ag⁺ и Cl⁻ сцепляются в кристаллики AgCl, которые не растворяются в воде, — это белые хлопья осадка. Ионы Mg²⁺ и NO₃⁻ так и остаются в растворе. Из одной частицы MgCl₂ получаются две частицы AgCl, потому что в ней два иона Cl⁻.',
      'The MgCl₂ solution holds Mg²⁺ and Cl⁻ ions, the AgNO₃ solution — Ag⁺ and NO₃⁻. When the solutions are mixed, Ag⁺ and Cl⁻ ions lock together into tiny AgCl crystals that do not dissolve in water — the white flakes of the precipitate. The Mg²⁺ and NO₃⁻ ions just stay in the solution. One MgCl₂ unit gives two AgCl units because it contains two Cl⁻ ions.',
      'MgCl₂ eritmasida Mg²⁺ va Cl⁻ ionlari, AgNO₃ eritmasida — Ag⁺ va NO₃⁻ ionlari bor. Eritmalar aralashtirilganda Ag⁺ va Cl⁻ ionlari suvda erimaydigan mayda AgCl kristallariga birikadi — bu cho‘kmaning oq parchalari. Mg²⁺ va NO₃⁻ ionlari eritmada qoladi. Bitta MgCl₂ zarrachasidan ikkita AgCl hosil bo‘ladi, chunki unda ikkita Cl⁻ ioni bor.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показало, что реакция прошла?', 'What showed that the reaction took place?', 'Reaksiya borganini nima ko‘rsatdi?'),
      options: [
        L('Сразу выпал белый творожистый осадок', 'A white curdy precipitate formed at once', 'Darhol oq ivisimon cho‘kma tushdi'),
        L('Выделились пузырьки газа', 'Gas bubbles were released', 'Gaz pufakchalari ajraldi'),
        L('Раствор стал синим', 'The solution turned blue', 'Eritma ko‘k rangga kirdi'),
      ],
      correct: 0,
      why: L('Ионы Ag⁺ и Cl⁻ образуют нерастворимый AgCl — белые хлопья, которые потом оседают.', 'Ag⁺ and Cl⁻ ions form insoluble AgCl — white flakes that later settle.', 'Ag⁺ va Cl⁻ ionlari erimaydigan AgCl hosil qiladi — keyin cho‘kadigan oq parchalar.'),
    },
    {
      id: 'type',
      q: L('Зачем к прозрачному слою над осадком капали ещё AgNO₃?', 'Why was more AgNO₃ dropped into the clear layer above the precipitate?', 'Nima uchun cho‘kma ustidagi tiniq qatlamga yana AgNO₃ tomizildi?'),
      options: [
        L('Проверить, что все ионы Cl⁻ уже в осадке', 'To check that all the Cl⁻ ions are already in the precipitate', 'Barcha Cl⁻ ionlari cho‘kmada ekanini tekshirish uchun'),
        L('Чтобы осадок быстрее высох', 'To make the precipitate dry faster', 'Cho‘kma tezroq qurishi uchun'),
        L('Чтобы растворить осадок', 'To dissolve the precipitate', 'Cho‘kmani eritish uchun'),
      ],
      correct: 0,
      why: L('Это проба на полноту осаждения: нет мути — значит, хлорид-ионов в растворе не осталось и масса осадка полная.', 'This is the test for complete precipitation: no cloudiness means no chloride ions are left and the precipitate is complete.', 'Bu cho‘ktirish to‘liqligini tekshirish: loyqa yo‘q — demak, eritmada xlorid ionlari qolmagan va cho‘kma to‘liq.'),
    },
    {
      id: 'product',
      q: L('Что осталось в фильтрате после фильтрования?', 'What was left in the filtrate after filtering?', 'Filtrlashdan keyin filtratda nima qoldi?'),
      options: [
        L('Раствор Mg(NO₃)₂ с небольшим избытком AgNO₃', 'A Mg(NO₃)₂ solution with a small excess of AgNO₃', 'Ozgina ortiqcha AgNO₃ bilan Mg(NO₃)₂ eritmasi'),
        L('Раствор MgCl₂', 'A MgCl₂ solution', 'MgCl₂ eritmasi'),
        L('Чистая вода без ионов', 'Pure water without ions', 'Ionsiz toza suv'),
      ],
      correct: 0,
      why: L('Ионы Mg²⁺ и NO₃⁻ в реакции не участвуют, а AgNO₃ брали в избытке — часть его осталась.', 'Mg²⁺ and NO₃⁻ ions take no part in the reaction, and AgNO₃ was taken in excess — some of it is left.', 'Mg²⁺ va NO₃⁻ ionlari reaksiyada qatnashmaydi, AgNO₃ esa mo‘l olingan — bir qismi qoldi.'),
    },
  ],
}
