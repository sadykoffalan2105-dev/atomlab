/**
 * Опыты новой 3D-лаборатории: § 2.12 учебника Kimyo 7 (три признака реакций — осадок, тепло, газ)
 * и практическое занятие § 5.2 «Получение водорода и изучение его свойств» (с. 115–116).
 * Реактивы, наблюдения и уравнения — по учебнику; цель каждого шага — объект установки (rigTargets.ts).
 */
import type { LabExperimentDef, LabExperimentId, LabText } from '../../components/lab3d/labContract'
import type { LabItemId } from '../../components/lab3d/labEvents'
import {
  LAB_PRACTICAL_EXPERIMENTS,
  LAB_PRACTICAL_QUIZ,
  LAB_PRACTICAL_SIDE_EQUATIONS,
  LAB_PRACTICAL_STEP_ACTIONS,
  LAB_PRACTICAL_STORY,
} from './labExperimentsPractical'
import { LAB_WORKS_EXPERIMENTS, LAB_WORKS_QUIZ, LAB_WORKS_SIDE_EQUATIONS, LAB_WORKS_STEP_ACTIONS, LAB_WORKS_STORY } from './labExperimentsWorks'
import {
  LAB_TASK_EXPERIMENTS,
  LAB_TASK_QUIZ,
  LAB_TASK_SIDE_EQUATIONS,
  LAB_TASK_STEP_ACTIONS,
  LAB_TASK_STORY,
  labTasksOfGrade,
} from '../labTasks/labTasks'

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
  },  // практические и лабораторные работы (Kimyo 7 § 1.6, Kimyo 8 ПР 3 и ЛР 5)
  ...LAB_PRACTICAL_EXPERIMENTS,
  // ещё три практические работы (Kimyo 7 § 6.5 и § 5.6, Kimyo 9 ПР 1)
  ...LAB_WORKS_EXPERIMENTS,
  // задачи учебников как реальный опыт (Kimyo 7–9, по 5 из класса)
  ...LAB_TASK_EXPERIMENTS,
]

/** Группы карточек выбора на доске. */
export type LabExperimentGroupId = 'signs' | 'practical' | 'tasks7' | 'tasks8' | 'tasks9'
export const LAB_EXPERIMENT_GROUPS: readonly { readonly id: LabExperimentGroupId; readonly title: LabText; readonly ids: readonly LabExperimentId[] }[] = [
  { id: 'signs', title: t('§ 2.12 · Признаки реакций', '§ 2.12 · Signs of reactions', '§ 2.12 · Reaksiya belgilari'), ids: ['baso4', 'ch4-burn', 'zn-hcl'] },
  {
    id: 'practical',
    title: t('Практические и лабораторные работы', 'Practical and laboratory work', 'Amaliy va laboratoriya ishlari'),
    ids: ['h2-practical', 'salt-purify', 'metals-acids', 'water-oxides', 'nh3', 'halogens', 'co2'],
  },
  ...([7, 8, 9] as const)
    .map((g) => ({
      id: `tasks${g}` as const,
      title: t(`Задачи-опыты · ${g} класс`, `Problems as experiments · grade ${g}`, `Masala-tajribalar · ${g}-sinf`),
      ids: labTasksOfGrade(g).map((x) => x.id),
    }))
    .filter((g) => g.ids.length > 0),
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
  ...LAB_PRACTICAL_SIDE_EQUATIONS,
  ...LAB_WORKS_SIDE_EQUATIONS,
  ...LAB_TASK_SIDE_EQUATIONS,
}

/* ── Действие руками на каждом шаге (жест, как его сделать, нужный предмет со стеллажа) ── */

export type LabGestureKind = 'tap' | 'drag' | 'swipe'
export interface LabStepAction {
  /** Жест: нажать / перетащить предмет / провести (чиркнуть, повернуть, наклонить). Траектория — rigTargets.ts. */
  readonly gesture: LabGestureKind
  /** Как сделать это руками (крупно на доске). */
  readonly how: LabText
  /** Предмет со стеллажа или из шкафа, который нужен на этом шаге (сцена подсвечивает его). */
  readonly need?: LabItemId
}

const tap = (how: LabText, need?: LabItemId): LabStepAction => ({ gesture: 'tap', how, need })
const drag = (how: LabText, need?: LabItemId): LabStepAction => ({ gesture: 'drag', how, need })
const swipe = (how: LabText): LabStepAction => ({ gesture: 'swipe', how })

export const LAB_STEP_ACTIONS: Readonly<Record<LabExperimentId, readonly LabStepAction[]>> = {
  baso4: [
    tap(t('Нажмите на пробирку BaCl₂ — она поднимется, рассмотрите раствор.', 'Tap the BaCl₂ tube: it lifts up so you can look at the solution.', 'BaCl₂ probirkasini bosing — u ko‘tariladi, eritmani ko‘rib chiqing.')),
    drag(t('Перетащите пробирку H₂SO₄ вверх и к пробирке BaCl₂.', 'Drag the H₂SO₄ tube up and over to the BaCl₂ tube.', 'H₂SO₄ probirkasini yuqoriga va BaCl₂ probirkasi tomon torting.')),
    swipe(t('Проведите влево — пробирка наклонится, кислота польётся струйкой.', 'Swipe left: the tube tilts and the acid pours in a thin stream.', 'Chapga suring — probirka egiladi, kislota ingichka oqim bo‘lib quyiladi.')),
    drag(t('Перетащите пустую пробирку обратно в штатив и смотрите на осадок.', 'Drag the empty tube back to the rack and watch the precipitate.', 'Bo‘sh probirkani shtativga qaytaring va cho‘kmani kuzating.')),
  ],
  'ch4-burn': [
    swipe(t('Чиркните спичкой о коробок: проведите вправо.', 'Strike the match on the box: swipe to the right.', 'Gugurtni qutiga chaqing: o‘ngga suring.')),
    swipe(t('Поверните кран (проведите к себе) — газ пойдёт, спичку поднесут сбоку к горелке.', 'Turn the tap (swipe towards you): gas flows and the match is brought to the burner from the side.', 'Jo‘mrakni buring (o‘zingizga suring) — gaz keladi, gugurt gorelkaga yondan tutiladi.')),
    drag(t('Перетащите холодный сухой стакан к пламени — он перевернётся над горелкой.', 'Drag the cold dry beaker to the flame: it turns upside down over the burner.', 'Sovuq quruq stakanni alangaga torting — u gorelka ustida to‘ntariladi.')),
    drag(t('Перетащите стакан с известковой водой к пламени.', 'Drag the limewater beaker to the flame.', 'Ohakli suvli stakanni alangaga torting.')),
    swipe(t('Закройте кран: проведите от себя.', 'Close the tap: swipe away from you.', 'Jo‘mrakni yoping: o‘zingizdan nariga suring.')),
  ],
  'zn-hcl': [
    tap(t('Нажмите на гранулу цинка — рассмотрите металл.', 'Tap the zinc granule to look at the metal.', 'Rux granulasini bosing — metallni ko‘rib chiqing.')),
    drag(
      t('Возьмите склянку HCl (со стеллажа или на столе) и перетащите к пробирке — кислота нальётся.', 'Take the HCl bottle (from the shelf or the bench) and drag it to the tube: the acid pours in.', 'HCl shishasini oling (tokchadan yoki stoldan) va probirkaga torting — kislota quyiladi.'),
      'reagent:HCl',
    ),
    drag(t('Перетащите гранулу цинка пинцетом к пробирке и отпустите.', 'Drag the zinc granule with tweezers to the tube and let go.', 'Rux granulasini pinset bilan probirkaga torting va qo‘yib yuboring.')),
    tap(t('Нажмите на пробирку и наблюдайте: пузырьки газа, цинк уменьшается.', 'Tap the tube and watch: gas bubbles, the zinc gets smaller.', 'Probirkani bosing va kuzating: gaz pufakchalari, rux kichrayadi.')),
  ],
  'h2-practical': [
    drag(
      t('Возьмите склянку HCl и перетащите к пробирке в лапке штатива — налейте кислоту.', 'Take the HCl bottle and drag it to the tube in the stand clamp: pour the acid.', 'HCl shishasini oling va shtativ panjasidagi probirkaga torting — kislota quying.'),
      'reagent:HCl',
    ),
    drag(t('Перетащите гранулы цинка к пробирке.', 'Drag the zinc granules to the tube.', 'Rux granulalarini probirkaga torting.'), 'reagent:Zn'),
    drag(t('Перетащите пробку с газоотводной трубкой на пробирку.', 'Drag the stopper with the gas outlet tube onto the test tube.', 'Gaz o‘tkazgich nayli tiqinni probirkaga torting.')),
    drag(
      t('Перетащите пустую пробирку к концу трубки — она перевернётся вверх дном.', 'Drag the empty tube to the end of the outlet tube: it turns upside down.', 'Bo‘sh probirkani nay uchiga torting — u to‘ntariladi.'),
      'glass:testTube',
    ),
    swipe(t('Проведите вверх — снимите колпачок; спиртовку зажгут спичкой.', 'Swipe up to take the cap off; the lamp is lit with a match.', 'Yuqoriga suring — qalpoqchani oling; lampa gugurt bilan yoqiladi.')),
    drag(t('Перетащите пробирку с водородом отверстием вниз к пламени спиртовки.', 'Drag the hydrogen tube, mouth down, to the spirit-lamp flame.', 'Vodorodli probirkani og‘zi pastga qaratib spirt lampasi alangasiga torting.')),
    drag(t('Перетащите холодную стеклянную пластинку к пламени водорода.', 'Drag the cold glass plate to the hydrogen flame.', 'Sovuq shisha plastinkani vodorod alangasiga torting.')),
  ],  ...LAB_PRACTICAL_STEP_ACTIONS,
  ...LAB_WORKS_STEP_ACTIONS,
  ...LAB_TASK_STEP_ACTIONS,
}

/* ── «Что произошло»: короткое объяснение на уровне частиц (доска рисует анимацию по этим данным) ── */

export interface LabParticleStory {
  /** Уравнение, которое показывает анимация (ионное — для обмена и замещения). */
  readonly equation: string
  readonly text: LabText
}

export const LAB_PARTICLE_STORY: Readonly<Record<LabExperimentId, LabParticleStory>> = {
  baso4: {
    equation: 'Ba²⁺ + SO₄²⁻ → BaSO₄↓',
    text: t(
      'В растворах есть ионы. Ионы Ba²⁺ и SO₄²⁻ встречаются и связываются в нерастворимый BaSO₄ — он выпадает белым осадком. Ионы H⁺ и Cl⁻ остаются в растворе (это соляная кислота).',
      'The solutions contain ions. Ba²⁺ and SO₄²⁻ ions meet and bind into insoluble BaSO₄, which falls out as a white precipitate. H⁺ and Cl⁻ ions stay in the solution (that is hydrochloric acid).',
      'Eritmalarda ionlar bor. Ba²⁺ va SO₄²⁻ ionlari uchrashib, erimaydigan BaSO₄ ga birikadi — u oq cho‘kma bo‘lib tushadi. H⁺ va Cl⁻ ionlari eritmada qoladi (bu xlorid kislota).',
    ),
  },
  'ch4-burn': {
    equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O',
    text: t(
      'Молекула метана CH₄ встречает две молекулы кислорода O₂. Атомы перестраиваются: углерод уходит в CO₂, водород — в две молекулы воды H₂O. При этом выделяется тепло Q.',
      'A methane molecule CH₄ meets two oxygen molecules O₂. The atoms rearrange: carbon goes into CO₂, hydrogen into two water molecules H₂O. Heat Q is released.',
      'Metan CH₄ molekulasi ikkita kislorod O₂ molekulasi bilan uchrashadi. Atomlar qayta joylashadi: uglerod CO₂ ga, vodorod ikkita suv H₂O molekulasiga o‘tadi. Bunda issiqlik Q ajraladi.',
    ),
  },
  'zn-hcl': {
    equation: 'Zn + 2H⁺ → Zn²⁺ + H₂↑',
    text: t(
      'Атом цинка отдаёт два электрона двум ионам водорода H⁺ из кислоты. Цинк переходит в раствор (ZnCl₂), а атомы водорода соединяются в молекулу H₂ — это пузырьки газа.',
      'A zinc atom gives two electrons to two hydrogen ions H⁺ from the acid. Zinc goes into the solution (ZnCl₂), and the hydrogen atoms join into an H₂ molecule: these are the gas bubbles.',
      'Rux atomi kislotadagi ikkita vodorod ioni H⁺ ga ikkita elektron beradi. Rux eritmaga o‘tadi (ZnCl₂), vodorod atomlari esa H₂ molekulasiga birikadi — bular gaz pufakchalari.',
    ),
  },
  'h2-practical': {
    equation: '2H₂ + O₂ → 2H₂O',
    text: t(
      'Цинк вытесняет водород из кислоты: Zn + 2HCl → ZnCl₂ + H₂↑. Водород легче воздуха, поэтому его собирают в пробирку вверх дном. При горении две молекулы H₂ соединяются с молекулой O₂ — образуются две молекулы воды.',
      'Zinc displaces hydrogen from the acid: Zn + 2HCl → ZnCl₂ + H₂↑. Hydrogen is lighter than air, so it is collected in an upside-down tube. When it burns, two H₂ molecules combine with one O₂ molecule to form two water molecules.',
      'Rux kislotadan vodorodni siqib chiqaradi: Zn + 2HCl → ZnCl₂ + H₂↑. Vodorod havodan yengil, shuning uchun u to‘ntarilgan probirkaga yig‘iladi. Yonganda ikkita H₂ molekulasi bitta O₂ molekulasi bilan birikib, ikkita suv molekulasini hosil qiladi.',
    ),
  },  ...LAB_PRACTICAL_STORY,
  ...LAB_WORKS_STORY,
  ...LAB_TASK_STORY,
}

/* ── Мини-проверка после опыта: признак реакции, тип реакции, продукт ── */

export interface LabQuizQuestion {
  readonly id: 'sign' | 'type' | 'product'
  readonly q: LabText
  readonly options: readonly LabText[]
  /** Индекс правильного варианта. */
  readonly correct: number
  /** Объяснение после ответа. */
  readonly why: LabText
}

const SIGN_Q = t('Какой признак реакции вы наблюдали?', 'Which sign of a reaction did you observe?', 'Qaysi reaksiya belgisini kuzatdingiz?')
const TYPE_Q = t('К какому типу относится реакция?', 'What type of reaction is it?', 'Reaksiya qaysi turga kiradi?')
const PRODUCT_Q = t('Какое вещество образовалось?', 'Which substance was formed?', 'Qaysi modda hosil bo‘ldi?')
const O_PRECIP = t('Выпал осадок', 'A precipitate formed', 'Cho‘kma tushdi')
const O_GAS = t('Выделился газ', 'A gas was given off', 'Gaz ajraldi')
const O_HEAT = t('Выделились тепло и свет', 'Heat and light were given off', 'Issiqlik va yorug‘lik ajraldi')
const O_COLOR = t('Изменился цвет', 'The colour changed', 'Rang o‘zgardi')
const T_EXCHANGE = t('Обмена', 'Exchange', 'Almashinish')
const T_SUBST = t('Замещения', 'Substitution', 'O‘rin olish')
const T_COMB = t('Соединения', 'Combination', 'Birikish')
const T_DECOMP = t('Разложения', 'Decomposition', 'Parchalanish')

export const LAB_QUIZ: Readonly<Record<LabExperimentId, readonly LabQuizQuestion[]>> = {
  baso4: [
    {
      id: 'sign',
      q: SIGN_Q,
      options: [O_GAS, O_PRECIP, O_COLOR],
      correct: 1,
      why: t('Сразу появилась белая муть, затем осадок осел на дно.', 'A white cloudiness appeared at once, then the solid settled to the bottom.', 'Darhol oq loyqa paydo bo‘ldi, keyin cho‘kma tubga cho‘kdi.'),
    },
    {
      id: 'type',
      q: TYPE_Q,
      options: [T_SUBST, T_COMB, T_EXCHANGE],
      correct: 2,
      why: t('Два сложных вещества обменялись составными частями: Ba и H поменялись местами.', 'Two compounds swapped their parts: Ba and H changed places.', 'Ikki murakkab modda tarkibiy qismlari bilan almashdi: Ba va H o‘rin almashdi.'),
    },
    {
      id: 'product',
      q: PRODUCT_Q,
      options: [t('BaSO₄ — белый осадок', 'BaSO₄, a white precipitate', 'BaSO₄ — oq cho‘kma'), t('H₂ — газ', 'H₂, a gas', 'H₂ — gaz'), t('BaCl₂ — соль', 'BaCl₂, a salt', 'BaCl₂ — tuz')],
      correct: 0,
      why: t('Сульфат бария BaSO₄ не растворяется в воде, поэтому выпадает в осадок (↓).', 'Barium sulfate BaSO₄ does not dissolve in water, so it precipitates (↓).', 'Bariy sulfat BaSO₄ suvda erimaydi, shuning uchun cho‘kmaga tushadi (↓).'),
    },
  ],
  'ch4-burn': [
    {
      id: 'sign',
      q: SIGN_Q,
      options: [O_PRECIP, O_HEAT, O_COLOR],
      correct: 1,
      why: t('Метан горит голубым пламенем, выделяется тепло Q — это главный признак опыта.', 'Methane burns with a blue flame and releases heat Q: the main sign in this experiment.', 'Metan ko‘k alanga bilan yonadi, issiqlik Q ajraladi — tajribaning asosiy belgisi.'),
    },
    {
      id: 'type',
      q: TYPE_Q,
      options: [t('Горение (реакция с кислородом)', 'Combustion (reaction with oxygen)', 'Yonish (kislorod bilan reaksiya)'), T_EXCHANGE, T_DECOMP],
      correct: 0,
      why: t('Метан соединяется с кислородом воздуха O₂ с выделением тепла и света — это горение.', 'Methane combines with oxygen O₂ from the air, releasing heat and light: this is combustion.', 'Metan havodagi kislorod O₂ bilan issiqlik va yorug‘lik chiqarib birikadi — bu yonish.'),
    },
    {
      id: 'product',
      q: t('Как доказали, что образовался CO₂?', 'How did we prove that CO₂ was formed?', 'CO₂ hosil bo‘lganini qanday isbotladik?'),
      options: [
        t('Известковая вода помутнела', 'The limewater turned milky', 'Ohakli suv loyqalandi'),
        t('На стакане появились капли', 'Droplets appeared on the beaker', 'Stakanda tomchilar paydo bo‘ldi'),
        t('Пламя стало голубым', 'The flame turned blue', 'Alanga ko‘k bo‘ldi'),
      ],
      correct: 0,
      why: t(
        'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O: нерастворимый карбонат кальция делает известковую воду мутной. Капли на стакане доказывают воду H₂O.',
        'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O: insoluble calcium carbonate makes limewater milky. The droplets prove water H₂O.',
        'CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O: erimaydigan kalsiy karbonat ohakli suvni loyqa qiladi. Stakandagi tomchilar suv H₂O ni isbotlaydi.',
      ),
    },
  ],
  'zn-hcl': [
    {
      id: 'sign',
      q: SIGN_Q,
      options: [O_PRECIP, O_COLOR, O_GAS],
      correct: 2,
      why: t('На поверхности цинка появляются пузырьки газа и поднимаются вверх.', 'Gas bubbles appear on the zinc surface and rise.', 'Rux sirtida gaz pufakchalari paydo bo‘lib, yuqoriga ko‘tariladi.'),
    },
    {
      id: 'type',
      q: TYPE_Q,
      options: [T_EXCHANGE, T_SUBST, T_COMB],
      correct: 1,
      why: t('Простое вещество цинк замещает водород в сложном веществе HCl.', 'The simple substance zinc replaces hydrogen in the compound HCl.', 'Oddiy modda rux murakkab modda HCl dagi vodorod o‘rnini oladi.'),
    },
    {
      id: 'product',
      q: t('Какой газ выделяется?', 'Which gas is given off?', 'Qaysi gaz ajraladi?'),
      options: [t('Водород H₂', 'Hydrogen H₂', 'Vodorod H₂'), t('Кислород O₂', 'Oxygen O₂', 'Kislorod O₂'), t('Углекислый газ CO₂', 'Carbon dioxide CO₂', 'Karbonat angidrid CO₂')],
      correct: 0,
      why: t('Zn + 2HCl → ZnCl₂ + H₂↑ — водород выделяется в виде пузырьков.', 'Zn + 2HCl → ZnCl₂ + H₂↑: hydrogen is given off as bubbles.', 'Zn + 2HCl → ZnCl₂ + H₂↑ — vodorod pufakchalar holida ajraladi.'),
    },
  ],
  'h2-practical': [
    {
      id: 'sign',
      q: t('Как узнать, что водород чистый?', 'How do you know the hydrogen is pure?', 'Vodorod toza ekanini qanday bilasiz?'),
      options: [
        t('Глухой хлопок у пламени', 'A dull pop at the flame', 'Alangada bo‘g‘iq qarsillash'),
        t('Резкий лающий звук', 'A sharp barking sound', 'Keskin hurgan ovoz'),
        t('Пробирка нагревается', 'The tube gets hot', 'Probirka qiziydi'),
      ],
      correct: 0,
      why: t(
        'Чистый водород сгорает с глухим хлопком; резкий лающий звук — смесь с воздухом, поджигать её нельзя.',
        'Pure hydrogen burns with a dull pop; a sharp barking sound means a mixture with air, which must not be lit.',
        'Toza vodorod bo‘g‘iq qarsillab yonadi; keskin hurgan ovoz — havo bilan aralashma, uni yoqish mumkin emas.',
      ),
    },
    {
      id: 'type',
      q: t('Почему пробирку для сбора держат вверх дном?', 'Why is the collecting tube held upside down?', 'Nega yig‘uvchi probirka to‘ntarib tutiladi?'),
      options: [
        t('Водород тяжелее воздуха', 'Hydrogen is heavier than air', 'Vodorod havodan og‘ir'),
        t('Водород легче воздуха', 'Hydrogen is lighter than air', 'Vodorod havodan yengil'),
        t('Так быстрее нагревается', 'It heats up faster', 'Shunday tezroq qiziydi'),
      ],
      correct: 1,
      why: t('Водород — самый лёгкий газ: он поднимается и вытесняет воздух из перевёрнутой пробирки.', 'Hydrogen is the lightest gas: it rises and pushes the air out of the upside-down tube.', 'Vodorod — eng yengil gaz: u ko‘tarilib, to‘ntarilgan probirkadan havoni siqib chiqaradi.'),
    },
    {
      id: 'product',
      q: t('Что образуется при горении водорода?', 'What forms when hydrogen burns?', 'Vodorod yonganda nima hosil bo‘ladi?'),
      options: [t('Вода H₂O', 'Water H₂O', 'Suv H₂O'), t('Углекислый газ CO₂', 'Carbon dioxide CO₂', 'Karbonat angidrid CO₂'), t('Соляная кислота HCl', 'Hydrochloric acid HCl', 'Xlorid kislota HCl')],
      correct: 0,
      why: t('2H₂ + O₂ → 2H₂O: на холодной пластинке появляются капли воды.', '2H₂ + O₂ → 2H₂O: water droplets appear on the cold plate.', '2H₂ + O₂ → 2H₂O: sovuq plastinkada suv tomchilari paydo bo‘ladi.'),
    },
  ],
  ...LAB_PRACTICAL_QUIZ,
  ...LAB_WORKS_QUIZ,
  ...LAB_TASK_QUIZ,
}
