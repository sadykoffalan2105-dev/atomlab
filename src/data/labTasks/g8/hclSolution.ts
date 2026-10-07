/**
 * Kimyo 8, с. 102, задание 2: концентрация соляной кислоты из 5,6 л HCl (н.у.) и 100 мл воды.
 * Опыт в 10 раз меньше — ДЕМОНСТРАЦИЯ УЧИТЕЛЯ в вытяжке (HCl ядовит): 10,0 мл воды в стаканчике на весах, газ из
 * газометра (запорная жидкость — вазелиновое масло) через опрокинутую воронку (не даёт воде «засосаться» в трубку).
 * Пропускают ≈ 600 мл газа при комнатной температуре (= 560 мл при н.у.); весы показывают массу поглощённого HCl.
 */
import type { LabLang } from '../../../components/lab3d/labContract'
import { fmtNum } from '../../../components/lab3d/measure/instruments'
import { gasMlAt, toNormalMl } from '../../../components/lab3d/measure/quantities'
import { L, tr, type LabTask, type LabTaskValues } from '../labTaskTypes'

type V3 = readonly [number, number, number]

/** Раскладка в вытяжном шкафу (локальные координаты, верх стола y = 0). */
export const HC = {
  ppe: [0.38, 0, 0.19] as V3,
  scales: [-0.12, 0, 0.06] as V3,
  /** Чаша весов (центр, на ней стоит стаканчик). */
  pan: [-0.12, 0.047, 0.048] as V3,
  beaker0: [-0.33, 0, 0.13] as V3,
  cylinder: [-0.37, 0, -0.02] as V3,
  /** Стержень штатива с лапкой для воронки [x, z]. */
  rod: [-0.12, -0.15] as const,
  /** Газометр (центр основания); кран газа — на высоте ≈ 0,23 м. */
  gaso: [0.17, 0, -0.07] as V3,
  /** Термометр, закреплённый на стойке у газометра (низ шарика). */
  thermo: [0.1, 0.03, 0.0] as V3,
  tile: [0.12, 0, 0.17] as V3,
  glassRod: [-0.02, 0, 0.215] as V3,
  /** Край воронки: поднят над стаканчиком / касается воды. */
  rimUp: 0.047 + 0.058 + 0.045,
  rimDown: 0.047 + 0.003 + 10e-6 / (Math.PI * 0.0205 * 0.0205),
  tapY: 0.03 + 1000e-6 / (Math.PI * 0.045 * 0.045) + 0.042,
}

const M_HCL = 36.5
const nByVolume = (v: LabTaskValues) => toNormalMl(v.V!, v.t!) / 22400
const mPred = (v: LabTaskValues) => nByVolume(v) * M_HCL
const f = (x: number, d: number, lang: LabLang) => fmtNum(x, d, lang)

export const TASK_G8_HCL_SOLUTION: LabTask = {
  id: 'task-g8-hcl-solution',
  grade: 8,
  page: 102,
  source: L('Kimyo 8 · с. 102, задание 2', 'Kimyo 8 · p. 102, exercise 2', 'Kimyo 8 · 102-bet, 2-topshiriq'),
  bookKind: 'task',
  title: L('Соляная кислота из хлороводорода', 'Hydrochloric acid from hydrogen chloride', 'Vodorod xloriddan xlorid kislota'),
  statement: L(
    'Определите концентрацию (%) соляной кислоты, образовавшейся в результате растворения 5,6 л HCl в 100 мл воды.',
    'Determine the concentration (%) of the hydrochloric acid formed by dissolving 5.6 l of HCl in 100 ml of water.',
    '5,6 l HCl ni 100 ml suvda eritish natijasida hosil bo‘lgan xlorid kislotaning konsentratsiyasini (%) aniqlang.',
  ),
  equation: 'w = m(HCl) / m(р-ра) · 100 %',
  kind: 'physical',
  type: 'solution-w',
  difficulty: 2,
  answers: [
    {
      key: 'w',
      label: 'w(HCl)',
      what: L('массовая доля HCl в полученной кислоте', 'mass fraction of HCl in the acid obtained', 'olingan kislotadagi HCl ning massa ulushi'),
      unit: L('%', '%', '%'),
      book: 8.36,
      decimals: 2,
      fromRun: (v) => v.w!,
    },
  ],
  labScale: {
    factor: 10,
    note: L(
      'В задаче 5,6 л газа и 100 мл воды. Ядовитый хлороводород берём в 10 раз меньше: 560 мл (н.у.) на 10,0 мл воды — доля HCl в растворе от этого не меняется, а газа хватает одного газометра на 1 л.',
      'The problem has 5.6 l of gas and 100 ml of water. We take 10 times less of the toxic hydrogen chloride: 560 ml (STP) for 10.0 ml of water — the fraction of HCl in the solution does not change, and one 1 l gas holder is enough.',
      'Masalada 5,6 l gaz va 100 ml suv. Zaharli vodorod xloridni 10 marta kam olamiz: 10,0 ml suvga 560 ml (n.sh.) — eritmadagi HCl ulushi o‘zgarmaydi, gaz esa 1 l li bitta gazometrga sig‘adi.',
    ),
  },
  instruments: ['scales', 'cyl10', 'gasometer', 'thermometer'],
  equipment: [
    L('Электронные весы (0,01 г), стаканчик 50 мл', 'Electronic balance (0.01 g), 50 ml beaker', 'Elektron tarozi (0,01 g), 50 ml stakancha'),
    L('Мерный цилиндр 10 мл с дистиллированной водой', '10 ml measuring cylinder with distilled water', 'Distillangan suvli 10 ml o‘lchov silindri'),
    L('Газометр 1 л с сухим HCl (запорная жидкость — вазелиновое масло), термометр на стойке', '1 l gas holder with dry HCl (sealing liquid — paraffin oil), thermometer on a stand', 'Quruq HCl li 1 l gazometr (berkituvchi suyuqlik — vazelin moyi), stoykadagi termometr'),
    L('Штатив с лапкой, опрокинутая воронка на шланге; стеклянная палочка, синяя лакмусовая бумажка', 'Stand with a clamp, inverted funnel on a hose; glass rod, blue litmus paper', 'Qisqichli shtativ, shlangdagi to‘nkarilgan voronka; shisha tayoqcha, ko‘k lakmus qog‘ozi'),
  ],
  safety: [
    L('Это демонстрация учителя: хлороводород ядовит и едко пахнет — опыт только в вытяжке с включённой тягой.', 'This is a teacher demonstration: hydrogen chloride is toxic and pungent — only in a fume hood with the draught on.', 'Bu o‘qituvchi namoyishi: vodorod xlorid zaharli va o‘tkir hidli — faqat tortmasi yoqilgan mo‘rili shkafda.'),
    L('Очки, перчатки, халат: на влажном воздухе HCl «дымит» — образуются капельки кислоты.', 'Goggles, gloves, coat: in moist air HCl “fumes” — tiny droplets of acid form.', 'Ko‘zoynak, qo‘lqop, xalat: nam havoda HCl «tutaydi» — kislota tomchilari hosil bo‘ladi.'),
    L('Трубку не опускают в воду: HCl растворяется так быстро, что вода «засасывается» в трубку и газометр. Поэтому — опрокинутая воронка у поверхности.', 'The tube is never put into the water: HCl dissolves so fast that water is “sucked back” into the tube and gas holder. Hence an inverted funnel at the surface.', 'Nay suvga tushirilmaydi: HCl shunchalik tez eriydiki, suv nay va gazometrga «so‘riladi». Shuning uchun — sirtdagi to‘nkarilgan voronka.'),
  ],
  gear: ['goggles', 'gloves', 'coat'],
  place: 'hood',
  steps: [
    {
      id: 'ppe',
      target: 'ppe',
      gesture: { kind: 'tap' },
      seconds: 1.6,
      instruction: L('Наденьте очки, перчатки и халат. Опыт показывает учитель.', 'Put on goggles, gloves and a lab coat. The teacher performs the experiment.', 'Ko‘zoynak, qo‘lqop va xalat kiying. Tajribani o‘qituvchi ko‘rsatadi.'),
      observation: L('Защита надета, тяга вытяжного шкафа работает.', 'Protection is on, the fume hood draught is working.', 'Himoya kiyildi, mo‘rili shkaf tortmasi ishlayapti.'),
      how: L('Нажмите на поднос со средствами защиты.', 'Tap the tray with the protective gear.', 'Himoya vositalari turgan patnisni bosing.'),
      teacher: L(
        'Хлороводород ядовит, поэтому ученик здесь — наблюдатель и лаборант: записывает показания, а газ пропускает учитель.',
        'Hydrogen chloride is toxic, so the student here is an observer and assistant: records the readings while the teacher passes the gas.',
        'Vodorod xlorid zaharli, shuning uchun o‘quvchi bu yerda kuzatuvchi va laborant: ko‘rsatkichlarni yozadi, gazni esa o‘qituvchi o‘tkazadi.',
      ),
    },
    {
      id: 'beaker',
      target: 'beaker',
      gesture: { kind: 'drag', from: [HC.beaker0[0], 0.03, HC.beaker0[2]], to: [HC.pan[0], 0.08, HC.pan[2]], lead: 0.5 },
      seconds: 3.4,
      instruction: L('Поставьте сухой стаканчик на весы под воронку и обнулите весы (T).', 'Put the dry beaker on the balance under the funnel and tare it (T).', 'Quruq stakanchani voronka ostiga, taroziga qo‘ying va nolga keltiring (T).'),
      observation: L('Весы показали массу стаканчика, после «T» — 0,00 г.', 'The balance showed the mass of the beaker, after “T” — 0.00 g.', 'Tarozi stakancha massasini ko‘rsatdi, «T» dan so‘ng — 0,00 g.'),
      how: L('Перетащите стаканчик на чашу весов.', 'Drag the beaker onto the balance pan.', 'Stakanchani tarozi pallasiga torting.'),
      teacher: L(
        'Тара «вычитает» стаканчик: дальше весы покажут только то, что в него попадёт, — воду, а потом газ.',
        'Taring “subtracts” the beaker: from now on the balance shows only what goes into it — the water, then the gas.',
        'Tara stakanchani «ayiradi»: endi tarozi faqat unga tushganini — suvni, keyin gazni ko‘rsatadi.',
      ),
    },
    {
      id: 'water',
      target: 'cylinder',
      gesture: { kind: 'drag', from: [HC.cylinder[0], 0.06, HC.cylinder[2]], to: [HC.pan[0], 0.14, HC.pan[2]], lead: 0.34 },
      seconds: 3.6,
      instruction: L('Проверьте по мениску 10,0 мл воды в цилиндре и вылейте её в стаканчик.', 'Check 10.0 ml of water in the cylinder at the meniscus and pour it into the beaker.', 'Silindrdagi 10,0 ml suvni menisk bo‘yicha tekshiring va stakanchaga quying.'),
      observation: L('Весы: около 9,98 г — масса воды (плотность 0,998 г/мл).', 'The balance: about 9.98 g — the mass of the water (density 0.998 g/ml).', 'Tarozi: taxminan 9,98 g — suv massasi (zichlik 0,998 g/ml).'),
      how: L('Перетащите цилиндр к стаканчику.', 'Drag the cylinder to the beaker.', 'Silindrni stakanchaga torting.'),
      teacher: L(
        'Объём воды знаем по цилиндру, а массу — точнее — по весам. Для раствора важна именно масса воды.',
        'We know the water volume from the cylinder, but its mass — more precisely — from the balance. For the solution, it is the mass that counts.',
        'Suv hajmini silindrdan, massasini esa aniqroq — tarozidan bilamiz. Eritma uchun aynan suv massasi muhim.',
      ),
      mistake: L('Мениск читают сверху — воды на самом деле меньше 10 мл.', 'Reading the top of the meniscus — there is actually less than 10 ml of water.', 'Meniskni yuqoridan o‘qish — suv aslida 10 ml dan kam.'),
    },
    {
      id: 'funnel',
      target: 'clamp',
      gesture: { kind: 'swipe', from: [HC.pan[0], 0.25, HC.pan[2] - 0.03], to: [HC.pan[0], 0.16, HC.pan[2] - 0.03], lead: 0.6 },
      seconds: 3.4,
      instruction: L('Опустите лапку с воронкой, чтобы край воронки коснулся воды, и снова нажмите T.', 'Lower the clamp with the funnel until the funnel rim touches the water, and press T again.', 'Voronkali qisqichni voronka cheti suvga tegguncha tushiring va yana T ni bosing.'),
      observation: L('Край воронки — у самой поверхности воды, воронка не касается стаканчика; весы — 0,00 г.', 'The funnel rim is right at the water surface, the funnel does not touch the beaker; the balance reads 0.00 g.', 'Voronka cheti — suv sirtida, voronka stakanchaga tegmaydi; tarozi — 0,00 g.'),
      how: L('Проведите по лапке вниз.', 'Swipe down along the clamp.', 'Qisqich bo‘ylab pastga suring.'),
      teacher: L(
        'Воронку держит штатив, а не стаканчик, — поэтому весы покажут только газ, который поглотила вода. Широкий край не даёт воде подняться в трубку.',
        'The funnel is held by the stand, not by the beaker — so the balance shows only the gas absorbed by the water. The wide rim keeps water from rising into the tube.',
        'Voronkani stakancha emas, shtativ ushlab turadi — shuning uchun tarozi faqat suv yutgan gazni ko‘rsatadi. Keng chet suvni nayga ko‘tarilishiga yo‘l qo‘ymaydi.',
      ),
      mistake: L('Опускают воронку глубоко в воду — при быстром растворении HCl воду засасывает в шланг.', 'Pushing the funnel deep into the water — as HCl dissolves fast, water is sucked into the hose.', 'Voronkani suvga chuqur tushirish — HCl tez eriganda suv shlangga so‘riladi.'),
    },
    {
      id: 'gas',
      target: 'gas-tap',
      gesture: { kind: 'swipe', from: [HC.gaso[0] - 0.04, HC.tapY, HC.gaso[2] + 0.03], to: [HC.gaso[0] + 0.03, HC.tapY, HC.gaso[2] + 0.03], lead: 0.12 },
      seconds: 9,
      instruction: L('Откройте кран газометра и медленно пропускайте газ, пока масло не поднимется к ≈ 600 мл.', 'Open the gas holder tap and pass the gas slowly until the oil rises to ≈ 600 ml.', 'Gazometr jo‘mragini oching va moy ≈ 600 ml gacha ko‘tarilguncha gazni sekin o‘tkazing.'),
      observation: L('Масло поднимается по шкале газометра, показание весов растёт, над водой — лёгкий «дымок», стаканчик теплеет. В жизни — 5–7 минут.', 'The oil rises up the gas holder scale, the balance reading grows, a light “mist” over the water, the beaker warms up. In real life — 5–7 minutes.', 'Moy gazometr shkalasi bo‘ylab ko‘tariladi, tarozi ko‘rsatkichi oshadi, suv ustida yengil «tutun», stakancha isiydi. Hayotda — 5–7 daqiqa.'),
      how: L('Проведите по ручке крана газометра — время ускорено.', 'Swipe across the gas holder tap handle — time is sped up.', 'Gazometr jo‘mragi dastasi bo‘ylab suring — vaqt tezlashtirilgan.'),
      teacher: L(
        '560 мл при н.у. в тёплом классе занимают больше: V = 560 · (273 + t) / 273 ≈ 600 мл. Молекулы HCl в воде распадаются на ионы H⁺ и Cl⁻ — поэтому газ растворяется так жадно и с теплом.',
        '560 ml at STP take up more space in a warm classroom: V = 560 · (273 + t) / 273 ≈ 600 ml. HCl molecules break into H⁺ and Cl⁻ ions in water — that is why the gas dissolves so eagerly and with heat.',
        'N.sh.dagi 560 ml iliq sinfda ko‘proq joy egallaydi: V = 560 · (273 + t) / 273 ≈ 600 ml. HCl molekulalari suvda H⁺ va Cl⁻ ionlariga ajraladi — shuning uchun gaz shunchalik ishtiyoq bilan va issiqlik chiqarib eriydi.',
      ),
      mistake: L('Пускают газ слишком быстро — пузыри проскакивают через воду, часть HCl уходит в тягу.', 'Letting the gas in too fast — bubbles slip through the water and some HCl escapes into the hood.', 'Gazni juda tez yuborish — pufaklar suvdan o‘tib ketadi, HCl ning bir qismi tortmaga ketadi.'),
    },
    {
      id: 'close',
      target: 'gas-tap',
      gesture: { kind: 'tap' },
      seconds: 3.4,
      instruction: L('Закройте кран. Запишите объём газа по шкале газометра и температуру по термометру.', 'Close the tap. Record the gas volume on the gas holder scale and the temperature on the thermometer.', 'Jo‘mrakni yoping. Gazometr shkalasidan gaz hajmini va termometrdan haroratni yozing.'),
      observation: L('Масло остановилось у отметки ≈ 600 мл; термометр у газометра — температура газа.', 'The oil stopped near the ≈ 600 ml mark; the thermometer by the gas holder shows the gas temperature.', 'Moy ≈ 600 ml belgisida to‘xtadi; gazometr yonidagi termometr — gaz harorati.'),
      how: L('Нажмите на кран газометра.', 'Tap the gas holder tap.', 'Gazometr jo‘mragini bosing.'),
      teacher: L(
        'Газ в газометре сухой (над маслом, а не над водой), поэтому поправка на водяной пар не нужна — только на температуру.',
        'The gas in the holder is dry (over oil, not over water), so no correction for water vapour is needed — only for temperature.',
        'Gazometrdagi gaz quruq (suv emas, moy ustida), shuning uchun suv bug‘iga tuzatish kerak emas — faqat haroratga.',
      ),
    },
    {
      id: 'weigh',
      target: 'scales',
      gesture: { kind: 'tap' },
      seconds: 3.4,
      instruction: L('Дождитесь, пока растворятся последние пузырьки газа, и запишите показание весов.', 'Wait for the last gas bubbles to dissolve and record the balance reading.', 'Gazning oxirgi pufakchalari erishini kuting va tarozi ko‘rsatkichini yozing.'),
      observation: L('Показание остановилось, загорелся ○ — это масса поглощённого хлороводорода.', 'The reading has stopped, the ○ is on — this is the mass of hydrogen chloride absorbed.', 'Ko‘rsatkich to‘xtadi, ○ yondi — bu yutilgan vodorod xlorid massasi.'),
      how: L('Нажмите на весы.', 'Tap the balance.', 'Taroziga bosing.'),
      teacher: L(
        'Весы обнулены с водой и воронкой, значит прирост — это и есть m(HCl). Масса раствора = масса воды + масса газа.',
        'The balance was tared with the water and funnel, so the increase is m(HCl) itself. Mass of solution = mass of water + mass of gas.',
        'Tarozi suv va voronka bilan nolga keltirilgan, demak o‘sish — aynan m(HCl). Eritma massasi = suv massasi + gaz massasi.',
      ),
      mistake: L('Записывают показание сразу после крана — газ в воронке ещё растворяется.', 'Recording right after the tap is closed — the gas in the funnel is still dissolving.', 'Jo‘mrakdan so‘ng darhol yozish — voronkadagi gaz hali eriyapti.'),
    },
    {
      id: 'litmus',
      target: 'glass-rod',
      gesture: { kind: 'drag', from: [HC.glassRod[0], 0.01, HC.glassRod[2]], to: [HC.tile[0], 0.06, HC.tile[2]], lead: 0.5 },
      seconds: 3.6,
      instruction: L('Палочкой перенесите каплю раствора на синюю лакмусовую бумажку.', 'With the glass rod, put a drop of the solution onto blue litmus paper.', 'Tayoqcha bilan eritmadan bir tomchini ko‘k lakmus qog‘oziga tomizing.'),
      observation: L('Синяя бумажка покраснела — в стаканчике кислота.', 'The blue paper turned red — the beaker holds an acid.', 'Ko‘k qog‘oz qizardi — stakanchada kislota.'),
      how: L('Перетащите палочку от стаканчика к плитке с лакмусом.', 'Drag the rod from the beaker to the tile with the litmus.', 'Tayoqchani stakanchadan lakmusli plitkaga torting.'),
      teacher: L(
        'Ионы H⁺, которые появились при растворении HCl, меняют цвет индикатора: синий лакмус краснеет.',
        'The H⁺ ions formed when HCl dissolved change the colour of the indicator: blue litmus turns red.',
        'HCl eriganda hosil bo‘lgan H⁺ ionlari indikator rangini o‘zgartiradi: ko‘k lakmus qizaradi.',
      ),
    },
  ],
  focus: [
    { from: 1.5, to: 1.97, point: [HC.scales[0], 0.035, HC.scales[2] + 0.07], dist: 0.3 },
    { from: 2.5, to: 2.97, point: [HC.pan[0], 0.06, HC.pan[2] + 0.06], dist: 0.3 },
    { from: 4.3, to: 4.95, point: [HC.gaso[0] - 0.08, 0.12, HC.gaso[2] + 0.06], dist: 0.55 },
    { from: 5.3, to: 5.97, point: [HC.gaso[0], 0.125, HC.gaso[2] + 0.046], dist: 0.22 },
    { from: 6.3, to: 6.97, point: [HC.scales[0], 0.035, HC.scales[2] + 0.07], dist: 0.3 },
    { from: 7.5, to: 7.97, point: [HC.tile[0], 0.01, HC.tile[2]], dist: 0.22 },
  ],
  labels: [
    { at: 1.9, pos: [HC.scales[0], 0.15, HC.scales[2] + 0.05], text: L('T: стаканчик «вычтен»', 'T: the beaker is “subtracted”', 'T: stakancha «ayirildi»') },
    { at: 3.9, pos: [HC.pan[0] - 0.07, 0.14, HC.pan[2]], text: L('край воронки у воды', 'funnel rim at the water', 'voronka cheti suvda') },
    { at: 4.5, pos: [HC.pan[0], 0.2, HC.pan[2]], text: L('HCl растворяется, стаканчик теплеет', 'HCl dissolves, the beaker warms up', 'HCl eriydi, stakancha isiydi') },
    { at: 4.7, pos: [HC.gaso[0], 0.3, HC.gaso[2]], text: L('ускорено: в жизни 5–7 мин', 'sped up: 5–7 min in real life', 'tezlashtirilgan: hayotda 5–7 daq') },
    { at: 7.8, pos: [HC.tile[0], 0.08, HC.tile[2]], text: L('лакмус красный: кислота', 'litmus red: acid', 'lakmus qizil: kislota') },
  ],
  measurements: [
    { key: 'vW', label: 'V(H₂O)', what: L('объём воды по цилиндру', 'water volume from the cylinder', 'silindr bo‘yicha suv hajmi'), instrument: 'cyl10', afterStep: 2 },
    { key: 'mW', label: 'm(H₂O)', what: L('масса воды на весах', 'mass of water on the balance', 'tarozidagi suv massasi'), instrument: 'scales', afterStep: 2 },
    { key: 'V', label: 'V(HCl)', what: L('объём газа, вышедшего из газометра', 'volume of gas that left the gas holder', 'gazometrdan chiqqan gaz hajmi'), instrument: 'gasometer', afterStep: 5 },
    { key: 't', label: 't', what: L('температура газа', 'gas temperature', 'gaz harorati'), instrument: 'thermometer', afterStep: 5 },
    { key: 'dm', label: 'm(HCl)', what: L('масса поглощённого HCl (прирост на весах)', 'mass of HCl absorbed (gain on the balance)', 'yutilgan HCl massasi (tarozidagi o‘sish)'), instrument: 'scales', afterStep: 6 },
    { key: 'w', label: 'w(HCl)', what: L('массовая доля HCl: m(HCl) / (m(H₂O) + m(HCl))', 'mass fraction of HCl: m(HCl) / (m(H₂O) + m(HCl))', 'HCl massa ulushi: m(HCl) / (m(H₂O) + m(HCl))'), instrument: 'scales', afterStep: 6, derived: true },
  ],
  simulate: (rng) => {
    const vW = rng.read('cyl10', 10)
    const mW = rng.read('scales', vW * 0.998)
    const tTrue = rng.between(19, 23)
    // учитель закрывает кран у отметки, соответствующей 0,025 моль при температуре класса
    const Vt = gasMlAt(0.025, tTrue)
    const V = rng.read('gasometer', Vt)
    const t = rng.read('thermometer', tTrue)
    // почти весь газ поглощается; немного проскакивает с пузырьками и уходит из тёплого раствора
    const absorbed = rng.between(0.99, 0.997)
    const dm = rng.read('scales', (toNormalMl(Vt, tTrue) / 22400) * M_HCL * absorbed)
    return { vW, mW, V, t, dm, w: (dm / (mW + dm)) * 100 }
  },
  given: (v, lang) => [
    tr(lang, 'Задача: V(HCl) = 5,6 л (н.у.); V(H₂O) = 100 мл; w(HCl) — ?', 'Problem: V(HCl) = 5.6 l (STP); V(H₂O) = 100 ml; w(HCl) — ?', 'Masala: V(HCl) = 5,6 l (n.sh.); V(H₂O) = 100 ml; w(HCl) — ?'),
    tr(
      lang,
      `Опыт (в 10 раз меньше): V(H₂O) = ${f(v.vW!, 1, lang)} мл, m(H₂O) = ${f(v.mW!, 2, lang)} г; газ: V = ${f(v.V!, 0, lang)} мл при t = ${f(v.t!, 1, lang)} °C`,
      `Experiment (10 times smaller): V(H₂O) = ${f(v.vW!, 1, lang)} ml, m(H₂O) = ${f(v.mW!, 2, lang)} g; gas: V = ${f(v.V!, 0, lang)} ml at t = ${f(v.t!, 1, lang)} °C`,
      `Tajriba (10 marta kichik): V(H₂O) = ${f(v.vW!, 1, lang)} ml, m(H₂O) = ${f(v.mW!, 2, lang)} g; gaz: V = ${f(v.V!, 0, lang)} ml, t = ${f(v.t!, 1, lang)} °C`,
    ),
    tr(lang, `Весы: прирост m(HCl) = ${f(v.dm!, 2, lang)} г; M(HCl) = 36,5 г/моль, Vm = 22,4 л/моль`, `Balance: gain m(HCl) = ${f(v.dm!, 2, lang)} g; M(HCl) = 36.5 g/mol, Vm = 22.4 l/mol`, `Tarozi: o‘sish m(HCl) = ${f(v.dm!, 2, lang)} g; M(HCl) = 36,5 g/mol, Vm = 22,4 l/mol`),
  ],
  solution: (v, lang) => {
    const V0 = toNormalMl(v.V!, v.t!)
    const n = V0 / 22400
    const mS = v.mW! + v.dm!
    return [
      tr(
        lang,
        `Газ к н.у.: V₀ = V · 273 / (273 + t) = ${f(v.V!, 0, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(V0, 0, lang)} мл`,
        `Gas to STP: V₀ = V · 273 / (273 + t) = ${f(v.V!, 0, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(V0, 0, lang)} ml`,
        `Gazni n.sh.ga: V₀ = V · 273 / (273 + t) = ${f(v.V!, 0, lang)} · 273 / ${f(273 + v.t!, 1, lang)} = ${f(V0, 0, lang)} ml`,
      ),
      tr(
        lang,
        `По объёму: n(HCl) = ${f(V0, 0, lang)} / 22 400 = ${f(n, 4, lang)} моль; m = n · M = ${f(n * M_HCL, 3, lang)} г (весы: ${f(v.dm!, 2, lang)} г)`,
        `From the volume: n(HCl) = ${f(V0, 0, lang)} / 22 400 = ${f(n, 4, lang)} mol; m = n · M = ${f(n * M_HCL, 3, lang)} g (balance: ${f(v.dm!, 2, lang)} g)`,
        `Hajm bo‘yicha: n(HCl) = ${f(V0, 0, lang)} / 22 400 = ${f(n, 4, lang)} mol; m = n · M = ${f(n * M_HCL, 3, lang)} g (tarozi: ${f(v.dm!, 2, lang)} g)`,
      ),
      tr(
        lang,
        `m(р-ра) = m(H₂O) + m(HCl) = ${f(v.mW!, 2, lang)} + ${f(v.dm!, 2, lang)} = ${f(mS, 2, lang)} г`,
        `m(solution) = m(H₂O) + m(HCl) = ${f(v.mW!, 2, lang)} + ${f(v.dm!, 2, lang)} = ${f(mS, 2, lang)} g`,
        `m(eritma) = m(H₂O) + m(HCl) = ${f(v.mW!, 2, lang)} + ${f(v.dm!, 2, lang)} = ${f(mS, 2, lang)} g`,
      ),
      tr(
        lang,
        `w(HCl) = ${f(v.dm!, 2, lang)} / ${f(mS, 2, lang)} · 100 % = ${f(v.w!, 2, lang)} % — в 10 раз больших количествах доля та же`,
        `w(HCl) = ${f(v.dm!, 2, lang)} / ${f(mS, 2, lang)} · 100 % = ${f(v.w!, 2, lang)} % — the same fraction for 10 times larger amounts`,
        `w(HCl) = ${f(v.dm!, 2, lang)} / ${f(mS, 2, lang)} · 100 % = ${f(v.w!, 2, lang)} % — 10 marta katta miqdorlarda ulush o‘sha`,
      ),
      tr(lang, `Ответ: w(HCl) ≈ ${f(v.w!, 2, lang)} %`, `Answer: w(HCl) ≈ ${f(v.w!, 2, lang)} %`, `Javob: w(HCl) ≈ ${f(v.w!, 2, lang)} %`),
    ]
  },
  compare: [
    {
      label: L('m(HCl): весы и объём газа', 'm(HCl): balance and gas volume', 'm(HCl): tarozi va gaz hajmi'),
      unit: 'g',
      decimals: 2,
      measured: (v) => v.dm!,
      predicted: mPred,
      book: 0.9125,
      tolerancePct: 3,
    },
    {
      label: L('w(HCl) в растворе', 'w(HCl) in the solution', 'eritmadagi w(HCl)'),
      unit: '%',
      decimals: 2,
      measured: (v) => v.w!,
      predicted: (v) => (mPred(v) / (v.mW! + mPred(v))) * 100,
      book: 8.36,
      tolerancePct: 3,
    },
  ],
  reconcile: L(
    'Весы показали чуть меньше, чем даёт объём газа, — и это честно. Хлороводород поглощается почти весь, но не до конца: часть пузырьков проскакивает через тонкий слой воды, а из тёплого раствора немного HCl уходит в тягу (−0,3…1 %). Весы ±0,01 г на 0,91 г — это ±1 %, шкала газометра ±5 мл на 600 мл — ±0,8 %, термометр ±0,5 °C — ±0,2 %. В учебнике 100 мл воды считают как 100 г; у нас масса воды взвешена (плотность 0,998 г/мл) — разница в сотых долях процента.',
    'The balance shows a little less than the gas volume suggests — and that is honest. Almost all the hydrogen chloride is absorbed, but not quite: some bubbles slip through the thin water layer, and a little HCl escapes from the warm solution into the hood (−0.3…1 %). The balance (±0.01 g on 0.91 g) gives ±1 %, the gas holder scale (±5 ml on 600 ml) ±0.8 %, the thermometer (±0.5 °C) ±0.2 %. The textbook takes 100 ml of water as 100 g; we weighed the water (density 0.998 g/ml) — a difference of hundredths of a percent.',
    'Tarozi gaz hajmi bo‘yicha hisobdan biroz kam ko‘rsatdi — bu halol. Vodorod xlorid deyarli to‘liq yutiladi, lekin butunlay emas: ba’zi pufakchalar yupqa suv qatlamidan o‘tib ketadi, iliq eritmadan esa ozgina HCl tortmaga chiqadi (−0,3…1 %). Tarozi (0,91 g da ±0,01 g) ±1 %, gazometr shkalasi (600 ml da ±5 ml) ±0,8 %, termometr (±0,5 °C) ±0,2 % beradi. Darslikda 100 ml suv 100 g deb olinadi; biz suvni tortdik (zichlik 0,998 g/ml) — farq foizning yuzdan bir ulushlarida.',
  ),
  conclusion: L(
    '560 мл HCl (н.у.) — это 0,025 моль, 0,91 г; в 10,0 мл воды получилась кислота с w ≈ 8,4 %. В задаче всего в 10 раз больше: 5,6 л HCl = 0,25 моль = 9,125 г; w = 9,125 / (100 + 9,125) · 100 % = 8,36 %. Хлороводород растворяется в воде очень хорошо и с выделением тепла, раствор — кислота (лакмус красный).',
    '560 ml of HCl (STP) is 0.025 mol, 0.91 g; in 10.0 ml of water it gave an acid with w ≈ 8.4 %. The problem has everything 10 times larger: 5.6 l of HCl = 0.25 mol = 9.125 g; w = 9.125 / (100 + 9.125) · 100 % = 8.36 %. Hydrogen chloride dissolves in water very well and gives off heat; the solution is an acid (litmus red).',
    '560 ml HCl (n.sh.) — bu 0,025 mol, 0,91 g; 10,0 ml suvda w ≈ 8,4 % li kislota hosil bo‘ldi. Masalada hammasi 10 marta ko‘p: 5,6 l HCl = 0,25 mol = 9,125 g; w = 9,125 / (100 + 9,125) · 100 % = 8,36 %. Vodorod xlorid suvda juda yaxshi va issiqlik chiqarib eriydi, eritma — kislota (lakmus qizil).',
  ),
  story: {
    equation: 'HCl → H⁺ + Cl⁻',
    text: L(
      'Молекулы HCl полярны: водород в них частично положителен, хлор — отрицателен. Молекулы воды окружают HCl, связь H–Cl рвётся, и в растворе появляются ионы H⁺ (точнее, H₃O⁺) и Cl⁻. При этом выделяется тепло. Масса раствора — сумма масс воды и растворённого газа, а ионы H⁺ дают кислую реакцию.',
      'HCl molecules are polar: their hydrogen is partly positive, the chlorine negative. Water molecules surround HCl, the H–Cl bond breaks, and H⁺ (more exactly H₃O⁺) and Cl⁻ ions appear in the solution. Heat is given off. The mass of the solution is the sum of the masses of water and dissolved gas, and the H⁺ ions make it acidic.',
      'HCl molekulalari qutbli: undagi vodorod qisman musbat, xlor — manfiy. Suv molekulalari HCl ni o‘rab oladi, H–Cl bog‘i uziladi va eritmada H⁺ (aniqrog‘i, H₃O⁺) hamda Cl⁻ ionlari paydo bo‘ladi. Bunda issiqlik ajraladi. Eritma massasi — suv va erigan gaz massalari yig‘indisi, H⁺ ionlari esa kislotali muhit beradi.',
    ),
  },
  quiz: [
    {
      id: 'sign',
      q: L('Что показало, что газ поглощается водой?', 'What showed that the gas was being absorbed by the water?', 'Gaz suv tomonidan yutilayotganini nima ko‘rsatdi?'),
      options: [
        L('Росло показание весов, а масло в газометре поднималось', 'The balance reading grew while the oil in the gas holder rose', 'Tarozi ko‘rsatkichi oshdi, gazometrdagi moy esa ko‘tarildi'),
        L('Вода в стаканчике посинела', 'The water in the beaker turned blue', 'Stakanchadagi suv ko‘kardi'),
        L('Выпал белый осадок', 'A white precipitate formed', 'Oq cho‘kma tushdi'),
      ],
      correct: 0,
      why: L('Газ уходил из газометра, а масса стаканчика росла — значит, HCl остался в воде.', 'Gas left the gas holder and the beaker got heavier — so the HCl stayed in the water.', 'Gaz gazometrdan chiqdi, stakancha esa og‘irlashdi — demak, HCl suvda qoldi.'),
    },
    {
      id: 'type',
      q: L('Зачем газ подают через опрокинутую воронку, а не трубкой под воду?', 'Why is the gas led in through an inverted funnel rather than a tube under the water?', 'Nega gaz suv ostidagi nay emas, to‘nkarilgan voronka orqali beriladi?'),
      options: [
        L('Чтобы воду не «засосало» в трубку: HCl растворяется очень быстро', 'So that water is not “sucked back” into the tube: HCl dissolves very fast', 'Suv nayga «so‘rilmasligi» uchun: HCl juda tez eriydi'),
        L('Чтобы газ лучше нагрелся', 'So that the gas warms up better', 'Gaz yaxshiroq isishi uchun'),
        L('Чтобы весы показывали меньше', 'So that the balance reads less', 'Tarozi kamroq ko‘rsatishi uchun'),
      ],
      correct: 0,
      why: L('Из-за быстрого растворения давление в трубке падает, и вода поднялась бы в шланг. Широкая воронка этого не допускает.', 'Fast dissolving lowers the pressure in the tube, and water would rise into the hose. The wide funnel prevents this.', 'Tez erish naydagi bosimni pasaytiradi va suv shlangga ko‘tarilardi. Keng voronka bunga yo‘l qo‘ymaydi.'),
    },
    {
      id: 'product',
      q: L('Что получилось в стаканчике?', 'What formed in the beaker?', 'Stakanchada nima hosil bo‘ldi?'),
      options: [
        L('Соляная кислота (лакмус краснеет)', 'Hydrochloric acid (litmus turns red)', 'Xlorid kislota (lakmus qizaradi)'),
        L('Раствор щёлочи', 'An alkali solution', 'Ishqor eritmasi'),
        L('Чистая вода — газ не растворился', 'Pure water — the gas did not dissolve', 'Toza suv — gaz erimadi'),
      ],
      correct: 0,
      why: L('Раствор хлороводорода в воде — соляная кислота; ионы H⁺ окрашивают синий лакмус в красный.', 'A solution of hydrogen chloride in water is hydrochloric acid; H⁺ ions turn blue litmus red.', 'Vodorod xloridning suvdagi eritmasi — xlorid kislota; H⁺ ionlari ko‘k lakmusni qizilga bo‘yaydi.'),
    },
  ],
}
