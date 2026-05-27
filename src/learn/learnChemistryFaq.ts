/** Офлайн-база типовых школьных тем (без OpenAI). */
export type FaqEntry = {
  keywords: string[]
  ru: string
  en: string
}

export const LEARN_CHEMISTRY_FAQ: FaqEntry[] = [
  {
    keywords: ['кислот', 'acid', 'ph', 'водород', 'h+', 'hcl', 'серная', 'азотная'],
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

export function offlineNeedsApiMessage(ru: boolean): string {
  return ru
    ? `Для **произвольных** вопросов по химии нужен режим OpenAI.

Настройте ключ:
1. Локально: файл \`.env\` → \`OPENAI_API_KEY=sk-...\`, перезапустите \`npm run dev\`
2. На сайте: разверните API на Vercel и укажите \`VITE_LEARN_CHAT_URL\` при сборке

Пока доступны ответы по типовым темам (кислоты, соли, ОВР, моль…) и по текущему параграфу.`
    : `For **free-form** chemistry questions, configure OpenAI API key in \`.env\` or Vercel. Offline mode covers common topics and the current lesson only.`
}
