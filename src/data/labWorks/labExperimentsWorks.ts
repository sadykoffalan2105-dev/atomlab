/**
 * Ещё три практические работы 3D-лаборатории (по учебникам Kimyo):
 *  • 'water-oxides' — Kimyo 7, § 6.5, с. 140: «Практическое занятие. Взаимодействие воды с оксидами».
 *    CaO + H₂O = Ca(OH)₂ — выделяется тепло, образуется основание (реакция соединения); оксид неметалла — в виде
 *    газированной минеральной воды (книга: газообразные CO₂, NO₂, SO₃ и ядовитый P₂O₅ в школе не берут);
 *    индикаторы по таблице учебника: фенолфталеин в основании малиновый, лакмус в кислоте красный, в воде фиолетовый;
 *  • 'co2' — Kimyo 9, Практическая работа 1, с. 191: «Получение оксида углерода(IV) и знакомство с его свойствами».
 *    Мрамор + соляная кислота, пробка с газоотводной трубкой, известковая вода мутнеет (§ 10, с. 51), при дальнейшем
 *    пропускании CO₂ муть исчезает — Ca(HCO₃)₂ (§ 23, с. 114); CO₂ через воду + синий лакмус; через NaOH с фенолфталеином;
 *  • 'metals-acids' — Kimyo 7, § 5.6, с. 124: «Практическое занятие. Взаимодействие кислот с металлами».
 *    Mg + разбавленная H₂SO₄ (1 : 5) — активно, водород — хлопок у горящей спички; Zn + HCl — пузырьки на поверхности
 *    гранул; Cu + HCl — изменений нет (медь стоит в ряду активности после водорода).
 * Тексты RU/EN/UZ; цели шагов — объекты установок (rigTargets.ts).
 */
import type { LabExperimentDef, LabExperimentId, LabText } from '../../components/lab3d/labContract'
import type { LabItemId } from '../../components/lab3d/labEvents'

const t = (ru: string, en: string, uz: string): LabText => ({ ru, en, uz })

export type WorksId = Extract<LabExperimentId, 'water-oxides' | 'co2' | 'metals-acids'>

const S_SMALL = t(
  'Берите реактивы в малых количествах.',
  'Use small amounts of reagents.',
  'Reaktivlarni oz miqdorda oling.',
)
const S_CONTACT = t(
  'Не допускайте попадания реактивов на одежду, кожу и в глаза; работайте в очках и халате.',
  'Keep reagents off your clothes, skin and eyes; wear goggles and a lab coat.',
  'Reaktivlar kiyim, teri va ko‘zga tushishiga yo‘l qo‘ymang; ko‘zoynak va xalatda ishlang.',
)
const S_ACID = t(
  'Кислоту наливайте осторожно; попавшую на кожу кислоту смойте большим количеством воды.',
  'Pour acid carefully; wash acid off the skin with plenty of water.',
  'Kislotani ehtiyotlik bilan quying; teriga tushgan kislotani ko‘p suv bilan yuving.',
)
const S_MOUTH = t(
  'Отверстие пробирки направляйте от себя и от одноклассников.',
  'Point the mouth of the test tube away from yourself and your classmates.',
  'Probirka og‘zini o‘zingizdan va sinfdoshlaringizdan uzoqqa qarating.',
)

const GEAR_STEP = (gloves: boolean) => ({
  id: 'gear',
  target: 'ppe',
  instruction: gloves
    ? t('Наденьте защитные очки, перчатки и халат.', 'Put on safety goggles, gloves and a lab coat.', 'Himoya ko‘zoynagi, qo‘lqop va xalatni kiying.')
    : t('Наденьте защитные очки и халат.', 'Put on safety goggles and a lab coat.', 'Himoya ko‘zoynagi va xalatni kiying.'),
  observation: t('Средства защиты надеты — можно начинать.', 'Protective gear is on: you can start.', 'Himoya vositalari kiyildi — boshlash mumkin.'),
})

export const LAB_WORKS_EXPERIMENTS: readonly LabExperimentDef[] = [
  /* ── Kimyo 7, § 6.5, с. 140 ── */
  {
    id: 'water-oxides',
    source: t('Kimyo 7 · § 6.5 · Практическое занятие', 'Kimyo 7 · § 6.5 · Practical lesson', 'Kimyo 7 · 6.5-§ · Amaliy mashg‘ulot'),
    title: t('Взаимодействие воды с оксидами', 'Reaction of water with oxides', 'Suvning oksidlar bilan o‘zaro ta’siri'),
    equation: 'CaO + H₂O → Ca(OH)₂',
    kind: 'combination',
    grade: 7,
    page: 140,
    gear: ['goggles', 'gloves', 'coat'],
    equipment: [
      t('Пробирки и штатив', 'Test tubes and a rack', 'Probirkalar va shtativ'),
      t('Оксид кальция CaO (негашёная известь), шпатель', 'Calcium oxide CaO (quicklime), a spatula', 'Kalsiy oksid CaO (so‘ndirilmagan ohak), shpatel'),
      t('Дистиллированная вода', 'Distilled water', 'Distillangan suv'),
      t('Газированная минеральная вода (в ней растворён CO₂)', 'Sparkling mineral water (CO₂ is dissolved in it)', 'Gazlangan mineral suv (unda CO₂ erigan)'),
      t('Фенолфталеин и лакмус', 'Phenolphthalein and litmus', 'Fenolftalein va lakmus'),
    ],
    safety: [
      S_SMALL,
      S_CONTACT,
      t(
        'Воду к оксиду кальция приливайте медленно: смесь сильно разогревается.',
        'Add the water to calcium oxide slowly: the mixture gets very hot.',
        'Suvni kalsiy oksidga sekin quying: aralashma kuchli qiziydi.',
      ),
    ],
    steps: [
      GEAR_STEP(true),
      {
        id: 'cao',
        target: 'spatula',
        instruction: t('Шпателем насыпьте в пробирку 1 немного оксида кальция CaO.', 'Use the spatula to put a little calcium oxide CaO into tube 1.', 'Shpatel bilan 1-probirkaga ozgina kalsiy oksid CaO soling.'),
        observation: t('На дне пробирки — белый порошок CaO.', 'White CaO powder lies at the bottom of the tube.', 'Probirka tubida — oq CaO kukuni.'),
      },
      {
        id: 'water',
        target: 'bottle-water',
        instruction: t('Медленно залейте оксид кальция водой.', 'Slowly pour water onto the calcium oxide.', 'Kalsiy oksidni sekin suv bilan quying.'),
        observation: t(
          'Смесь разогревается, над пробиркой поднимается пар; образуется белый мутный раствор — гашёная известь Ca(OH)₂.',
          'The mixture heats up and steam rises from the tube; a white cloudy liquid forms: slaked lime Ca(OH)₂.',
          'Aralashma qiziydi, probirkadan bug‘ ko‘tariladi; oq loyqa eritma — so‘ndirilgan ohak Ca(OH)₂ hosil bo‘ladi.',
        ),
      },
      {
        id: 'mineral',
        target: 'bottle-soda',
        instruction: t(
          'В пробирку 2 налейте газированную минеральную воду — в ней растворён оксид неметалла CO₂.',
          'Pour sparkling mineral water into tube 2: the non-metal oxide CO₂ is dissolved in it.',
          '2-probirkaga gazlangan mineral suv quying — unda metallmas oksidi CO₂ erigan.',
        ),
        observation: t(
          'В воде поднимаются пузырьки CO₂; часть его соединилась с водой — образовалась угольная кислота H₂CO₃.',
          'Bubbles of CO₂ rise in the water; part of it has combined with water to form carbonic acid H₂CO₃.',
          'Suvda CO₂ pufakchalari ko‘tariladi; uning bir qismi suv bilan birikib, karbonat kislota H₂CO₃ hosil qilgan.',
        ),
      },
      {
        id: 'distilled',
        target: 'bottle-water',
        instruction: t('В пробирку 3 налейте дистиллированную воду — для сравнения.', 'Pour distilled water into tube 3 for comparison.', 'Taqqoslash uchun 3-probirkaga distillangan suv quying.'),
        observation: t('Чистая вода бесцветна и прозрачна.', 'Pure water is colourless and clear.', 'Toza suv rangsiz va tiniq.'),
      },
      {
        id: 'phenolphthalein',
        target: 'phenolphthalein',
        instruction: t('Добавьте 1–2 капли фенолфталеина в пробирку 1 с Ca(OH)₂.', 'Add 1–2 drops of phenolphthalein to tube 1 with Ca(OH)₂.', 'Ca(OH)₂ li 1-probirkaga 1–2 tomchi fenolftalein qo‘shing.'),
        observation: t(
          'Раствор стал малиновым — в пробирке основание (щёлочь).',
          'The liquid turned crimson: there is a base (alkali) in the tube.',
          'Eritma to‘q pushti rangga kirdi — probirkada asos (ishqor) bor.',
        ),
      },
      {
        id: 'litmus-acid',
        target: 'litmus',
        instruction: t('Добавьте 1–2 капли лакмуса в пробирку 2 с минеральной водой.', 'Add 1–2 drops of litmus to tube 2 with mineral water.', 'Mineral suvli 2-probirkaga 1–2 tomchi lakmus qo‘shing.'),
        observation: t('Лакмус стал красным — в растворе кислота.', 'The litmus turned red: the solution contains an acid.', 'Lakmus qizardi — eritmada kislota bor.'),
      },
      {
        id: 'litmus-water',
        target: 'litmus',
        instruction: t('Добавьте лакмус в пробирку 3 с дистиллированной водой.', 'Add litmus to tube 3 with distilled water.', 'Distillangan suvli 3-probirkaga lakmus qo‘shing.'),
        observation: t('В чистой воде лакмус фиолетовый — среда нейтральная.', 'In pure water litmus is violet: the medium is neutral.', 'Toza suvda lakmus binafsha — muhit neytral.'),
      },
      {
        id: 'compare',
        target: 'rack',
        instruction: t('Сравните окраску индикаторов в трёх пробирках.', 'Compare the indicator colours in the three tubes.', 'Uchta probirkadagi indikatorlar rangini taqqoslang.'),
        observation: t(
          'Основание: фенолфталеин малиновый. Кислота: лакмус красный. Вода: лакмус фиолетовый.',
          'Base: phenolphthalein is crimson. Acid: litmus is red. Water: litmus is violet.',
          'Asos: fenolftalein to‘q pushti. Kislota: lakmus qizil. Suv: lakmus binafsha.',
        ),
      },
    ],
    conclusion: t(
      'Оксид металла CaO реагирует с водой с выделением тепла и образует основание Ca(OH)₂ (реакция соединения) — фенолфталеин в нём малиновый. Оксид неметалла CO₂ с водой образует кислоту H₂CO₃ — лакмус краснеет. В чистой воде лакмус фиолетовый: индикаторы различают кислоты и основания.',
      'The metal oxide CaO reacts with water giving off heat and forms the base Ca(OH)₂ (a combination reaction): phenolphthalein turns crimson in it. The non-metal oxide CO₂ forms the acid H₂CO₃ with water: litmus turns red. In pure water litmus is violet, so indicators tell acids from bases.',
      'Metall oksidi CaO suv bilan issiqlik chiqarib reaksiyaga kirishadi va Ca(OH)₂ asosini hosil qiladi (birikish reaksiyasi) — unda fenolftalein to‘q pushti. Metallmas oksidi CO₂ suv bilan H₂CO₃ kislotasini hosil qiladi — lakmus qizaradi. Toza suvda lakmus binafsha: indikatorlar kislota va asoslarni farqlaydi.',
    ),
  },

  /* ── Kimyo 9, Практическая работа 1, с. 191 ── */
  {
    id: 'co2',
    source: t('Kimyo 9 · Практическая работа 1', 'Kimyo 9 · Practical work 1', 'Kimyo 9 · 1-amaliy ish'),
    title: t(
      'Получение оксида углерода(IV) и знакомство с его свойствами',
      'Preparing carbon(IV) oxide and studying its properties',
      'Uglerod(IV) oksidini olish va uning xossalari bilan tanishish',
    ),
    equation: 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑',
    kind: 'exchange',
    grade: 9,
    page: 191,
    gear: ['goggles', 'coat'],
    equipment: [
      t('Штатив с лапкой, пробирка с пробкой и газоотводной трубкой', 'A stand with a clamp, a test tube with a stopper and gas outlet tube', 'Panjali shtativ, tiqin va gaz o‘tkazgich nayli probirka'),
      t('Кусочки мрамора (мела) CaCO₃', 'Pieces of marble (chalk) CaCO₃', 'Marmar (bo‘r) bo‘lakchalari CaCO₃'),
      t('Разбавленная соляная кислота HCl', 'Dilute hydrochloric acid HCl', 'Suyultirilgan xlorid kislota HCl'),
      t('Известковая вода Ca(OH)₂, дистиллированная вода', 'Limewater Ca(OH)₂, distilled water', 'Ohakli suv Ca(OH)₂, distillangan suv'),
      t('Синий лакмус; раствор NaOH с фенолфталеином', 'Blue litmus; NaOH solution with phenolphthalein', 'Ko‘k lakmus; fenolftaleinli NaOH eritmasi'),
    ],
    safety: [S_ACID, S_MOUTH, S_SMALL],
    steps: [
      GEAR_STEP(false),
      {
        id: 'marble',
        target: 'marble',
        instruction: t('Положите в пробирку несколько кусочков мрамора CaCO₃.', 'Put a few pieces of marble CaCO₃ into the test tube.', 'Probirkaga bir necha bo‘lak marmar CaCO₃ soling.'),
        observation: t('Белые кусочки мрамора лежат на дне пробирки.', 'White pieces of marble lie at the bottom of the tube.', 'Oq marmar bo‘lakchalari probirka tubida yotibdi.'),
      },
      {
        id: 'acid',
        target: 'bottle-hcl',
        instruction: t('Налейте немного соляной кислоты.', 'Pour in a little hydrochloric acid.', 'Ozgina xlorid kislota quying.'),
        observation: t(
          'Мрамор «вскипает» — бурно выделяются пузырьки бесцветного газа CO₂.',
          'The marble “fizzes”: bubbles of a colourless gas, CO₂, are given off vigorously.',
          'Marmar «qaynaydi» — rangsiz CO₂ gazi pufakchalari shiddat bilan ajraladi.',
        ),
      },
      {
        id: 'stopper',
        target: 'stopper',
        instruction: t('Закройте пробирку пробкой с газоотводной трубкой.', 'Close the tube with the stopper and gas outlet tube.', 'Probirkani gaz o‘tkazgich nayli tiqin bilan yoping.'),
        observation: t('Углекислый газ выходит только через трубку.', 'Carbon dioxide now leaves only through the outlet tube.', 'Karbonat angidrid endi faqat nay orqali chiqadi.'),
      },
      {
        id: 'limewater',
        target: 'outlet',
        instruction: t('Опустите конец трубки в пробирку с 2–3 мл известковой воды.', 'Lower the end of the outlet tube into a tube with 2–3 mL of limewater.', 'Nay uchini 2–3 ml ohakli suvli probirkaga tushiring.'),
        observation: t(
          'Известковая вода мутнеет — выпадает белый CaCO₃↓. Это качественная реакция на CO₂.',
          'The limewater turns milky: white CaCO₃↓ forms. This is the test for CO₂.',
          'Ohakli suv loyqalanadi — oq CaCO₃↓ cho‘kadi. Bu CO₂ ga sifat reaksiyasi.',
        ),
      },
      {
        id: 'excess',
        target: 'tube-lime',
        instruction: t('Пропускайте газ дальше и наблюдайте.', 'Keep passing the gas and watch.', 'Gazni o‘tkazishni davom ettiring va kuzating.'),
        observation: t(
          'Муть исчезает, раствор снова прозрачный: CaCO₃ превращается в растворимый гидрокарбонат Ca(HCO₃)₂.',
          'The milkiness disappears and the solution is clear again: CaCO₃ turns into soluble calcium hydrogencarbonate Ca(HCO₃)₂.',
          'Loyqa yo‘qoladi, eritma yana tiniq: CaCO₃ eriydigan kalsiy gidrokarbonat Ca(HCO₃)₂ ga aylanadi.',
        ),
      },
      {
        id: 'water',
        target: 'outlet',
        instruction: t('Опустите трубку в дистиллированную воду и пропускайте газ 1–2 мин.', 'Put the outlet tube into distilled water and pass the gas for 1–2 min.', 'Nayni distillangan suvga tushiring va gazni 1–2 daqiqa o‘tkazing.'),
        observation: t('Газ проходит пузырьками, часть CO₂ растворяется в воде.', 'The gas passes through as bubbles; some CO₂ dissolves in the water.', 'Gaz pufakchalar bo‘lib o‘tadi, CO₂ ning bir qismi suvda eriydi.'),
      },
      {
        id: 'litmus',
        target: 'litmus',
        instruction: t('Выньте трубку и добавьте несколько капель синего лакмуса.', 'Take the tube out and add a few drops of blue litmus.', 'Nayni chiqaring va bir necha tomchi ko‘k lakmus qo‘shing.'),
        observation: t('Лакмус краснеет — в растворе угольная кислота H₂CO₃.', 'The litmus turns red: the solution contains carbonic acid H₂CO₃.', 'Lakmus qizaradi — eritmada karbonat kislota H₂CO₃ bor.'),
      },
      {
        id: 'alkali',
        target: 'outlet',
        instruction: t('Пропустите газ через раствор NaOH с фенолфталеином.', 'Pass the gas through the NaOH solution with phenolphthalein.', 'Gazni fenolftaleinli NaOH eritmasidan o‘tkazing.'),
        observation: t(
          'Малиновая окраска постепенно исчезает: кислотный оксид CO₂ реагирует со щёлочью.',
          'The crimson colour slowly fades: the acidic oxide CO₂ reacts with the alkali.',
          'To‘q pushti rang asta-sekin yo‘qoladi: kislotali oksid CO₂ ishqor bilan reaksiyaga kirishadi.',
        ),
      },
    ],
    conclusion: t(
      'Углекислый газ получают действием соляной кислоты на мрамор. CO₂ — бесцветный газ, тяжелее воздуха; его узнают по помутнению известковой воды, а при избытке CO₂ осадок растворяется. CO₂ — кислотный оксид: с водой даёт угольную кислоту (лакмус краснеет), со щёлочью реагирует (фенолфталеин обесцвечивается).',
      'Carbon dioxide is made by the action of hydrochloric acid on marble. CO₂ is a colourless gas, heavier than air; it is detected by limewater turning milky, and with excess CO₂ the precipitate dissolves. CO₂ is an acidic oxide: with water it gives carbonic acid (litmus turns red) and it reacts with alkalis (phenolphthalein loses its colour).',
      'Karbonat angidrid marmarga xlorid kislota ta’sir ettirib olinadi. CO₂ — rangsiz, havodan og‘ir gaz; uni ohakli suvning loyqalanishidan bilishadi, CO₂ ortiqcha bo‘lsa cho‘kma eriydi. CO₂ — kislotali oksid: suv bilan karbonat kislota beradi (lakmus qizaradi), ishqor bilan reaksiyaga kirishadi (fenolftalein rangsizlanadi).',
    ),
  },

  /* ── Kimyo 7, § 5.6, с. 124 ── */
  {
    id: 'metals-acids',
    source: t('Kimyo 7 · § 5.6 · Практическое занятие', 'Kimyo 7 · § 5.6 · Practical lesson', 'Kimyo 7 · 5.6-§ · Amaliy mashg‘ulot'),
    title: t('Взаимодействие кислот с металлами', 'Reaction of acids with metals', 'Kislotalarning metallar bilan o‘zaro ta’siri'),
    equation: 'Mg + H₂SO₄ → MgSO₄ + H₂↑',
    kind: 'substitution',
    grade: 7,
    page: 124,
    gear: ['goggles', 'coat'],
    equipment: [
      t('Штатив с тремя пробирками', 'A rack with three test tubes', 'Uchta probirkali shtativ'),
      t('Магниевые стружки Mg, гранулы цинка Zn, медные стружки Cu', 'Magnesium turnings Mg, zinc granules Zn, copper turnings Cu', 'Magniy qirindilari Mg, rux granulalari Zn, mis qirindilari Cu'),
      t('Разбавленная серная кислота H₂SO₄ (1 часть кислоты и 5 частей воды)', 'Dilute sulfuric acid H₂SO₄ (1 part acid to 5 parts water)', 'Suyultirilgan sulfat kislota H₂SO₄ (1 qism kislota va 5 qism suv)'),
      t('Разбавленная соляная кислота HCl', 'Dilute hydrochloric acid HCl', 'Suyultirilgan xlorid kislota HCl'),
      t('Спички', 'Matches', 'Gugurt'),
    ],
    safety: [
      S_ACID,
      t(
        'Горение водорода сопровождается взрывом: водорода в пробирке должно быть не больше 1/3 её объёма.',
        'Hydrogen burns with a bang: the hydrogen in a tube must be no more than 1/3 of its volume.',
        'Vodorodning yonishi portlash bilan boradi: probirkadagi vodorod hajmining 1/3 qismidan oshmasligi kerak.',
      ),
      S_MOUTH,
    ],
    steps: [
      GEAR_STEP(false),
      {
        id: 'mg',
        target: 'mg',
        instruction: t('Поместите в пробирку 1 магниевые стружки.', 'Put magnesium turnings into tube 1.', '1-probirkaga magniy qirindilarini soling.'),
        observation: t('На дне пробирки — серебристые стружки магния.', 'Silvery magnesium turnings lie at the bottom of the tube.', 'Probirka tubida — kumushrang magniy qirindilari.'),
      },
      {
        id: 'mg-acid',
        target: 'bottle-h2so4',
        instruction: t('Прилейте разбавленную серную кислоту.', 'Add dilute sulfuric acid.', 'Suyultirilgan sulfat kislota quying.'),
        observation: t(
          'Магний активно реагирует с кислотой: бурно выделяются пузырьки газа.',
          'Magnesium reacts actively with the acid: gas bubbles are given off vigorously.',
          'Magniy kislota bilan faol reaksiyaga kirishadi: gaz pufakchalari shiddat bilan ajraladi.',
        ),
      },
      {
        id: 'test',
        target: 'match',
        instruction: t('Поднесите горящую спичку к отверстию пробирки.', 'Bring a burning match to the mouth of the tube.', 'Yonib turgan gugurtni probirka og‘ziga yaqinlashtiring.'),
        observation: t(
          'Слышен хлопок (небольшой взрыв), яркого горения спички нет — это водород H₂.',
          'A pop is heard (a small explosion) and the match does not flare up: the gas is hydrogen H₂.',
          'Qarsillash (kichik portlash) eshitiladi, gugurt yorqin yonmaydi — bu vodorod H₂.',
        ),
      },
      {
        id: 'zn',
        target: 'zn',
        instruction: t('Осторожно насыпьте в пробирку 2 гранулы цинка.', 'Carefully put zinc granules into tube 2.', '2-probirkaga ehtiyotlik bilan rux granulalarini soling.'),
        observation: t('На дне пробирки — серые гранулы цинка.', 'Grey zinc granules lie at the bottom of the tube.', 'Probirka tubida — kulrang rux granulalari.'),
      },
      {
        id: 'zn-acid',
        target: 'bottle-hcl',
        instruction: t('Прилейте разбавленную соляную кислоту.', 'Add dilute hydrochloric acid.', 'Suyultirilgan xlorid kislota quying.'),
        observation: t(
          'Вскоре поверхность гранул покрывается пузырьками газа — реакция идёт спокойнее, чем с магнием.',
          'Soon the surface of the granules is covered with gas bubbles: the reaction is calmer than with magnesium.',
          'Tez orada granulalar sirti gaz pufakchalari bilan qoplanadi — reaksiya magniyga qaraganda sokinroq boradi.',
        ),
      },
      {
        id: 'cu',
        target: 'cu',
        instruction: t('Положите в пробирку 3 медные стружки.', 'Put copper turnings into tube 3.', '3-probirkaga mis qirindilarini soling.'),
        observation: t('На дне пробирки — красно-коричневые стружки меди.', 'Reddish-brown copper turnings lie at the bottom of the tube.', 'Probirka tubida — qizg‘ish-jigarrang mis qirindilari.'),
      },
      {
        id: 'cu-acid',
        target: 'bottle-hcl',
        instruction: t('Прилейте к меди разбавленную соляную кислоту.', 'Add dilute hydrochloric acid to the copper.', 'Misga suyultirilgan xlorid kislota quying.'),
        observation: t(
          'Изменений нет: цвет меди и раствора не меняется, газ не выделяется — медь не вытесняет водород из кислоты.',
          'No change: the colour of the copper and of the solution stays the same and no gas forms; copper does not displace hydrogen from the acid.',
          'O‘zgarish yo‘q: mis va eritma rangi o‘zgarmaydi, gaz ajralmaydi — mis kislotadan vodorodni siqib chiqarmaydi.',
        ),
      },
      {
        id: 'compare',
        target: 'rack',
        instruction: t('Сравните три пробирки.', 'Compare the three tubes.', 'Uchta probirkani taqqoslang.'),
        observation: t(
          'Mg — бурно, Zn — спокойнее, Cu — не реагирует. Mg и Zn стоят в ряду активности до водорода, Cu — после.',
          'Mg reacts vigorously, Zn more calmly, Cu not at all. Mg and Zn stand before hydrogen in the activity series, Cu after it.',
          'Mg — shiddatli, Zn — sokinroq, Cu — reaksiyaga kirishmaydi. Faollik qatorida Mg va Zn vodoroddan oldin, Cu — keyin turadi.',
        ),
      },
    ],
    conclusion: t(
      'Металлы, стоящие в ряду активности до водорода (Mg, Zn), вытесняют водород из кислот — это реакция замещения; чем активнее металл, тем бурнее идёт реакция. Медь стоит после водорода и с соляной кислотой не реагирует.',
      'Metals that stand before hydrogen in the activity series (Mg, Zn) displace hydrogen from acids: this is a substitution reaction, and the more active the metal, the more vigorous the reaction. Copper stands after hydrogen and does not react with hydrochloric acid.',
      'Faollik qatorida vodoroddan oldin turgan metallar (Mg, Zn) kislotalardan vodorodni siqib chiqaradi — bu o‘rin olish reaksiyasi; metall qancha faol bo‘lsa, reaksiya shuncha shiddatli boradi. Mis vodoroddan keyin turadi va xlorid kislota bilan reaksiyaga kirishmaydi.',
    ),
  },
]

/** Уравнения из наблюдений (проверяются на баланс). */
export const LAB_WORKS_SIDE_EQUATIONS: Readonly<Record<WorksId, readonly string[]>> = {
  'water-oxides': ['CO₂ + H₂O → H₂CO₃'],
  co2: ['CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O', 'CaCO₃ + CO₂ + H₂O → Ca(HCO₃)₂', 'CO₂ + H₂O → H₂CO₃', 'CO₂ + 2NaOH → Na₂CO₃ + H₂O'],
  'metals-acids': ['Zn + 2HCl → ZnCl₂ + H₂↑', '2H₂ + O₂ → 2H₂O'],
}

/* ── Действия руками ── */
type Act = { readonly gesture: 'tap' | 'drag' | 'swipe'; readonly how: LabText; readonly need?: LabItemId }
const tap = (how: LabText, need?: LabItemId): Act => ({ gesture: 'tap', how, need })
const drag = (how: LabText, need?: LabItemId): Act => ({ gesture: 'drag', how, need })

const GEAR_HOW = t(
  'Нажмите на поднос со средствами защиты (или кнопку «Надеть» на доске).',
  'Tap the tray with the protective gear (or press “Put on” on the board).',
  'Himoya vositalari patnisini bosing (yoki doskadagi «Kiyish» tugmasini).',
)

export const LAB_WORKS_STEP_ACTIONS: Readonly<Record<WorksId, readonly Act[]>> = {
  'water-oxides': [
    tap(GEAR_HOW),
    drag(t('Перетащите шпатель с CaO к пробирке 1 — порошок высыплется.', 'Drag the spatula with CaO to tube 1: the powder pours in.', 'CaO li shpatelni 1-probirkaga torting — kukun to‘kiladi.'), 'reagent:CaO'),
    drag(t('Перетащите склянку с водой к пробирке 1 — вода нальётся струйкой.', 'Drag the water bottle to tube 1: water pours in a thin stream.', 'Suvli shishani 1-probirkaga torting — suv ingichka oqib tushadi.')),
    drag(t('Перетащите бутылку минеральной воды к пробирке 2.', 'Drag the mineral water bottle to tube 2.', 'Mineral suv shishasini 2-probirkaga torting.')),
    drag(t('Перетащите склянку с водой к пробирке 3.', 'Drag the water bottle to tube 3.', 'Suvli shishani 3-probirkaga torting.')),
    drag(t('Перетащите пипетку с фенолфталеином к пробирке 1 — упадут капли.', 'Drag the phenolphthalein dropper to tube 1: drops fall in.', 'Fenolftaleinli tomizgichni 1-probirkaga torting — tomchilar tushadi.')),
    drag(t('Перетащите пипетку с лакмусом к пробирке 2.', 'Drag the litmus dropper to tube 2.', 'Lakmusli tomizgichni 2-probirkaga torting.')),
    drag(t('Перетащите пипетку с лакмусом к пробирке 3.', 'Drag the litmus dropper to tube 3.', 'Lakmusli tomizgichni 3-probirkaga torting.')),
    tap(t('Нажмите на штатив — пробирки поднимутся на белом фоне.', 'Tap the rack: the tubes rise against a white background.', 'Shtativni bosing — probirkalar oq fonda ko‘tariladi.')),
  ],
  co2: [
    tap(GEAR_HOW),
    drag(t('Перетащите кусочки мрамора к пробирке в лапке штатива.', 'Drag the pieces of marble to the tube in the stand clamp.', 'Marmar bo‘lakchalarini shtativ panjasidagi probirkaga torting.')),
    drag(t('Возьмите склянку HCl и перетащите к пробирке — налейте кислоту.', 'Take the HCl bottle and drag it to the tube: pour in the acid.', 'HCl shishasini oling va probirkaga torting — kislota quying.'), 'reagent:HCl'),
    drag(t('Перетащите пробку с газоотводной трубкой на пробирку.', 'Drag the stopper with the outlet tube onto the test tube.', 'Gaz o‘tkazgich nayli tiqinni probirkaga torting.')),
    drag(t('Перетащите конец газоотводной трубки вниз — в известковую воду.', 'Drag the end of the outlet tube down into the limewater.', 'Gaz o‘tkazgich nay uchini pastga — ohakli suvga torting.')),
    tap(t('Нажмите на пробирку с известковой водой — газ пойдёт дальше.', 'Tap the limewater tube: the gas keeps flowing.', 'Ohakli suvli probirkani bosing — gaz o‘tishda davom etadi.')),
    drag(t('Перетащите конец трубки в пробирку с дистиллированной водой.', 'Drag the end of the outlet tube into the tube of distilled water.', 'Nay uchini distillangan suvli probirkaga torting.')),
    drag(t('Перетащите пипетку с синим лакмусом к пробирке с водой.', 'Drag the blue-litmus dropper to the water tube.', 'Ko‘k lakmusli tomizgichni suvli probirkaga torting.')),
    drag(t('Перетащите конец трубки в раствор NaOH с фенолфталеином.', 'Drag the end of the outlet tube into the NaOH solution with phenolphthalein.', 'Nay uchini fenolftaleinli NaOH eritmasiga torting.')),
  ],
  'metals-acids': [
    tap(GEAR_HOW),
    drag(t('Перетащите стружки магния к пробирке 1.', 'Drag the magnesium turnings to tube 1.', 'Magniy qirindilarini 1-probirkaga torting.')),
    drag(t('Возьмите склянку H₂SO₄ и перетащите к пробирке 1.', 'Take the H₂SO₄ bottle and drag it to tube 1.', 'H₂SO₄ shishasini oling va 1-probirkaga torting.'), 'reagent:H2SO4'),
    drag(t('Перетащите горящую спичку к отверстию пробирки 1.', 'Drag the burning match to the mouth of tube 1.', 'Yonib turgan gugurtni 1-probirka og‘ziga torting.')),
    drag(t('Перетащите гранулы цинка к пробирке 2.', 'Drag the zinc granules to tube 2.', 'Rux granulalarini 2-probirkaga torting.'), 'reagent:Zn'),
    drag(t('Перетащите склянку HCl к пробирке 2.', 'Drag the HCl bottle to tube 2.', 'HCl shishasini 2-probirkaga torting.'), 'reagent:HCl'),
    drag(t('Перетащите медные стружки к пробирке 3.', 'Drag the copper turnings to tube 3.', 'Mis qirindilarini 3-probirkaga torting.')),
    drag(t('Перетащите склянку HCl к пробирке 3.', 'Drag the HCl bottle to tube 3.', 'HCl shishasini 3-probirkaga torting.')),
    tap(t('Нажмите на штатив — сравните три пробирки.', 'Tap the rack to compare the three tubes.', 'Shtativni bosing — uchta probirkani taqqoslang.')),
  ],
}

/* ── «Что произошло» ── */
export const LAB_WORKS_STORY: Readonly<Record<WorksId, { readonly equation: string; readonly text: LabText }>> = {
  'water-oxides': {
    equation: 'CaO + H₂O → Ca(OH)₂',
    text: t(
      'Молекула воды присоединяется к оксиду кальция: из одного атома O оксида и молекулы H₂O получаются две группы OH. Образуется основание Ca(OH)₂, выделяется тепло. В растворе основания фенолфталеин малиновый.',
      'A water molecule adds on to calcium oxide: the oxide’s O atom and the H₂O molecule give two OH groups. The base Ca(OH)₂ forms and heat is released. In a solution of a base phenolphthalein is crimson.',
      'Suv molekulasi kalsiy oksidga birikadi: oksiddagi O atomi va H₂O molekulasidan ikkita OH guruhi hosil bo‘ladi. Ca(OH)₂ asosi hosil bo‘ladi, issiqlik ajraladi. Asos eritmasida fenolftalein to‘q pushti.',
    ),
  },
  co2: {
    equation: 'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O',
    text: t(
      'Молекула CO₂ встречает гидроксид кальция из известковой воды. Кальций, углерод и три атома кислорода собираются в нерастворимый карбонат кальция CaCO₃ — это белая муть. Оставшиеся атомы образуют молекулу воды.',
      'A CO₂ molecule meets calcium hydroxide in the limewater. Calcium, carbon and three oxygen atoms come together as insoluble calcium carbonate CaCO₃, the white milkiness. The remaining atoms form a water molecule.',
      'CO₂ molekulasi ohakli suvdagi kalsiy gidroksid bilan uchrashadi. Kalsiy, uglerod va uchta kislorod atomi erimaydigan kalsiy karbonat CaCO₃ ga yig‘iladi — bu oq loyqa. Qolgan atomlar suv molekulasini hosil qiladi.',
    ),
  },
  'metals-acids': {
    equation: 'Mg + 2H⁺ → Mg²⁺ + H₂↑',
    text: t(
      'Атом магния отдаёт два электрона двум ионам водорода H⁺ из кислоты. Магний переходит в раствор (MgSO₄), а атомы водорода соединяются в молекулу H₂. Медь стоит после водорода — её атомы не отдают электроны ионам H⁺.',
      'A magnesium atom gives two electrons to two hydrogen ions H⁺ from the acid. Magnesium goes into the solution (MgSO₄) and the hydrogen atoms join into an H₂ molecule. Copper stands after hydrogen: its atoms do not give electrons to H⁺ ions.',
      'Magniy atomi kislotadagi ikkita vodorod ioni H⁺ ga ikkita elektron beradi. Magniy eritmaga o‘tadi (MgSO₄), vodorod atomlari esa H₂ molekulasiga birikadi. Mis vodoroddan keyin turadi — uning atomlari H⁺ ionlariga elektron bermaydi.',
    ),
  },
}

/* ── Мини-проверка ── */
type Q = { readonly id: 'sign' | 'type' | 'product'; readonly q: LabText; readonly options: readonly LabText[]; readonly correct: number; readonly why: LabText }
const SIGN_Q = t('Какой признак реакции вы наблюдали?', 'Which sign of a reaction did you observe?', 'Qaysi reaksiya belgisini kuzatdingiz?')
const TYPE_Q = t('К какому типу относится реакция?', 'What type of reaction is it?', 'Reaksiya qaysi turga kiradi?')
const T_EXCHANGE = t('Обмена', 'Exchange', 'Almashinish')
const T_SUBST = t('Замещения', 'Substitution', 'O‘rin olish')
const T_COMB = t('Соединения', 'Combination', 'Birikish')
const T_DECOMP = t('Разложения', 'Decomposition', 'Parchalanish')

export const LAB_WORKS_QUIZ: Readonly<Record<WorksId, readonly Q[]>> = {
  'water-oxides': [
    {
      id: 'sign',
      q: SIGN_Q,
      options: [
        t('Выделилось тепло (разогрев, пар)', 'Heat was given off (warming, steam)', 'Issiqlik ajraldi (qizish, bug‘)'),
        t('Выпал осадок', 'A precipitate formed', 'Cho‘kma tushdi'),
        t('Появился запах', 'A smell appeared', 'Hid paydo bo‘ldi'),
      ],
      correct: 0,
      why: t('CaO с водой сильно разогрелся — реакция идёт с выделением тепла.', 'CaO got very hot with water: the reaction gives off heat.', 'CaO suv bilan kuchli qizidi — reaksiya issiqlik chiqarib boradi.'),
    },
    {
      id: 'type',
      q: TYPE_Q,
      options: [T_EXCHANGE, T_COMB, T_DECOMP],
      correct: 1,
      why: t('Из двух веществ (CaO и H₂O) образовалось одно — Ca(OH)₂.', 'Two substances (CaO and H₂O) formed one: Ca(OH)₂.', 'Ikki moddadan (CaO va H₂O) bitta — Ca(OH)₂ hosil bo‘ldi.'),
    },
    {
      id: 'product',
      q: t('Какой индикатор и в каком цвете показал основание?', 'Which indicator showed the base, and in what colour?', 'Qaysi indikator asosni qaysi rangda ko‘rsatdi?'),
      options: [
        t('Фенолфталеин — малиновый', 'Phenolphthalein: crimson', 'Fenolftalein — to‘q pushti'),
        t('Лакмус — красный', 'Litmus: red', 'Lakmus — qizil'),
        t('Лакмус — фиолетовый', 'Litmus: violet', 'Lakmus — binafsha'),
      ],
      correct: 0,
      why: t('В растворе основания Ca(OH)₂ фенолфталеин малиновый; красный лакмус — признак кислоты, фиолетовый — нейтральной воды.', 'In the base Ca(OH)₂ phenolphthalein is crimson; red litmus means an acid, violet means neutral water.', 'Ca(OH)₂ asosi eritmasida fenolftalein to‘q pushti; qizil lakmus — kislota, binafsha — neytral suv belgisi.'),
    },
  ],
  co2: [
    {
      id: 'sign',
      q: t('Как узнать углекислый газ?', 'How can carbon dioxide be detected?', 'Karbonat angidridni qanday aniqlash mumkin?'),
      options: [
        t('Известковая вода мутнеет', 'Limewater turns milky', 'Ohakli suv loyqalanadi'),
        t('Тлеющая лучина вспыхивает', 'A glowing splint bursts into flame', 'Cho‘g‘langan cho‘p alangalanadi'),
        t('Слышен хлопок у пламени', 'A pop is heard at the flame', 'Alanga yonida qarsillash eshitiladi'),
      ],
      correct: 0,
      why: t('Помутнение известковой воды (CaCO₃↓) — качественная реакция на CO₂.', 'Limewater turning milky (CaCO₃↓) is the test for CO₂.', 'Ohakli suvning loyqalanishi (CaCO₃↓) — CO₂ ga sifat reaksiyasi.'),
    },
    {
      id: 'type',
      q: TYPE_Q,
      options: [T_SUBST, T_EXCHANGE, T_COMB],
      correct: 1,
      why: t('CaCO₃ и HCl обмениваются составными частями; образующаяся H₂CO₃ распадается на H₂O и CO₂.', 'CaCO₃ and HCl swap parts; the H₂CO₃ formed breaks down into H₂O and CO₂.', 'CaCO₃ va HCl tarkibiy qismlarini almashadi; hosil bo‘lgan H₂CO₃ H₂O va CO₂ ga parchalanadi.'),
    },
    {
      id: 'product',
      q: t('Почему при избытке CO₂ муть исчезла?', 'Why did the milkiness disappear with excess CO₂?', 'Nega CO₂ ortiqcha bo‘lganda loyqa yo‘qoldi?'),
      options: [
        t('CaCO₃ превратился в растворимый Ca(HCO₃)₂', 'CaCO₃ turned into soluble Ca(HCO₃)₂', 'CaCO₃ eriydigan Ca(HCO₃)₂ ga aylandi'),
        t('Осадок улетел вместе с газом', 'The precipitate flew off with the gas', 'Cho‘kma gaz bilan uchib ketdi'),
        t('Известковая вода испарилась', 'The limewater evaporated', 'Ohakli suv bug‘lanib ketdi'),
      ],
      correct: 0,
      why: t('CaCO₃ + CO₂ + H₂O → Ca(HCO₃)₂ — гидрокарбонат кальция растворим в воде.', 'CaCO₃ + CO₂ + H₂O → Ca(HCO₃)₂: calcium hydrogencarbonate dissolves in water.', 'CaCO₃ + CO₂ + H₂O → Ca(HCO₃)₂ — kalsiy gidrokarbonat suvda eriydi.'),
    },
  ],
  'metals-acids': [
    {
      id: 'sign',
      q: SIGN_Q,
      options: [t('Выделился газ', 'A gas was given off', 'Gaz ajraldi'), t('Выпал осадок', 'A precipitate formed', 'Cho‘kma tushdi'), t('Изменился цвет', 'The colour changed', 'Rang o‘zgardi')],
      correct: 0,
      why: t('С магнием и цинком выделялись пузырьки водорода.', 'Bubbles of hydrogen were given off with magnesium and zinc.', 'Magniy va rux bilan vodorod pufakchalari ajraldi.'),
    },
    {
      id: 'type',
      q: TYPE_Q,
      options: [T_EXCHANGE, T_DECOMP, T_SUBST],
      correct: 2,
      why: t('Простое вещество Mg замещает водород в кислоте H₂SO₄.', 'The simple substance Mg replaces hydrogen in the acid H₂SO₄.', 'Oddiy modda Mg H₂SO₄ kislotasidagi vodorod o‘rnini oladi.'),
    },
    {
      id: 'product',
      q: t('Какой металл не вытесняет водород из кислоты?', 'Which metal does not displace hydrogen from an acid?', 'Qaysi metall kislotadan vodorodni siqib chiqarmaydi?'),
      options: [t('Магний Mg', 'Magnesium Mg', 'Magniy Mg'), t('Цинк Zn', 'Zinc Zn', 'Rux Zn'), t('Медь Cu', 'Copper Cu', 'Mis Cu')],
      correct: 2,
      why: t('Медь стоит в ряду активности после водорода.', 'Copper stands after hydrogen in the activity series.', 'Mis faollik qatorida vodoroddan keyin turadi.'),
    },
  ],
}
