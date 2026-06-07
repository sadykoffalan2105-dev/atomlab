import type { ChemistryKnowledgeChunk } from './learnChemistryKnowledgeBase'

/** Углублённая база: сложные и частые вопросы школьной химии. */
export const CHEMISTRY_KNOWLEDGE_CORPUS: ChemistryKnowledgeChunk[] = [
  {
    id: 'deep-atom-structure',
    topic: 'Строение атома (углублённо)',
    grades: [8, 9, 10],
    keywords: ['атом', 'протон', 'нейтрон', 'электрон', 'орбитал', 'квантов', 'оболочк', 'atom structure'],
    ru: `**Атом** — ядро (p⁺, n⁰) + электронная оболочка. **Атомный номер Z** = число протонов = порядковый номер. **Массовое число A** = Z + N (нейтроны).

Электроны распределены по уровням (K, L, M…). **Валентные e⁻** — на внешнем уровне, они определяют химию элемента. **Изотопы** — один Z, разное N (¹²C, ¹⁴C).

Школьная модель: не путайте орбитали с «орбитами планет» — это упрощение для правил заполнения (2,8,8…).`,
    en: `Atom: nucleus (protons, neutrons) + electron shells. Z = protons; A = Z + N. Valence electrons drive chemistry. Isotopes share Z, differ in N.`,
  },
  {
    id: 'deep-periodic-trends',
    topic: 'Периодические закономерности',
    grades: [8, 9, 10, 11],
    keywords: ['периодич', 'металличност', 'радиус', 'энергия ионизац', 'электроотриц', 'trend', 'periodic'],
    ru: `**В периоде** (слева направо): металличность ↓, электроотрицательность ↑, радиус атома ↓ (до благородных газов).

**В группе** (сверху вниз): металличность ↑, радиус ↑, активность щелочных металлов ↑.

Связь с валентностью и типом связи: металлы → ионная/металлическая; неметаллы справа → ковалентная. **Благородные газы** — заполненная внешняя оболочка, инертны.`,
    en: `Across a period: metallic character decreases, electronegativity increases. Down a group: atomic radius and metallic character increase.`,
  },
  {
    id: 'deep-ionic-covalent',
    topic: 'Ионная и ковалентная связь',
    grades: [8, 9],
    keywords: ['ионн', 'ковалент', 'полярн', 'электроотриц', 'перенос', 'общая пара', 'ionic', 'covalent', 'polar'],
    ru: `**Ионная связь** — перенос e⁻ от металла к неметаллу (NaCl: Na⁺ + Cl⁻). Высокие t плавления, растворимость в воде, проводимость в расплаве.

**Кovalентная** — общая пара e⁻ (H₂O, O₂). **Полярная** — разная электроотрицательность (H–Cl). **Неполярная** — одинаковые атомы (O₂, N₂).

Как отличить: металл + неметалл → чаще ионная; неметалл + неметалл → ковалентная.`,
    en: `Ionic: electron transfer (NaCl). Covalent: shared electrons. Polar covalent when electronegativities differ.`,
  },
  {
    id: 'deep-oxidation-numbers',
    topic: 'Степени окисления и ОВР',
    grades: [9, 10, 11],
    keywords: ['степень окислен', 'окислител', 'восстановител', 'баланс', 'oxidation number', 'redox', 'half reaction'],
    ru: `**Правила степени окисления:** простые вещества = 0; моноатомные ионы = заряд; O обычно −2 (кроме пероксидов); H обычно +1 (кроме гидридов).

**Окисление** — рост степени окисления (отдача e⁻). **Восстановление** — падение (приём e⁻).

**Электронный баланс:** найти окислитель и восстановитель, сравнить число e⁻, подобрать коэффициенты. MnO₄⁻ в кислой среde → Mn²⁺ (Mn +7 → +2, принимает 5e⁻).`,
    en: `Oxidation state rules; redox = electron transfer. Balance with electron method for complex equations (MnO₄⁻, Cr₂O₇²⁻).`,
  },
  {
    id: 'deep-mole-calculations',
    topic: 'Расчёты: моль, масса, объём',
    grades: [8, 9, 10, 11],
    keywords: ['моль', 'моляр', 'масса', 'объём', '22.4', 'n=', 'стехиометр', 'mole calculation', 'stoichiometry'],
    ru: `**Связки формул:**
• n = m / M
• n = V / Vm (газы при н.у.: Vm ≈ 22,4 л/моль)
• N = n · Nₐ

**По уравнению:** коэффициенты = мольные соотношения. Алгоритм: уравнение → n(реагента) → n(продукта) → m или V.

**Массовая доля:** ω = m(в-ва)/m(р-ра)·100%. **Выход:** ω = m(факт)/m(теор)·100%.`,
    en: `n=m/M; n=V/22.4 for gases at STP. Stoichiometry from balanced equations. Mass percent and percent yield.`,
  },
  {
    id: 'deep-ph-indicators',
    topic: 'pH, среда, индикаторы',
    grades: [8, 9, 10, 11],
    keywords: ['ph', 'кислот', 'щелоч', 'нейтрал', 'индикатор', 'лакмус', 'фенолфталеин', 'acid base ph'],
    ru: `**pH = −lg[H⁺]**. pH < 7 — кислая, > 7 — щелочная, = 7 — нейтральная (25 °C).

**Сильные** кислоты/основания — полная диссоциация (HCl, H₂SO₄, NaOH). **Слабые** — частичная (CH₃COOH, NH₃·H₂O).

**Индикаторы:** лакмус (кисл. красный, щел. синий), фенолфталеин (бесцв. → малиновый в щел.), метилоранж (pH<3.1 красный, >4.4 жёлтый). **Нейтрализация:** кислота + основание → соль + H₂O.`,
    en: `pH scale; strong vs weak acids/bases; indicators; neutralization gives salt + water.`,
  },
  {
    id: 'deep-solubility-ion-exchange',
    topic: 'Растворимость и ионный обмен',
    grades: [9, 10, 11],
    keywords: ['растворим', 'осадок', 'ионный обмен', 'двойной обмен', 'solubility', 'precipitate', 'ion exchange'],
    ru: `**Ионный обмен** идёт, если один из продуктов — **газ**, **осадок** или **вода**.

Типичные нерастворимые: AgCl, BaSO₄, CaCO₃ (кроме разб. в кислоте с CO₂), Fe(OH)₃.

**Правило:** все nitrates и acetates растворимы; хлориды растворимы, кроме Ag⁺, Pb²⁺; сульфаты — кроме Ba²⁺, Pb²⁺, Sr²⁺.`,
    en: `Ion exchange when gas, precipitate, or water forms. Solubility rules for common school ions.`,
  },
  {
    id: 'deep-electrolysis',
    topic: 'Электролиз (подробно)',
    grades: [10, 11],
    keywords: ['электролиз', 'катод', 'анод', 'электролит', 'раствор', 'расплав', 'electrolysis'],
    ru: `**Катод (−)** — восстановление (катионы → металл или H₂). **Анод (+)** — окисление (анионы или OH⁻ → O₂, Cl₂).

**Раствор NaCl:** катод H₂ (или Na при расплаве), анод Cl₂. **Раствор CuSO₄:** катод Cu, анод O₂ (или растворение Cu анода).

**Правило:** более активный металл восстанавливается сложнее — в водных растворах часто выделяется H₂ вместо Na, K.`,
    en: `Cathode: reduction; anode: oxidation. Aqueous vs molten electrolysis differ (H₂ vs metal at cathode).`,
  },
  {
    id: 'deep-organic-classes',
    topic: 'Классы органических соединений',
    grades: [10, 11],
    keywords: ['органик', 'алкан', 'алкен', 'спирт', 'альдегид', 'кетон', 'карбонов', 'углеводород', 'organic'],
    ru: `**Углеводороды:** алканы (−ан), алкены (−ен, двойная связь), алкины (−ин). **Функциональные группы:** −OH (спирты), −CHO (альдегиды), −CO− (кетоны), −COOH (кислоты).

**Реакции:** алканы — замещение; алкены — присоединение; окисление спиртов → альдегиды/кетоны; этерификация: кислота + спирт ⇄ эфир + H₂O.`,
    en: `Hydrocarbons and functional groups: alcohols, aldehydes, ketones, carboxylic acids. Key reaction types.`,
  },
  {
    id: 'deep-le-chatelier',
    topic: 'Равновесие и Le Chatelier',
    grades: [10, 11],
    keywords: ['равновес', 'ле шателье', 'chatelier', 'сдвиг', 'давлен', 'температур', 'equilibrium'],
    ru: `**Химическое равновесие** — v₁ = v₂, концентрации постоянны. **Le Chatelier:** система противодействует изменению.

• ↑T для **экзотермической** → сдвиг влево (к реагентам).
• ↑P (газы) → в сторону меньшего числа молей газа.
• ↑[реагент] → вправо (к продуктам).

Пример: N₂ + 3H₂ ⇄ 2NH₃ + Q — повышение P сдвигает вправо.`,
    en: `Equilibrium: forward = reverse rate. Le Chatelier: system opposes stress (T, P, concentration).`,
  },
  {
    id: 'deep-kinetics',
    topic: 'Скорость реакции',
    grades: [10, 11],
    keywords: ['скорост', 'катализ', 'энергия активац', 'температур', 'концентрац', 'kinetics', 'catalyst'],
    ru: `**Скорость ↑** при: росте T, концентрации, давления (газы), площади поверхности твёрдых реагентов, **катализаторе**.

**Катализатор** снижает Eₐ, ускоряет прямую и обратную реакцию одинаково, **не расходуется** (может отравляться).

Молекулярно: больше ударов с энергией ≥ Eₐ. Правило Вант-Гоффа: ~×2–4 на 10 °C для многих реакций.`,
    en: `Rate factors: temperature, concentration, pressure, surface area, catalyst lowers activation energy.`,
  },
  {
    id: 'deep-coordination',
    topic: 'Комплексные соединения',
    grades: [11],
    keywords: ['комплекс', 'лиганд', 'координац', 'аммиак', 'complex', 'ligand'],
    ru: `**Комплекс** — центральный ион + **лиганды** (NH₃, H₂O, CN⁻, Cl⁻). Пример: [Cu(NH₃)₄]²⁺ — интенсивно-синий раствор (кач. реакция на Cu²⁺).

**Координационное число** — число лигандов у центра. Окраска комплексов — d-переходы; используется в качественном анализе.`,
    en: `Coordination complexes: central ion + ligands. [Cu(NH₃)₄]²⁺ is deep blue — test for Cu²⁺.`,
  },
  {
    id: 'deep-haber-contact',
    topic: 'Промышленная химия',
    grades: [10, 11],
    keywords: ['габер', 'аммиак', 'контактн', 'серная', 'haber', 'ammonia', 'industrial'],
    ru: `**Процесс Габера:** N₂ + 3H₂ ⇄ 2NH₃, высокое P, ~450 °C, Fe-катализатор. NH₃ → удобрения, HNO₃.

**Контактный процесс:** SO₂ → SO₃ → H₂SO₄ (V₂O₅). **Электролиз** Al₂O₃ → Al. **Сода:** NaCl + NH₃ + CO₂ → NaHCO₃.

Экология: SO₂, NOₓ → кислотные дожди; CO₂ → парниковый эффект.`,
    en: `Haber process (NH₃), contact process (H₂SO₄), Hall–Héroult (Al). Environmental links.`,
  },
  {
    id: 'deep-qualitative-cations',
    topic: 'Качественный анализ катионов',
    grades: [9, 10, 11],
    keywords: ['катион', 'качествен', 'осадок', 'nh4', 'fe', 'cu', 'ag', 'cation test'],
    ru: `**NH₄⁺** — NaOH, запах NH₃. **Fe³⁺** — NaOH, бурый Fe(OH)₃. **Fe²⁺** — бледно-зелёный раствор, бурый осадок при окислении. **Cu²⁺** — голубой раствор, с NH₃ — [Cu(NH₃)₄]²⁺.

**Ag⁺** + Cl⁻ → AgCl (белый). **Ba²⁺** + SO₄²⁻ → BaSO₄ (белый). **Пламенные пробы:** Na жёлтый, K фиолетовый.`,
    en: `Qualitative cation tests: NH₄⁺ smell, Fe³⁺ brown precipitate, Cu²⁺ blue, AgCl white.`,
  },
  {
    id: 'deep-qualitative-anions',
    topic: 'Качественный анализ анионов',
    grades: [9, 10, 11],
    keywords: ['анион', 'cl', 'so4', 'co3', 'no3', 'anion test'],
    ru: `**Cl⁻** — AgNO₃ → AgCl (белый, нераств. в HNO₃). **SO₄²⁻** — BaCl₂ → BaSO₄ (белый). **CO₃²⁻** — кислота → CO₂↑ (мутнеет известковая вода).

**S²⁻** — кислота → H₂S (запах, ядовит!). **NO₃⁻** — с FeSO₄ и H₂SO₄ (конц.) — бурое кольцо.`,
    en: `Anion tests: AgCl, BaSO₄, CO₂ from carbonate + acid, H₂S from sulfide.`,
  },
  {
    id: 'deep-gases',
    topic: 'Газы: свойства и получение',
    grades: [8, 9, 10],
    keywords: ['кислород', 'водород', 'хлор', 'co2', 'nh3', 'h2s', 'gas preparation'],
    ru: `**O₂** — KMnO₄ или H₂O₂ (кат.), поддерживает горение. **H₂** — Zn + HCl. **Cl₂** — электролиз NaCl. **CO₂** — CaCO₃ + HCl. **NH₃** — Ca(OH)₂ + NH₄Cl.

**Уравнение Менделеева–Клапейрона:** pV = nRT. **Плотность газа** vs воздух: M > 29 → тяжелее.`,
    en: `Lab gas prep: O₂, H₂, Cl₂, CO₂, NH₃. Ideal gas law pV=nRT.`,
  },
  {
    id: 'deep-metals-reactivity',
    topic: 'Ряд активности металлов',
    grades: [9, 10, 11],
    keywords: ['активност', 'ряд', 'металл', 'замещен', 'реактivity series', 'metal'],
    ru: `**Ряд активности** (фрагмент): K, Na, Ca, Mg, Al, Zn, Fe, Pb, H, Cu, Ag, Au.

Металл **левее** водорода — вытесняет H₂ из кислот. **Правее** — не реагирует с разб. кислотами (Cu, Ag). **Более активный** вытесняет менее активный из солей (Fe + CuSO₄).

**Коррозия Fe** — электрохимическая; защита: цинкование, окраска, легирование.`,
    en: `Reactivity series: active metals displace H₂ from acids; more active displaces less active from salts.`,
  },
  {
    id: 'deep-carbon-chemistry',
    topic: 'Химия углерода',
    grades: [9, 10],
    keywords: ['co', 'co2', 'углерод', 'carbon monoxide', 'carbon dioxide', 'carbonate'],
    ru: `**CO** — ядовитый, восстановитель (BF: Fe₂O₃ + CO → Fe). **CO₂** — кислотный оксид, не поддерживает горение, с Ca(OH)₂ → CaCO₃↓.

**CaCO₃** — известняк; + HCl → CO₂. **Силикаты** — основа минералов. **Аллотропы C:** алмаз, графит, фуллерены.`,
    en: `CO toxic reductant; CO₂ acidic oxide; carbonates with acid give CO₂.`,
  },
  {
    id: 'deep-nitrogen-sulfur',
    topic: 'Азот и сера',
    grades: [9, 10],
    keywords: ['азот', 'сера', 'аммиак', 'h2so4', 'so2', 'nitrogen', 'sulfur'],
    ru: `**N₂** — инертен (~78% воздуха). **NH₃** — слабое основание, пахучий, растворим. **HNO₃** — сильный окислитель.

**S** — аллотропы. **SO₂** — отбеливатель, кислотный оксид. **H₂SO₄** — обезвоживает, разбавлять осторожно! **H₂S** — ядовит, запах тухлых яиц, только в вытяжке.`,
    en: `N₂, NH₃, HNO₃; sulfur allotropes, SO₂, H₂SO₄, toxic H₂S.`,
  },
  {
    id: 'deep-halogens',
    topic: 'Галогены',
    grades: [9, 10],
    keywords: ['галоген', 'хлор', 'фтор', 'бром', 'йод', 'halogen', 'chlorine'],
    ru: `**Галогены** (F₂, Cl₂, Br₂, I₂) — активность ↓ вниз по группе. **Cl₂** + H₂O ⇄ HCl + HClO (отбеливание). **Cl₂** + NaOH (холод) → NaClO.

**Ag⁺** тесты: AgCl белый, AgBr жёлтый, AgI жёлтый. **Диспропорционирование** Cl₂ в щёлочи.`,
    en: `Halogens decrease in activity down the group. AgCl/AgBr/AgI precipitate tests.`,
  },
  {
    id: 'deep-benzene-aromatic',
    topic: 'Ароматические соединения',
    grades: [11],
    keywords: ['бензол', 'аромат', 'электрофил', 'benzene', 'aromatic'],
    ru: `**Бензол C₆H₆** — ароматическое кольцо, стабильное. Реакции **замещения** (не присоединения): + Br₂ (Fe) → C₆H₅Br + HBr.

Токсичен — осторожность. **Толуол, ксилол** — гомологи. **Правило** Hückel (4n+2 π-e⁻) — для углубления в 11 классе.`,
    en: `Benzene: electrophilic substitution. Toxic; homologs toluene, xylene.`,
  },
  {
    id: 'deep-polymers-biochem',
    topic: 'Полимеры и биомолекулы',
    grades: [10, 11],
    keywords: ['полимер', 'белок', 'днк', 'крахмал', 'полимеризац', 'polymer', 'protein', 'dna'],
    ru: `**Полимеры** — макромолекулы из мономеров (полиэтилен, ПВХ, каучук). **Полимеризация** — nCH₂=CH₂ → [−CH₂−CH₂−]ₙ.

**Белки** — аминокислоты, пептидная связь. **Крахмал** + I₂ → синий. **ДНК** — двойная спираль, нуклеотиды.`,
    en: `Polymers from monomers; proteins, starch–iodine test, DNA structure basics.`,
  },
  {
    id: 'deep-environment',
    topic: 'Экологическая химия',
    grades: [9, 10, 11],
    keywords: ['эколог', 'кислотн', 'дожд', 'озон', 'парников', 'environment', 'pollution'],
    ru: `**Кислотные дожди** — SO₂, NOₓ → H₂SO₄, HNO₃ в атмосфере. **Парниковый эффект** — CO₂, CH₄. **Озоновая дыра** — CFC (фреоны).

**Очистка воды:** коагуляция, фильтрация, хлорирование. Ответственная утилизация химотходов в школе.`,
    en: `Acid rain, greenhouse gases, ozone layer, water treatment basics.`,
  },
  {
    id: 'deep-safety-lab',
    topic: 'Лабораторная безопасность',
    grades: [7, 8, 9, 10, 11],
    keywords: ['безопасн', 'травм', 'кислот', 'щелоч', 'ожог', 'lab safety'],
    ru: `**Обязательно:** очки, халат, волосы убраны, перчатки при кислотах/щёлочах. **Кислоту в воду**, не наоборот. Не нюхать/не пробовать.

**Ожог:** промыть водой 15–20 мин, сообщить учителю. **K₂Cr₂O₇, Hg** — токсичны. **H₂S, Cl₂, SO₂** — только вытяжка. Отходы — в маркированную тару.`,
    en: `Lab PPE; add acid to water; rinse spills; toxic gases in fume hood.`,
  },
  {
    id: 'deep-titration',
    topic: 'Титрование',
    grades: [10, 11],
    keywords: ['титрован', 'бюретк', 'эквивалент', 'титр', 'titration'],
    ru: `**Титрование** — пошаговое добавление титранта до **точки эквивалентности** (индикатор меняет цвет).

n(кисл.)·основность = n(осн.)·кислотность. Для HCl + NaOH: c₁V₁ = c₂V₂. **Молярная концентрация** c = n/V (моль/л).`,
    en: `Titration to equivalence point; n acid × basicity = n base × acidity.`,
  },
  {
    id: 'deep-buffer-hydrolysis',
    topic: 'Гидролиз и среда растворов',
    grades: [10, 11],
    keywords: ['гидролиз', 'среда', 'соль', 'hydrolysis', 'salt solution'],
    ru: `**Гидролиз соли:** сильная кислота + слабое основание → **кислая** среда (NH₄Cl). Слабая кислота + сильное основание → **щелочная** (Na₂CO₃, Na₂S).

Сильная + сильная → pH ≈ 7. **Проверка:** индикатор или pH-метр.`,
    en: `Salt hydrolysis sets solution pH; strong/weak acid-base pairs determine acidity.`,
  },
]
