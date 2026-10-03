/**
 * Практические и лабораторные работы 3D-лаборатории (по учебникам Kimyo):
 *  • 'salt-purify' — Kimyo 7, § 1.6, с. 24–25: «Практическое занятие. Очистка загрязнённой поваренной соли»
 *    (растворение, подготовка фильтра, фильтрование по палочке, выпаривание фильтрата в фарфоровой чашке);
 *  • 'nh3' — Kimyo 8, Практическая работа 3 (§ 39, с. 168–169): «Получение аммиака и проведение с ним опытов»
 *    (смесь NH₄Cl и гашёной извести в ступке, нагревание, сбор в пробирку вверх дном, запах — только помахиванием,
 *    красный лакмус синеет; NH₃ + HCl = NH₄Cl — § 37, с. 160);
 *  • 'halogens' — Kimyo 8, Лабораторная работа 5 (с. 202): «Вытеснение галогенов из их растворов»
 *    (NaBr и NaI + хлорная вода, NaI + бромная вода, NaCl + бромная вода — изменений нет; крахмальный клейстер
 *    с йодом — синий, Лабораторная работа 3, п. 5, с. 201).
 * Тексты RU/EN/UZ; цели шагов — объекты установок (rigTargets.ts).
 */
import type { LabExperimentDef, LabExperimentId, LabText } from '../../components/lab3d/labContract'
import type { LabItemId } from '../../components/lab3d/labEvents'

const t = (ru: string, en: string, uz: string): LabText => ({ ru, en, uz })

type PracticalId = Extract<LabExperimentId, 'salt-purify' | 'nh3' | 'halogens'>

const S_GOGGLES = t('Работайте в защитных очках и халате.', 'Wear safety goggles and a lab coat.', 'Himoya ko‘zoynagi va xalatda ishlang.')
const S_LAMP = t(
  'Спиртовку зажигайте только спичкой, гасите — колпачком; не задувайте пламя.',
  'Light the spirit lamp only with a match and put it out with the cap; never blow the flame out.',
  'Spirt lampasini faqat gugurt bilan yoqing, qalpoqcha bilan o‘chiring; alangani puflamang.',
)
const S_SMELL = t(
  'Запах газа определяйте только помахиванием руки от отверстия к себе — не наклоняйтесь к пробирке.',
  'Smell a gas only by wafting it towards you with your hand; never bend over the tube.',
  'Gaz hidini faqat qo‘l bilan probirka og‘zidan o‘zingizga yelpib aniqlang — probirkaga engashmang.',
)
const S_HOOD = t('Опыт проводите в вытяжном шкафу (тяга включена).', 'Do the experiment in the fume hood (fan on).', 'Tajribani mo‘rili shkafda o‘tkazing (tortish yoqilgan).')

export const LAB_PRACTICAL_EXPERIMENTS: readonly LabExperimentDef[] = [
  /* ── Kimyo 7, § 1.6: очистка загрязнённой поваренной соли ── */
  {
    id: 'salt-purify',
    source: t('§ 1.6 · Практическое занятие', '§ 1.6 · Practical work', '§ 1.6 · Amaliy mashg‘ulot'),
    title: t('Очистка загрязнённой поваренной соли', 'Purifying contaminated table salt', 'Ifloslangan osh tuzini tozalash'),
    equation: 'NaCl (+ SiO₂) → NaCl',
    kind: 'physical',
    grade: 7,
    page: 24,
    equipment: [
      t('Лабораторный штатив с кольцом (2 шт.)', 'Laboratory stand with a ring (2)', 'Halqali laboratoriya shtativi (2 ta)'),
      t('Химический стакан (2 шт.), стеклянная палочка', 'Beakers (2), glass rod', 'Kimyoviy stakan (2 ta), shisha tayoqcha'),
      t('Воронка, фильтровальная бумага', 'Funnel, filter paper', 'Voronka, filtr qog‘oz'),
      t('Фарфоровая чашка, спиртовка, спички', 'Porcelain dish, spirit lamp, matches', 'Chinni kosacha, spirt lampasi, gugurt'),
      t('Загрязнённая поваренная соль, дистиллированная вода (20 мл)', 'Contaminated table salt, distilled water (20 mL)', 'Ifloslangan osh tuzi, distillangan suv (20 ml)'),
    ],
    safety: [
      S_GOGGLES,
      S_LAMP,
      t(
        'Горячую фарфоровую чашку не трогайте руками; раствор перемешивайте палочкой, чтобы он не разбрызгивался.',
        'Do not touch the hot porcelain dish; stir the solution with a rod so that it does not spatter.',
        'Issiq chinni kosachani qo‘l bilan ushlamang; eritma sachramasligi uchun uni tayoqcha bilan aralashtiring.',
      ),
      t('Ничего не пробуйте на вкус, даже соль.', 'Never taste anything in the lab, not even salt.', 'Laboratoriyada hech narsani, hatto tuzni ham tatib ko‘rmang.'),
    ],
    steps: [
      {
        id: 'add-salt',
        target: 'salt-dish',
        instruction: t(
          'Понемногу добавляйте загрязнённую соль в стакан с 20 мл дистиллированной воды.',
          'Add the contaminated salt little by little to a beaker with 20 mL of distilled water.',
          'Ifloslangan tuzni 20 ml distillangan suvli stakanga oz-ozdan qo‘shing.',
        ),
        observation: t(
          'Вода мутнеет: в ней плавают песчинки и соринки.',
          'The water turns cloudy: grains of sand and dirt float in it.',
          'Suv loyqalanadi: unda qum zarralari va axlatlar suzadi.',
        ),
      },
      {
        id: 'dissolve',
        target: 'stir-rod',
        instruction: t(
          'Перемешивайте стеклянной палочкой, пока соль не перестанет растворяться.',
          'Stir with a glass rod until the salt stops dissolving.',
          'Tuz erishdan to‘xtaguncha shisha tayoqcha bilan aralashtiring.',
        ),
        observation: t(
          'Кристаллы соли исчезли — соль растворилась; песок не растворяется, раствор остаётся мутным.',
          'The salt crystals have gone: the salt dissolved; the sand does not dissolve and the solution stays cloudy.',
          'Tuz kristallari yo‘qoldi — tuz eridi; qum erimaydi, eritma loyqa qoladi.',
        ),
      },
      {
        id: 'fold',
        target: 'filter',
        instruction: t(
          'Сложите квадрат фильтровальной бумаги вчетверо и расправьте конусом.',
          'Fold the square of filter paper in four and open it into a cone.',
          'Filtr qog‘oz kvadratini to‘rt buklang va konus shaklida yoying.',
        ),
        observation: t(
          'Получился конический фильтр — он должен быть на 0,5 см ниже края воронки.',
          'You have a cone-shaped filter: it should sit 0.5 cm below the rim of the funnel.',
          'Konussimon filtr hosil bo‘ldi — u voronka chetidan 0,5 sm pastda bo‘lishi kerak.',
        ),
      },
      {
        id: 'filter-in',
        target: 'filter',
        instruction: t('Вставьте фильтр в воронку на кольце штатива.', 'Put the filter into the funnel on the stand ring.', 'Filtrni shtativ halqasidagi voronkaga joylang.'),
        observation: t(
          'Фильтр прилегает к стенкам воронки, под воронкой — чистый стакан.',
          'The filter fits against the funnel walls; a clean beaker stands under the funnel.',
          'Filtr voronka devorlariga yopishadi, voronka ostida toza stakan turibdi.',
        ),
      },
      {
        id: 'filter',
        target: 'beaker-mix',
        instruction: t(
          'Медленно влейте мутный раствор в фильтр по стеклянной палочке, прижатой к стенке фильтра.',
          'Slowly pour the cloudy solution into the filter along a glass rod held against the filter wall.',
          'Loyqa eritmani filtr devoriga tiralgan shisha tayoqcha bo‘ylab filtrga sekin quying.',
        ),
        observation: t(
          'Через фильтр проходит прозрачный раствор — фильтрат; песок и грязь остаются на фильтре.',
          'A clear solution, the filtrate, passes through the filter; sand and dirt stay on the filter.',
          'Filtrdan tiniq eritma — filtrat o‘tadi; qum va iflosliklar filtrda qoladi.',
        ),
      },
      {
        id: 'to-dish',
        target: 'beaker-filtrate',
        instruction: t(
          'Перелейте фильтрат в фарфоровую чашку на кольце второго штатива.',
          'Pour the filtrate into the porcelain dish on the ring of the second stand.',
          'Filtratni ikkinchi shtativ halqasidagi chinni kosachaga quying.',
        ),
        observation: t('В чашке — прозрачный раствор соли.', 'The dish holds a clear salt solution.', 'Kosachada tiniq tuz eritmasi.'),
      },
      {
        id: 'heat',
        target: 'spirit-lamp',
        instruction: t(
          'Снимите колпачок и зажгите спиртовку спичкой — пламя должно касаться дна чашки.',
          'Take off the cap and light the spirit lamp with a match: the flame should touch the bottom of the dish.',
          'Qalpoqchani oling va spirt lampasini gugurt bilan yoqing — alanga kosacha tubiga tegishi kerak.',
        ),
        observation: t('Раствор нагревается, над чашкой появляется пар.', 'The solution heats up and steam rises above the dish.', 'Eritma qiziydi, kosacha ustida bug‘ paydo bo‘ladi.'),
      },
      {
        id: 'evaporate',
        target: 'dish-rod',
        instruction: t(
          'Выпаривайте раствор, перемешивая палочкой, чтобы он не разбрызгивался.',
          'Evaporate the solution, stirring with a rod so that it does not spatter.',
          'Eritmani sachramasligi uchun tayoqcha bilan aralashtirib bug‘lating.',
        ),
        observation: t(
          'Вода испаряется, на дне и по краям чашки появляются белые кристаллы соли.',
          'The water evaporates; white salt crystals appear on the bottom and around the edges of the dish.',
          'Suv bug‘lanadi, kosacha tubida va chetlarida oq tuz kristallari paydo bo‘ladi.',
        ),
      },
      {
        id: 'stop',
        target: 'lamp-cap',
        instruction: t(
          'Как только появились кристаллы, прекратите нагревание — накройте пламя колпачком.',
          'As soon as crystals appear, stop heating: cover the flame with the cap.',
          'Kristallar paydo bo‘lishi bilan qizdirishni to‘xtating — alangani qalpoqcha bilan yoping.',
        ),
        observation: t(
          'Пламя погасло. В чашке — чистая белая поваренная соль NaCl.',
          'The flame is out. The dish holds clean white table salt NaCl.',
          'Alanga o‘chdi. Kosachada toza oq osh tuzi NaCl.',
        ),
      },
    ],
    conclusion: t(
      'Растворение, фильтрование и выпаривание — физические явления: новые вещества не образуются. Нерастворимые примеси (песок) задерживает фильтр, вода испаряется, а растворённая соль остаётся в чашке чистой — так из смеси выделяют чистое вещество.',
      'Dissolving, filtering and evaporating are physical changes: no new substances are formed. The filter holds back the insoluble impurities (sand), the water evaporates and the dissolved salt stays in the dish, now pure: this is how a pure substance is separated from a mixture.',
      'Eritish, filtrlash va bug‘latish — fizik hodisalar: yangi moddalar hosil bo‘lmaydi. Erimaydigan aralashmalarni (qum) filtr ushlab qoladi, suv bug‘lanadi, erigan tuz esa kosachada toza holda qoladi — aralashmadan toza modda shunday ajratiladi.',
    ),
    place: 'bench',
  },

  /* ── Kimyo 8, Практическая работа 3: получение аммиака ── */
  {
    id: 'nh3',
    source: t('Практическая работа 3 · § 39', 'Practical work 3 · § 39', '3-amaliy ish · § 39'),
    title: t('Получение аммиака и опыты с ним', 'Obtaining ammonia and experiments with it', 'Ammiak olish va u bilan tajribalar'),
    equation: '2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O',
    kind: 'exchange',
    grade: 8,
    page: 169,
    equipment: [
      t('Фарфоровая ступка с пестиком', 'Porcelain mortar and pestle', 'Chinni hovoncha va dasta'),
      t('Хлорид аммония NH₄Cl, гашёная известь Ca(OH)₂', 'Ammonium chloride NH₄Cl, slaked lime Ca(OH)₂', 'Ammoniy xlorid NH₄Cl, so‘ndirilgan ohak Ca(OH)₂'),
      t('Пробирка с пробкой и газоотводной трубкой, сухая пробирка', 'Test tube with a stopper and gas outlet tube, a dry test tube', 'Tiqinli va gaz o‘tkazgich nayli probirka, quruq probirka'),
      t('Штатив с лапками, спиртовка, спички', 'Stand with clamps, spirit lamp, matches', 'Panjali shtativ, spirt lampasi, gugurt'),
      t('Красная лакмусовая бумажка, концентрированная соляная кислота HCl, стеклянная палочка', 'Red litmus paper, concentrated hydrochloric acid HCl, glass rod', 'Qizil lakmus qog‘oz, konsentrlangan xlorid kislota HCl, shisha tayoqcha'),
    ],
    safety: [
      S_HOOD,
      t('Наденьте очки, перчатки и халат.', 'Put on goggles, gloves and a lab coat.', 'Ko‘zoynak, qo‘lqop va xalat kiying.'),
      S_SMELL,
      t(
        'Пробирку со смесью закрепляйте отверстием немного вниз: капли воды не должны стекать на горячее дно.',
        'Clamp the tube with its mouth slightly down: water droplets must not run back onto the hot bottom.',
        'Aralashmali probirkani og‘zini biroz pastga qaratib mahkamlang: suv tomchilari issiq tubga oqib tushmasligi kerak.',
      ),
      S_LAMP,
    ],
    steps: [
      {
        id: 'gear',
        target: 'ppe',
        instruction: t('Наденьте защитные очки, перчатки и халат.', 'Put on safety goggles, gloves and a lab coat.', 'Himoya ko‘zoynagi, qo‘lqop va xalat kiying.'),
        observation: t('Вы защищены: аммиак едкий, а концентрированная HCl дымит.', 'You are protected: ammonia is pungent and concentrated HCl fumes.', 'Siz himoyalangansiz: ammiak o‘tkir, konsentrlangan HCl esa tutaydi.'),
      },
      {
        id: 'mix',
        target: 'pestle',
        instruction: t(
          'В ступке хорошенько разотрите пестиком равные объёмы NH₄Cl и гашёной извести.',
          'In the mortar, grind equal volumes of NH₄Cl and slaked lime well with the pestle.',
          'Hovonchada NH₄Cl va so‘ndirilgan ohakning teng hajmlarini dasta bilan yaxshilab ezing.',
        ),
        observation: t('Получилась однородная белая смесь; уже слышен слабый запах аммиака.', 'A uniform white mixture forms; a faint smell of ammonia is already noticeable.', 'Bir jinsli oq aralashma hosil bo‘ldi; ammiakning kuchsiz hidi seziladi.'),
      },
      {
        id: 'fill',
        target: 'mortar',
        instruction: t('Заполните смесью 1/3 пробирки.', 'Fill one third of the test tube with the mixture.', 'Probirkaning 1/3 qismini aralashma bilan to‘ldiring.'),
        observation: t('Смесь в пробирке — примерно на треть её высоты.', 'The mixture fills about a third of the tube.', 'Aralashma probirkaning taxminan uchdan bir qismida.'),
      },
      {
        id: 'assemble',
        target: 'reactor-tube',
        instruction: t(
          'Закройте пробирку пробкой с газоотводной трубкой и закрепите в лапке штатива отверстием немного вниз.',
          'Close the tube with the stopper and gas outlet tube and clamp it in the stand with its mouth slightly down.',
          'Probirkani gaz o‘tkazgich nayli tiqin bilan yoping va shtativ panjasiga og‘zini biroz pastga qaratib mahkamlang.',
        ),
        observation: t('Прибор собран, как на рис. 23.', 'The apparatus is assembled as in Fig. 23.', 'Asbob 23-rasmdagidek yig‘ildi.'),
      },
      {
        id: 'collect',
        target: 'collect-tube',
        instruction: t(
          'Наденьте на конец газоотводной трубки сухую пробирку вверх дном.',
          'Put a dry test tube upside down over the end of the gas outlet tube.',
          'Gaz o‘tkazgich nay uchiga quruq probirkani to‘nkarib kiygizing.',
        ),
        observation: t(
          'Аммиак легче воздуха (M = 17 < 29), поэтому его собирают в пробирку вверх дном.',
          'Ammonia is lighter than air (M = 17 < 29), so it is collected in an upside-down tube.',
          'Ammiak havodan yengil (M = 17 < 29), shuning uchun u to‘nkarilgan probirkaga yig‘iladi.',
        ),
      },
      {
        id: 'heat',
        target: 'spirit-lamp',
        instruction: t('Зажгите спиртовку и медленно нагрейте смесь.', 'Light the spirit lamp and heat the mixture slowly.', 'Spirt lampasini yoqing va aralashmani sekin qizdiring.'),
        observation: t(
          'Выделяется бесцветный газ аммиак, у отверстия пробирки — капли воды: 2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O.',
          'Colourless ammonia gas is given off and water droplets form at the tube mouth: 2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O.',
          'Rangsiz ammiak gazi ajraladi, probirka og‘zida suv tomchilari: 2NH₄Cl + Ca(OH)₂ → CaCl₂ + 2NH₃↑ + 2H₂O.',
        ),
      },
      {
        id: 'smell',
        target: 'waft',
        instruction: t(
          'Помахиванием руки направьте газ от пробирки к себе — не нюхайте прямо из пробирки!',
          'Waft the gas from the tube towards you with your hand; never sniff straight from the tube!',
          'Qo‘l bilan yelpib gazni probirkadan o‘zingizga yo‘naltiring — to‘g‘ridan-to‘g‘ri hidlamang!',
        ),
        observation: t('Резкий запах нашатыря — пробирка заполнена аммиаком.', 'A sharp smell of smelling salts: the tube is full of ammonia.', 'Novshadilning o‘tkir hidi — probirka ammiak bilan to‘ldi.'),
      },
      {
        id: 'litmus',
        target: 'litmus',
        instruction: t(
          'Поднесите к отверстию пробирки влажную красную лакмусовую бумажку.',
          'Bring a moist red litmus paper to the mouth of the tube.',
          'Probirka og‘ziga nam qizil lakmus qog‘ozni yaqinlashtiring.',
        ),
        observation: t(
          'Красная лакмусовая бумажка синеет: раствор аммиака в воде — щелочной.',
          'The red litmus paper turns blue: a solution of ammonia in water is alkaline.',
          'Qizil lakmus qog‘oz ko‘karadi: ammiakning suvdagi eritmasi — ishqoriy.',
        ),
      },
      {
        id: 'hcl',
        target: 'hcl-rod',
        instruction: t(
          'Поднесите к отверстию стеклянную палочку, смоченную концентрированной соляной кислотой.',
          'Bring a glass rod moistened with concentrated hydrochloric acid to the mouth of the tube.',
          'Probirka og‘ziga konsentrlangan xlorid kislota bilan ho‘llangan shisha tayoqchani yaqinlashtiring.',
        ),
        observation: t('Белый «дым без огня» — мельчайшие кристаллы хлорида аммония: NH₃ + HCl → NH₄Cl.', 'White “smoke without fire”: tiny crystals of ammonium chloride, NH₃ + HCl → NH₄Cl.', 'Oq «olovsiz tutun» — ammoniy xloridning mayda kristallari: NH₃ + HCl → NH₄Cl.'),
      },
    ],
    conclusion: t(
      'Аммиак получают нагреванием солей аммония со щёлочью (гашёной известью). Это бесцветный газ с резким запахом, легче воздуха, очень хорошо растворяется в воде; его раствор — щелочной (лакмус синеет). С хлороводородом аммиак образует белый дым — хлорид аммония.',
      'Ammonia is obtained by heating ammonium salts with an alkali (slaked lime). It is a colourless gas with a sharp smell, lighter than air and very soluble in water; its solution is alkaline (litmus turns blue). With hydrogen chloride ammonia forms white smoke: ammonium chloride.',
      'Ammiak ammoniy tuzlarini ishqor (so‘ndirilgan ohak) bilan qizdirib olinadi. U rangsiz, o‘tkir hidli, havodan yengil, suvda juda yaxshi eriydigan gaz; eritmasi ishqoriy (lakmus ko‘karadi). Vodorod xlorid bilan ammiak oq tutun — ammoniy xlorid hosil qiladi.',
    ),
    place: 'hood',
    gear: ['goggles', 'gloves', 'coat'],
  },

  /* ── Kimyo 8, Лабораторная работа 5: вытеснение галогенов ── */
  {
    id: 'halogens',
    source: t('Лабораторная работа 5', 'Laboratory work 5', '5-laboratoriya ishi'),
    title: t('Вытеснение галогенов из их растворов', 'Displacement of halogens from their solutions', 'Galogenlarni eritmalaridan siqib chiqarish'),
    equation: 'Cl₂ + 2NaBr → 2NaCl + Br₂',
    kind: 'substitution',
    grade: 8,
    page: 202,
    equipment: [
      t('Штатив с четырьмя пробирками', 'Rack with four test tubes', 'To‘rtta probirkali shtativ'),
      t('Растворы NaBr, NaI, NaCl (по 3–4 мл)', 'Solutions of NaBr, NaI, NaCl (3–4 mL each)', 'NaBr, NaI, NaCl eritmalari (3–4 ml dan)'),
      t('Хлорная вода, бромная вода (капельницы)', 'Chlorine water, bromine water (dropper bottles)', 'Xlorli suv, bromli suv (tomizgichlar)'),
      t('Крахмальный клейстер', 'Starch paste', 'Kraxmal kleysteri'),
    ],
    safety: [
      S_HOOD,
      t('Наденьте очки и перчатки: хлорная и бромная вода ядовиты и едки.', 'Put on goggles and gloves: chlorine and bromine water are toxic and corrosive.', 'Ko‘zoynak va qo‘lqop kiying: xlorli va bromli suv zaharli va o‘yuvchi.'),
      t('Не вдыхайте пары хлора и брома; капли попавшие на кожу смойте водой.', 'Do not breathe chlorine or bromine vapour; wash any drops off the skin with water.', 'Xlor va brom bug‘larini nafas olmang; teriga tushgan tomchilarni suv bilan yuving.'),
      S_SMELL,
    ],
    steps: [
      {
        id: 'gear',
        target: 'ppe',
        instruction: t('Наденьте защитные очки и перчатки.', 'Put on safety goggles and gloves.', 'Himoya ko‘zoynagi va qo‘lqop kiying.'),
        observation: t('В пробирках — бесцветные растворы NaBr, NaI, NaI и NaCl.', 'The tubes hold colourless solutions of NaBr, NaI, NaI and NaCl.', 'Probirkalarda NaBr, NaI, NaI va NaCl ning rangsiz eritmalari.'),
      },
      {
        id: 'cl-nabr',
        target: 'cl-water',
        instruction: t('Прилейте пипеткой 1–2 мл хлорной воды в пробирку с NaBr.', 'Add 1–2 mL of chlorine water with the dropper to the NaBr tube.', 'NaBr li probirkaga tomizgich bilan 1–2 ml xlorli suv qo‘shing.'),
        observation: t('Раствор окрашивается в жёлто-оранжевый цвет — выделился бром: Cl₂ + 2NaBr → 2NaCl + Br₂.', 'The solution turns yellow-orange: bromine is released, Cl₂ + 2NaBr → 2NaCl + Br₂.', 'Eritma sariq-to‘q sariq rangga bo‘yaladi — brom ajraldi: Cl₂ + 2NaBr → 2NaCl + Br₂.'),
      },
      {
        id: 'cl-nai',
        target: 'cl-water',
        instruction: t('Прилейте хлорную воду в пробирку с NaI.', 'Add chlorine water to the NaI tube.', 'NaI li probirkaga xlorli suv qo‘shing.'),
        observation: t('Раствор становится жёлто-бурым — выделился йод: Cl₂ + 2NaI → 2NaCl + I₂.', 'The solution turns yellowish-brown: iodine is released, Cl₂ + 2NaI → 2NaCl + I₂.', 'Eritma sarg‘ish-qo‘ng‘ir bo‘ladi — yod ajraldi: Cl₂ + 2NaI → 2NaCl + I₂.'),
      },
      {
        id: 'br-nai',
        target: 'br-water',
        instruction: t('Во вторую пробирку с NaI прилейте 1–2 мл бромной воды.', 'Add 1–2 mL of bromine water to the second NaI tube.', 'Ikkinchi NaI li probirkaga 1–2 ml bromli suv qo‘shing.'),
        observation: t('Раствор буреет — бром вытесняет йод: Br₂ + 2NaI → 2NaBr + I₂.', 'The solution turns brown: bromine displaces iodine, Br₂ + 2NaI → 2NaBr + I₂.', 'Eritma qo‘ng‘irlashadi — brom yodni siqib chiqaradi: Br₂ + 2NaI → 2NaBr + I₂.'),
      },
      {
        id: 'br-nacl',
        target: 'br-water',
        instruction: t('В пробирку с NaCl прилейте бромную воду.', 'Add bromine water to the NaCl tube.', 'NaCl li probirkaga bromli suv qo‘shing.'),
        observation: t(
          'Изменений нет — лишь бледно-жёлтый цвет самой бромной воды: бром не вытесняет хлор.',
          'No change, only the pale yellow colour of the bromine water itself: bromine cannot displace chlorine.',
          'O‘zgarish yo‘q — faqat bromli suvning o‘z och sariq rangi: brom xlorni siqib chiqara olmaydi.',
        ),
      },
      {
        id: 'starch',
        target: 'starch',
        instruction: t('Добавьте каплю крахмального клейстера в бурый раствор йода.', 'Add a drop of starch paste to the brown iodine solution.', 'Qo‘ng‘ir yod eritmasiga bir tomchi kraxmal kleysteri qo‘shing.'),
        observation: t('Появляется тёмно-синее окрашивание — так крахмал обнаруживает йод.', 'A dark blue colour appears: this is how starch detects iodine.', 'To‘q ko‘k rang paydo bo‘ladi — kraxmal yodni shunday aniqlaydi.'),
      },
      {
        id: 'compare',
        target: 'rack',
        instruction: t('Сравните окраску растворов и заполните таблицу.', 'Compare the colours of the solutions and fill in the table.', 'Eritmalar rangini solishtiring va jadvalni to‘ldiring.'),
        observation: t(
          'Каждый более активный галоген вытесняет менее активный из его соли: Cl₂ > Br₂ > I₂.',
          'Each more active halogen displaces a less active one from its salt: Cl₂ > Br₂ > I₂.',
          'Har bir faolroq galogen kamroq faol galogenni uning tuzidan siqib chiqaradi: Cl₂ > Br₂ > I₂.',
        ),
      },
    ],
    conclusion: t(
      'Активность галогенов уменьшается сверху вниз по группе: F₂ > Cl₂ > Br₂ > I₂. Более активный галоген вытесняет менее активный из растворов его солей (реакции замещения); обратные реакции не идут.',
      'Halogen activity decreases down the group: F₂ > Cl₂ > Br₂ > I₂. A more active halogen displaces a less active one from solutions of its salts (substitution reactions); the reverse reactions do not happen.',
      'Galogenlar faolligi guruhda yuqoridan pastga kamayadi: F₂ > Cl₂ > Br₂ > I₂. Faolroq galogen kamroq faol galogenni uning tuzlari eritmasidan siqib chiqaradi (o‘rin olish reaksiyalari); teskari reaksiyalar bormaydi.',
    ),
    place: 'hood',
    gear: ['goggles', 'gloves'],
  },
]

export const LAB_PRACTICAL_SIDE_EQUATIONS: Readonly<Record<PracticalId, readonly string[]>> = {
  'salt-purify': [],
  nh3: ['NH₃ + HCl → NH₄Cl'],
  halogens: ['Cl₂ + 2NaI → 2NaCl + I₂', 'Br₂ + 2NaI → 2NaBr + I₂'],
}

/* ── Действия руками ── */
type Act = { readonly gesture: 'tap' | 'drag' | 'swipe'; readonly how: LabText; readonly need?: LabItemId }
const tap = (how: LabText, need?: LabItemId): Act => ({ gesture: 'tap', how, need })
const drag = (how: LabText, need?: LabItemId): Act => ({ gesture: 'drag', how, need })
const swipe = (how: LabText): Act => ({ gesture: 'swipe', how })

const GEAR_HOW = t(
  'Нажмите на очки и перчатки на подносе (или наденьте их у вытяжки, или кнопкой «Надеть» на доске).',
  'Tap the goggles and gloves on the tray (or put them on by the hood, or press “Put on” on the board).',
  'Patnisdagi ko‘zoynak va qo‘lqopni bosing (yoki ularni mo‘rili shkaf yonida kiying, yoki doskadagi «Kiyish» tugmasi).',
)

export const LAB_PRACTICAL_STEP_ACTIONS: Readonly<Record<PracticalId, readonly Act[]>> = {
  'salt-purify': [
    drag(t('Перетащите часовое стекло с солью к стакану — соль высыплется в воду.', 'Drag the watch glass with salt to the beaker: the salt pours into the water.', 'Tuzli soat oynasini stakanga torting — tuz suvga to‘kiladi.'), 'reagent:NaCl'),
    swipe(t('Проведите по палочке туда-обратно — она размешает раствор по кругу.', 'Swipe along the rod: it stirs the solution round and round.', 'Tayoqcha bo‘ylab suring — u eritmani aylantirib aralashtiradi.')),
    tap(t('Нажмите на фильтровальную бумагу — она сложится вчетверо и раскроется конусом.', 'Tap the filter paper: it folds in four and opens into a cone.', 'Filtr qog‘ozni bosing — u to‘rt buklanib, konus bo‘lib ochiladi.')),
    drag(t('Перетащите конус фильтра в воронку на кольце.', 'Drag the filter cone into the funnel on the ring.', 'Filtr konusini halqadagi voronkaga torting.')),
    drag(t('Перетащите стакан с мутным раствором к воронке — он наклонится, раствор польётся по палочке.', 'Drag the beaker of cloudy solution to the funnel: it tilts and the solution runs down the rod.', 'Loyqa eritmali stakanni voronkaga torting — u egiladi, eritma tayoqcha bo‘ylab oqadi.')),
    drag(t('Перетащите стакан с фильтратом к фарфоровой чашке.', 'Drag the beaker of filtrate to the porcelain dish.', 'Filtratli stakanni chinni kosachaga torting.')),
    swipe(t('Проведите вправо — колпачок снимется, спиртовку зажгут спичкой.', 'Swipe right: the cap comes off and the lamp is lit with a match.', 'O‘ngga suring — qalpoqcha olinadi, lampa gugurt bilan yoqiladi.')),
    swipe(t('Проведите по палочке у чашки — перемешивайте, пока выпаривается вода.', 'Swipe along the rod by the dish: keep stirring while the water evaporates.', 'Kosacha yonidagi tayoqcha bo‘ylab suring — suv bug‘lanayotganda aralashtiring.')),
    drag(t('Перетащите колпачок на пламя — спиртовка погаснет.', 'Drag the cap onto the flame: the lamp goes out.', 'Qalpoqchani alangaga torting — lampa o‘chadi.')),
  ],
  nh3: [
    tap(GEAR_HOW),
    swipe(t('Проведите по пестику туда-обратно — разотрите смесь в ступке.', 'Swipe back and forth along the pestle to grind the mixture in the mortar.', 'Dasta bo‘ylab u yoq-bu yoqqa suring — hovonchadagi aralashmani ezing.')),
    drag(t('Перетащите ступку к пробирке в штативе — смесь пересыплется.', 'Drag the mortar to the test tube in the rack: the mixture pours in.', 'Hovonchani shtativdagi probirkaga torting — aralashma to‘kiladi.')),
    drag(t('Перетащите пробирку к лапке штатива — пробка с трубкой встанет, пробирка закрепится наклонно.', 'Drag the tube to the stand clamp: the stopper and outlet tube go in and the tube is clamped at an angle.', 'Probirkani shtativ panjasiga torting — nayli tiqin o‘rnatiladi, probirka qiya mahkamlanadi.')),
    drag(t('Перетащите сухую пробирку на конец газоотводной трубки — она перевернётся вверх дном.', 'Drag the dry tube onto the end of the outlet tube: it turns upside down.', 'Quruq probirkani gaz o‘tkazgich nay uchiga torting — u to‘nkariladi.'), 'glass:testTube'),
    swipe(t('Проведите вправо — колпачок снимется, спиртовку зажгут спичкой.', 'Swipe right: the cap comes off and the lamp is lit with a match.', 'O‘ngga suring — qalpoqcha olinadi, lampa gugurt bilan yoqiladi.')),
    swipe(t('Помашите рукой от пробирки к себе (проведите к себе).', 'Wave your hand from the tube towards yourself (swipe towards you).', 'Qo‘lingizni probirkadan o‘zingizga yelping (o‘zingizga suring).')),
    drag(t('Перетащите влажную красную лакмусовую бумажку к отверстию пробирки.', 'Drag the moist red litmus paper to the mouth of the tube.', 'Nam qizil lakmus qog‘ozni probirka og‘ziga torting.')),
    drag(t('Перетащите палочку, смоченную HCl, к отверстию пробирки.', 'Drag the rod moistened with HCl to the mouth of the tube.', 'HCl bilan ho‘llangan tayoqchani probirka og‘ziga torting.'), 'reagent:HCl'),
  ],
  halogens: [
    tap(GEAR_HOW),
    drag(t('Перетащите пипетку хлорной воды к пробирке NaBr — упадут капли.', 'Drag the chlorine-water dropper to the NaBr tube: drops fall in.', 'Xlorli suv tomizgichini NaBr probirkasiga torting — tomchilar tushadi.')),
    drag(t('Перетащите пипетку хлорной воды к пробирке NaI.', 'Drag the chlorine-water dropper to the NaI tube.', 'Xlorli suv tomizgichini NaI probirkasiga torting.')),
    drag(t('Перетащите пипетку бромной воды ко второй пробирке NaI.', 'Drag the bromine-water dropper to the second NaI tube.', 'Bromli suv tomizgichini ikkinchi NaI probirkasiga torting.')),
    drag(t('Перетащите пипетку бромной воды к пробирке NaCl.', 'Drag the bromine-water dropper to the NaCl tube.', 'Bromli suv tomizgichini NaCl probirkasiga torting.')),
    drag(t('Перетащите пипетку с крахмалом к бурому раствору йода.', 'Drag the starch dropper to the brown iodine solution.', 'Kraxmalli tomizgichni qo‘ng‘ir yod eritmasiga torting.')),
    tap(t('Нажмите на штатив — пробирки выстроятся для сравнения.', 'Tap the rack: the tubes line up for comparison.', 'Shtativni bosing — probirkalar solishtirish uchun saflanadi.')),
  ],
}

/* ── «Что произошло» ── */
export const LAB_PRACTICAL_STORY: Readonly<Record<PracticalId, { readonly equation: string; readonly text: LabText }>> = {
  'salt-purify': {
    equation: 'Na⁺ + Cl⁻ → NaCl',
    text: t(
      'Молекулы воды окружают ионы Na⁺ и Cl⁻ и уносят их в раствор; песчинки не растворяются и застревают в порах фильтра. При нагревании молекулы воды улетают паром, а ионы Na⁺ и Cl⁻ снова собираются в кубические кристаллы соли. Вещество не изменилось — это физическое явление.',
      'Water molecules surround the Na⁺ and Cl⁻ ions and carry them into solution; grains of sand do not dissolve and get stuck in the pores of the filter. On heating, water molecules fly off as steam, and the Na⁺ and Cl⁻ ions gather again into cubic salt crystals. The substance has not changed: this is a physical change.',
      'Suv molekulalari Na⁺ va Cl⁻ ionlarini o‘rab, eritmaga olib o‘tadi; qum zarralari erimaydi va filtr teshikchalarida qoladi. Qizdirilganda suv molekulalari bug‘ bo‘lib uchib ketadi, Na⁺ va Cl⁻ ionlari esa yana kubsimon tuz kristallariga yig‘iladi. Modda o‘zgarmadi — bu fizik hodisa.',
    ),
  },
  nh3: {
    equation: 'NH₃ + HCl → NH₄Cl',
    text: t(
      'При нагревании ионы NH₄⁺ отдают ион водорода гидроксид-иону OH⁻: образуются молекулы NH₃ (газ) и H₂O. Лёгкие молекулы NH₃ поднимаются в перевёрнутую пробирку. У отверстия молекула NH₃ своей неподелённой электронной парой присоединяет H⁺ от HCl — образуется ион NH₄⁺, и крошечные кристаллы NH₄Cl видны как белый дым.',
      'On heating, NH₄⁺ ions give a hydrogen ion to the hydroxide ion OH⁻: molecules of NH₃ (a gas) and H₂O form. The light NH₃ molecules rise into the upside-down tube. At the mouth an NH₃ molecule uses its lone electron pair to take H⁺ from HCl, forming the NH₄⁺ ion, and tiny NH₄Cl crystals appear as white smoke.',
      'Qizdirilganda NH₄⁺ ionlari vodorod ionini gidroksid-ion OH⁻ ga beradi: NH₃ (gaz) va H₂O molekulalari hosil bo‘ladi. Yengil NH₃ molekulalari to‘nkarilgan probirkaga ko‘tariladi. Og‘izda NH₃ molekulasi bo‘linmagan elektron jufti bilan HCl dan H⁺ ni biriktiradi — NH₄⁺ ioni hosil bo‘ladi, mayda NH₄Cl kristallari oq tutun bo‘lib ko‘rinadi.',
    ),
  },
  halogens: {
    equation: 'Cl₂ + 2Br⁻ → 2Cl⁻ + Br₂',
    text: t(
      'Атом хлора сильнее притягивает электроны, чем атом брома. Молекула Cl₂ отбирает по электрону у двух ионов Br⁻: хлор становится ионами Cl⁻, а атомы брома соединяются в молекулу Br₂ — раствор желтеет. Так же бром отбирает электроны у ионов I⁻. Отнять электрон у Cl⁻ бром не может — поэтому с NaCl изменений нет.',
      'A chlorine atom attracts electrons more strongly than a bromine atom. A Cl₂ molecule takes one electron from each of two Br⁻ ions: chlorine becomes Cl⁻ ions, and the bromine atoms join into a Br₂ molecule, so the solution turns yellow. In the same way bromine takes electrons from I⁻ ions. Bromine cannot take an electron from Cl⁻, so nothing happens with NaCl.',
      'Xlor atomi elektronlarni brom atomiga qaraganda kuchliroq tortadi. Cl₂ molekulasi ikkita Br⁻ ionidan bittadan elektron oladi: xlor Cl⁻ ionlariga aylanadi, brom atomlari esa Br₂ molekulasiga birikadi — eritma sarg‘ayadi. Xuddi shunday brom I⁻ ionlaridan elektron oladi. Brom Cl⁻ dan elektron ola olmaydi — shuning uchun NaCl bilan o‘zgarish yo‘q.',
    ),
  },
}

/* ── Мини-проверка ── */
interface Q {
  readonly id: 'sign' | 'type' | 'product'
  readonly q: LabText
  readonly options: readonly LabText[]
  readonly correct: number
  readonly why: LabText
}

export const LAB_PRACTICAL_QUIZ: Readonly<Record<PracticalId, readonly Q[]>> = {
  'salt-purify': [
    {
      id: 'sign',
      q: t('Что задержал фильтр?', 'What did the filter hold back?', 'Filtr nimani ushlab qoldi?'),
      options: [t('Песок и грязь', 'Sand and dirt', 'Qum va iflosliklar'), t('Растворённую соль', 'The dissolved salt', 'Erigan tuzni'), t('Воду', 'Water', 'Suvni')],
      correct: 0,
      why: t('Поры фильтра пропускают раствор, но задерживают нерастворимые частицы.', 'The filter pores let the solution through but hold back insoluble particles.', 'Filtr teshikchalari eritmani o‘tkazadi, erimaydigan zarralarni esa ushlab qoladi.'),
    },
    {
      id: 'type',
      q: t('Какое это явление?', 'What kind of change is this?', 'Bu qanday hodisa?'),
      options: [t('Химическая реакция', 'A chemical reaction', 'Kimyoviy reaksiya'), t('Физическое явление', 'A physical change', 'Fizik hodisa'), t('Горение', 'Combustion', 'Yonish')],
      correct: 1,
      why: t('Новых веществ не образовалось: соль осталась солью, вода — водой.', 'No new substances formed: the salt stayed salt and the water stayed water.', 'Yangi moddalar hosil bo‘lmadi: tuz tuzligicha, suv suvligicha qoldi.'),
    },
    {
      id: 'product',
      q: t('Когда нужно прекратить нагревание?', 'When should heating be stopped?', 'Qizdirishni qachon to‘xtatish kerak?'),
      options: [
        t('Когда появились первые кристаллы', 'When the first crystals appear', 'Birinchi kristallar paydo bo‘lganda'),
        t('Когда раствор закипел', 'When the solution boils', 'Eritma qaynaganda'),
        t('Когда чашка треснет', 'When the dish cracks', 'Kosacha yorilganda'),
      ],
      correct: 0,
      why: t('Как только на дне чашки начнут образовываться кристаллы, нагревание прекращают (с. 24).', 'As soon as crystals begin to form on the bottom of the dish, heating is stopped (p. 24).', 'Kosacha tubida kristallar hosil bo‘la boshlashi bilan qizdirish to‘xtatiladi (24-bet).'),
    },
  ],
  nh3: [
    {
      id: 'sign',
      q: t('Как доказали, что получен аммиак?', 'How did we prove that ammonia was obtained?', 'Ammiak olinganini qanday isbotladik?'),
      options: [
        t('Красный лакмус посинел, с HCl — белый дым', 'Red litmus turned blue; white smoke with HCl', 'Qizil lakmus ko‘kardi, HCl bilan oq tutun'),
        t('Газ горит голубым пламенем', 'The gas burns with a blue flame', 'Gaz ko‘k alanga bilan yonadi'),
        t('Выпал белый осадок', 'A white precipitate formed', 'Oq cho‘kma tushdi'),
      ],
      correct: 0,
      why: t('Раствор NH₃ щелочной — лакмус синеет; NH₃ + HCl → NH₄Cl — белый дым.', 'NH₃ solution is alkaline, so litmus turns blue; NH₃ + HCl → NH₄Cl gives white smoke.', 'NH₃ eritmasi ishqoriy — lakmus ko‘karadi; NH₃ + HCl → NH₄Cl — oq tutun.'),
    },
    {
      id: 'type',
      q: t('Почему пробирку для сбора держат вверх дном?', 'Why is the collecting tube held upside down?', 'Nega yig‘uvchi probirka to‘nkarib tutiladi?'),
      options: [
        t('Аммиак тяжелее воздуха', 'Ammonia is heavier than air', 'Ammiak havodan og‘ir'),
        t('Аммиак легче воздуха', 'Ammonia is lighter than air', 'Ammiak havodan yengil'),
        t('Чтобы газ не нагрелся', 'So the gas does not heat up', 'Gaz qizimasligi uchun'),
      ],
      correct: 1,
      why: t('M(NH₃) = 17 г/моль, а воздуха — 29 г/моль: аммиак поднимается вверх.', 'M(NH₃) = 17 g/mol and air is 29 g/mol, so ammonia rises.', 'M(NH₃) = 17 g/mol, havoniki — 29 g/mol: ammiak yuqoriga ko‘tariladi.'),
    },
    {
      id: 'product',
      q: t('Как правильно определить запах газа?', 'How do you smell a gas correctly?', 'Gaz hidini qanday to‘g‘ri aniqlash kerak?'),
      options: [
        t('Помахивая рукой от отверстия к себе', 'By wafting it towards you with your hand', 'Qo‘l bilan og‘izdan o‘zingizga yelpib'),
        t('Глубоко вдохнуть у отверстия', 'By breathing in deeply at the mouth', 'Og‘izda chuqur nafas olib'),
        t('Поднести пробирку к носу', 'By holding the tube to your nose', 'Probirkani burunga tutib'),
      ],
      correct: 0,
      why: t('Аммиак едкий: его запах определяют только помахиванием руки.', 'Ammonia is pungent: smell it only by wafting with your hand.', 'Ammiak o‘tkir: hidi faqat qo‘l bilan yelpib aniqlanadi.'),
    },
  ],
  halogens: [
    {
      id: 'sign',
      q: t('Какой признак реакции вы наблюдали?', 'Which sign of a reaction did you observe?', 'Qaysi reaksiya belgisini kuzatdingiz?'),
      options: [
        t('Выделился газ', 'A gas was given off', 'Gaz ajraldi'),
        t('Изменился цвет', 'The colour changed', 'Rang o‘zgardi'),
        t('Выделились тепло и свет', 'Heat and light were given off', 'Issiqlik va yorug‘lik ajraldi'),
      ],
      correct: 1,
      why: t('Бесцветные растворы стали жёлто-оранжевым (Br₂) и бурым (I₂).', 'The colourless solutions turned yellow-orange (Br₂) and brown (I₂).', 'Rangsiz eritmalar sariq-to‘q sariq (Br₂) va qo‘ng‘ir (I₂) bo‘ldi.'),
    },
    {
      id: 'type',
      q: t('К какому типу относится реакция?', 'What type of reaction is it?', 'Reaksiya qaysi turga kiradi?'),
      options: [t('Обмена', 'Exchange', 'Almashinish'), t('Разложения', 'Decomposition', 'Parchalanish'), t('Замещения', 'Substitution', 'O‘rin olish')],
      correct: 2,
      why: t('Простое вещество Cl₂ замещает бром в сложном веществе NaBr.', 'The simple substance Cl₂ replaces bromine in the compound NaBr.', 'Oddiy modda Cl₂ murakkab modda NaBr dagi brom o‘rnini oladi.'),
    },
    {
      id: 'product',
      q: t('Какой ряд активности галогенов верный?', 'Which order of halogen activity is correct?', 'Galogenlar faolligining qaysi qatori to‘g‘ri?'),
      options: [
        t('I₂ > Br₂ > Cl₂ — активнее всех йод', 'I₂ > Br₂ > Cl₂: iodine is the most active', 'I₂ > Br₂ > Cl₂ — eng faoli yod'),
        t('Cl₂ > I₂ > Br₂ — йод активнее брома', 'Cl₂ > I₂ > Br₂: iodine beats bromine', 'Cl₂ > I₂ > Br₂ — yod bromdan faol'),
        t('Cl₂ > Br₂ > I₂ — активнее всех хлор', 'Cl₂ > Br₂ > I₂: chlorine is the most active', 'Cl₂ > Br₂ > I₂ — eng faoli xlor'),
      ],
      correct: 2,
      why: t('Хлор вытеснил бром и йод, бром — только йод, но не хлор.', 'Chlorine displaced bromine and iodine; bromine displaced only iodine, not chlorine.', 'Xlor brom va yodni, brom esa faqat yodni siqib chiqardi, xlorni emas.'),
    },
  ],
}
