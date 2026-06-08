import { CHEMISTRY_KNOWLEDGE_EXTENDED } from './learnChemistryKnowledgeExtended'
import { CHEMISTRY_KNOWLEDGE_CORPUS } from './learnChemistryKnowledgeCorpus'
import { CHEMISTRY_KNOWLEDGE_BRAIN } from './learnChemistryBrain'

/** Школьная химия 7–11 класс — офлайн-база для ИИ-учителя. */
export type ChemistryKnowledgeChunk = {
  id: string
  topic: string
  grades?: number[]
  keywords: string[]
  ru: string
  en: string
  /** Привязка к учебнику Kimyo 7 класс */
  textbook?: {
    gradeId: 'g7'
    chapterId: string
    sectionId: string
    page: number
    rememberRu: string
    rememberEn: string
  }
}

export const CHEMISTRY_KNOWLEDGE_CHUNKS: ChemistryKnowledgeChunk[] = [
  {
    id: 'intro-chemistry',
    topic: 'Химия как наука',
    grades: [7],
    keywords: ['хими', 'наук', 'веществ', 'реакц', 'лаборатор', 'chemistry', 'science'],
    ru: `**Химия** изучает вещества, их состав, строение, свойства и превращения. Главные задачи: получать новые вещества, исследовать свойства, применять знания в жизни и технике.

Химия связана с физикой (энергия, агрегатные состояния), биологией (белки, ДНК), медициной и экологией. В лаборатории соблюдают ТБ: очки, халат, вытяжка, не пробовать на вкус.`,
    en: `**Chemistry** studies substances, composition, structure, properties, and transformations. Lab safety: goggles, coat, fume hood.`,
  },
  {
    id: 'pure-mixture',
    topic: 'Чистые вещества и смеси',
    grades: [7],
    keywords: ['чист', 'смес', 'гомоген', 'гетероген', 'раствор', 'коллоид', 'pure', 'mixture', 'solution'],
    ru: `**Чистое вещество** — постоянный состав и свойства (дистиллированная вода, медь, кислород). **Смесь** — два и более веществ, разделимых физическими методами.

**Гомогенная** смесь однородна (соль в воде, воздух). **Гетерогенная** — видны частицы (песок в воде, молоко). Методы разделения: фильтрация, выпаривание, дистилляция, магнит, сито, декантация.`,
    en: `Pure substances have fixed composition; mixtures can be separated physically. Homogeneous vs heterogeneous; filtration, evaporation, distillation.`,
  },
  {
    id: 'physical-chemical',
    topic: 'Физические и химические явления',
    grades: [7],
    keywords: ['физическ', 'химическ', 'явлен', 'плавлен', 'горен', 'ржав', 'physical', 'chemical', 'change'],
    ru: `**Физическое явление** — вещество остаётся тем же (плавление льда, кипение воды, измельчение). **Химическое** — образуются новые вещества (горение, ржавление, гашение извести).

Признаки химической реакции: изменение цвета, газ, осадок, тепло/свет, запах. Обратимость: физические чаще обратимы, многие химические — нет.`,
    en: `Physical changes keep the same substance; chemical changes form new substances. Signs: color, gas, precipitate, heat, odor.`,
  },
  {
    id: 'atoms-molecules',
    topic: 'Атомы и молекулы',
    grades: [8],
    keywords: ['атом', 'молекул', 'электрон', 'протон', 'нейтрон', 'ядро', 'atom', 'molecule', 'electron'],
    ru: `**Атом** — мельчайшая частица элемента. Состоит из ядра (протоны + нейтроны) и электронной оболочки. **Молекула** — частица из связанных атомов (H₂O, O₂).

**Изотопы** — атомы одного элемента с разным числом нейтронов. Массовое число A = Z + N. В химических реакциях атомы не исчезают — перегруппировываются.`,
    en: `Atoms have nucleus (protons, neutrons) and electrons. Molecules are bonded atoms. Isotopes differ in neutrons.`,
  },
  {
    id: 'periodic-table',
    topic: 'Периодический закон',
    grades: [8, 9],
    keywords: ['период', 'менделеев', 'групп', 'периодич', 'металл', 'неметалл', 'periodic', 'mendeleev', 'group'],
    ru: `**Периодический закон**: свойства элементов зависят от заряда ядра и повторяются периодически. Группы — столбцы (одинаковая валентность/свойства), периоды — строки.

**Металлы** — слева/внизу (электропроводность, блеск). **Неметаллы** — справа/вверху. **Благородные газы** — инертны (He, Ne, Ar). Валентность и степень окисления помогают составлять формулы.`,
    en: `Periodic law: properties repeat with atomic number. Groups are columns; periods are rows. Metals vs nonmetals.`,
  },
  {
    id: 'chemical-bond',
    topic: 'Химическая связь',
    grades: [8, 9],
    keywords: ['связ', 'ионн', 'ковалент', 'металлич', 'электроотриц', 'bond', 'ionic', 'covalent'],
    ru: `**Ионная связь** — перенос электронов (NaCl: Na⁺ и Cl⁻). **Ковалентная** — общая пара электронов (H₂, H₂O, CH₄). **Металлическая** — «электронное море» в металлах.

Полярная ковалентная связь — разная электроотрицательность (HCl). Вещества с ионной связью — твёрдые кристаллы, высокие t плавления; ковалентные молекулы — разные агрегатные состояния.`,
    en: `Ionic bond (electron transfer), covalent (shared electrons), metallic bond in metals. Polarity from electronegativity difference.`,
  },
  {
    id: 'equations-balance',
    topic: 'Химические уравнения',
    grades: [8, 9],
    keywords: ['уравнен', 'коэффициент', 'баланс', 'расстав', 'equation', 'balance', 'coefficient'],
    ru: `**Химическое уравнение** — запись реакции формулами с коэффициентами. Закон сохранения массы: число атомов каждого элемента одинаково слева и справа.

Методы балансировки: подбор коэффициентов, электронный баланс (для ОВР). Типы: соединение, разложение, замещение, обмен.`,
    en: `Balance equations by conserving atoms. Types: synthesis, decomposition, single replacement, double replacement.`,
  },
  {
    id: 'oxides',
    topic: 'Оксиды',
    grades: [8, 9],
    keywords: ['оксид', 'основн', 'кислотн', 'амфотер', 'oxide', 'basic', 'acidic', 'amphoteric'],
    ru: `**Оксиды** — соединения элемента с кислородом. **Основные** (Na₂O, CaO, CuO) — с кислотами дают соль и воду. **Кислотные** (SO₂, CO₂, P₂O₅) — с основаниями. **Амфотерные** (Al₂O₃, ZnO) — реагируют и с кислотами, и с щёлочами.

Получение: сжигание элементов, разложение, восстановление.`,
    en: `Oxides: basic, acidic, amphoteric. Basic + acid → salt + water; amphoteric react with both acids and bases.`,
  },
  {
    id: 'acids-bases',
    topic: 'Кислоты и основания',
    grades: [8, 9, 11],
    keywords: ['кислот', 'основан', 'щелоч', 'ph', 'нейтрализац', 'acid', 'base', 'alkali', 'neutralization'],
    ru: `**Кислоты** — дают H⁺ в воде (HCl, H₂SO₄, HNO₃, CH₃COOH). **Основания** — OH⁻ (NaOH, Ca(OH)₂). **Щёлочи** — растворимые основания.

**pH** < 7 кислая среда, > 7 щелочная, = 7 нейтральная. **Нейтрализация**: кислота + основание → соль + H₂O. Индикаторы: лакмус, фенолфталеин, универсальный.`,
    en: `Acids release H⁺; bases release OH⁻. pH scale; neutralization gives salt + water. Indicators change color.`,
  },
  {
    id: 'salts',
    topic: 'Соли',
    grades: [8, 9],
    keywords: ['сол', 'сульфат', 'хлорид', 'нитрат', 'карбонат', 'salt', 'sulfate', 'chloride'],
    ru: `**Соли** — катион металла (или NH₄⁺) + анион кислотного остатка. Примеры: NaCl, CuSO₄, CaCO₃, (NH₄)₂SO₄.

Получение: нейтрализация, металл + кислота, осаждение, обмен. Растворимость — по таблице растворимости. Качественные реакции: осадки, окраска ионов.`,
    en: `Salts: cation + anion. Preparation by neutralization, metal+acid, precipitation. Solubility rules apply.`,
  },
  {
    id: 'redox',
    topic: 'ОВР',
    grades: [9, 10, 11],
    keywords: ['овр', 'окисл', 'восстанов', 'электрон', 'степень окислен', 'redox', 'oxidation', 'reduction'],
    ru: `**ОВР** — перенос электронов. **Восстановитель** отдаёт e⁻ (степень окисления ↑). **Окислитель** принимает e⁻ (степень окисления ↓).

Баланс: метод электронного баланса. Важные окислители: O₂, halogens, KMnO₄, K₂Cr₂O₇. Восстановители: металлы, H₂, C. Электролиз и гальванические элементы — приложения ОВР.`,
    en: `Redox: electron transfer. Oxidation number changes. Electron balance method for equations.`,
  },
  {
    id: 'stoichiometry',
    topic: 'Расчёты по уравнениям',
    grades: [8, 9, 10, 11],
    keywords: ['моль', 'моляр', 'масса', 'объём', 'задач', 'расчёт', 'стехиометр', 'mole', 'molar', 'stoichiometry'],
    ru: `**Моль** — 6,02·10²³ частиц. n = m/M; для газов при н.у.: n = V/22,4 (л/моль).

По уравнению: коэффициенты = мольные соотношения. Алгоритм: уравнение → n реагента → n продукта → m или V. Массовая доля ω = m(вещества)/m(раствора).`,
    en: `Mole n=m/M; gas STP V=22.4n. Stoichiometry from balanced equations. Mass fraction calculations.`,
  },
  {
    id: 'solutions',
    topic: 'Растворы',
    grades: [9, 10],
    keywords: ['раствор', 'растворим', 'концентрац', 'моляльн', 'массовая доля', 'solution', 'solubility', 'concentration'],
    ru: `**Раствор** — гомогенная смесь растворителя и растворённого вещества. **Массовая доля** ω (%), **молярная концентрация** c (моль/л).

Растворимость зависит от T. Ненасыщенный/насыщенный/пересыщенный раствор. Кристаллизация, электролиз растворов — практические темы.`,
    en: `Solutions: mass percent, molarity. Solubility and saturation. Crystallization from solutions.`,
  },
  {
    id: 'metals',
    topic: 'Металлы',
    grades: [9, 10, 11],
    keywords: ['металл', 'железо', 'алюмин', 'медь', 'цинк', 'натрий', 'калий', 'metal', 'iron', 'aluminum'],
    ru: `**Металлы** — электропроводность, ковкость, блеск. Активные (Na, K, Ca, Mg, Al, Zn, Fe) реагируют с водой/кислотами. Менее активные — Cu, Ag, Au.

Получение: электролиз, восстановление углем/водородом. Коррозия железа — защита цинкованием, окраской. Сплавы: сталь, бронза, латунь.`,
    en: `Metals: conductivity and reactivity series. Corrosion and protection. Alloys: steel, bronze, brass.`,
  },
  {
    id: 'nonmetals',
    topic: 'Неметаллы',
    grades: [9, 10],
    keywords: ['неметалл', 'хлор', 'сера', 'фосфор', 'углерод', 'азот', 'nonmetal', 'chlorine', 'sulfur'],
    ru: `**Неметаллы**: H, C, N, O, P, S, halogens. **Галогены** (F₂, Cl₂, Br₂, I₂) — окислители, активность падает вниз по группе. **Сера** — SO₂, H₂SO₄. **Фосфор** — аллотропы, H₃PO₄.

Углерод: алмаз, графит, CO, CO₂. Азот: NH₃, HNO₃. Безопасность: токсичные газы только в вытяжке.`,
    en: `Nonmetals: halogens, sulfur, phosphorus, carbon, nitrogen families. Toxic gases need a fume hood.`,
  },
  {
    id: 'organic-intro',
    topic: 'Основы органической химии',
    grades: [10, 11],
    keywords: ['органическ', 'углеводород', 'алкан', 'алкен', 'алкин', 'бензол', 'organic', 'hydrocarbon', 'alkane'],
    ru: `**Органическая химия** — соединения углерода (кроме CO, CO₂, карбонатов). **Алканы** CₙH₂ₙ₊₂ (одинарные связи), **алкены** CₙH₂ₙ (двойная), **алкины** CₙH₂ₙ₋₂ (тройная).

Гомологический ряд, изомерия. Именование по IUPAC. Реакции: замещение (алканы), присоединение (алкены), горение.`,
    en: `Organic chemistry: hydrocarbons alkanes, alkenes, alkynes. Isomerism and IUPAC naming.`,
  },
  {
    id: 'organic-oxygen',
    topic: 'Кислородсодержащие органические',
    grades: [10, 11],
    keywords: ['спирт', 'альдегид', 'кетон', 'карбонов', 'эфир', 'alcohol', 'aldehyde', 'ketone', 'carboxylic'],
    ru: `**Спирты** R-OH (этанол, глицерин). **Альдегиды** R-CHO, **кетоны** R-CO-R'. **Карбоновые кислоты** R-COOH (уксусная). **Эфиры** R-O-R'.

Окисление спиртов, этерификация (кислота + спирт → эфир + вода). Полимеры из органических мономеров.`,
    en: `Alcohols, aldehydes, ketones, carboxylic acids, ethers. Esterification and oxidation of alcohols.`,
  },
  {
    id: 'electrochemistry',
    topic: 'Электрохимия',
    grades: [10, 11],
    keywords: ['электролиз', 'гальван', 'электрод', 'анод', 'катод', 'электролит', 'electrolysis', 'galvanic', 'electrode'],
    ru: `**Электролиз** — разложение вещества током. На катоде (−) восстановление, на аноде (+) окисление. **Гальванический элемент** — химическая энергия → электрическая (Zn|Cu).

Правило: более активный металл — анод. Применения: покрытия, получение Al, Na, Cl₂. Коррозия — гальваническая пара.`,
    en: `Electrolysis uses current; galvanic cells produce current. Cathode reduction, anode oxidation.`,
  },
  {
    id: 'kinetics-equilibrium',
    topic: 'Скорость и равновесие',
    grades: [10, 11],
    keywords: ['скорост', 'катализ', 'равновес', 'ле шателье', 'эндотерм', 'экзотерм', 'kinetics', 'equilibrium', 'catalyst'],
    ru: `**Скорость реакции** ↑ при росте T, концентрации, давления (газы), при катализаторе. **Катализатор** ускоряет, не расходуется.

**Химическое равновесие** — v₁ = v₂. **Принцип Ле Шателье**: система противодействует изменению (T, P, концентрации). Экзотермические сдвигаются при охлаждении.`,
    en: `Rate factors: temperature, concentration, catalyst. Le Chatelier's principle for equilibrium shifts.`,
  },
  {
    id: 'lab-safety',
    topic: 'Техника безопасности',
    grades: [7, 8, 9, 10, 11],
    keywords: ['безопасн', 'травм', 'вытяжк', 'очки', 'кислот', 'щелоч', 'ожог', 'safety', 'hazard', 'lab'],
    ru: `В кабинете химии: **очки**, халат, волосы убраны. Кислоты разбавлять: кислоту в воду, не наоборот. При попадании кислоты/щёлочи — промыть водой, сообщить учителю.

Нюхать непосредственно нельзя — только осторожно пальцами. Горючие вдали от огня. Отходы — в указанную тару. K₂Cr₂O₇, Hg — токсичны, строго по инструкции.`,
    en: `Lab safety: goggles, add acid to water, rinse spills, no tasting. Toxic reagents need teacher supervision.`,
  },
  {
    id: 'qualitative-analysis',
    topic: 'Качественный анализ',
    grades: [9, 10, 11],
    keywords: ['качествен', 'анализ', 'катион', 'анион', 'осадок', 'реактив', 'qualitative', 'precipitate', 'ion'],
    ru: `**Качественный анализ** определяет ионы в смеси. **Катионы**: NH₄⁺ (запах NH₃), Fe³⁺ (бурый осадок), Cu²⁺ (голубой раствор), Ag⁺ (белый AgCl).

**Анионы**: Cl⁻ (AgCl белый), SO₄²⁻ (BaSO₄ белый), CO₃²⁻ (пузырьки CO₂ с кислотой). Систематический анализ — последовательность реакций.`,
    en: `Qualitative analysis identifies ions by characteristic precipitates and colors. Systematic analysis schemes.`,
  },
  {
    id: 'hydrocarbons-fuels',
    topic: 'Топлива и горение',
    grades: [8, 9, 10],
    keywords: ['горен', 'топлив', 'метан', 'пропан', 'угарн', 'co', 'combustion', 'fuel', 'methane'],
    ru: `**Горение** — быстрая реакция с O₂ с выделением тепла. Полное горение углеводородов: CO₂ + H₂O. **Неполное** — CO (угарный газ, ядовит) или сажа.

Метан CH₄ — природный газ. Пропан-бутан — баллоны. Условия горения: достаточно O₂, температура воспламенения.`,
    en: `Combustion with oxygen; complete gives CO₂ and H₂O; incomplete may give toxic CO. Fuel gases: methane, propane.`,
  },
  {
    id: 'polymers-biochem',
    topic: 'Полимеры и биохимия',
    grades: [10, 11],
    keywords: ['полимер', 'белок', 'аминокислот', 'днк', 'крахмал', 'целлюлоз', 'polymer', 'protein', 'starch'],
    ru: `**Полимеры** — большие молекулы (полиэтилен, ПВХ, натуральный каучук). **Белки** — из аминокислот, ферменты. **Углеводы**: глюкоза, крахмал (синий с йодом), целлюлоза.

ДНК — наследственная информация. Биохимия связывает химию с живыми системами.`,
    en: `Polymers, proteins, carbohydrates, DNA — macromolecules in living systems.`,
  },
  {
    id: 'environment',
    topic: 'Химия и окружающая среда',
    grades: [9, 10, 11],
    keywords: ['эколог', 'загрязнен', 'озон', 'кислотн', 'дожд', 'парников', 'environment', 'pollution', 'greenhouse'],
    ru: `Химия в экологии: **кислотные дожди** (SO₂, NOₓ), **парниковый эффект** (CO₂, CH₄), озоновый слой (CFC).

Очистка сточных вод, каталитические нейтрализаторы автомобилей. Ответственное обращение с отходами и токсичными веществами.`,
    en: `Environmental chemistry: acid rain, greenhouse gases, ozone layer, wastewater treatment.`,
  },
  ...CHEMISTRY_KNOWLEDGE_EXTENDED,
  ...CHEMISTRY_KNOWLEDGE_CORPUS,
  ...CHEMISTRY_KNOWLEDGE_BRAIN,
]

export const CHEMISTRY_KNOWLEDGE_CHUNK_COUNT = CHEMISTRY_KNOWLEDGE_CHUNKS.length
