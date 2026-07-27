import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Частые ошибки мышления учеников — приоритетный pack для RAG при «путают/ошибка».
 */
export const MISCONCEPTIONS_KNOWLEDGE: ChemistryKnowledgeChunk[] = [
  {
    id: 'misc-atom-vs-molecule',
    topic: 'Ошибка: атом и молекула — это одно и то же',
    grades: [7, 8],
    keywords: ['атом и молекула', 'чем атом отличается', 'молекула это', 'atom vs molecule', 'путают атом'],
    ru: `**Не путать:** атом — мельчайшая частица *элемента*; молекула — частица *вещества*, из атомов.
Пример: атом O — элемент кислород; молекула O₂ — газ, которым дышим.
Простые вещества бывают молекулярными (O₂, N₂) или металлическими/атомными сетками (Fe, алмаз).`,
    en: `Atom = element particle; molecule = substance particle of atoms. O ≠ O₂.`,
  },
  {
    id: 'misc-dissolve-vs-melt',
    topic: 'Ошибка: растворение = плавление',
    grades: [7, 8],
    keywords: ['растворение и плавление', 'растворить или расплавить', 'dissolve vs melt', 'сахар плавится'],
    ru: `**Плавление** — твёрдое → жидкое *того же* вещества (лёд → вода).
**Растворение** — образование раствора с растворителем (сахар в воде).
Сахар в чае не «плавится» — растворяется.`,
    en: `Melting = same substance solid→liquid. Dissolving = mix into solvent.`,
  },
  {
    id: 'misc-burning-oxygen',
    topic: 'Ошибка: при горении вещество «пропадает»',
    grades: [7, 8, 9],
    keywords: ['куда девается вещество при горении', 'масса при горении', 'закон сохранения горение'],
    ru: `При горении вещество не исчезает — атомы переходят в CO₂, H₂O, золу.
С учётом газов масса сохраняется. «Пропал» только вид исходного вещества.`,
    en: `Burning rearranges atoms; mass conserved if gases counted.`,
  },
  {
    id: 'misc-acid-formula',
    topic: 'Ошибка: любая формула с H — кислота',
    grades: [8, 9],
    keywords: ['является ли кислота', 'h2o кислота', 'ch4 кислота', 'что такое кислота школа'],
    ru: `Не всё с H — кислота. H₂O — вода; CH₄ — метан; NaOH — основание.
Кислота (школа): H, способный замещаться металлом; в воде даёт H⁺.
Примеры: HCl, H₂SO₄, HNO₃, CH₃COOH.`,
    en: `Not every H-compound is an acid. Acids donate H⁺ in water.`,
  },
  {
    id: 'misc-catalyst-consume',
    topic: 'Ошибка: катализатор расходуется в реакции',
    grades: [9, 10, 11],
    keywords: ['катализатор расходуется', 'что делает катализатор', 'catalyst consumed'],
    ru: `Катализатор **ускоряет** реакцию и в итоге **не расходуется**.
Снижает Ea, не смещает равновесие — ускоряет прямую и обратную.`,
    en: `Catalyst speeds reaction, is not consumed, does not shift K.`,
  },
  {
    id: 'misc-ph-strong',
    topic: 'Ошибка: pH = сила кислоты',
    grades: [9, 10],
    keywords: ['ph и сила кислоты', 'сильная кислота', 'слабая кислота ph'],
    ru: `pH — *состояние раствора сейчас*; сила кислоты — *полнота диссоциации*.
Разбавленная сильная может иметь выше pH, чем концентрированная слабая.
Сильные: HCl, H₂SO₄, HNO₃. Слабые: CH₃COOH, H₂CO₃.`,
    en: `pH = current acidity; strength = dissociation degree.`,
  },
  {
    id: 'misc-ion-charge',
    topic: 'Ошибка: путать заряд иона и имя соли',
    grades: [8, 9],
    keywords: ['заряд иона', 'fe2+ и fe3+', 'хлорид или хлорат'],
    ru: `Fe²⁺ ≠ Fe³⁺ — разные свойства и соли.
Хлорид Cl⁻ ≠ хлорат (с кислородом). Смотри формулу, не «похожее» имя.`,
    en: `Fe²⁺ ≠ Fe³⁺. Chloride ≠ chlorate — check formula.`,
  },
  {
    id: 'misc-mole-vs-mass',
    topic: 'Ошибка: моль = масса / «больше моль — тяжелее всегда»',
    grades: [8, 9, 10],
    keywords: ['моль и масса', 'путают моль', 'количество вещества и масса', 'mole vs mass'],
    ru: `**Моль (n)** — количество частиц/формульных единиц; **масса (m)** — в граммах.
Связь: m = n·M. 1 моль Fe (56 г) тяжелее 1 моль H₂ (2 г), хотя n одинаково.
Не сравнивай «кто больше» без единиц.`,
    en: `Mole is amount; mass is grams. m=n·M. Same n ≠ same mass.`,
  },
  {
    id: 'misc-coefficient-index',
    topic: 'Ошибка: коэффициент и индекс — одно и то же',
    grades: [7, 8, 9],
    keywords: ['коэффициент и индекс', 'можно ли менять индексы', 'уравнивание индексы'],
    ru: `**Индекс** — часть формулы вещества (H₂O). Менять индексы = другое вещество.
**Коэффициент** — сколько молекул/формульных единиц в уравнении. Уравнивают коэффициентами, не индексами.`,
    en: `Index is in the formula; coefficient balances the equation. Never change indices to balance.`,
  },
  {
    id: 'misc-equilibrium-stop',
    topic: 'Ошибка: при равновесии реакция остановилась',
    grades: [9, 10, 11],
    keywords: ['равновесие остановилась', 'реакция прекратилась равновесие', 'dynamic equilibrium myth'],
    ru: `При равновесии концентрации **не меняются**, но прямая и обратная реакции **идут** с равными скоростями (динамическое равновесие).`,
    en: `At equilibrium reactions continue; rates are equal, concentrations steady.`,
  },
  {
    id: 'misc-heat-shift',
    topic: 'Ошибка: нагрев всегда смещает вправо',
    grades: [9, 10, 11],
    keywords: ['нагрев смещает равновесие', 'температура всегда вправо', 'heat always forward'],
    ru: `Нагрев смещает равновесие в сторону **эндотермической** реакции — не «всегда вправо».
Смотри знак Q / ΔH в уравнении.`,
    en: `Heating favors the endothermic direction — not always “to the right”.`,
  },
  {
    id: 'misc-organic-same-formula',
    topic: 'Ошибка: одна формула C₂H₆O — одно вещество',
    grades: [10, 11],
    keywords: ['изомеры путают', 'одинаковая формула разные свойства', 'этанол и диметиловый эфир'],
    ru: `Одна молекулярная формула может давать **изомеры** с разными свойствами (этанол и диметиловый эфир — оба C₂H₆O).
Строение важнее «просто формулы».`,
    en: `Same molecular formula can be different isomers with different properties.`,
  },
  {
    id: 'misc-electron-shells',
    topic: 'Ошибка: электроны «вращаются как планеты» и уровни можно заполнять как угодно',
    grades: [8, 9],
    keywords: ['строение атома ошибка', 'электроны планеты', 'заполнение уровней'],
    ru: `Школьная модель: электроны на уровнях/подуровнях по правилам (энергия, ёмкость уровня 2n²), не произвольный «хаос».
Ядро — протоны+нейтроны; заряд ядра = Z. Ион — атом с другим числом электронов.`,
    en: `Electrons occupy shells by rules (2n²); ions differ in electron count.`,
  },
  {
    id: 'misc-neutralization-always-7',
    topic: 'Ошибка: любая нейтрализация даёт pH=7',
    grades: [9, 10],
    keywords: ['нейтрализация ph 7', 'всегда нейтрально', 'слабая кислота щелочь ph'],
    ru: `Соль сильной кислоты и сильного основания → среда ≈ нейтральная.
Соль слабой кислоты и сильной щёлочи → гидролиз, среда **щелочная**.
Соль сильной кислоты и слабого основания → **кислая**. pH=7 — не автоматический итог.`,
    en: `Neutralization pH depends on salt hydrolysis; not always 7.`,
  },
  {
    id: 'misc-gas-volume-any-t',
    topic: 'Ошибка: 22,4 л всегда для любого газа при любой температуре',
    grades: [8, 9, 10],
    keywords: ['22,4 всегда', 'молярный объём ошибка', 'vm только ну'],
    ru: `**22,4 л/моль** — молярный объём при **н.у.** (школьное соглашение).
При других t и p объём другой (уравнение состояния). Не подставляй 22,4 «на автомате».`,
    en: `22.4 L/mol is for STP only — not any temperature/pressure.`,
  },
  {
    id: 'logic-answer-structure',
    topic: 'Как учитель строит чёткий ответ вслух',
    grades: [7, 8, 9, 10, 11],
    keywords: ['как отвечать', 'структура ответа', 'чёткий ответ', 'логика ответа'],
    ru: `**Шаблон:** 1) суть одним предложением 2) почему/механизм 3) один пример 4) что запомнить.
Не начинай издалека. Не читай учебник целиком.`,
    en: `Oral answer: thesis → why → example → remember.`,
  },
  {
    id: 'misc-chloride-chlorite-chlorate',
    topic: 'Ошибка: хлорид = хлорит = хлорат',
    grades: [8, 9, 10],
    keywords: ['хлорид хлорит', 'хлорат', 'путают соли хлора', 'clo clo2 clo3'],
    ru: `**Не путать остатки хлора:**
• Cl⁻ — хлори́д (NaCl)
• ClO₂⁻ — хлори́т (NaClO₂)
• ClO₃⁻ — хлора́т (KClO₃)
• ClO₄⁻ — перхлора́т
Степень окисления хлора разная — свойства и реакции разные.`,
    en: `Chloride Cl⁻ ≠ chlorite ClO₂⁻ ≠ chlorate ClO₃⁻ ≠ perchlorate ClO₄⁻.`,
  },
  {
    id: 'misc-sulfide-sulfite-sulfate',
    topic: 'Ошибка: сульфид = сульфит = сульфат',
    grades: [8, 9],
    keywords: ['сульфид сульфит сульфат', 'путают серу соли', 'so3 so4 s2'],
    ru: `• S²⁻ — сульфи́д
• SO₃²⁻ — сульфи́т
• SO₄²⁻ — сульфа́т
Разные степени окисления серы — разные кислоты и соли.`,
    en: `Sulfide S²⁻ ≠ sulfite SO₃²⁻ ≠ sulfate SO₄²⁻.`,
  },
  {
    id: 'misc-ion-vs-atom',
    topic: 'Ошибка: ион и атом — одно и то же',
    grades: [7, 8, 9],
    keywords: ['ион и атом', 'натрий ион', 'заряд атома'],
    ru: `Атом нейтрален (число p⁺ = e⁻). Ион — атом/группа с зарядом (Na⁺, Cl⁻).
В соли NaCl нет «атомов натрия и хлора как в металле», есть ионы.`,
    en: `Atom is neutral; ion has charge. Salts contain ions, not neutral metal atoms.`,
  },
  {
    id: 'misc-coefficient-index',
    topic: 'Ошибка: коэффициент и индекс — одно и то же',
    grades: [7, 8],
    keywords: ['коэффициент и индекс', '2h2o', 'что менять в формуле'],
    ru: `Индекс — внутри формулы (H₂O: два H). Коэффициент — перед формулой (2H₂O: две молекулы).
Индексы нельзя «подгонять» при уравнивании — меняй коэффициенты.`,
    en: `Index is inside the formula; coefficient is in front. Never change indices to balance.`,
  },
  {
    id: 'misc-metal-oxide-acid',
    topic: 'Ошибка: любой оксид металла — основный',
    grades: [8, 9],
    keywords: ['амфотерный оксид', 'al2o3 кислота', 'оксид металла всегда основный'],
    ru: `Оксиды Na₂O, CaO — осно́вные. Al₂O₃, ZnO — амфотерные (и с кислотами, и со щёлочами).
Высшие оксиды некоторых металлов могут быть кислотными (CrO₃, Mn₂O₇).`,
    en: `Not every metal oxide is basic — some are amphoteric or acidic at high OS.`,
  },
  {
    id: 'misc-organic-only-carbon',
    topic: 'Ошибка: всё с углеродом — органика',
    grades: [10, 11],
    keywords: ['co2 органика', 'карбонат органика', 'что относится к органике'],
    ru: `CO₂, CO, карбонаты, карбиды — обычно неорганические.
Органика — углеводороды и их производные (связи C–C / C–H в типичном школьном смысле).`,
    en: `CO₂, carbonates, carbides are inorganic; organics are hydrocarbons and derivatives.`,
  },
  {
    id: 'misc-catalyst-equilibrium',
    topic: 'Ошибка: катализатор смещает равновесие',
    grades: [10, 11],
    keywords: ['катализатор равновесие', 'катализатор выход', 'ускоряет только прямую'],
    ru: `Катализатор ускоряет прямую и обратную одинаково — равновесие не смещает, выход «по K» не меняет.
Он быстрее приводит к равновесию.`,
    en: `Catalyst speeds both directions; does not change equilibrium yield.`,
  },
  {
    id: 'misc-color-always-same',
    topic: 'Ошибка: цвет раствора всегда = цвет соли «в сухом»',
    grades: [8, 9],
    keywords: ['цвет иона', 'почему раствор синий', 'гидратация цвет'],
    ru: `Цвет часто даёт гидратированный ион (Cu²⁺ — голубой), а не «название соли».
Безводный CuSO₄ почти белый; гидрат — синий.`,
    en: `Solution color often comes from hydrated ions; anhydrous forms can differ.`,
  },
]
