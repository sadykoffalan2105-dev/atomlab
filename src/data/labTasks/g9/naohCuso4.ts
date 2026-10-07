/**
 * Kimyo 9, с. 200, лабораторная работа 12, задание 2: сколько 20 %-ного раствора NaOH (ρ = 1,22 г/мл) нужно,
 * чтобы 4 г 20 %-ного раствора CuSO₄ прореагировали без остатка.
 * Опыт 1:1 — сухой фильтр взвешен; в стаканчик на весах (тара) 4,00 г раствора CuSO₄ и капля фенолфталеина;
 * градуированная пипетка 2 мл с раствором NaOH — до «0», затем по каплям: голубой осадок Cu(OH)₂, конец — жидкость
 * над осадком слабо розовеет (щёлочь в лёгком избытке); отсчёт по пипетке; фильтрование, промывание, сушка на
 * воздухе (без нагрева — Cu(OH)₂ при нагревании чернеет, разлагаясь на CuO и воду); масса осадка.
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { quantize } from '../../../components/lab3d/measure/quantities'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

const M_CUSO4 = 160
const M_NAOH = 40
const M_CUOH2 = 98
const W = 0.2
const RHO = 1.22

const n = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)
/** n(CuSO₄) во взятой навеске раствора (моль). */
const nCu = (v: LabTaskValues) => (v.mS! * W) / M_CUSO4
/** Объём 20 %-ного NaOH, нужный по уравнению для взятой навески (мл). */
const vNeed = (v: LabTaskValues) => (nCu(v) * 2 * M_NAOH) / W / RHO

export const NAOH_CUSO4: LabTask = {
  id: 'task-g9-naoh-cuso4',
  grade: 9,
  page: 200,
  source: L('Kimyo 9 · с. 200, лабораторная работа 12, задание 2', 'Kimyo 9 · p. 200, lab work 12, task 2', 'Kimyo 9 · 200-bet, 12-laboratoriya ishi, 2-topshiriq'),
  bookKind: 'labwork',
  title: L('Щёлочь для сульфата меди — без остатка', 'Alkali for copper sulfate — with nothing left', 'Mis sulfat uchun ishqor — qoldiqsiz'),
  statement: L(
    'Какой объем 20 %-ного раствора гидроксида натрия (ρ = 1,22 г/мл) необходим, чтобы его реакция взаимодействия с 4 г 20 %-ного раствора сульфата меди(II) прошла без остатка?',
    'What volume of a 20 % sodium hydroxide solution (ρ = 1.22 g/ml) is needed for its reaction with 4 g of a 20 % copper(II) sulfate solution to go to completion with nothing left over?',
    '20 % li natriy gidroksid eritmasining (ρ = 1,22 g/ml) 20 % li mis(II) sulfat eritmasining 4 grammi bilan reaksiyasi qoldiqsiz borishi uchun qanday hajmi kerak?',
  ),
  equation: 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄',
  kind: 'exchange',
  type: 'solution-w',
  difficulty: 3,
  answers: [
    {
      key: 'V',
      label: 'V(NaOH)',
      what: L('объём 20 %-ного раствора NaOH', 'volume of the 20 % NaOH solution', '20 % li NaOH eritmasi hajmi'),
      unit: L('мл', 'ml', 'ml'),
      book: 1.64,
      decimals: 2,
      fromRun: vNeed,
    },
  ],
  labScale: {
    factor: 1,
    note: L(
      'Опыт — в масштабе задачи: 4 г раствора (≈3,3 мл) в стаканчике на 50 мл, щёлочь — градуированной пипеткой на 2 мл (цена деления 0,02 мл).',
      'Same scale as the problem: 4 g of solution (≈3.3 ml) in a 50 ml beaker, the alkali from a 2 ml graduated pipette (0.02 ml divisions).',
      'Tajriba masala miqyosida: 50 ml li stakanchada 4 g eritma (≈3,3 ml), ishqor — 2 ml li darajali pipetka bilan (bo‘linma 0,02 ml).',
    ),
  },
  instruments: ['scales', 'pipette2'],
  equipment: [
    L('Электронные весы (0,01 г)', 'Electronic balance (0.01 g)', 'Elektron tarozi (0,01 g)'),
    L('Градуированная пипетка 2 мл с грушей, штатив для пипеток', '2 ml graduated pipette with a bulb, pipette stand', 'Nokli 2 ml li darajali pipetka, pipetka shtativi'),
    L('Стаканчики 50 мл, стакан 100 мл для фильтрата', '50 ml beakers, 100 ml beaker for the filtrate', '50 ml li stakanchalar, filtrat uchun 100 ml li stakan'),
    L('Воронка на кольце штатива, бумажный фильтр, промывалка, часовое стекло', 'Funnel on a ring stand, filter paper, wash bottle, watch glass', 'Shtativ halqasidagi voronka, qog‘oz filtr, yuvgich, soat oynasi'),
    L('20 %-ные растворы CuSO₄ и NaOH, фенолфталеин', '20 % CuSO₄ and NaOH solutions, phenolphthalein', '20 % li CuSO₄ va NaOH eritmalari, fenolftalein'),
  ],
  safety: [
    L('Очки и перчатки: 20 %-ный NaOH разъедает кожу и особенно опасен для глаз.', 'Goggles and gloves: 20 % NaOH burns skin and is especially dangerous for the eyes.', 'Ko‘zoynak va qo‘lqop: 20 % li NaOH terini kuydiradi, ko‘z uchun ayniqsa xavfli.'),
    L('Щёлочь в пипетку набирают только грушей — никогда ртом.', 'Fill the pipette with the bulb only — never by mouth.', 'Ishqorni pipetkaga faqat nok bilan torting — hech qachon og‘iz bilan emas.'),
    L('Соли меди ядовиты: растворы не пробовать, после работы вымыть руки.', 'Copper salts are toxic: never taste, wash your hands after work.', 'Mis tuzlari zaharli: eritmalarni tatib ko‘rmang, ishdan so‘ng qo‘lni yuving.'),
  ],
  gear: ['goggles', 'gloves'],
  place: 'bench',
  steps: [
    {
      id: 'gear',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте защитные очки и перчатки.', 'Put on safety goggles and gloves.', 'Himoya ko‘zoynagi va qo‘lqopni taqing.'),
      observation: L('Очки и перчатки надеты — можно работать со щёлочью.', 'Goggles and gloves on — you can work with the alkali.', 'Ko‘zoynak va qo‘lqop taqildi — ishqor bilan ishlash mumkin.'),
      how: L('Нажмите на поднос с очками и перчатками.', 'Tap the tray with the goggles and gloves.', 'Ko‘zoynak va qo‘lqopli patnisni bosing.'),
      teacher: L('Ион OH⁻ в концентрированной щёлочи омыляет жиры кожи и белки глаза — поэтому защита надевается до того, как открыта первая склянка.', 'OH⁻ ions in a strong alkali saponify skin fats and attack eye proteins — protection goes on before the first bottle is opened.', 'Kuchli ishqordagi OH⁻ ionlari teri yog‘larini sovunlaydi va ko‘z oqsillarini buzadi — shuning uchun himoya birinchi shisha ochilishidan oldin taqiladi.'),
    },
    {
      id: 'filter-dry',
      target: 'filter',
      gesture: { kind: 'drag', from: [0.12, 0.01, 0.17], to: [-0.12, 0.08, 0.05], lead: 0.6 },
      seconds: 2.8,
      instruction: L('Взвесьте сухой бумажный фильтр.', 'Weigh the dry filter paper.', 'Quruq qog‘oz filtrni torting.'),
      observation: L('Весы показывают массу сухого фильтра — около 0,9 г.', 'The balance shows the dry filter — about 0.9 g.', 'Tarozi quruq filtr massasini ko‘rsatadi — taxminan 0,9 g.'),
      how: L('Перетащите фильтр на чашу весов.', 'Drag the filter onto the balance pan.', 'Filtrni tarozi pallasiga torting.'),
      teacher: L('Осадок потом взвешивают вместе с фильтром, поэтому массу бумаги узнают заранее: разность двух взвешиваний — масса Cu(OH)₂.', 'The precipitate will be weighed together with the filter, so the paper is weighed first: the difference of the two weighings is the mass of Cu(OH)₂.', 'Cho‘kma keyin filtr bilan birga tortiladi, shuning uchun qog‘oz massasi oldindan aniqlanadi: ikki tortish farqi — Cu(OH)₂ massasi.'),
      mistake: L('Взять фильтр мокрыми перчатками — бумага впитает воду, и масса будет завышена.', 'Handling the filter with wet gloves — the paper soaks up water and reads heavier.', 'Filtrni ho‘l qo‘lqop bilan olish — qog‘oz suv shimadi, massa ortiq chiqadi.'),
    },
    {
      id: 'beaker',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.3, 0.03, -0.04], to: [-0.12, 0.09, 0.05], lead: 0.62 },
      seconds: 3,
      instruction: L('Снимите фильтр и поставьте на весы сухой стаканчик на 50 мл.', 'Take the filter off and put a dry 50 ml beaker on the balance.', 'Filtrni oling va taroziga quruq 50 ml li stakanchani qo‘ying.'),
      observation: L('Весы показывают массу пустого стаканчика — около 30 г.', 'The balance shows the empty beaker — about 30 g.', 'Tarozi bo‘sh stakancha massasini ko‘rsatadi — taxminan 30 g.'),
      how: L('Перетащите стаканчик на чашу весов.', 'Drag the beaker onto the pan.', 'Stakanchani tarozi pallasiga torting.'),
      teacher: L('Реакцию ведём прямо в стаканчике на весах: так масса раствора CuSO₄ известна до сотых грамма.', 'We run the reaction right in the beaker on the balance, so the mass of CuSO₄ solution is known to a hundredth of a gram.', 'Reaksiyani tarozidagi stakanchaning o‘zida o‘tkazamiz: shunda CuSO₄ eritmasi massasi yuzdan bir grammgacha ma’lum bo‘ladi.'),
    },
    {
      id: 'tare',
      target: 'tare',
      gesture: { kind: 'tap' },
      seconds: 1.4,
      instruction: L('Нажмите «T» — обнулите весы со стаканчиком.', 'Press “T” to zero the balance with the beaker.', 'Stakanchali tarozini «T» bilan nolga keltiring.'),
      observation: L('На дисплее 0.00 g и «→0←»: масса стаканчика вычтена.', 'The display reads 0.00 g with “→0←”: the beaker is subtracted.', 'Displeyda 0.00 g va «→0←»: stakancha massasi ayirildi.'),
      how: L('Нажмите кнопку «T» на передней панели весов.', 'Tap the “T” button on the front of the balance.', 'Tarozi old panelidagi «T» tugmasini bosing.'),
      teacher: L('После тары весы покажут только раствор, который нальём, — не нужно вычитать массу стекла.', 'After taring the balance shows only the solution we pour in — no need to subtract the glass.', 'Taradan keyin tarozi faqat quyiladigan eritmani ko‘rsatadi — shisha massasini ayirish shart emas.'),
      mistake: L('Забыли тару — на дисплее «30 с лишним граммов», и 4 г раствора не отмерить.', 'Forgot to tare — the display shows 30-odd grams and 4 g of solution cannot be measured.', 'Tarani unutish — displeyda 30 grammdan ortiq, 4 g eritmani o‘lchab bo‘lmaydi.'),
    },
    {
      id: 'cuso4',
      target: 'bottle-cuso4',
      gesture: { kind: 'drag', from: [-0.42, 0.06, 0.13], to: [-0.14, 0.2, 0.05], lead: 0.42 },
      seconds: 5,
      instruction: L('Налейте в стаканчик 4,00 г 20 %-ного раствора CuSO₄.', 'Pour 4.00 g of 20 % CuSO₄ solution into the beaker.', 'Stakanchaga 20 % li CuSO₄ eritmasidan 4,00 g quying.'),
      observation: L('В стаканчике — тонкий слой голубого раствора (≈3,3 мл); дисплей останавливается около 4,00 г.', 'A thin layer of blue solution (≈3.3 ml) is in the beaker; the display stops near 4.00 g.', 'Stakanchada yupqa havorang eritma qatlami (≈3,3 ml); displey 4,00 g atrofida to‘xtaydi.'),
      how: L('Перетащите склянку к стаканчику и лейте тонкой струйкой; у 4 г — медленнее.', 'Drag the bottle to the beaker and pour a thin stream; slow down near 4 g.', 'Shishani stakanchaga torting va ingichka oqim bilan quying; 4 g ga yaqin sekinlating.'),
      teacher: L('Голубой цвет дают гидратированные ионы Cu²⁺; в 4 г 20 %-ного раствора — 0,8 г CuSO₄, остальное — вода.', 'The blue colour comes from hydrated Cu²⁺ ions; 4 g of 20 % solution hold 0.8 g of CuSO₄, the rest is water.', 'Havorang rangni gidratlangan Cu²⁺ ionlari beradi; 20 % li eritmaning 4 grammida 0,8 g CuSO₄, qolgani suv.'),
      mistake: L('Снимать показание, пока цифры «бегут»: дождитесь значка «○».', 'Reading while the digits still change: wait for the “○” mark.', 'Raqamlar «yugurayotganda» o‘qish: «○» belgisini kuting.'),
    },
    {
      id: 'indicator',
      target: 'indicator',
      gesture: { kind: 'tap' },
      seconds: 2.6,
      instruction: L('Добавьте каплю фенолфталеина.', 'Add a drop of phenolphthalein.', 'Bir tomchi fenolftalein qo‘shing.'),
      observation: L('Раствор остаётся голубым — фенолфталеин в нём бесцветен.', 'The solution stays blue — phenolphthalein is colourless in it.', 'Eritma havorangligicha qoladi — undagi fenolftalein rangsiz.'),
      how: L('Нажмите на склянку-капельницу с фенолфталеином.', 'Tap the phenolphthalein dropper bottle.', 'Fenolftaleinli tomizgich-shishani bosing.'),
      teacher: L('Раствор CuSO₄ слабокислый, и фенолфталеин бесцветен; розовым он станет, только когда в растворе появится лишний OH⁻ — это и будет сигнал «Cu²⁺ кончились».', 'CuSO₄ solution is slightly acidic, so phenolphthalein is colourless; it turns pink only when spare OH⁻ appears — the signal that the Cu²⁺ is used up.', 'CuSO₄ eritmasi kuchsiz kislotali, fenolftalein rangsiz; u faqat eritmada ortiqcha OH⁻ paydo bo‘lganda pushti bo‘ladi — bu «Cu²⁺ tugadi» degan belgi.'),
    },
    {
      id: 'pipette',
      target: 'pipette',
      gesture: { kind: 'drag', from: [-0.5, 0.2, -0.2], to: [-0.44, 0.24, -0.1], lead: 0.35 },
      seconds: 5,
      instruction: L('Наберите грушей раствор NaOH в пипетку выше нуля и спустите до риски «0».', 'Draw NaOH solution into the pipette above zero with the bulb, then let it down to the “0” mark.', 'Nok bilan NaOH eritmasini pipetkaga noldan yuqori torting va «0» chizig‘igacha tushiring.'),
      observation: L('Мениск стоит точно на риске «0»; лишняя капля стекла обратно в стаканчик с NaOH.', 'The meniscus sits exactly on the “0” mark; the extra drop ran back into the NaOH beaker.', 'Menisk aynan «0» chizig‘ida; ortiqcha tomchi NaOH li stakanchaga qaytib oqdi.'),
      how: L('Перетащите пипетку из штатива в стаканчик с NaOH.', 'Drag the pipette from its stand into the NaOH beaker.', 'Pipetkani shtativdan NaOH li stakanchaga torting.'),
      teacher: L('Пипетка градуирована «на вылив»: отсчёт по шкале показывает, сколько вылито от нуля, поэтому начинать нужно точно с «0».', 'The pipette is calibrated “to deliver”: its scale shows how much has run out from zero, so you must start exactly at “0”.', 'Pipetka «quyish uchun» darajalangan: shkala noldan qancha quyilganini ko‘rsatadi, shuning uchun aynan «0» dan boshlash kerak.'),
      mistake: L('Пузырёк воздуха в кончике — первая «капля» окажется пустой, и отсчёт будет завышен.', 'An air bubble in the tip — the first “drop” is empty and the reading comes out too high.', 'Uchida havo pufakchasi — birinchi «tomchi» bo‘sh bo‘ladi va hisob ortiq chiqadi.'),
    },
    {
      id: 'titrate',
      target: 'pipette',
      gesture: { kind: 'swipe', from: [-0.12, 0.42, 0.05], to: [-0.12, 0.34, 0.05], lead: 0.25 },
      seconds: 8,
      instruction: L('Приливайте NaOH по каплям, покачивая стаканчик, пока жидкость над осадком не порозовеет.', 'Add NaOH drop by drop, swirling the beaker, until the liquid above the precipitate turns pink.', 'NaOH ni tomchilab, stakanchani chayqatib qo‘shing, cho‘kma ustidagi suyuqlik pushti bo‘lguncha.'),
      observation: L('Каждая капля даёт голубые хлопья Cu(OH)₂; раствор бледнеет; в конце жидкость над осадком слабо-розовая. Весы прибавили ≈2 г — массу прилитой щёлочи.', 'Each drop gives blue flakes of Cu(OH)₂; the solution fades; at the end the liquid above the precipitate is pale pink. The balance gained ≈2 g — the mass of the alkali added.', 'Har bir tomchi Cu(OH)₂ ning havorang parchalarini beradi; eritma oqaradi; oxirida cho‘kma ustidagi suyuqlik och pushti. Tarozi ≈2 g qo‘shdi — quyilgan ishqor massasi.'),
      how: L('Слегка сожмите грушу: проведите по пипетке сверху вниз — капли пойдут одна за другой.', 'Squeeze the bulb gently: swipe down the pipette — drops fall one after another.', 'Nokni sekin siqing: pipetka bo‘ylab yuqoridan pastga suring — tomchilar ketma-ket tushadi.'),
      teacher: L('Cu²⁺ + 2OH⁻ → Cu(OH)₂↓: пока в растворе есть ионы меди, каждый OH⁻ сразу уходит в осадок; первая лишняя капля оставляет OH⁻ свободными — и фенолфталеин розовеет.', 'Cu²⁺ + 2OH⁻ → Cu(OH)₂↓: while copper ions remain, every OH⁻ goes straight into the precipitate; the first spare drop leaves free OH⁻ — and phenolphthalein turns pink.', 'Cu²⁺ + 2OH⁻ → Cu(OH)₂↓: eritmada mis ionlari bor ekan, har bir OH⁻ darhol cho‘kmaga o‘tadi; birinchi ortiqcha tomchi OH⁻ ni erkin qoldiradi — fenolftalein pushti bo‘ladi.'),
      mistake: L('Лить струёй — розовое окрашивание «проскочат» на несколько капель, объём будет завышен.', 'Pouring a stream — you overshoot the pink by several drops and the volume comes out too high.', 'Oqim bilan quyish — pushti rangni bir necha tomchiga o‘tkazib yuborasiz, hajm ortiq chiqadi.'),
    },
    {
      id: 'filter',
      target: 'beaker',
      gesture: { kind: 'drag', from: [-0.12, 0.09, 0.05], to: [0.1, 0.3, -0.13], lead: 0.42 },
      seconds: 6,
      instruction: L('Отфильтруйте осадок и промойте его на фильтре дистиллированной водой.', 'Filter off the precipitate and wash it on the filter with distilled water.', 'Cho‘kmani filtrlang va filtrda distillangan suv bilan yuving.'),
      observation: L('Голубой осадок остаётся на фильтре, фильтрат прозрачный, слабо-розовый (Na₂SO₄ и капля NaOH).', 'The blue precipitate stays on the filter; the filtrate is clear and pale pink (Na₂SO₄ and a drop of NaOH).', 'Havorang cho‘kma filtrda qoladi, filtrat tiniq, och pushti (Na₂SO₄ va bir tomchi NaOH).'),
      how: L('Перетащите стаканчик с весов к воронке и наклоните.', 'Drag the beaker from the balance to the funnel and tilt it.', 'Stakanchani tarozidan voronkaga torting va engashtiring.'),
      teacher: L('Промывание смывает с осадка раствор Na₂SO₄ и NaOH: без него соли высохли бы на фильтре и прибавили массу.', 'Washing rinses the Na₂SO₄ and NaOH solution off the precipitate; otherwise these salts would dry on the filter and add mass.', 'Yuvish cho‘kmadan Na₂SO₄ va NaOH eritmasini yuvib tashlaydi: aks holda bu tuzlar filtrda qurib, massani oshirardi.'),
      mistake: L('Лить мимо палочки и выше края фильтра — часть осадка уйдёт в фильтрат.', 'Pouring above the filter edge — some precipitate escapes into the filtrate.', 'Filtr chetidan yuqori quyish — cho‘kmaning bir qismi filtratga o‘tadi.'),
    },
    {
      id: 'dry',
      target: 'filter',
      gesture: { kind: 'drag', from: [0.13, 0.24, -0.13], to: [0.39, 0.03, -0.08], lead: 0.45 },
      seconds: 4.5,
      instruction: L('Высушите фильтр с осадком на воздухе — без нагревания.', 'Dry the filter with the precipitate in air — without heating.', 'Cho‘kmali filtrni havoda quriting — qizdirmasdan.'),
      observation: L('Сутки на часовом стекле: осадок подсох и остался голубым.', 'A day on the watch glass: the precipitate has dried and is still blue.', 'Soat oynasida bir kun: cho‘kma qurib, havorangligicha qoldi.'),
      how: L('Перетащите фильтр из воронки на часовое стекло.', 'Drag the filter from the funnel onto the watch glass.', 'Filtrni voronkadan soat oynasiga torting.'),
      teacher: L('Cu(OH)₂ непрочен: уже при нагревании влажного осадка он чернеет — Cu(OH)₂ → CuO + H₂O, и масса стала бы меньше. Поэтому сушат на воздухе.', 'Cu(OH)₂ is unstable: heating the wet precipitate turns it black — Cu(OH)₂ → CuO + H₂O — and the mass would drop. That is why it is dried in air.', 'Cu(OH)₂ beqaror: nam cho‘kma qizdirilsa, u qorayadi — Cu(OH)₂ → CuO + H₂O, massa kamayardi. Shuning uchun havoda quritiladi.'),
      mistake: L('Сушить в сушильном шкафу при 105 °C — осадок почернеет.', 'Drying in the oven at 105 °C — the precipitate turns black.', '105 °C da quritish shkafida quritish — cho‘kma qorayadi.'),
    },
    {
      id: 'weigh',
      target: 'filter',
      gesture: { kind: 'drag', from: [0.39, 0.02, -0.08], to: [-0.09, 0.08, 0.05], lead: 0.55 },
      seconds: 3.6,
      instruction: L('Обнулите пустые весы («T») и взвесьте фильтр с осадком.', 'Zero the empty balance (“T”) and weigh the filter with the precipitate.', 'Bo‘sh tarozini «T» bilan nolga keltiring va cho‘kmali filtrni torting.'),
      observation: L('Весы показывают массу фильтра с осадком — на ≈0,5 г больше, чем сухой фильтр.', 'The balance shows the filter with the precipitate — ≈0.5 g more than the dry filter.', 'Tarozi cho‘kmali filtr massasini ko‘rsatadi — quruq filtrdan ≈0,5 g ko‘p.'),
      how: L('Перетащите фильтр с часового стекла на чашу весов.', 'Drag the filter from the watch glass onto the pan.', 'Filtrni soat oynasidan tarozi pallasiga torting.'),
      teacher: L('Весы всё ещё «помнят» тару стаканчика и без него показывают минус; новая тара на пустой чаше возвращает честный ноль.', 'The balance still “remembers” the beaker tare and reads negative without it; a new tare on the empty pan gives an honest zero.', 'Tarozi hali stakancha tarasini «eslaydi» va usiz minus ko‘rsatadi; bo‘sh pallada yangi tara halol nolni qaytaradi.'),
      mistake: L('Не обнулить весы — масса осадка выйдет «минус 30 г».', 'Not zeroing — the precipitate would come out as “minus 30 g”.', 'Nolga keltirmaslik — cho‘kma massasi «minus 30 g» chiqadi.'),
    },
  ],
  focus: [
    { from: 1.72, to: 1.98, point: [-0.12, 0.03, 0.16], dist: 0.26 },
    { from: 4.74, to: 4.98, point: [-0.12, 0.03, 0.16], dist: 0.26 },
    { from: 6.9, to: 6.99, point: [-0.12, 0.349, 0.048], dist: 0.15 },
    { from: 7.12, to: 7.7, point: [-0.12, 0.07, 0.048], dist: 0.3 },
    { from: 7.86, to: 7.99, point: [-0.12, 0.2, 0.048], dist: 0.15 },
    { from: 10.72, to: 10.99, point: [-0.12, 0.03, 0.16], dist: 0.26 },
  ],
  labels: [
    { at: 4.62, pos: [-0.12, 0.17, 0.05], text: L('голубой раствор CuSO₄', 'blue CuSO₄ solution', 'havorang CuSO₄ eritmasi') },
    { at: 7.4, pos: [-0.2, 0.14, 0.05], text: L('голубой осадок Cu(OH)₂↓', 'blue precipitate Cu(OH)₂↓', 'havorang cho‘kma Cu(OH)₂↓') },
    { at: 7.84, pos: [-0.2, 0.17, 0.05], text: L('над осадком — слабо-розовая жидкость', 'pale pink liquid above the precipitate', 'cho‘kma ustida — och pushti suyuqlik') },
    { at: 9.55, pos: [0.36, 0.1, -0.08], text: L('сушка на воздухе — без нагревания', 'air drying — no heating', 'havoda quritish — qizdirmasdan') },
  ],
  measurements: [
    { key: 'mF', label: 'm(фильтр)', what: L('масса сухого фильтра', 'mass of the dry filter', 'quruq filtr massasi'), instrument: 'scales', afterStep: 1 },
    { key: 'mS', label: 'm(р-р CuSO₄)', what: L('масса 20 %-ного раствора CuSO₄', 'mass of the 20 % CuSO₄ solution', '20 % li CuSO₄ eritmasi massasi'), instrument: 'scales', afterStep: 4 },
    { key: 'V', label: 'V(р-р NaOH)', what: L('объём NaOH по пипетке до розового окрашивания', 'NaOH volume by the pipette up to the pink colour', 'pushti ranggacha pipetka bo‘yicha NaOH hajmi'), instrument: 'pipette2', afterStep: 7 },
    { key: 'm2', label: 'm(фильтр + осадок)', what: L('масса фильтра с высушенным осадком', 'mass of the filter with the dried precipitate', 'quritilgan cho‘kmali filtr massasi'), instrument: 'scales', afterStep: 10 },
    { key: 'mP', label: 'm(Cu(OH)₂)', what: L('масса осадка: разность взвешиваний', 'mass of the precipitate: difference of weighings', 'cho‘kma massasi: tortishlar farqi'), instrument: 'scales', afterStep: 10, derived: true },
  ],
  simulate: (rng) => {
    // общий сдвиг нуля весов в двух взвешиваниях фильтра (в разности он сокращается), бумага — 0,86–1,02 г
    const off = rng.between(-0.003, 0.003)
    const paper = rng.between(0.86, 1.02)
    const mF = quantize(paper + off, 0.01)
    const mS = rng.weigh(4, 0.03)
    const v0: LabTaskValues = { mS }
    // конец — первая лишняя капля (0,01–0,035 мл): жидкость над осадком розовеет
    const V = rng.read('pipette2', vNeed(v0) + rng.between(0.01, 0.035))
    // часть хлопьев остаётся на стенках стаканчика и проходит через поры фильтра
    const ppt = nCu(v0) * M_CUOH2 * rng.between(0.972, 0.995)
    const m2 = quantize(paper + ppt + off, 0.01)
    const mB = quantize(rng.between(29.6, 33.4), 0.01)
    return { mF, mS, V, m2, mP: Math.round((m2 - mF) * 100) / 100, mB }
  },
  given: (v, lang) => [
    `m(${tr(lang, 'р-ра', 'soln', 'eritma')} CuSO₄) = ${n(v.mS!, 2, lang)} ${tr(lang, 'г', 'g', 'g')}; w(CuSO₄) = 20 %`,
    `w(NaOH) = 20 %; ρ = 1${lang === 'en' ? '.' : ','}22 ${tr(lang, 'г/мл', 'g/ml', 'g/ml')}`,
    tr(
      lang,
      `По пипетке до розовой окраски: V = ${n(v.V!, 2, lang)} мл`,
      `By the pipette up to the pink colour: V = ${n(v.V!, 2, lang)} ml`,
      `Pushti ranggacha pipetka bo‘yicha: V = ${n(v.V!, 2, lang)} ml`,
    ),
    `m(${tr(lang, 'фильтр', 'filter', 'filtr')}) = ${n(v.mF!, 2, lang)} ${tr(lang, 'г', 'g', 'g')}; m(${tr(lang, 'фильтр + осадок', 'filter + precipitate', 'filtr + cho‘kma')}) = ${n(v.m2!, 2, lang)} ${tr(lang, 'г', 'g', 'g')}`,
    'M(CuSO₄) = 160, M(NaOH) = 40, M(Cu(OH)₂) = 98 ' + tr(lang, 'г/моль', 'g/mol', 'g/mol'),
  ],
  solution: (v, lang) => {
    const mc = v.mS! * W
    const nc = nCu(v)
    const mn = nc * 2 * M_NAOH
    const ms = mn / W
    const V = ms / RHO
    const g = tr(lang, 'г', 'g', 'g')
    const mol = tr(lang, 'моль', 'mol', 'mol')
    return [
      tr(lang, `1) m(CuSO₄) = ${n(v.mS!, 2, lang)} · 0,20 = ${n(mc, 3, lang)} г; n = ${n(mc, 3, lang)} / 160 = ${n(nc, 5, lang)} моль`, `1) m(CuSO₄) = ${n(v.mS!, 2, lang)} · 0.20 = ${n(mc, 3, lang)} g; n = ${n(mc, 3, lang)} / 160 = ${n(nc, 5, lang)} mol`, `1) m(CuSO₄) = ${n(v.mS!, 2, lang)} · 0,20 = ${n(mc, 3, lang)} g; n = ${n(mc, 3, lang)} / 160 = ${n(nc, 5, lang)} mol`),
      `2) CuSO₄ + 2NaOH: n(NaOH) = 2 · ${n(nc, 5, lang)} = ${n(2 * nc, 5, lang)} ${mol}; m(NaOH) = ${n(2 * nc, 5, lang)} · 40 = ${n(mn, 3, lang)} ${g}`,
      tr(lang, `3) m(р-ра NaOH) = ${n(mn, 3, lang)} / 0,20 = ${n(ms, 3, lang)} г`, `3) m(NaOH solution) = ${n(mn, 3, lang)} / 0.20 = ${n(ms, 3, lang)} g`, `3) m(NaOH eritmasi) = ${n(mn, 3, lang)} / 0,20 = ${n(ms, 3, lang)} g`),
      tr(lang, `4) V = m / ρ = ${n(ms, 3, lang)} / 1,22 = ${n(V, 2, lang)} мл (по пипетке — ${n(v.V!, 2, lang)} мл: последняя капля — избыток для окраски)`, `4) V = m / ρ = ${n(ms, 3, lang)} / 1.22 = ${n(V, 2, lang)} ml (pipette: ${n(v.V!, 2, lang)} ml — the last drop is the excess for the colour)`, `4) V = m / ρ = ${n(ms, 3, lang)} / 1,22 = ${n(V, 2, lang)} ml (pipetkada — ${n(v.V!, 2, lang)} ml: oxirgi tomchi rang uchun ortiqcha)`),
      tr(lang, `5) Проверка: m(Cu(OH)₂) = ${n(nc, 5, lang)} · 98 = ${n(nc * 98, 3, lang)} г; на весах ${n(v.m2!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mP!, 2, lang)} г`, `5) Check: m(Cu(OH)₂) = ${n(nc, 5, lang)} · 98 = ${n(nc * 98, 3, lang)} g; balance: ${n(v.m2!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mP!, 2, lang)} g`, `5) Tekshiruv: m(Cu(OH)₂) = ${n(nc, 5, lang)} · 98 = ${n(nc * 98, 3, lang)} g; tarozida ${n(v.m2!, 2, lang)} − ${n(v.mF!, 2, lang)} = ${n(v.mP!, 2, lang)} g`),
      tr(lang, `Ответ: V(р-ра NaOH) ≈ ${n(V, 2, lang)} мл`, `Answer: V(NaOH solution) ≈ ${n(V, 2, lang)} ml`, `Javob: V(NaOH eritmasi) ≈ ${n(V, 2, lang)} ml`),
    ]
  },
  compare: [
    {
      label: L('объём раствора NaOH', 'volume of NaOH solution', 'NaOH eritmasi hajmi'),
      unit: 'ml',
      decimals: 2,
      measured: (v) => v.V!,
      predicted: vNeed,
      book: 1.64,
      tolerancePct: 3,
    },
    {
      label: L('масса осадка Cu(OH)₂', 'mass of Cu(OH)₂ precipitate', 'Cu(OH)₂ cho‘kmasi massasi'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.mP!,
      predicted: (v) => nCu(v) * M_CUOH2,
      book: 0.49,
      tolerancePct: 5,
    },
  ],
  reconcile: L(
    'Объём по пипетке чуть больше расчётного: розовый цвет появляется только от первой лишней капли (0,02–0,03 мл), а глаз читает мениск с точностью ±0,01 мл — на 1,64 мл это 1–3 %. Масса осадка чуть меньше расчётной: хлопья Cu(OH)₂ остаются на стенках стаканчика и палочке, самые мелкие проходят через поры фильтра, а весы дают ±0,01 г в каждом из двух взвешиваний — на 0,49 г это до 2 %. Осадок сушили без нагрева: в шкафу при 105 °C он почернел бы (CuO), и масса вышла бы на 18 % меньше.',
    'The pipette volume is slightly above the calculation: the pink appears only with the first spare drop (0.02–0.03 ml), and the eye reads the meniscus to ±0.01 ml — 1–3 % of 1.64 ml. The precipitate is slightly lighter than calculated: Cu(OH)₂ flakes stay on the beaker walls and rod, the finest pass through the filter pores, and the balance gives ±0.01 g in each of two weighings — up to 2 % of 0.49 g. It was dried without heat: at 105 °C it would turn black (CuO) and weigh 18 % less.',
    'Pipetka bo‘yicha hajm hisobdagidan biroz ko‘p: pushti rang faqat birinchi ortiqcha tomchidan (0,02–0,03 ml) paydo bo‘ladi, ko‘z esa meniskni ±0,01 ml aniqlikda o‘qiydi — 1,64 ml da bu 1–3 %. Cho‘kma massasi hisobdagidan biroz kam: Cu(OH)₂ parchalari stakancha devori va tayoqchada qoladi, eng maydalari filtr g‘ovaklaridan o‘tadi, tarozi esa ikki tortishning har birida ±0,01 g beradi — 0,49 g da 2 % gacha. Cho‘kma qizdirilmay quritildi: 105 °C da u qorayib (CuO), massasi 18 % kam chiqardi.',
  ),
  conclusion: L(
    'В 4 г 20 %-ного раствора — 0,8 г CuSO₄ (0,005 моль); по уравнению на него нужно 0,01 моль NaOH, то есть 2 г 20 %-ного раствора, или 1,64 мл при ρ = 1,22 г/мл. Конец реакции виден по индикатору: пока есть Cu²⁺, щёлочь уходит в осадок Cu(OH)₂, лишняя капля окрашивает фенолфталеин.',
    '4 g of 20 % solution hold 0.8 g of CuSO₄ (0.005 mol); by the equation it needs 0.01 mol of NaOH, i.e. 2 g of 20 % solution, or 1.64 ml at ρ = 1.22 g/ml. The end point is seen with the indicator: while Cu²⁺ remains, the alkali goes into the Cu(OH)₂ precipitate; a spare drop turns phenolphthalein pink.',
    '20 % li eritmaning 4 grammida 0,8 g CuSO₄ (0,005 mol); tenglama bo‘yicha unga 0,01 mol NaOH, ya’ni 20 % li eritmadan 2 g yoki ρ = 1,22 g/ml da 1,64 ml kerak. Reaksiya oxiri indikatorda ko‘rinadi: Cu²⁺ bor ekan, ishqor Cu(OH)₂ cho‘kmasiga o‘tadi; ortiqcha tomchi fenolftaleinni pushti qiladi.',
  ),
  story: {
    equation: 'Cu²⁺ + 2OH⁻ → Cu(OH)₂↓',
    text: L(
      'В растворе медного купороса ионы Cu²⁺ окружены молекулами воды (отсюда голубой цвет), рядом — ионы SO₄²⁻. Каждая капля щёлочи приносит ионы Na⁺ и OH⁻: два OH⁻ связывают один Cu²⁺ в нерастворимый Cu(OH)₂ — голубые хлопья, а Na⁺ и SO₄²⁻ остаются в растворе (Na₂SO₄). Когда Cu²⁺ кончаются, OH⁻ больше не во что уходить — фенолфталеин розовеет.',
      'In blue vitriol solution Cu²⁺ ions are wrapped in water molecules (hence the blue colour), with SO₄²⁻ ions nearby. Each drop of alkali brings Na⁺ and OH⁻: two OH⁻ bind one Cu²⁺ into insoluble Cu(OH)₂ — blue flakes — while Na⁺ and SO₄²⁻ stay in solution (Na₂SO₄). When the Cu²⁺ runs out, OH⁻ has nowhere to go — phenolphthalein turns pink.',
      'Mis kuporosi eritmasida Cu²⁺ ionlari suv molekulalari bilan o‘ralgan (havorang shundan), yonida SO₄²⁻ ionlari. Har bir ishqor tomchisi Na⁺ va OH⁻ ionlarini olib keladi: ikkita OH⁻ bitta Cu²⁺ ni erimaydigan Cu(OH)₂ ga — havorang parchalarga bog‘laydi, Na⁺ va SO₄²⁻ esa eritmada qoladi (Na₂SO₄). Cu²⁺ tugagach, OH⁻ ning boradigan joyi qolmaydi — fenolftalein pushti bo‘ladi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('По какому признаку вы поняли, что сульфат меди прореагировал весь?', 'How did you know that all the copper sulfate had reacted?', 'Mis sulfat to‘liq reaksiyaga kirganini qaysi belgidan bildingiz?'),
      options: [
        L('Жидкость над осадком слабо порозовела от фенолфталеина', 'The liquid above the precipitate turned pale pink with phenolphthalein', 'Cho‘kma ustidagi suyuqlik fenolftaleindan och pushti bo‘ldi'),
        L('Пошли пузырьки газа', 'Gas bubbles appeared', 'Gaz pufakchalari chiqdi'),
        L('Осадок почернел', 'The precipitate turned black', 'Cho‘kma qoraydi'),
        L('Раствор стал ярко-синим', 'The solution turned bright blue', 'Eritma to‘q ko‘k bo‘ldi'),
      ],
      correct: 0,
      why: L('Пока в растворе есть Cu²⁺, OH⁻ уходят в осадок; розовая окраска — сигнал свободных OH⁻, значит Cu²⁺ кончились.', 'While Cu²⁺ remains, OH⁻ goes into the precipitate; the pink signals free OH⁻, so the Cu²⁺ is used up.', 'Cu²⁺ bor ekan, OH⁻ cho‘kmaga o‘tadi; pushti rang erkin OH⁻ belgisi, demak Cu²⁺ tugagan.'),
    },
    {
      id: 'type',
      q: L('Какой это тип реакции?', 'What type of reaction is this?', 'Bu qanday turdagi reaksiya?'),
      options: [
        L('Обмен — ионы меняются партнёрами, выпадает осадок', 'Exchange — ions swap partners and a precipitate forms', 'Almashinish — ionlar sheriklarini almashtiradi, cho‘kma tushadi'),
        L('Замещение', 'Substitution', 'O‘rin olish'),
        L('Разложение', 'Decomposition', 'Parchalanish'),
      ],
      correct: 0,
      why: L('CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄: две соли (основание и соль) обменялись ионами, реакция идёт до конца, потому что Cu(OH)₂ нерастворим.', 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄: two compounds swap ions; it goes to completion because Cu(OH)₂ is insoluble.', 'CuSO₄ + 2NaOH → Cu(OH)₂↓ + Na₂SO₄: ikki modda ion almashadi; Cu(OH)₂ erimagani uchun reaksiya oxirigacha boradi.'),
    },
    {
      id: 'product',
      q: L('Что осталось на фильтре и что прошло в фильтрат?', 'What stayed on the filter and what went into the filtrate?', 'Filtrda nima qoldi, filtratga nima o‘tdi?'),
      options: [
        L('На фильтре — голубой Cu(OH)₂, в фильтрате — раствор Na₂SO₄', 'Blue Cu(OH)₂ on the filter, Na₂SO₄ solution in the filtrate', 'Filtrda — havorang Cu(OH)₂, filtratda — Na₂SO₄ eritmasi'),
        L('На фильтре — Na₂SO₄, в фильтрате — Cu(OH)₂', 'Na₂SO₄ on the filter, Cu(OH)₂ in the filtrate', 'Filtrda — Na₂SO₄, filtratda — Cu(OH)₂'),
        L('На фильтре — чёрный CuO, в фильтрате — вода', 'Black CuO on the filter, water in the filtrate', 'Filtrda — qora CuO, filtratda — suv'),
      ],
      correct: 0,
      why: L('Cu(OH)₂ нерастворим и задерживается бумагой; Na₂SO₄ растворим и уходит с водой. CuO получился бы только при нагревании осадка.', 'Cu(OH)₂ is insoluble and is held by the paper; Na₂SO₄ dissolves and passes with the water. CuO would form only if the precipitate were heated.', 'Cu(OH)₂ erimaydi va qog‘ozda ushlanadi; Na₂SO₄ eriydi va suv bilan o‘tadi. CuO faqat cho‘kma qizdirilganda hosil bo‘lardi.'),
    },
  ],
  sideEquations: ['Cu(OH)₂ → CuO + H₂O'],
}
