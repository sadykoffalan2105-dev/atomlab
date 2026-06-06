import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'

/** Расширенные темы школьной химии 7–11 класс. */
export const CHEMISTRY_KNOWLEDGE_EXTENDED: ChemistryKnowledgeChunk[] = [
  {
    id: 'g7-substances',
    topic: 'Вещества и их свойства',
    grades: [7],
    keywords: ['веществ', 'свойств', 'агрегат', 'тверд', 'жидк', 'газ', 'property', 'state'],
    ru: `Вещества различают по **агрегатному состоянию** (твёрдое, жидкое, газообразное) и **физическим свойствам**: цвет, запах, плотность, растворимость, температура плавления и кипения.

Химические свойства — способность вступать в реакции (горючесть, окисляемость). Одно и то же вещество может быть в разных состояниях (лёд, вода, пар).`,
    en: `Substances have physical properties (color, density, solubility) and chemical properties (reactivity). States: solid, liquid, gas.`,
  },
  {
    id: 'g7-separation',
    topic: 'Разделение смесей',
    grades: [7],
    keywords: ['разделен', 'фильтр', 'выпар', 'дистилл', 'магнит', 'сито', 'separation', 'filter', 'distill'],
    ru: `**Фильтрация** — нерастворимые частицы. **Выпаривание** — извлечение растворённого вещества. **Дистилляция** — разделение по температуре кипения. **Магнит** — железные частицы. **Сито/декантация** — по размеру частиц или плотности.

Выбор метода зависит от типа смеси: твёрдое+жидкое, жидкое+жидкое, газ+газ.`,
    en: `Separation: filtration, evaporation, distillation, magnet, sieving. Method depends on mixture type.`,
  },
  {
    id: 'g8-valency',
    topic: 'Валентность и формулы',
    grades: [8],
    keywords: ['валентност', 'формул', 'состав', 'индекс', 'valency', 'formula'],
    ru: `**Валентность** — число связей атома. Составляют формулы по валентности: Al(III) + O(II) → Al₂O₃. Простые вещества: H₂, O₂, N₂, Cl₂.

**Степень окисления** — условный заряд в соединении; сумма степеней окисления = 0 в молекуле, = заряду в ионе.`,
    en: `Valency determines formulas. Oxidation states sum to zero in neutral molecules.`,
  },
  {
    id: 'g8-reaction-types',
    topic: 'Типы химических реакций',
    grades: [8, 9],
    keywords: ['соединен', 'разложен', 'замещен', 'обмен', 'тип реакц', 'synthesis', 'decomposition', 'replacement'],
    ru: `**Соединение**: A + B → AB (2H₂ + O₂ → 2H₂O). **Разложение**: AB → A + B (2H₂O → 2H₂ + O₂). **Замещение**: A + BC → AC + B (Fe + CuSO₄). **Обмен**: AB + CD → AD + CB (AgNO₃ + NaCl).

Также: окислительно-восстановительные, ионного обмена, каталитические.`,
    en: `Reaction types: synthesis, decomposition, single replacement, double replacement, redox, ion exchange.`,
  },
  {
    id: 'g8-combustion',
    topic: 'Горение и окисление',
    grades: [8, 9],
    keywords: ['горен', 'окислен', 'восстанов', 'кислород', 'combustion', 'oxidation'],
    ru: `**Горение** — быстрое окисление с теплом и светом. Нужны: горючее, окислитель (обычно O₂), температура воспламенения.

Медленное окисление: ржавление Fe, почернение серебра. Полное горение углеводородов → CO₂ + H₂O.`,
    en: `Combustion is rapid oxidation. Slow oxidation: rust. Complete hydrocarbon combustion gives CO₂ and H₂O.`,
  },
  {
    id: 'g9-hydrogen',
    topic: 'Водород и вода',
    grades: [8, 9],
    keywords: ['водород', 'h2', 'h₂', 'электролиз воды', 'hydrogen', 'electrolysis water'],
    ru: `**H₂** — самый лёгкий газ, восстановитель. Получение: Zn + 2HCl → ZnCl₂ + H₂↑; каталитическое: CH₄ + H₂O.

**Вода** — полярный растворитель, водородные связи. Электролиз воды (с электролитом): катод H₂, анод O₂.`,
    en: `Hydrogen from Zn + acid or reforming. Water electrolysis gives H₂ at cathode, O₂ at anode.`,
  },
  {
    id: 'g9-chlorine',
    topic: 'Хлор и галогениды',
    grades: [9],
    keywords: ['хлор', 'cl2', 'cl₂', 'галогенид', 'отбел', 'chlorine', 'halide', 'bleach'],
    ru: `**Cl₂** — жёлто-зелёный газ, сильный окислитель, ядовит. Получение: электролиз NaCl. С водой: Cl₂ + H₂O ⇄ HCl + HClO (отбеливание).

С AgNO₃: Cl⁻ → белый AgCl. С NaOH (холод): NaClO — отбеливающие растворы.`,
    en: `Chlorine is a toxic oxidizer. AgCl precipitate tests for chloride ions.`,
  },
  {
    id: 'g9-sulfuric',
    topic: 'Серная кислота',
    grades: [9, 10],
    keywords: ['серная', 'h2so4', 'h₂so₄', 'sulfuric', 'концентрирован'],
    ru: `**H₂SO₄** — сильная двухосновная кислота. Концентрированная — обезвоживает (сахар «уголь»), осторожно с водой!

Разбавление: **кислоту в воду** медленно, с перемешиванием. Реакции: с металлами (до H₂), с основаниями, с солями (BaSO₄ — белый осадок).`,
    en: `Sulfuric acid is strong and dehydrating. Always add acid to water. BaSO₄ is a white precipitate test.`,
  },
  {
    id: 'g9-nitric',
    topic: 'Азотная кислота',
    grades: [9, 10],
    keywords: ['азотная', 'hno3', 'hno₃', 'nitric', 'no2', 'no₂'],
    ru: `**HNO₃** — сильный окислитель. С металлами (кроме Au, Pt): выделяет NO₂ (бурые пары) или NO. Разбавленная — с Fe даёт Fe²⁺.

Применение: удобрения (через NH₃), взрывчатые вещества (школьно — только теория, без синтеза!).`,
    en: `Nitric acid is a strong oxidizer. With metals gives NO or NO₂. Used industrially for fertilizers.`,
  },
  {
    id: 'g9-alkali-metals',
    topic: 'Щелочные и щёлочноземельные металлы',
    grades: [9],
    keywords: ['щелочн', 'кальций', 'магний', 'бериллий', 'alkaline earth', 'calcium', 'magnesium'],
    ru: `**Щелочные** Na, K — +1, очень активны. **Щёлочноземельные** Ca, Mg — +2. Ca + 2H₂O → Ca(OH)₂ + H₂ (медленнее Na).

CaO (негашённая известь) + H₂O → Ca(OH)₂ (гашёная). Mg — в сплавах, «горящая лента».`,
    en: `Alkali metals (Na, K) and alkaline earth metals (Ca, Mg). CaO slaked to Ca(OH)₂.`,
  },
  {
    id: 'g9-iron',
    topic: 'Железо и сталь',
    grades: [9, 10],
    keywords: ['железо', 'fe', 'сталь', 'корроз', 'ржав', 'iron', 'steel', 'rust'],
    ru: `**Fe** — Fe²⁺ (бледно-зелёный) и Fe³⁺ (бурый гидроксид). Реакции: с HCl (H₂), с CuSO₄ (медь на поверхности).

**Коррозия** — Fe + O₂ + H₂O. Защита: лак, цинкование, легирование (нержавейка). **Сталь** — сплав Fe + C.`,
    en: `Iron chemistry: Fe²⁺/Fe³⁺. Rust is electrochemical corrosion. Steel is Fe-C alloy.`,
  },
  {
    id: 'g9-copper-zinc',
    topic: 'Медь и цинк',
    grades: [9],
    keywords: ['медь', 'цинк', 'zn', 'cu', 'латун', 'бронз', 'copper', 'zinc', 'brass'],
    ru: `**Cu** — малoактивный, Cu²⁺ голубой. CuSO₄·5H₂O синий. **Zn** — амфотерный металл, Zn + HCl, Zn + NaOH (школьно).

**Латунь** Cu+Zn, **бронза** Cu+Sn. Цинкование защищает железо.`,
    en: `Copper is less reactive; blue Cu²⁺ solutions. Zinc is amphoteric. Brass and bronze are alloys.`,
  },
  {
    id: 'g9-aluminum',
    topic: 'Алюминий',
    grades: [9, 10],
    keywords: ['алюмин', 'al', 'амфотер', 'пассив', 'aluminum', 'aluminium'],
    ru: `**Al** — лёгкий, пассивируется Al₂O₃. Реагирует с кислотами и щёлочами (амфотерность). Al₂O₃ — амфотерный оксид.

Получение: электролиз расплава Al₂O₃. Применение: фольга, конструкции, сплавы (дюраль).`,
    en: `Aluminum passivates with Al₂O₃. Amphoteric metal and oxide. Produced by electrolysis.`,
  },
  {
    id: 'g9-carbon-compounds',
    topic: 'Соединения углерода',
    grades: [9, 10],
    keywords: ['co', 'co2', 'co₂', 'карбонат', 'мрамор', 'известняк', 'carbonate', 'marble'],
    ru: `**CO** — ядовитый, восстановитель (blast furnace). **CO₂** — кислотный оксид, не поддерживает горение.

**Карбонаты** (CaCO₃): + HCl → CO₂↑. **Силикаты** — основа горных пород. Углерод: алмаз, графит, фуллерены (упоминание).`,
    en: `CO is toxic; CO₂ is acidic oxide. Carbonates with acid release CO₂.`,
  },
  {
    id: 'g9-phosphorus',
    topic: 'Фосфор',
    grades: [9],
    keywords: ['фосфор', 'p2o5', 'p₂o₅', 'h3po4', 'phosphorus', 'phosphate'],
    ru: `**Фосфор** — аллотропы (белый — ядовит, самовоспламеняется на воздухе; красный — безопаснее). **P₂O₅** — кислотный оксид. **H₃PO₄** — средняя кислота.

Фосфаты — удобрения. В организме — ДНК, АТФ.`,
    en: `Phosphorus allotropes. P₂O₅ and phosphoric acid. Phosphates in fertilizers and biology.`,
  },
  {
    id: 'g10-solutions-molality',
    topic: 'Концентрации растворов',
    grades: [9, 10, 11],
    keywords: ['моляльн', 'нормальн', 'массовая доля', 'ω', 'molarity', 'molality', 'percent'],
    ru: `**Массовая доля** ω = m(в-ва)/m(р-ра)·100%. **Молярность** c = n/V (моль/л). **Моляльность** — моль на кг растворителя.

Разбавление: c₁V₁ = c₂V₂. Задачи: найти m соли для приготовления раствора заданной ω.`,
    en: `Concentration: mass percent, molarity c=n/V, dilution c₁V₁=c₂V₂.`,
  },
  {
    id: 'g10-dissociation',
    topic: 'Электролитическая диссоциация',
    grades: [10, 11],
    keywords: ['диссоциац', 'ион', 'сильн', 'слаб', 'dissociation', 'ionization'],
    ru: `**Сильные электролиты** — почти полная диссоциация (NaCl, HCl, NaOH). **Слабые** — частичная (CH₃COOH, NH₃·H₂O).

Ионные уравнения: вычёркивают «наблюдателей». Проводимость растворов — от подвижности ионов.`,
    en: `Strong vs weak electrolytes. Ionic equations omit spectator ions.`,
  },
  {
    id: 'g10-hydrolysis',
    topic: 'Гидролиз солей',
    grades: [10, 11],
    keywords: ['гидролиз', 'среда', 'кислая', 'щелочн', 'hydrolysis', 'salt hydrolysis'],
    ru: `**Гидролиз** — ионы соли взаимодействуют с водой. Соль сильной кислоты + слабого основания → кислая среда (NH₄Cl). Слабой кислоты + сильного основания → щелочная (Na₂CO₃).

Соль сильной + сильной → pH ≈ 7. Индикаторы показывают среду.`,
    en: `Salt hydrolysis changes pH. Strong acid + weak base salt is acidic; weak acid + strong base is basic.`,
  },
  {
    id: 'g10-galvanic',
    topic: 'Гальванические элементы',
    grades: [10, 11],
    keywords: ['гальван', 'элемент', 'данье', 'вольт', 'galvanic', 'voltaic', 'cell'],
    ru: `**Гальванический элемент**: анод (−) — окисление, катод (+) — восстановление. ЭДС зависит от ряда напряжений.

Пример: Zn|Zn²⁺||Cu²⁺|Cu. Сольвой мост — замыкание цепи. Аккумулятор — обратимый элемент.`,
    en: `Galvanic cell: anode oxidation, cathode reduction. EMF from activity series.`,
  },
  {
    id: 'g10-thermochemistry',
    topic: 'Термохимия',
    grades: [10, 11],
    keywords: ['термохим', 'энтальп', 'теплот', 'уравнен', 'hess', 'enthalpy'],
    ru: `**Тепловой эффект** в уравнении: ΔH. Экзотермические (горение) ΔH < 0. Закон Гесса: ΔH не зависит от пути.

Теплота нейтрализации сильной кислоты и щёлочи ≈ const. Расчёты: Q = n·ΔH.`,
    en: `Thermochemistry: ΔH in equations. Hess's law. Exothermic ΔH < 0.`,
  },
  {
    id: 'g10-reaction-rate',
    topic: 'Скорость химической реакции',
    grades: [10, 11],
    keywords: ['скорост', 'концентрац', 'температур', 'давлен', 'collision', 'rate'],
    ru: `Скорость ↑ при: росте T (правило Вант-Гоффа ~×2–4 на 10°C), концентрации, площади поверхности, катализаторе, для газов — при росте P.

Молекулярно-кинетическое объяснение: больше ударов с энергией ≥ Eₐ.`,
    en: `Rate increases with temperature, concentration, surface area, catalyst, and gas pressure.`,
  },
  {
    id: 'g10-organic-naming',
    topic: 'Номенклатура органики',
    grades: [10, 11],
    keywords: ['иупак', 'iupac', 'метан', 'этан', 'пропан', 'бутан', 'naming', 'alkane'],
    ru: `**Алканы**: -ан (метан CH₄, этан C₂H₆). **Алкены**: -ен (этен C₂H₄). **Алкины**: -ин (ацетилен C₂H₂). **Спирты**: -ол (этанол). **Кислоты**: -овая (-oic).

Разветвление: 2-метилпропан. Номер углерода с функциональной группой — минимальный.`,
    en: `IUPAC: -ane alkanes, -ene alkenes, -yne alkynes, -ol alcohols, -oic acids.`,
  },
  {
    id: 'g10-alkene-reactions',
    topic: 'Реакции алкенов',
    grades: [10, 11],
    keywords: ['алкен', 'присоединен', 'марковников', 'полимер', 'ethylene', 'alkene'],
    ru: `**Алкены** — двойная связь, реакции **присоединения**: + H₂ (Ni), + Br₂ (обесцвечивание), + HCl, + H₂O (гидратация).

**Полимеризация** этилена: nCH₂=CH₂ → [-CH₂-CH₂-]ₙ. Правило Марковникова для несимметричных алкенов.`,
    en: `Alkenes undergo addition: H₂, Br₂, HX, H₂O. Ethylene polymerizes to polyethylene.`,
  },
  {
    id: 'g10-aromatic',
    topic: 'Ароматические соединения',
    grades: [11],
    keywords: ['бензол', 'аромат', 'толуол', 'бензол', 'aromatic', 'benzene'],
    ru: `**Бензол C₆H₆** — ароматическое кольцо, стабильное. **Замещение** (не присоединение): + Br₂ (Fe) → бромбензол + HBr.

Гомологи: толуол, ксилол. Токсичность бензола — осторожность в лаборатории.`,
    en: `Benzene is aromatic; electrophilic substitution. Homologs: toluene. Benzene is toxic.`,
  },
  {
    id: 'g10-esters',
    topic: 'Сложные эфиры',
    grades: [10, 11],
    keywords: ['эфир', 'этерификац', 'запах', 'ester', 'esterification'],
    ru: `**Этерификация**: кислота + спирт ⇄ эфир + H₂O (H⁺ катализ). Эфиры — часто приятный запах (школьные демонстрации — малые количества).

Гидролиз эфиров: кислотный или щелочной (мыловарение).`,
    en: `Esterification: acid + alcohol ⇄ ester + water. Alkaline hydrolysis makes soap.`,
  },
  {
    id: 'g10-amino-acids',
    topic: 'Аминокислоты и белки',
    grades: [11],
    keywords: ['аминокислот', 'белок', 'пептид', 'аминогруп', 'amino acid', 'protein'],
    ru: `**Аминокислоты** — NH₂ и COOH в одной молекуле. **Пептидная связь** — белки. **Денатурация** — разрушение структуры (нагрев, кислота).

Качественные: биуретовая (белки), ксантопротеиновая (серосодержащие).`,
    en: `Amino acids form peptide bonds in proteins. Denaturation by heat or acid.`,
  },
  {
    id: 'g11-coordination',
    topic: 'Комплексные соединения',
    grades: [11],
    keywords: ['комплекс', 'координац', 'лиганд', 'complex', 'coordination'],
    ru: `**Комплексные соединения** — центральный ион + лиганды (NH₃, H₂O, CN⁻). Пример: [Cu(NH₃)₄]²⁺ — глубокосиний раствор (качественная на Cu²⁺).

Окраска многих комплексов используется в качественном анализе.`,
    en: `Coordination complexes: central ion + ligands. [Cu(NH₃)₄]²⁺ is deep blue.`,
  },
  {
    id: 'g11-organic-synthesis',
    topic: 'Органический синтез',
    grades: [11],
    keywords: ['синтез', 'цепочк', 'превращен', 'organic synthesis', 'conversion'],
    ru: `Цепочки превращений: алкан → галогеналкан → спирт → альдегид → кислота. Алкен → галогеналкан / спирт.

В задачах: определить промежуточные вещества, условия реакций, выход продукта.`,
    en: `Organic synthesis chains: alkane → halide → alcohol → aldehyde → acid.`,
  },
  {
    id: 'g11-industry',
    topic: 'Химическая промышленность',
    grades: [10, 11],
    keywords: ['промышлен', 'хабер', 'контакт', 'аммиак', 'серная', 'industry', 'haber'],
    ru: `**Процесс Габера** — NH₃. **Контактный** — H₂SO₄. **Сода** — Сольвей. **Нефтехимия** — этилен, полимеры.

Экологические аспекты: выбросы SO₂, NOₓ, утилизация отходов.`,
    en: `Industrial processes: Haber (NH₃), contact (H₂SO₄), petrochemicals.`,
  },
  {
    id: 'problem-stoichiometry',
    topic: 'Решение задач на расчёты',
    grades: [8, 9, 10, 11],
    keywords: ['задач', 'расчёт', 'найти массу', 'объём', 'избыток', 'недостаток', 'limiting', 'yield'],
    ru: `**Алгоритм задачи:**
1) Уравнение + коэффициенты.
2) n = m/M или n = V/22,4 (газ н.у.).
3) Мольное соотношение по уравнению.
4) Пересчёт в ответ (г, л, %).

**Избыток/недостаток** — по меньшему n реагента. **Выход** = факт/теория·100%.`,
    en: `Stoichiometry: balance, moles, ratio, convert. Limiting reagent = smallest mole ratio. Percent yield.`,
  },
  {
    id: 'problem-mixed',
    topic: 'Смеси и нечистые вещества',
    grades: [9, 10, 11],
    keywords: ['смес', 'нечист', 'примес', 'массовая доля', 'impure', 'mixture problem'],
    ru: `Задачи на **нечистый металл** или **смесь солей**: составить уравнение по реакции с известным газом/осадком, найти n чистого вещества, затем ω в образце.

Пример: смесь Na₂CO₃ + NaCl — добавить HCl, измерить CO₂.`,
    en: `Impure sample problems: use gas or precipitate amount to find pure fraction.`,
  },
  {
    id: 'table-solubility',
    topic: 'Таблица растворимости',
    grades: [9, 10, 11],
    keywords: ['растворим', 'таблиц', 'нерастворим', 'solubility table', 'insoluble'],
    ru: `Правила (школьная таблица): все нитраты и ацетаты растворимы; хлориды растворимы, кроме AgCl, PbCl₂; сульфаты — кроме BaSO₄, PbSO₄; карбонаты и фосфаты — в основном нерастворимы (кроме Na⁺, K⁺, NH₄⁺).

Ионный обмен: реакция идёт, если газ, осадок или вода.`,
    en: `Solubility rules: nitrates soluble; AgCl, BaSO₄ insoluble; carbonates mostly insoluble.`,
  },
  {
    id: 'flame-tests',
    topic: 'Пламенные окраски',
    grades: [9, 10],
    keywords: ['пламен', 'окраск', 'калий', 'натрий', 'кальций', 'flame test', 'color'],
    ru: `**Пламенные пробы**: Na — жёлтый, K — фиолетовый (через синее стекло), Ca — кирпично-красный, Ba — зелёный, Cu — зеленоватый.

Метод качественного определения катионов. Безопасность: небольшие количества, чистый проволочный образец.`,
    en: `Flame tests: Na yellow, K violet, Ca brick-red, Ba green, Cu greenish.`,
  },
  {
    id: 'lab-apparatus',
    topic: 'Лабораторное оборудование',
    grades: [7, 8, 9],
    keywords: ['колб', 'пробирк', 'воронк', 'бюретк', 'оборудован', 'apparatus', 'beaker', 'flask'],
    ru: `**Пробирка** — малые реакции. **Колба** — смешивание, нагрев. **Воронка** — фильтрация. **Бюретка/пипетка** — точные объёмы (титрование).

**Вытяжной шкаф** — токсичные газы. **Штатив** — нагрев.`,
    en: `Lab glassware: test tube, flask, funnel, burette for titration. Fume hood for toxic gases.`,
  },
  {
    id: 'titration',
    topic: 'Титриметрический анализ',
    grades: [10, 11],
    keywords: ['титрован', 'титр', 'бюретк', 'эквивалент', 'titration', 'titre'],
    ru: `**Титрование** — пошаговое добавление раствора известной концентрации до точки эквивалентности (индикатор).

n(кислоты)·основность = n(щёлочи)·кислотность. c₁V₁ = c₂V₂ для монопротонных.`,
    en: `Titration to equivalence point. n acid × basicity = n base × acidity.`,
  },
]
