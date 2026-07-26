import type { ChemistryKnowledgeChunk } from '../learnChemistryKnowledgeBase'

/**
 * Ядро неорганики для быстрого точного ответа (отдельно от misconceptions).
 */
export const INORGANIC_CORE_KNOWLEDGE: ChemistryKnowledgeChunk[] = [
  {
    id: 'inorg-halogens',
    topic: 'Галогены: F, Cl, Br, I',
    grades: [9, 10],
    keywords: ['галогены', 'хлор', 'бром', 'йод', 'фтор', 'halogens', 'cl2'],
    ru: `Галогены (VIIА): F₂, Cl₂, Br₂, I₂ — типичные неметаллы-окислители.
Активность: F > Cl > Br > I. Более активный вытесняет менее из соли (Cl₂ + 2KBr → 2KCl + Br₂).
С H₂ — галогеноводороды; водный HCl — соляная кислота.
Cl₂ ядовит — только вытяжка. Качественно: Cl₂ желто-зелёный газ.`,
    en: `Halogens: oxidizers; activity F>Cl>Br>I; displace less active from salts.`,
  },
  {
    id: 'inorg-alkali-metals',
    topic: 'Щелочные металлы: Na, K',
    grades: [8, 9],
    keywords: ['щелочные металлы', 'натрий', 'калий', 'реакция натрия с водой', 'alkali metals', 'na + h2o'],
    ru: `Na, K — мягкие, очень активные. Хранят под керосином/маслом.
2Na + 2H₂O → 2NaOH + H₂↑ (H₂ может вспыхнуть).
Оксиды/гидроксиды — сильные щёлочи. Не берите крупные куски руками; реакция с водой — демонстрация учителя.`,
    en: `Alkali metals + water → hydroxide + H₂. Store under oil.`,
  },
  {
    id: 'inorg-nitrogen-oxygen',
    topic: 'Азот и кислород',
    grades: [7, 8, 9],
    keywords: ['азот', 'кислород получение', 'воздух состав', 'nitrogen', 'oxygen lab', 'kmno4'],
    ru: `Воздух: ~78% N₂, ~21% O₂. O₂ поддерживает горение и дыхание.
В школе O₂ часто из KMnO₄ (нагрев) или H₂O₂ + MnO₂.
N₂ малоактивен при обычных условиях; промышленно NH₃ — процесс Габера.
O₃ — аллотроп кислорода, сильный окислитель.`,
    en: `Air mostly N₂/O₂; O₂ from KMnO₄ or H₂O₂; Haber for NH₃.`,
  },
  {
    id: 'inorg-metals-rust',
    topic: 'Коррозия и защита металлов',
    grades: [8, 9, 10],
    keywords: ['коррозия', 'ржавление', 'защита металлов', 'ржавчина', 'corrosion', 'rust', 'оцинковка'],
    ru: `Коррозия — разрушение металла химически/электрохимически.
Ржавление Fe во влажном воздухе → гидратированные оксиды.
Защита: краска, смазка, покрытие (Zn — протекция), легирование (нержавейка), катодная защита.`,
    en: `Rust = Fe oxidation in moist air. Protect by coatings, galvanizing, alloys.`,
  },
  {
    id: 'inorg-water-hard',
    topic: 'Жёсткость воды',
    grades: [9, 10],
    keywords: ['жёсткость воды', 'карбонатная жёсткость', 'умягчение воды', 'hard water', 'накипь'],
    ru: `Жёсткость — Ca²⁺ и Mg²⁺. Временная (гидрокарбонаты) снимается кипячением → CaCO₃ (накипь).
Постоянная — сульфаты/хлориды; умягчение: сода, ионообмен.
Жёсткая вода плохо мылится, портит нагреватели.`,
    en: `Hard water: Ca²⁺/Mg²⁺. Temporary hardness removed by boiling.`,
  },
  {
    id: 'inorg-oxides-classes',
    topic: 'Классы оксидов',
    grades: [8, 9],
    keywords: ['оксиды', 'кислотный оксид', 'основный оксид', 'амфотерный оксид', 'oxide classes'],
    ru: `**Основные** (Na₂O, CaO) — с водой → щёлочь/основание; с кислотами → соль.
**Кислотные** (SO₂, CO₂, P₂O₅) — с водой → кислота; со щелочами → соль.
**Амфотерные** (ZnO, Al₂O₃) — и с кислотами, и со щелочами.
**Несолеобразующие** (CO, NO) — не дают солей типичным путём.`,
    en: `Basic / acidic / amphoteric / non-salt-forming oxides — different reaction patterns.`,
  },
  {
    id: 'inorg-acids-bases-salts',
    topic: 'Кислоты, основания, соли — связи классов',
    grades: [8, 9],
    keywords: ['кислота основание соль', 'нейтрализация', 'классы неорганики', 'acid base salt'],
    ru: `Кислота + основание → соль + вода (нейтрализация).
Кислота + основный оксид → соль + вода.
Основание + кислотный оксид → соль + вода.
Кислота + металл (активный) → соль + H₂ (исключения: HNO₃, конц. H₂SO₄ — другие продукты).`,
    en: `Neutralization and oxide routes connect acids, bases, and salts.`,
  },
  {
    id: 'inorg-qualitative-ions',
    topic: 'Качественные реакции на ионы (школа)',
    grades: [8, 9, 10],
    keywords: [
      'качественная реакция', 'как обнаружить', 'хлорид серебро', 'сульфат барий', 'qualitative analysis',
    ],
    ru: `Частые школьные тесты:
• Cl⁻ + AgNO₃ → белый осадок AgCl (растворим в NH₃).
• SO₄²⁻ + BaCl₂ → белый BaSO₄ (не растворим в кислотах).
• CO₃²⁻ + кислота → CO₂ (муть извести).
• Fe³⁺ + SCN⁻ → кроваво-красный комплекс.
Всегда: наблюдение + ионное уравнение словами.`,
    en: `Classic tests: Cl⁻/Ag⁺, SO₄²⁻/Ba²⁺, CO₃²⁻/acid→CO₂, Fe³⁺/SCN⁻ red.`,
  },
  {
    id: 'inorg-ammonia-sulfuric',
    topic: 'Аммиак и серная кислота — промышленные якоря',
    grades: [9, 10, 11],
    keywords: ['аммиак получение', 'серная кислота контактный', 'габер', 'contact process', 'haber'],
    ru: `**NH₃ (Габер):** N₂ + 3H₂ ⇌ 2NH₃ + Q; катализатор Fe; давление↑, t компромисс.
**H₂SO₄ (контактный):** SO₂ → SO₃ (V₂O₅), затем олеум/поглощение — не лей воду в конц. кислоту!
Оба процесса — классика Ле Шателье + катализ.`,
    en: `Haber NH₃ and Contact H₂SO₄ — equilibrium + catalysis industry classics.`,
  },
  {
    id: 'inorg-carbonates-co2',
    topic: 'Карбонаты и CO₂',
    grades: [7, 8, 9],
    keywords: ['карбонат', 'углекислый газ', 'co2 известь', 'мрамор кислота', 'carbon dioxide'],
    ru: `Карбонаты + кислота → соль + H₂O + CO₂↑.
CO₂ тяжелее воздуха, не поддерживает горение; с известковой водой — помутнение (CaCO₃), при избытке CO₂ — просветление (гидрокарбонат).
Мрамор/мел — CaCO₃.`,
    en: `Carbonate + acid → CO₂. Limewater milky then clears with excess CO₂.`,
  },
]
