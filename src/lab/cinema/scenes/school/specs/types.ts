/**
 * ATOMLAB — научная спецификация школьной сцены (7 класс, Kimyo 7; строение атома — Kimyo 8).
 *
 * Спецификация — ДАННЫЕ без three и React: что за реакция (по учебнику, со страницей), какие атомы,
 * какие связи рвутся и образуются, какая получается частица (пары, неспаренные электроны, форма, угол),
 * что говорит учебник о валентности и как на самом деле, что наблюдают в опыте, шесть шагов сцены
 * и тексты RU/EN/UZ. Движок школьной сцены (агент A, school/schoolSpec.ts) строит кадр из этих данных.
 *
 * Правила (проверяет scripts/test-school-specs.mts):
 *   • длины и углы НЕ хранятся числами — только ссылкой на научное ядро (src/chemistry/data/bondData.ts),
 *     число подставляет resolve*() из ./core;
 *   • в каждой частице: валентные электроны атомов − заряд = 2·(общие пары) + 2·(неподелённые пары)
 *     + неспаренные (+ обобществлённые в металле); у атомов 2-го периода не больше 8 электронов;
 *   • формальные заряды атомов сходятся с подсчётом электронов;
 *   • каждое число в текстах есть в ядре (или в условиях реакции со ссылкой на учебник),
 *     наборы чисел RU / EN / UZ совпадают по полям.
 *
 * Формат согласован с описанием задачи A настолько, насколько оно известно; ведущий сводит типы.
 */
import type { AngleKey, BondKey, ElementSymbol, ReagentGeometryKey } from '../../../../../chemistry/data'

export type SchoolLocale = 'ru' | 'en' | 'uz'
export const SCHOOL_LOCALES: readonly SchoolLocale[] = ['ru', 'en', 'uz']

/** Строка на трёх языках. */
export type L10n = Readonly<Record<SchoolLocale, string>>

/** Сцены «образование молекулы» (первые 10 веществ каталога 7 класса, движок SchoolReactionScene). */
export type MoleculeSchoolSpecId = 'h2o' | 'co2' | 'nacl' | 'co' | 'so2' | 'so3' | 'no' | 'no2' | 'n2o' | 'n2o5'

/** Сцены «обмен в растворе» (движок school/solution, спецификация SolutionScienceSpec). */
export type SolutionSchoolSpecId = 'baso4'

export type SchoolSpecId = MoleculeSchoolSpecId | SolutionSchoolSpecId

/** Порядок — порядок каталога 7 класса (catalogRank.json). */
export const SCHOOL_SPEC_IDS: readonly MoleculeSchoolSpecId[] = ['h2o', 'co2', 'nacl', 'co', 'so2', 'so3', 'no', 'no2', 'n2o', 'n2o5']

// ─────────────────────────────────────────────────────────────────────────────
// Источники
// ─────────────────────────────────────────────────────────────────────────────

/** Ссылка на учебник Kimyo (рус. изд.): класс, страницы, параграф/тема. */
export type TextbookRef = {
  readonly grade: 7 | 8 | 9
  /** Страницы печатного учебника (совпадают с номерами страниц PDF). */
  readonly pages: readonly number[]
  /** «§ 4.5» (7 кл.: глава.тема) или «§ 38» (8–9 кл.). */
  readonly section: string
  /** Название темы по учебнику. */
  readonly title: string
  /** Что именно там написано (RU, для ведущего и проверки). */
  readonly what: string
  /** Запись в учебнике дословно, если она отличается от сцены. */
  readonly asInBook?: string
}

/** Справочный источник вне учебника (CRC, NIST, Greenwood & Earnshaw…). */
export type ReferenceSource = { readonly reference: string }

export type SchoolSource = TextbookRef | ReferenceSource

export const isTextbookRef = (s: SchoolSource): s is TextbookRef => (s as TextbookRef).grade != null

// ─────────────────────────────────────────────────────────────────────────────
// Реакция
// ─────────────────────────────────────────────────────────────────────────────

export type Phase = 'г' | 'ж' | 'тв' | 'р-р'

export type ReactionTerm = {
  /** Формула с юникод-индексами: 'O₂', 'NH₄NO₃'. */
  readonly formula: string
  readonly coef: number
  readonly phase: Phase
  /** id частицы из SchoolScienceSpec.particles */
  readonly particle: string
}

export type ReactionConditions = {
  readonly heating: boolean
  /** Числовая температура из учебника (°C) — только со ссылкой. */
  readonly temperatureC?: number
  readonly temperatureSource?: TextbookRef
  readonly catalyst?: string
  /** Электрический (грозовой) разряд. */
  readonly electricDischarge?: boolean
  /** Горение при недостатке / избытке кислорода. */
  readonly oxygen?: 'lack' | 'excess'
  /** Условия словами для панели. */
  readonly text: L10n
}

export type ReactionKind = 'combination' | 'decomposition' | 'combustion' | 'exchange'

export type SchoolReaction = {
  /** Уравнение сцены: '2C + O₂ → 2CO' (стрелка ⇄ — обратимая). */
  readonly equation: string
  readonly reactants: readonly ReactionTerm[]
  readonly products: readonly ReactionTerm[]
  readonly reversible: boolean
  readonly kind: ReactionKind
  /** Реакция банка лаборатории (balanceLessonBank / schoolReactions), если есть. */
  readonly bankId: string | null
  /** Где в учебниках; ПЕРВАЯ ссылка — главная (по ней сцена). */
  readonly sources: readonly TextbookRef[]
  readonly conditions: ReactionConditions
  /** Тепловой эффект — только словами (без чисел в сцене). */
  readonly heat: 'exo' | 'endo' | null
  readonly heatSource?: SchoolSource
}

// ─────────────────────────────────────────────────────────────────────────────
// Атомы
// ─────────────────────────────────────────────────────────────────────────────

export type AtomSpec = {
  readonly element: ElementSymbol
  /** Заряд ядра (= порядковый номер, ATOMIC_DATA.z). */
  readonly z: number
  /** Схема слоёв (electronLevels.atomLevels): C → [2, 4]. */
  readonly levels: readonly number[]
  /** Электронов на внешнем слое. */
  readonly outer: number
  /** Неспаренных электронов в ОСНОВНОМ состоянии (по правилу Хунда). */
  readonly unpaired: number
  /** Внешние подуровни основного состояния (Kimyo 8, § 11): '2s² 2p²'. */
  readonly config: string
  /** Возбуждённое состояние, если школа им объясняет валентность (C: 2s¹2p³ — 4 неспаренных). */
  readonly excited?: {
    readonly config: string
    readonly unpaired: number
    readonly source: SchoolSource
    readonly why: L10n
  }
  /** Валентности элемента по таблице учебника (7 кл. с. 52). */
  readonly schoolValences: readonly number[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Частицы: связи, пары, форма
// ─────────────────────────────────────────────────────────────────────────────

/** Откуда длина связи: ключ BOND_DATA, запись REAGENT_GEOMETRY или кристалл CRYSTAL_DATA. */
export type LengthRef =
  | { readonly bond: BondKey }
  | { readonly reagent: ReagentGeometryKey; readonly name: string }
  | { readonly crystal: 'nacl' | 'graphite' | 'na_metal' | 'barite' }

/** Откуда угол: ключ BOND_ANGLES или запись REAGENT_GEOMETRY. */
export type AngleRef = { readonly angle: AngleKey } | { readonly reagent: ReagentGeometryKey; readonly name: string }

export type BondSpec = {
  /** id атомов частицы */
  readonly a: string
  readonly b: string
  /** Сколько общих электронных пар рисуем (1 — «–», 2 — «=», 3 — «≡»). */
  readonly pairs: 1 | 2 | 3
  /** Из них донорно-акцепторная: пара целиком от атома donor (Kimyo 8, с. 69–70). */
  readonly dative?: { readonly donor: string }
  /**
   * Порядок связи на самом деле, если он дробный (резонанс, МО): NO — 2½, NO₂ — 1½.
   * Рисуем pairs (показанная структура), честно оговариваем realOrder.
   */
  readonly realOrder?: number
  /** Связь между разными атомами — полярная; одинаковыми — неполярная. */
  readonly polar: boolean
  readonly length: LengthRef
}

export type AtomInParticle = {
  readonly id: string
  readonly element: ElementSymbol
  /**
   * Формальный заряд (молекула) или заряд иона (кристалл). 0 — не пишем. Формальные заряды молекул
   * (C⁻≡O⁺, N≡N⁺–O⁻) в 7 классе НЕ рисуются — это данные для проверки и для пояснений старших классов;
   * заряды ионов (Na⁺, Cl⁻) рисуются.
   */
  readonly charge?: number
}

export type ParticleKind =
  /** отдельная молекула */
  | 'molecule'
  /** один атом, взятый из простого вещества немолекулярного строения (графит, сера S₈) — схема */
  | 'atom-sample'
  /** металл: атомы в решётке, внешние электроны обобществлены */
  | 'metal'
  /** ионный кристалл */
  | 'ionic-crystal'
  /** ион в растворе, окружённый молекулами воды (Ba²⁺, Cl⁻, SO₄²⁻, H₃O⁺) */
  | 'ion'
  /** осадок — ионный кристалл, выпадающий из раствора (BaSO₄↓) */
  | 'precipitate'

export type ParticleShape =
  | 'atom'
  | 'diatomic'
  | 'linear'
  | 'bent'
  | 'trigonal-planar'
  | 'planar'
  | 'propeller'
  | 'lattice'
  | 'ions'
  /** правильный тетраэдр (SO₄²⁻) */
  | 'tetrahedral'
  /** тригональная пирамида (H₃O⁺) */
  | 'pyramidal'

export type ParticleSpec = {
  readonly id: string
  readonly formula: string
  readonly name: L10n
  readonly role: 'reactant' | 'product' | 'catalyst'
  readonly phase: Phase
  readonly kind: ParticleKind
  readonly atoms: readonly AtomInParticle[]
  /** Связи ПОКАЗАННОЙ структуры (для резонанса — одна из предельных, см. resonance). */
  readonly bonds: readonly BondSpec[]
  /** Неподелённые пары по id атома (нет ключа — 0). */
  readonly lonePairs: Readonly<Record<string, number>>
  /** Неспаренные электроны по id атома (радикалы NO, NO₂; атом C / S из твёрдого вещества). */
  readonly unpaired: Readonly<Record<string, number>>
  /** Обобществлённые электроны металла на атом (Na — 1). */
  readonly delocalized?: Readonly<Record<string, number>>
  /** Суммарный заряд частицы (молекула — 0). */
  readonly charge: number
  readonly shape: ParticleShape
  readonly angles?: readonly { readonly atoms: readonly [string, string, string]; readonly ref: AngleRef }[]
  /** Ключ DIPOLE_MOMENTS, если есть. */
  readonly dipoleKey?: string
  readonly polarity: 'polar' | 'nonpolar' | 'ionic' | 'metallic'
  /** Резонанс: какую структуру показываем школьнику и как честно оговорить. */
  readonly resonance?: { readonly show: L10n; readonly real: L10n }
  /** Схема вместо реального строения (атом из графита и т. п.) — как это назвать. */
  readonly schematic?: L10n
}

// ─────────────────────────────────────────────────────────────────────────────
// Механизм сцены
// ─────────────────────────────────────────────────────────────────────────────

export type BondEvent = {
  /** id частицы и её атомов */
  readonly particle: string
  readonly a: string
  readonly b: string
  readonly why: L10n
}

export type SchoolMechanism = {
  /** Связи исходных частиц, которые рвутся. */
  readonly breaks: readonly BondEvent[]
  /** Связи итоговых частиц, которые образуются (частица — продукт). */
  readonly forms: readonly (BondEvent & {
    /** shared-pair — пары из неспаренных электронов обоих; dative — только донорно-акцепторная; shared+dative — обе (C≡O) */
    readonly how: 'shared-pair' | 'dative' | 'shared+dative'
  })[]
  /** Связи, которые переходят в продукт без разрыва (SO₂ → SO₃, NO → NO₂). */
  readonly kept?: readonly BondEvent[]
  /** Ионная связь: переход электронов (сколько от каждого атома). */
  readonly electronTransfer?: { readonly from: ElementSymbol; readonly to: ElementSymbol; readonly perAtom: number }
  /**
   * Как разложить электроны атома реагента ПЕРЕД образованием связей, если не так, как в основном
   * состоянии (как SchoolSceneSpec.splitElectrons движка A): C в CO₂ — 4 неспаренных (возбуждение);
   * S в SO₂ — пара + 4 неспаренных; атом O — акцептор донорно-акцепторной пары — 3 пары, 0 неспаренных.
   * 2·lone + unpaired = электроны внешнего слоя (тест).
   */
  readonly splitElectrons?: readonly {
    /** id частицы-реагента и её атома */
    readonly particle: string
    readonly atom: string
    readonly lone: number
    readonly unpaired: number
    readonly why: L10n
  }[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Валентность: учебник и «как на самом деле»
// ─────────────────────────────────────────────────────────────────────────────

export type ValenceVerdict =
  /** школьная валентность = числу общих пар атома */
  | 'match'
  /** школьная валентность получена по формуле и с числом связей не совпадает */
  | 'formal'
  /** в ионном веществе валентность = заряд иона */
  | 'ionic'

export type ValenceSpec = {
  /** Частица, к которой относится (обычно — вещество каталога). */
  readonly particle: string
  /** Валентность по учебнику 7 класса (по формуле / по таблице). */
  readonly school: Readonly<Partial<Record<ElementSymbol, number>>>
  readonly schoolSource: TextbookRef
  /** Степени окисления (8 кл.) — для честного сравнения. */
  readonly oxidation: Readonly<Partial<Record<ElementSymbol, number>>>
  readonly verdict: Readonly<Partial<Record<ElementSymbol, ValenceVerdict>>>
  readonly explain: L10n
}

// ─────────────────────────────────────────────────────────────────────────────
// Шаги и тексты
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Шесть шагов школьного стандарта (docs/plans/g7-first10-school-scenes.md). Имена — как у движка
 * школьной сцены (агент A, school/schoolSpec.ts): reactants → atoms → breaking → pairs → molecule → result.
 */
export const SCHOOL_STEP_IDS = ['reactants', 'atoms', 'breaking', 'pairs', 'molecule', 'result'] as const
export type SchoolStepId = (typeof SCHOOL_STEP_IDS)[number]

export type SchoolStepText = {
  readonly title: string
  /** 2–4 предложения для панели */
  readonly body: string
  /** уравнение / схема стадии */
  readonly equation: string
  /** честная пометка о схематичности */
  readonly note: string
  /** реплика учителя */
  readonly speak: string
}

export type SchoolStepSpec = {
  readonly id: SchoolStepId
  /** Уровень материала: 7 — учебник 7 класса, 8 — строение атома / виды связи из 8 класса. */
  readonly level: 7 | 8 | 9
  /** Рекомендуемая длительность шага, с (4–7). */
  readonly seconds: number
  /** Что показать на шаге (RU, для движка сцены). */
  readonly show: readonly string[]
  /** Откуда материал шага (строение атома — Kimyo 8 и т. п.). */
  readonly sources?: readonly SchoolSource[]
  readonly text: Readonly<Record<SchoolLocale, SchoolStepText>>
}

export type Observation = { readonly text: L10n; readonly source: SchoolSource }

export type CaveatKind =
  /** учебник упрощает — сцена показывает точнее и объясняет */
  | 'textbook-simplification'
  /** в учебнике ошибка / опечатка */
  | 'textbook-error'
  /** сцена сама упрощает (один атом вместо кристалла и т. п.) */
  | 'scene-simplification'
  /** ограничение школьной модели (Льюис, валентность) */
  | 'model-limit'

export type Caveat = {
  readonly id: string
  readonly kind: CaveatKind
  /** Где это сказано в учебнике (или что упрощено). */
  readonly source?: SchoolSource
  /** Чем подтверждается поправка (справочник, другой учебник). Числа оговорки берутся из source / evidence / ядра. */
  readonly evidence?: SchoolSource
  readonly text: L10n
}

export type SchoolScienceSpec = {
  readonly id: SchoolSpecId
  /** Вещество каталога 7 класса (формула с индексами). */
  readonly substance: string
  /** id частицы вещества каталога в particles (у N₂O₅ это реагент). */
  readonly focus: string
  readonly name: L10n
  readonly bondType: 'covalent-polar' | 'ionic'
  readonly reaction: SchoolReaction
  readonly atoms: readonly AtomSpec[]
  readonly particles: readonly ParticleSpec[]
  readonly mechanism: SchoolMechanism
  readonly valence: ValenceSpec
  readonly observations: readonly Observation[]
  readonly uses: readonly Observation[]
  readonly intro: { readonly title: L10n; readonly speak: L10n }
  readonly safety: L10n
  /** Легенда значков (как SchoolLessonText.legend движка). */
  readonly legend: {
    readonly electron: L10n
    readonly sharedPair: L10n
    readonly lonePair: L10n
    readonly unpaired: L10n
  }
  /** Короткие 3D-подписи (как SchoolSceneSpec.captions движка A). */
  readonly captions: {
    /** над реагентами на шаге reactants */
    readonly reactants: L10n
    /** над продуктами на шаге result */
    readonly result: L10n
    /** условие над стрелкой: «t°», «кат. V₂O₅», «молния» */
    readonly condition?: L10n
  }
  readonly steps: readonly SchoolStepSpec[]
  readonly caveats: readonly Caveat[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Обмен в растворе (BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl): свои шаги и свой вид реакции
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Шесть шагов сцены «обмен в растворе» (движок school/solution):
 *   tubes   — что видно в пробирке (7 кл.): два бесцветных раствора, сливают — белая муть;
 *   ions    — из чего состоят растворы: ионы в воде (9 кл. простыми словами);
 *   meet    — ионы находят друг друга: притяжение Ba²⁺ и SO₄²⁻, H₃O⁺ и Cl⁻ остаются в растворе (8 кл.);
 *   nucleus — растёт кристаллик барита (8 кл.);
 *   settle  — осадок на дне и соляная кислота над ним (8 кл.);
 *   result  — итог: уравнение обмена и сокращённое ионное (7 кл. + пометка 9 кл.).
 */
export const SOLUTION_STEP_IDS = ['tubes', 'ions', 'meet', 'nucleus', 'settle', 'result'] as const
export type SolutionStepId = (typeof SOLUTION_STEP_IDS)[number]

export type SolutionStepSpec = {
  readonly id: SolutionStepId
  /** Уровень материала шага: 7, 8 или 9 класс. */
  readonly level: 7 | 8 | 9
  /** Рекомендуемая длительность шага, с (4–7). */
  readonly seconds: number
  readonly show: readonly string[]
  readonly sources?: readonly SchoolSource[]
  readonly text: Readonly<Record<SchoolLocale, SchoolStepText>>
}

/**
 * Член уравнения в растворе: формула + water · H₂O = частицы раствора (ионы) или осадок.
 * H₂SO₄ + 2H₂O → 2H₃O⁺ + SO₄²⁻ (water 2); HCl + H₂O → H₃O⁺ + Cl⁻ (water 1); BaCl₂ → Ba²⁺ + 2Cl⁻.
 */
export type SolutionTerm = {
  readonly formula: string
  readonly coef: number
  readonly phase: Phase
  /** Стрелка у осадка (↓) — как в учебнике. */
  readonly precipitate?: boolean
  readonly particles: readonly { readonly particle: string; readonly count: number }[]
  /** Сколько молекул воды входит в частицы (протон на молекуле воды — H₃O⁺). */
  readonly water?: number
}

export type SolutionReaction = {
  /** Уравнение учебника со стрелкой осадка: 'BaCl₂ + H₂SO₄ → BaSO₄↓ + 2HCl'. */
  readonly equation: string
  readonly reactants: readonly SolutionTerm[]
  readonly products: readonly SolutionTerm[]
  /** Полное и сокращённое ионные уравнения (9 кл., § 6). */
  readonly ionicFull: string
  readonly ionicShort: string
  readonly kind: 'exchange'
  readonly bankId: string
  /** Где в учебниках; ПЕРВАЯ ссылка — главная (по ней сцена). */
  readonly sources: readonly TextbookRef[]
  readonly conditions: ReactionConditions
  /** Тепловой эффект — только словами; у этой реакции он незаметен (числа не показываются). */
  readonly heat: 'exo' | 'endo' | null
  readonly heatSource?: SchoolSource
}

/** Число из справочника или расчёта, которое встречается в текстах (сверяет тест). */
export type SolutionFact = {
  readonly id: string
  readonly value: number
  /** что это (RU, для ведущего) */
  readonly what: string
  readonly source: SchoolSource
}

export type SolutionScienceSpec = {
  readonly id: SolutionSchoolSpecId
  readonly substance: string
  /** id частицы вещества каталога (осадок) */
  readonly focus: string
  readonly name: L10n
  readonly bondType: 'ionic'
  readonly reaction: SolutionReaction
  readonly particles: readonly ParticleSpec[]
  /** Гидратная оболочка: сколько молекул воды на самом деле и сколько в кадре; чем ион обращён к воде. */
  readonly hydration: readonly {
    readonly particle: string
    readonly realCount: number
    readonly shown: number
    /** 'O' — к катиону обращён кислород воды, 'H' — к аниону водород */
    readonly facing: 'O' | 'H'
    readonly source: SchoolSource
  }[]
  readonly facts: readonly SolutionFact[]
  readonly observations: readonly Observation[]
  readonly uses: readonly Observation[]
  readonly intro: { readonly title: L10n; readonly speak: L10n }
  readonly safety: L10n
  readonly legend: {
    /** шар с символом — ион, заряд подписан */
    readonly ion: L10n
    /** серая палочка — связь внутри частицы */
    readonly sharedPair: L10n
    /** молекулы воды вокруг ионов */
    readonly water: L10n
    /** белый осадок / кристаллик */
    readonly precipitate: L10n
  }
  readonly captions: {
    readonly tubeA: L10n
    readonly tubeB: L10n
    readonly solutionA: L10n
    readonly solutionB: L10n
    readonly crystal: L10n
    readonly neighbors: L10n
    readonly precipitate: L10n
    readonly acid: L10n
    readonly nitric: L10n
    /** выноска микромира при первом появлении H₃O⁺ (строки — через '\n') */
    readonly hydronium: L10n
    /** подпись к линиям притяжения пары катион — анион-группа */
    readonly attract: L10n
    /** наблюдатели встречаются, но не соединяются */
    readonly spectators: L10n
    /** итог: сверка атомов слева и справа */
    readonly balance: L10n
  }
  readonly steps: readonly SolutionStepSpec[]
  readonly caveats: readonly Caveat[]
}
