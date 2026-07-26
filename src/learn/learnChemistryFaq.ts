/** Офлайн-база типовых школьных тем (без OpenAI). */
export type FaqEntry = {
  keywords: string[]
  ru: string
  en: string
}

export const LEARN_CHEMISTRY_FAQ: FaqEntry[] = [
  {
    keywords: ['кислот', 'acid', 'h+', 'hcl', 'серная', 'азотная'],
    ru: `**Кислоты** — вещества, дающие H⁺ в воде (по Arrhenius). Свойства: кислый вкус (только в модели!), реакция с металлами и основаниями, индикаторы краснеют.

Примеры: HCl — соляная, H₂SO₄ — серная, HNO₃ — азотная. Соли получают нейтрализацией: кислота + основание → соль + вода.`,
    en: `**Acids** release H⁺ in water. They react with metals and bases; indicators turn red. Examples: HCl, H₂SO₄, HNO₃.`,
  },
  {
    keywords: ['основан', 'щелоч', 'base', 'alkali', 'гидроксид', 'oh-', 'naoh', 'koh'],
    ru: `**Основания** — вещества, дающие OH⁻ в воде. **Щёлочи** — растворимые основания (NaOH, KOH).

Свойства: мылковатый ощущение, реакция с кислотами, индикаторы синеют. Нерастворимые: Fe(OH)₃, Cu(OH)₂.`,
    en: `**Bases** give OH⁻ in water. Soluble bases are **alkalis** (NaOH, KOH). They neutralize acids.`,
  },
  {
    keywords: ['сол', 'salt', 'nacl', 'сульфат', 'хлорид', 'нитрат'],
    ru: `**Соли** — ионы металла (или NH₄⁺) + кислотный остаток. NaCl — поваренная соль, CuSO₄ — сульфат меди.

Получение: кислота + основание; металл + кислота; обмен в растворах. В ATOMLAB найдите соль в каталоге и откройте 3D.`,
    en: `**Salts** consist of cations and anions. Formed by neutralization, metal + acid, or ion exchange.`,
  },
  {
    keywords: ['овр', 'окисл', 'восстанов', 'redox', 'электрон', 'окислител', 'восстановител'],
    ru: `**ОВР** — перенос электронов. **Восстановитель** отдаёт e⁻, **окислитель** принимает.

Пример: Zn + Cu²⁺ → Zn²⁺ + Cu. Степень окисления растёт при окислении. Баланс — метод электронного баланса.`,
    en: `**Redox**: reductant loses electrons, oxidant gains them. Use electron balance to balance equations.`,
  },
  {
    keywords: ['моль', 'mole', 'моляр', 'molar', 'навогадро', 'avogadro', '6.02'],
    ru: `**Моль** — 6,02·10²³ частиц. **M** — молярная масса (г/моль) = Mr.

n = m/M; n = V/Vm (газы при н.у.: Vm ≈ 22,4 л/моль). Задачи: по уравнению найти массу/объём продукта.`,
    en: `**Mole** = 6.02×10²³ particles. n = m/M; for gases at STP Vm ≈ 22.4 L/mol.`,
  },
  {
    keywords: ['равновес', 'equilibrium', 'обратим', 'катализ', 'catalyst', 'скорост', 'rate'],
    ru: `**Скорость реакции** ↑ при T↑, концентрации↑, катализаторе. **Равновесие** — v₁ = v₂, концентрации постоянны.

**Катализатор** ускоряет, не расходуется. Принцип Ле Шателье: система противодействует изменению условий.`,
    en: `Reaction **rate** increases with T and concentration. **Equilibrium**: forward = reverse rate. Catalysts speed up without being consumed.`,
  },
  {
    keywords: ['ионн', 'диссоциац', 'электролит', 'electrolyte', 'гидролиз', 'hydrolysis'],
    ru: `**Электролиты** диссоциируют в воде на ионы. Сильные: NaCl, HCl; слабые: CH₃COOH.

**Ионный обмен**: осадок, газ или вода. **Гидролиз солей** — взаимодействие ионов соли с водой (среда может быть кислой/щелочной).`,
    en: `Electrolytes dissociate into ions. Ion exchange forms precipitate, gas, or water. Salt hydrolysis changes solution pH.`,
  },
  {
    keywords: ['амфотер', 'amphoteric', 'al2o3', 'zn', 'цинк'],
    ru: `**Амфотерные оксиды** (Al₂O₃, ZnO) реагируют и с кислотами, и с основаниями.

Пример: Al₂O₃ + 6HCl → 2AlCl₃ + 3H₂O; Al₂O₃ + 2NaOH → 2NaAlO₂ + H₂O.`,
    en: `**Amphoteric oxides** react with both acids and bases (e.g. Al₂O₃, ZnO).`,
  },
  {
    keywords: ['полимер', 'polymer', 'пластмасс', 'белок', 'крахмал'],
    ru: `**Полимеры** — большие молекулы из повторяющихся звеньев (мономеров). Примеры: полиэтилен, белки, крахмал, целлюлоза.

В школьном курсе органики изучают простые мономеры и идею полимеризации.`,
    en: `**Polymers** are macromolecules built from repeating monomer units (polyethylene, proteins, starch).`,
  },
  {
    keywords: ['огэ', 'oge', 'егэ', 'ege', 'экзамен', 'exam'],
    ru: `**ОГЭ по химии**: расчёты (моль, масса, объём газа), уравнения, классы веществ, качественные реакции.

В ATOMLAB: раздел «Задачи» → «Подготовка к ОГЭ», повторение § 9 класса, мини-тесты в параграфах.`,
    en: `Exam prep: stoichiometry, equations, classification, qualitative tests — use ATOMLAB Tasks → OGE-style practice.`,
  },
  {
    keywords: ['период', 'менделеев', 'mendeleev', 'групп', 'периодич'],
    ru: `**Периодическая система**: периоды (строки) — электронные оболочки; группы (столбцы) — похожие свойства.

Слева направо в периоде: металличность ↓. Сверху вниз в группе: металличность ↑. Откройте таблицу в ATOMLAB.`,
    en: `Periodic table: periods = electron shells; groups = similar properties. Metallic character trends across periods and groups.`,
  },
  {
    keywords: ['связ', 'ковалент', 'ионн', 'металлич', 'bond', 'covalent', 'ionic'],
    ru: `**Ионная связь** — перенос e⁻ (NaCl). **Ковалентная** — общие e⁻ (H₂O, O₂). **Металлическая** — «облако» e⁻ в металлах.

Связь определяет свойства: плавление, растворимость, проводимость.`,
    en: `Ionic, covalent, and metallic bonding explain structure and properties of substances.`,
  },
  {
    keywords: ['органик', 'углеводород', 'алкан', 'алкен', 'organic', 'hydrocarbon'],
    ru: `Школьная **органика**: углеводороды (алкани CₙH₂ₙ₊₂, алкены с двойной связью), спирты, кислоты с -COOH.

Гомологический ряд — отличие на CH₂. Реакции: горение, галогенирование, полимеризация (этилен).`,
    en: `School **organic chemistry**: hydrocarbons, alcohols, carboxylic acids; homologous series differ by CH₂.`,
  },
  {
    keywords: ['валентност', 'valency', 'валентн', 'степень окисл'],
    ru: `**Валентность** — способность атома образовывать связи (число одно- или двухэлектронных связей). В школьном курсе часто указывают римскими цифрами: I, II, III.

Примеры: H (I), O (II), N (III, V), C (IV), Fe (II, III). Степень окисления — формальный заряд в соединении; не путайте с валентностью.`,
    en: `**Valency** is how many bonds an atom forms. **Oxidation state** is a formal charge assignment in compounds.`,
  },
  {
    keywords: ['кислород', 'oxygen', 'o2', 'o₂', 'горен', 'combustion'],
    ru: `**Кислород O₂** — газ, поддерживает горение. В лаборатории получают разложением KMnO₄ или H₂O₂ (с тягой).

Свойства: бесцветен, малорастворим в воде, активный окислитель. В ATOMLAB откройте 3D-модель O₂ (двухатомная молекула).`,
    en: `**Oxygen O₂** supports combustion; it is a colorless oxidizer. See the diatomic 3D model in ATOMLAB.`,
  },
  {
    keywords: ['вода', 'water', 'h2o', 'h₂o', 'гидролиз воды'],
    ru: `**Вода H₂O** — полярная молекула, растворитель многих веществ. Высокие теплоёмкость и температура кипения из-за водородных связей.

В реакциях: гидролиз солей, нейтрализация, электролиз. Модель H₂O — в каталоге и в § о молекулах.`,
    en: `**Water H₂O** is polar, a good solvent, with hydrogen bonding. See the catalog 3D model.`,
  },
  {
    keywords: ['дихромат', 'dichromate', 'k2cr2o7', 'k₂cr₂o₇', 'хром'],
    ru: `**Дихромат калия K₂Cr₂O₇** — оранжевый кристаллический окислитель Cr(VI). Применяют в кожевенном деле, травлении металлов, очистке посуды.

Токсичен и канцерогенен — только под руководством учителя, в перчатках, с вытяжкой.`,
    en: `**K₂Cr₂O₇** is a strong Cr(VI) oxidizer; toxic — school use only with supervision and ventilation.`,
  },
  {
    keywords: ['углерод', 'carbon', 'co2', 'co₂', 'углекисл'],
    ru: `**Углерод** — неметалл, аллотропы: графит, алмаз. **CO₂** — продукт горения, кислотный оксид углерода; не поддерживает горение, но участвует в фотосинтезе.

В ATOMLAB: модель CO₂ — линейная молекула с двойными связями C=O.`,
    en: `Carbon allotropes include graphite and diamond. **CO₂** is a linear molecule — see the catalog model.`,
  },
  {
    keywords: ['натрий', 'sodium', 'калий', 'potassium', 'щелочной металл'],
    ru: `**Щелочные металлы** (Na, K) — мягкие, активные, хранят под керосином. Реагируют с водой: 2Na + 2H₂O → 2NaOH + H₂↑.

Ионы Na⁺, K⁺ — в солях и растворах; пламенные окраски (Na — жёлтый, K — фиолетовый).`,
    en: `Alkali metals (Na, K) are very reactive with water. Flame tests: Na yellow, K violet.`,
  },
  {
    keywords: ['безопас', 'очки', 'перчат', 'вытяж', 'safety', 'goggles', 'ventilation', 'lab'],
    ru: `**Безопасность в лаборатории:** очки, халат, перчатки; не пробовать вещества на вкус; работать у вытяжки с кислотами и газами; разбавлять кислоту водой (не наоборот).

При ожоге — промыть водой, сообщить учителю. Отходы — в указанную тару.`,
    en: `Lab safety: goggles, coat, gloves; never taste chemicals; use a fume hood; add acid to water, not water to acid.`,
  },
  {
    keywords: ['индикатор', 'indicator', 'фенолфталеин', 'лакмус', 'litmus', 'ph'],
    ru: `**Индикаторы** меняют цвет по pH: лакмус (кислота — красный, щёлочь — синий), фенолфталеин (бесцветен в кислой, малиновый в щелочной), метилоранж.

Универсальный индикатор даёт шкалу цветов от pH 1 до 14.`,
    en: `Indicators change color with pH: litmus, phenolphthalein, methyl orange, universal indicator.`,
  },
  {
    keywords: ['осадок', 'precipitate', 'не раствор', 'solubility', 'растворим'],
    ru: `**Растворимость** — из таблицы растворимости. **Осадок** образуется, если один из продуктов ионного обмена нерастворим (например, AgCl, BaSO₄).

Запишите ионное уравнение и вычеркните «наблюдателей».`,
    en: `Use a solubility table. A **precipitate** forms when a product is insoluble (e.g. AgCl, BaSO₄).`,
  },
  {
    keywords: ['газ', 'закон', 'boyle', 'charles', 'pv', 'давлен', 'ideal gas'],
    ru: `**Газы:** pV = nRT (идеальный газ). При постоянной T: p₁V₁ = p₂V₂ (Бойль-Мариотт). При постоянном p: V₁/T₁ = V₂/T₂.

n = V/Vm (н.у. Vm ≈ 22,4 л/моль). Масса через M.`,
    en: `Ideal gas law pV = nRT. At STP Vm ≈ 22.4 L/mol. Boyle and Charles laws relate p, V, and T.`,
  },
  {
    keywords: ['электролиз', 'electrolysis', 'катод', 'анод', 'cathode', 'anode'],
    ru: `**Электролиз** — разложение вещества током. На **катоде** (−) восстановление, на **аноде** (+) окисление.

Пример: электролиз водного раствора NaCl даёт H₂ на катоде и Cl₂ на аноде (в промышленности).`,
    en: `Electrolysis: reduction at cathode (−), oxidation at anode (+). Example: brine electrolysis gives H₂ and Cl₂.`,
  },
  {
    keywords: ['номенклатур', 'nomenclature', 'назван', 'name compound', 'суффикс'],
    ru: `**Номенклатура:** бинарные соединения — «оксид + металл» (оксид натрия), кислотные остатки в солях (-ат, -ит), органика — корень + окончание (-ан, -ен, -ол).

В ATOMLAB ищите вещество по формуле в каталоге.`,
    en: `Naming: metal oxides, acid residues in salts (-ate/-ite), organic roots (-ane, -ene, -ol). Search formulas in ATOMLAB.`,
  },
  {
    keywords: ['галоген', 'halogen', 'хлор', 'bromine', 'йод', 'chlorine', 'fluorine'],
    ru: `**Галогены** (F, Cl, Br, I) — активные неметаллы. Активность ↓ вниз по группе: F₂ > Cl₂ > Br₂ > I₂.

Диспропорционирование Cl₂ в щёлочи; галогениды с серебром дают цветные осадки (AgCl белый).`,
    en: `Halogens are reactive nonmetals; activity decreases down the group. Ag⁺ tests give characteristic precipitates.`,
  },
  {
    keywords: ['азот', 'nitrogen', 'n2', 'n₂', 'аммиак', 'ammonia', 'nh3'],
    ru: `**Азот N₂** — инертный газ (~78% воздуха). **NH₃** — слабое основание, пахучий, растворим в воде (фенолфталеин — малиновый).

Синтез аммиака: N₂ + 3H₂ ⇄ 2NH₃ (катализ, высокое p и T).`,
    en: `N₂ is abundant in air. NH₃ is a weak base; Haber process: N₂ + 3H₂ ⇄ 2NH₃.`,
  },
  {
    keywords: ['сера', 'sulfur', 'so2', 'so₂', 'h2so4', 'сульфид'],
    ru: `**Сера** — жёлтый неметалл, аллотропы. **SO₂** — газ-отбеливатель, кислотный оксид. **H₂SO₄** — сильная кислота (разбавлять осторожно!).

Сульфиды с кислотами дают H₂S (ядовитый газ с запахом тухлых яиц — только в вытяжке).`,
    en: `Sulfur forms SO₂ and H₂SO₄. Sulfides with acids release toxic H₂S — use a hood.`,
  },
  {
    keywords: ['спирт', 'alcohol', 'этанол', 'ethanol', 'метанол', 'oh групп'],
    ru: `**Спирты** содержат группу -OH. Этанол C₂H₅OH — растворитель, горюч. Метанол CH₃OH — ядовит.

Реакции: с активными металлами (H₂), окисление до альдегидов/кетонов, этерификация с кислотами.`,
    en: `Alcohols have -OH groups. Ethanol is common and flammable; methanol is toxic. Oxidation gives aldehydes/ketones.`,
  },
  {
    keywords: ['глюкоз', 'glucose', 'сахар', 'крахмал', 'starch', 'углевод'],
    ru: `**Углеводы:** глюкоза C₆H₁₂O₆ — моносахарид; крахмал — полисахарид, даёт синюю окраску с йодом.

Горение и брожение — связь с органикой и биологией.`,
    en: `Glucose is a monosaccharide; starch gives a blue color with iodine.`,
  },
  {
    keywords: ['эндотерм', 'экзотерм', 'enthalpy', 'теплот', 'q>', 'q<'],
    ru: `**Экзотермические** реакции выделяют тепло (горение). **Эндотермические** поглощают (растворение NH₄NO₃ в воде охлаждает).

ΔH < 0 — экзотермия; ΔH > 0 — эндотермия.`,
    en: `Exothermic reactions release heat; endothermic absorb heat. ΔH sign indicates the direction of heat flow.`,
  },
  {
    keywords: ['алюмин', 'aluminum', 'aluminium', 'fe', 'железо', 'iron', 'корроз'],
    ru: `**Алюминий** — лёгкий металл, пассивируется оксидной плёнкой. **Железо** — Fe²⁺ (бледно-зелёный) и Fe³⁺ (бурый/жёлтый в растворе).

Коррозия железа — электрохимический процесс; защита — окраска, цинкование.`,
    en: `Aluminum forms a protective oxide layer. Iron has Fe²⁺/Fe³⁺ chemistry; rust is electrochemical corrosion.`,
  },
  {
    keywords: ['медь', 'copper', 'cu', 'патин', 'сульфат меди'],
    ru: `**Медь Cu** — розовый металл, Cu²⁺ — голубые растворы, CuSO₄·5H₂O — синие кристаллы.

Реакции: с конц. HNO₃ (NO₂), замещение (Fe + CuSO₄), осаждение Cu(OH)₂.`,
    en: `Copper metal is reddish; Cu²⁺ solutions are blue. CuSO₄ is a common school reagent.`,
  },
  {
    keywords: ['водород', 'hydrogen', 'h2', 'h₂', 'водородный показатель'],
    ru: `**Водород H₂** — лёгкий газ, восстановитель. Получение: Zn + HCl, электролиз воды.

**pH** = −lg[H⁺]; pH < 7 кислая среда, pH > 7 щелочная, pH = 7 нейтрально (чистая вода ~25 °C).`,
    en: `Hydrogen H₂ is a light reducing gas. pH measures acidity: <7 acid, >7 base, 7 neutral.`,
  },
  {
    keywords: ['ле шателье', 'лешателье', 'смещение равновесия', 'le chatelier'],
    ru: `**Принцип Ле Шателье:** воздействие смещает равновесие так, чтобы ослабить это воздействие.

↑ концентрации → расходование этого вещества; ↑T → эндотермическая сторона; ↑p (газы) → меньше молей газа. Катализатор равновесие не смещает.`,
    en: `Le Chatelier: the system shifts to counteract the change. Catalysts do not shift equilibrium.`,
  },
  {
    keywords: ['атом и молекула', 'чем атом', 'molecule vs atom', 'путают атом'],
    ru: `**Атом** — частица элемента; **молекула** — частица вещества из атомов. O — атом кислорода-элемента; O₂ — молекула кислорода-газа.`,
    en: `Atom = element particle; molecule = substance particle made of atoms. O ≠ O₂.`,
  },
  {
    keywords: ['титрован', 'бюретка', 'титрование', 'titration'],
    ru: `**Титрование** — точное приливание раствора известной концентрации до точки эквивалентности (часто по индикатору). Бюретка даёт точный объём.`,
    en: `Titration adds a known solution to the equivalence point, often with an indicator.`,
  },
  {
    keywords: ['закон гесса', 'hess', 'энтальпия образования', 'ΔHf'],
    ru: `**Закон Гесса:** тепловой эффект зависит от начального и конечного состояния, не от пути. ΔH° = ΣΔHf°(продуктов) − ΣΔHf°(реагентов).`,
    en: `Hess’s law: ΔH depends on states, not path. Use formation enthalpies to compute ΔH°.`,
  },
  {
    keywords: ['лишний реагент', 'недостаток', 'лимитирующий', 'limiting'],
    ru: `Сравни моли реагентов с коэффициентами уравнения. Кто закончится первым — **в недостатке**; продукт считают только по нему.`,
    en: `The limiting reagent is used up first; calculate product from it only.`,
  },
  {
    keywords: ['техника безопасности', 'кислоту в воду', 'вытяжка хлор', 'lab safety'],
    ru: `Кислоту вливают в воду (не наоборот). Нагрев — отверстием от себя. Ядовитые газы — вытяжка. Не пробовать на вкус; очки и халат.`,
    en: `Add acid to water; heat away from face; use a fume hood for toxic gases.`,
  },
  {
    keywords: ['бензол', 'арены', 'ароматическ', 'benzene'],
    ru: `**Бензол C₆H₆** — арены; устойчивое кольцо. Типичны замещение (бромирование с катализатором), а не «обычное» присоединение как у алкенов.`,
    en: `Benzene is aromatic; substitution is typical, unlike simple alkene addition.`,
  },
]

export function matchFaqEntry(query: string): FaqEntry | null {
  const q = query.toLowerCase()
  let best: FaqEntry | null = null
  let bestScore = 0
  for (const entry of LEARN_CHEMISTRY_FAQ) {
    let score = 0
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) score += kw.length >= 4 ? 2 : 1
    }
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }
  return bestScore >= 2 ? best : null
}

export function offlineNeedsApiMessage(locale: boolean | 'ru' | 'en' | 'uz'): string {
  const lang = typeof locale === 'boolean' ? (locale ? 'ru' : 'en') : locale
  if (lang === 'uz') {
    return `Bu savolga **oflayn bazada** tayyor javob yo‘q.

Sinab ko‘ring:
• savolni boshqacha yozing (kislotalar, tuzlar, OVR, mol, pH…);
• o‘qituvchi panelida **Ollama** ni yoqing (kompyuterda bepul, docs/TEACHER_AI.md);
• keyinroq — \`VITE_LEARN_CHAT_URL\` orqali o‘z serveringiz.

Hozir tipik mavzular va joriy § konspekti mavjud.`
  }
  if (lang === 'en') {
    return `No offline match for this question. Rephrase (acids, salts, redox, mole, pH…), enable **Ollama** in the teacher panel, or set \`VITE_LEARN_CHAT_URL\` for your server.`
  }
  return `По этому вопросу в **офлайн-базе** нет готового ответа.

Попробуйте:
• переформулировать (кислоты, соли, ОВР, моль, pH…);
• включить **Ollama** в панели учителя (бесплатно на вашем ПК, см. docs/TEACHER_AI.md);
• позже — свой сервер через \`VITE_LEARN_CHAT_URL\`.

Сейчас доступны типовые темы и конспект текущего §.`
}
