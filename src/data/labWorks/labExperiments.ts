/**
 * Опыты новой 3D-лаборатории: § 2.12 учебника Kimyo 7 (три признака реакций — осадок, тепло, газ)
 * и практическое занятие § 5.2 «Получение водорода и изучение его свойств» (с. 115–116).
 * Реактивы, наблюдения и уравнения — по учебнику; цель каждого шага — объект установки (rigTargets.ts).
 */
import type { LabExperimentDef, LabExperimentId, LabText } from '../../components/lab3d/labContract'

const t = (ru: string, en: string, uz: string): LabText => ({ ru, en, uz })

/* ── Общая техника безопасности (§ 1.4: штатив, спиртовка, газовая горелка) ── */
const SAFETY_GOGGLES = t(
  'Работайте в защитных очках и халате.',
  'Wear safety goggles and a lab coat.',
  'Himoya ko‘zoynagi va xalatda ishlang.',
)
const SAFETY_ACID = t(
  'Кислоту наливайте осторожно; попавшую на кожу кислоту смойте большим количеством воды.',
  'Pour acid carefully; wash acid off the skin with plenty of water.',
  'Kislotani ehtiyotlik bilan quying; teriga tushgan kislotani ko‘p suv bilan yuving.',
)
const SAFETY_TUBE_MOUTH = t(
  'Отверстие пробирки направляйте от себя и от одноклассников.',
  'Point the mouth of the test tube away from yourself and your classmates.',
  'Probirka og‘zini o‘zingizdan va sinfdoshlaringizdan uzoqqa qarating.',
)
const SAFETY_LAMP = t(
  'Спиртовку зажигайте только спичкой (не от другой спиртовки), гасите — колпачком.',
  'Light the spirit lamp only with a match (never from another lamp); put it out with the cap.',
  'Spirt lampasini faqat gugurt bilan yoqing (boshqa lampadan emas), qalpoqcha bilan o‘chiring.',
)

export const LAB_EXPERIMENTS: readonly LabExperimentDef[] = [
  {
    id: 'baso4',
    source: t('§ 2.12 · Образование осадка', '§ 2.12 · Formation of a precipitate', '§ 2.12 · Cho‘kma hosil bo‘lishi'),
    title: t(
      'Хлорид бария и серная кислота',
      'Barium chloride and sulfuric acid',
      'Bariy xlorid va sulfat kislota',
    ),
    equation: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl',
    kind: 'exchange',
    grade: 7,
    page: 67,
    equipment: [
      t('Штатив для пробирок', 'Test-tube rack', 'Probirkalar shtativi'),
      t('Две пробирки', 'Two test tubes', 'Ikkita probirka'),
      t('Раствор хлорида бария BaCl₂', 'Barium chloride solution BaCl₂', 'Bariy xlorid eritmasi BaCl₂'),
      t('Разбавленная серная кислота H₂SO₄', 'Dilute sulfuric acid H₂SO₄', 'Suyultirilgan sulfat kislota H₂SO₄'),
    ],
    safety: [
      SAFETY_GOGGLES,
      SAFETY_ACID,
      t(
        'Соли бария ядовиты: не пробуйте вещества на вкус, после опыта вымойте руки.',
        'Barium salts are poisonous: never taste chemicals, wash your hands after the experiment.',
        'Bariy tuzlari zaharli: moddalarni tatib ko‘rmang, tajribadan so‘ng qo‘lingizni yuving.',
      ),
    ],
    steps: [
      {
        id: 'look-bacl2',
        target: 'tube-bacl2',
        instruction: t(
          'Рассмотрите пробирку с раствором хлорида бария BaCl₂.',
          'Look at the test tube with barium chloride solution BaCl₂.',
          'Bariy xlorid BaCl₂ eritmasi solingan probirkani ko‘rib chiqing.',
        ),
        observation: t(
          'Раствор BaCl₂ бесцветный и прозрачный.',
          'The BaCl₂ solution is colourless and clear.',
          'BaCl₂ eritmasi rangsiz va tiniq.',
        ),
      },
      {
        id: 'take-h2so4',
        target: 'tube-h2so4',
        instruction: t(
          'Возьмите пробирку с разбавленной серной кислотой H₂SO₄.',
          'Take the test tube with dilute sulfuric acid H₂SO₄.',
          'Suyultirilgan sulfat kislota H₂SO₄ solingan probirkani oling.',
        ),
        observation: t(
          'Серная кислота тоже бесцветная. По виду растворы не отличить.',
          'Sulfuric acid is colourless too. The solutions look the same.',
          'Sulfat kislota ham rangsiz. Eritmalarni ko‘rinishidan ajratib bo‘lmaydi.',
        ),
      },
      {
        id: 'pour',
        target: 'tube-h2so4',
        instruction: t(
          'Прилейте кислоту к раствору хлорида бария.',
          'Pour the acid into the barium chloride solution.',
          'Kislotani bariy xlorid eritmasiga quying.',
        ),
        observation: t(
          'Сразу появляется белая муть — образуется нерастворимый сульфат бария BaSO₄.',
          'A white cloudiness appears at once: insoluble barium sulfate BaSO₄ forms.',
          'Darhol oq loyqa paydo bo‘ladi — erimaydigan bariy sulfat BaSO₄ hosil bo‘ladi.',
        ),
      },
      {
        id: 'settle',
        target: 'tube-h2so4',
        instruction: t(
          'Поставьте пустую пробирку в штатив и понаблюдайте.',
          'Put the empty tube back into the rack and watch.',
          'Bo‘sh probirkani shtativga qo‘ying va kuzating.',
        ),
        observation: t(
          'Белый осадок BaSO₄↓ оседает на дно, над ним — прозрачный раствор соляной кислоты HCl.',
          'The white precipitate BaSO₄↓ settles to the bottom; above it is a clear solution of hydrochloric acid HCl.',
          'Oq cho‘kma BaSO₄↓ tubga cho‘kadi, uning ustida — xlorid kislota HCl ning tiniq eritmasi.',
        ),
      },
    ],
    conclusion: t(
      'Реакция обмена: вещества обменялись составными частями. Признак реакции — выпадение белого осадка BaSO₄↓.',
      'An exchange reaction: the substances swapped their parts. The sign of the reaction is the white precipitate BaSO₄↓.',
      'Almashinish reaksiyasi: moddalar tarkibiy qismlari bilan almashdi. Reaksiya belgisi — oq cho‘kma BaSO₄↓ tushishi.',
    ),
  },
  {
    id: 'ch4-burn',
    source: t('§ 2.12 · Выделение тепла', '§ 2.12 · Release of heat', '§ 2.12 · Issiqlik ajralishi'),
    title: t('Горение метана', 'Burning of methane', 'Metanning yonishi'),
    equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O + Q',
    kind: 'combustion',
    grade: 7,
    page: 67,
    equipment: [
      t('Газовая горелка (природный газ — метан CH₄)', 'Gas burner (natural gas is methane CH₄)', 'Gaz gorelkasi (tabiiy gaz — metan CH₄)'),
      t('Спички', 'Matches', 'Gugurt'),
      t('Холодный сухой химический стакан', 'Cold dry beaker', 'Sovuq quruq kimyoviy stakan'),
      t(
        'Стакан, смоченный известковой водой Ca(OH)₂',
        'Beaker wetted with limewater Ca(OH)₂',
        'Ohakli suv Ca(OH)₂ bilan namlangan stakan',
      ),
    ],
    safety: [
      SAFETY_GOGGLES,
      t(
        'Спичку подносите к горлышку горелки сбоку, а не сверху — поток газа может погасить пламя.',
        'Bring the match to the burner mouth from the side, not from above: the gas flow can blow it out.',
        'Gugurtni gorelka og‘ziga yondan tuting, tepadan emas — gaz oqimi alangani o‘chirishi mumkin.',
      ),
      t(
        'После опыта закройте газовый кран до конца.',
        'After the experiment close the gas tap completely.',
        'Tajribadan so‘ng gaz jo‘mragini oxirigacha yoping.',
      ),
    ],
    steps: [
      {
        id: 'match',
        target: 'match',
        instruction: t('Зажгите спичку.', 'Strike a match.', 'Gugurtni yoqing.'),
        observation: t('Спичка горит жёлтым пламенем.', 'The match burns with a yellow flame.', 'Gugurt sariq alanga bilan yonadi.'),
      },
      {
        id: 'ignite',
        target: 'gas-valve',
        instruction: t(
          'Откройте газовый кран и поднесите спичку к горлышку горелки сбоку.',
          'Open the gas tap and bring the match to the burner mouth from the side.',
          'Gaz jo‘mragini oching va gugurtni gorelka og‘ziga yondan tuting.',
        ),
        observation: t(
          'Метан загорается голубым пламенем без копоти, выделяется много тепла.',
          'Methane catches fire with a blue, smokeless flame and gives off a lot of heat.',
          'Metan qurumsiz havorang alanga bilan yonadi, ko‘p issiqlik ajraladi.',
        ),
      },
      {
        id: 'dry-beaker',
        target: 'beaker-dry',
        instruction: t(
          'Подержите над пламенем холодный сухой стакан вверх дном.',
          'Hold a cold dry beaker upside down above the flame.',
          'Sovuq quruq stakanni to‘nkarib, alanga ustida tuting.',
        ),
        observation: t(
          'Стенки стакана запотевают — появляются капли воды: при горении метана образуется вода H₂O.',
          'The walls mist up with drops of water: burning methane produces water H₂O.',
          'Stakan devorlari terlaydi — suv tomchilari paydo bo‘ladi: metan yonganda suv H₂O hosil bo‘ladi.',
        ),
      },
      {
        id: 'lime-beaker',
        target: 'beaker-lime',
        instruction: t(
          'Подержите над пламенем стакан, смоченный известковой водой.',
          'Hold the beaker wetted with limewater above the flame.',
          'Ohakli suv bilan namlangan stakanni alanga ustida tuting.',
        ),
        observation: t(
          'Известковая вода мутнеет: CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O — значит, образуется углекислый газ CO₂.',
          'The limewater turns milky: CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O, so carbon dioxide CO₂ is formed.',
          'Ohakli suv loyqalanadi: CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O — demak, karbonat angidrid CO₂ hosil bo‘ladi.',
        ),
      },
      {
        id: 'close',
        target: 'gas-valve',
        instruction: t('Закройте газовый кран.', 'Close the gas tap.', 'Gaz jo‘mragini yoping.'),
        observation: t('Пламя гаснет.', 'The flame goes out.', 'Alanga o‘chadi.'),
      },
    ],
    conclusion: t(
      'Метан горит в кислороде воздуха с образованием углекислого газа и воды. Признаки реакции — свет и выделение тепла (+Q).',
      'Methane burns in the oxygen of the air forming carbon dioxide and water. Signs of the reaction: light and release of heat (+Q).',
      'Metan havo kislorodida yonib, karbonat angidrid va suv hosil qiladi. Reaksiya belgilari — yorug‘lik va issiqlik ajralishi (+Q).',
    ),
  },
  {
    id: 'zn-hcl',
    source: t('§ 2.12 · Выделение газа', '§ 2.12 · Release of a gas', '§ 2.12 · Gaz ajralishi'),
    title: t('Цинк и соляная кислота', 'Zinc and hydrochloric acid', 'Rux va xlorid kislota'),
    equation: 'Zn + 2HCl → ZnCl₂ + H₂↑',
    kind: 'substitution',
    grade: 7,
    page: 67,
    equipment: [
      t('Штатив для пробирок, пробирка', 'Test-tube rack, test tube', 'Probirkalar shtativi, probirka'),
      t('Гранулы цинка Zn, пинцет', 'Zinc granules Zn, tweezers', 'Rux granulalari Zn, pinset'),
      t('Раствор соляной кислоты HCl', 'Hydrochloric acid solution HCl', 'Xlorid kislota eritmasi HCl'),
    ],
    safety: [SAFETY_GOGGLES, SAFETY_ACID, SAFETY_TUBE_MOUTH],
    steps: [
      {
        id: 'look-zn',
        target: 'zn-granule',
        instruction: t('Рассмотрите гранулу цинка.', 'Look at the zinc granule.', 'Rux granulasini ko‘rib chiqing.'),
        observation: t(
          'Цинк — серебристо-серый металл.',
          'Zinc is a silvery-grey metal.',
          'Rux — kumushsimon kulrang metall.',
        ),
      },
      {
        id: 'acid',
        target: 'bottle-hcl',
        instruction: t(
          'Налейте в пробирку 2–3 мл соляной кислоты.',
          'Pour 2–3 mL of hydrochloric acid into the test tube.',
          'Probirkaga 2–3 ml xlorid kislota quying.',
        ),
        observation: t(
          'Соляная кислота — бесцветная прозрачная жидкость.',
          'Hydrochloric acid is a colourless clear liquid.',
          'Xlorid kislota — rangsiz tiniq suyuqlik.',
        ),
      },
      {
        id: 'drop-zn',
        target: 'zn-granule',
        instruction: t(
          'Опустите гранулу цинка в пробирку.',
          'Drop the zinc granule into the test tube.',
          'Rux granulasini probirkaga tushiring.',
        ),
        observation: t(
          'На поверхности цинка сразу появляются пузырьки газа — выделяется водород H₂↑.',
          'Gas bubbles appear on the zinc at once: hydrogen H₂↑ is released.',
          'Rux sirtida darhol gaz pufakchalari paydo bo‘ladi — vodorod H₂↑ ajraladi.',
        ),
      },
      {
        id: 'watch',
        target: 'tube-acid',
        instruction: t(
          'Понаблюдайте за пробиркой несколько минут.',
          'Watch the test tube for a few minutes.',
          'Probirkani bir necha daqiqa kuzating.',
        ),
        observation: t(
          'Газ выделяется непрерывно, гранула цинка становится всё меньше — цинк растворяется, образуется хлорид цинка ZnCl₂.',
          'Gas keeps coming off and the zinc granule gets smaller: zinc dissolves, forming zinc chloride ZnCl₂.',
          'Gaz to‘xtovsiz ajraladi, rux granulasi kichrayib boradi — rux eriydi, rux xlorid ZnCl₂ hosil bo‘ladi.',
        ),
      },
    ],
    conclusion: t(
      'Реакция замещения: цинк замещает водород в кислоте. Признак реакции — выделение газа (водорода H₂↑).',
      'A substitution reaction: zinc replaces hydrogen in the acid. The sign of the reaction is the release of a gas (hydrogen H₂↑).',
      'O‘rin olish reaksiyasi: rux kislotadagi vodorod o‘rnini oladi. Reaksiya belgisi — gaz (vodorod H₂↑) ajralishi.',
    ),
  },
  {
    id: 'h2-practical',
    source: t(
      'Практическое занятие · § 5.2',
      'Practical work · § 5.2',
      'Amaliy mashg‘ulot · § 5.2',
    ),
    title: t(
      'Получение водорода и изучение его свойств',
      'Obtaining hydrogen and studying its properties',
      'Vodorod olish va uning xossalarini o‘rganish',
    ),
    equation: 'Zn + 2HCl → ZnCl₂ + H₂↑',
    kind: 'substitution',
    grade: 7,
    page: 115,
    equipment: [
      t(
        'Пробирка с газоотводной трубкой (вместо аппарата Кирюшкина)',
        'Test tube with a gas outlet tube (instead of Kiryushkin’s apparatus)',
        'Gaz o‘tkazgich nayli probirka (Kiryushkin apparati o‘rniga)',
      ),
      t('Лабораторный штатив с лапкой', 'Laboratory stand with a clamp', 'Panjali laboratoriya shtativi'),
      t('Пробирка для сбора газа', 'Test tube for collecting the gas', 'Gaz yig‘ish uchun probirka'),
      t('Металлический цинк Zn (или Fe, Al)', 'Zinc metal Zn (or Fe, Al)', 'Metall rux Zn (yoki Fe, Al)'),
      t('Раствор соляной кислоты HCl', 'Hydrochloric acid solution HCl', 'Xlorid kislota eritmasi HCl'),
      t('Спиртовка, спички, стеклянная пластинка', 'Spirit lamp, matches, glass plate', 'Spirt lampasi, gugurt, shisha plastinka'),
    ],
    safety: [
      SAFETY_GOGGLES,
      t(
        'Водород в смеси с воздухом взрывоопасен: поджигать его можно только после проверки на чистоту.',
        'Hydrogen mixed with air is explosive: light it only after testing its purity.',
        'Vodorod havo bilan aralashganda portlovchi: uni faqat tozaligini tekshirgandan so‘ng yoqish mumkin.',
      ),
      t(
        'Проверьте герметичность прибора: пробка должна плотно закрывать пробирку.',
        'Check that the apparatus is airtight: the stopper must close the tube tightly.',
        'Asbob germetikligini tekshiring: tiqin probirkani zich yopishi kerak.',
      ),
      SAFETY_ACID,
      SAFETY_LAMP,
    ],
    steps: [
      {
        id: 'acid',
        target: 'bottle-hcl',
        instruction: t(
          'Налейте в пробирку 2–3 мл раствора соляной кислоты.',
          'Pour 2–3 mL of hydrochloric acid solution into the test tube.',
          'Probirkaga 2–3 ml xlorid kislota eritmasini quying.',
        ),
        observation: t(
          'Пробирка в лапке штатива, в ней бесцветный раствор кислоты.',
          'The tube is held in the stand clamp; it contains a colourless acid solution.',
          'Probirka shtativ panjasida, unda rangsiz kislota eritmasi.',
        ),
      },
      {
        id: 'zinc',
        target: 'zn-granule',
        instruction: t(
          'Опустите в пробирку 2–3 гранулы цинка.',
          'Drop 2–3 zinc granules into the tube.',
          'Probirkaga 2–3 ta rux granulasini tushiring.',
        ),
        observation: t(
          'Немедленно начинает выделяться газ — пузырьки водорода.',
          'Gas starts to come off at once: bubbles of hydrogen.',
          'Darhol gaz ajrala boshlaydi — vodorod pufakchalari.',
        ),
      },
      {
        id: 'stopper',
        target: 'stopper',
        instruction: t(
          'Плотно закройте пробирку пробкой с газоотводной трубкой.',
          'Close the tube tightly with the stopper and gas outlet tube.',
          'Probirkani gaz o‘tkazgich nayli tiqin bilan zich yoping.',
        ),
        observation: t(
          'Водород выходит наружу только через газоотводную трубку.',
          'Hydrogen now escapes only through the outlet tube.',
          'Vodorod endi faqat gaz o‘tkazgich nay orqali chiqadi.',
        ),
      },
      {
        id: 'collect',
        target: 'collect-tube',
        instruction: t(
          'Наденьте на трубку пробирку вверх дном и соберите водород вытеснением воздуха.',
          'Put a test tube upside down over the outlet tube and collect hydrogen by displacing air.',
          'Nay ustiga probirkani to‘nkarib kiygizing va vodorodni havoni siqib chiqarish usulida yig‘ing.',
        ),
        observation: t(
          'Водород легче воздуха: он поднимается вверх и вытесняет воздух из перевёрнутой пробирки.',
          'Hydrogen is lighter than air: it rises and pushes the air out of the upturned tube.',
          'Vodorod havodan yengil: u yuqoriga ko‘tarilib, to‘nkarilgan probirkadan havoni siqib chiqaradi.',
        ),
      },
      {
        id: 'lamp',
        target: 'spirit-lamp',
        instruction: t(
          'Снимите колпачок и зажгите спиртовку спичкой.',
          'Take off the cap and light the spirit lamp with a match.',
          'Qalpoqchani oling va spirt lampasini gugurt bilan yoqing.',
        ),
        observation: t(
          'Спиртовка горит ровным жёлтоватым пламенем.',
          'The spirit lamp burns with a steady yellowish flame.',
          'Spirt lampasi bir tekis sarg‘ish alanga bilan yonadi.',
        ),
      },
      {
        id: 'purity',
        target: 'collect-tube',
        instruction: t(
          'Не переворачивая, поднесите пробирку с водородом отверстием к пламени спиртовки.',
          'Without turning it over, bring the mouth of the hydrogen tube to the spirit-lamp flame.',
          'To‘nkarilgan holda vodorodli probirka og‘zini spirt lampasi alangasiga yaqinlashtiring.',
        ),
        observation: t(
          'Глухой тихий хлопок — водород чистый. Громкий «лающий» хлопок означал бы смесь с воздухом — она взрывоопасна.',
          'A quiet, dull pop: the hydrogen is pure. A loud “barking” pop would mean a mixture with air, which is explosive.',
          'Bo‘g‘iq past ovoz — vodorod toza. Baland «akillagan» ovoz havo bilan aralashmani bildiradi — u portlovchi.',
        ),
      },
      {
        id: 'burn',
        target: 'glass-plate',
        instruction: t(
          'Подожгите водород у конца газоотводной трубки и поднесите к пламени холодную стеклянную пластинку.',
          'Light the hydrogen at the end of the outlet tube and hold a cold glass plate to the flame.',
          'Gaz o‘tkazgich nay uchida vodorodni yoqing va alangaga sovuq shisha plastinkani tuting.',
        ),
        observation: t(
          'Водород горит голубоватым пламенем, на стекле появляются капли воды: 2H₂ + O₂ → 2H₂O.',
          'Hydrogen burns with a bluish flame and drops of water appear on the glass: 2H₂ + O₂ → 2H₂O.',
          'Vodorod havorang alanga bilan yonadi, shishada suv tomchilari paydo bo‘ladi: 2H₂ + O₂ → 2H₂O.',
        ),
      },
    ],
    conclusion: t(
      'Водород получают действием соляной кислоты на цинк (реакция замещения). Водород — лёгкий газ, его собирают в перевёрнутую пробирку; чистый водород горит голубоватым пламенем, образуя воду.',
      'Hydrogen is obtained by the action of hydrochloric acid on zinc (a substitution reaction). Hydrogen is a light gas, collected in an upturned tube; pure hydrogen burns with a bluish flame forming water.',
      'Vodorod ruxga xlorid kislota ta’sir ettirib olinadi (o‘rin olish reaksiyasi). Vodorod — yengil gaz, u to‘nkarilgan probirkaga yig‘iladi; toza vodorod havorang alanga bilan yonib, suv hosil qiladi.',
    ),
  },
]

export function getLabExperiment(id: LabExperimentId): LabExperimentDef {
  const def = LAB_EXPERIMENTS.find((e) => e.id === id)
  if (!def) throw new Error(`labExperiments: нет опыта «${id}»`)
  return def
}

export function isLabExperimentId(v: unknown): v is LabExperimentId {
  return typeof v === 'string' && LAB_EXPERIMENTS.some((e) => e.id === v)
}

/** Дополнительные уравнения, которые встречаются в наблюдениях (для проверки баланса). */
export const LAB_SIDE_EQUATIONS: Readonly<Partial<Record<LabExperimentId, readonly string[]>>> = {
  'ch4-burn': ['CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O'],
  'h2-practical': ['2H₂ + O₂ → 2H₂O'],
}
