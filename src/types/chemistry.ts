export type Vec3 = readonly [number, number, number]

export interface Atom3D {
  symbol: string
  pos: Vec3
}

/** Категория для каталога и оформления. */
export type CompoundCategory = 'oxide' | 'acid' | 'base' | 'salt' | 'other'

/** Условия для учебного реактора (лаборатория): что нужно «включить» перед синтезом. */
export interface SynthesisLabConditions {
  needsHeat?: boolean
  needsPressure?: boolean
  needsCatalyst?: boolean
}

/** Текстовое описание условий синтеза для карточки каталога (T, p, катализатор, оборудование). */
export interface SynthesisConditionsTextRu {
  temperature?: string
  pressure?: string
  catalyst?: string
  /** Посуда / вытяжка / электролизёр и т.п. */
  equipment?: string
}

/** Один этап школьного/промышленного получения вещества. */
export interface ObtainingStepRu {
  /** Номер шага (1, 2, …) */
  step: number
  /** Уравнение или ключевая операция */
  equation: string
  /** Краткая ремарка к шагу (условия, наблюдение) */
  note?: string
}

export interface CompoundDef {
  id: string
  nameRu: string
  formulaUnicode: string
  composition: Record<string, number>
  atoms: Atom3D[]
  bonds: readonly (readonly [number, number])[]
  accentColor: string
  descriptionRu: string
  /**
   * Текст получения для карточки: одно уравнение или нумерованные этапы
   * (① … ② …). H₂/O₂/N₂ — молекулы простых веществ.
   */
  laboratoryRecipeRu: string
  /** Структурированные этапы получения (для UI «по шагам»). */
  obtainingStepsRu: readonly ObtainingStepRu[]
  category: CompoundCategory
  /** Опционально: для панели «Реактор» — обязательные условия перед запуском. */
  synthesisLab?: SynthesisLabConditions
  /**
   * Условия синтеза для каталога (температура, давление, катализатор, оборудование).
   * Если не задано в сырье — в `finalizeCompound` подставляются шаблоны по `synthesisLab` и категории.
   */
  synthesisConditionsRu: SynthesisConditionsTextRu
  /**
   * Дополнительная информация: добыча/происхождение, применение, важность.
   * Генерируется в `finalizeCompound` из `compoundFacts.ts`.
   */
  factsRu: CompoundFactsRu
}

/** Дополнительные сведения о веществе для карточки каталога. */
export interface CompoundFactsRu {
  /** Откуда добывают / как получают в природе и промышленности */
  source: string
  /** Где и как применяется */
  usage: string
  /** Почему важно / интересный факт */
  importance: string
}

/** Запись до подстановки цепочки атомов и цвета по категории (если нет). */
export type RawCompoundDef = Omit<
  CompoundDef,
  'atoms' | 'bonds' | 'accentColor' | 'laboratoryRecipeRu' | 'synthesisConditionsRu' | 'obtainingStepsRu' | 'factsRu'
> & {
  atoms?: Atom3D[]
  bonds?: readonly (readonly [number, number])[]
  accentColor?: string
  /** Если нет — в `finalizeCompound` короткая схема `nA + mB = формула` */
  laboratoryRecipeRu?: string
  obtainingStepsRu?: readonly ObtainingStepRu[]
  /** Если не задано — в `finalizeCompound` генерируется из `synthesisLab` и категории. */
  synthesisConditionsRu?: SynthesisConditionsTextRu
  /** Кураторские факты; если нет — шаблон по категории/типу вещества. */
  factsRu?: CompoundFactsRu
}

export type LabParticle =
  | {
      id: string
      type: 'atom'
      z: number
      symbol: string
      color: string
      position: Vec3
    }
  | {
      id: string
      type: 'molecule'
      compoundId: string
      position: Vec3
    }

export interface ElementViewModel {
  z: number
  symbol: string
  nameRu: string
  atomicMass: number
  cpkHex: string
  gridX: number
  gridY: number
  groupBlock: string
  oxidationStates: string
  electronConfiguration: string
  /** English label from IUPAC-style data (e.g. Gas, Solid) */
  standardState: string
  electronegativity?: number | null
  atomicRadius?: number | null
  ionizationEnergy?: number | null
  electronAffinity?: number | null
  meltingPoint?: number | null
  boilingPoint?: number | null
  density?: number | null
  yearDiscovered?: string | null
}
